"""
Gemini Vision Reasoning Service
Implementation of VisionReasoningProvider using Google's Gemini Vision API.
Serves as an asynchronous secondary reasoning and advisory verification layer.
Enforces request cooldowns, rate quotas, timeouts, retries, and graceful offline fallback.
"""

import asyncio
import base64
import json
import time
import cv2
import httpx
import numpy as np
from typing import Dict, Any, Optional, List
from collections import deque

from backend.app.services.vision_provider import VisionReasoningProvider, VisionAnalysisResult
from backend.app.services.secrets_vault import secrets_vault

GEMINI_API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"

class GeminiVisionProvider(VisionReasoningProvider):
    """Production secondary reasoning provider for Google Gemini."""

    def __init__(self):
        self.enabled = True
        self.default_model = "gemini-2.0-flash"
        self.timeout_seconds = 8.0
        self.max_retries = 1
        self.cooldown_seconds = 15.0
        self.max_requests_per_hour = 30
        
        # Rate-limiting tracking
        self._camera_last_call = {}  # camera_id -> timestamp
        self._call_history = deque()  # timestamps of recent calls in last hour
        self._lock = asyncio.Lock()

    def get_configured_model(self) -> str:
        try:
            from backend.app.database.session import SessionLocal
            from backend.app.database.models import SystemConfigDB
            db = SessionLocal()
            try:
                cfg = db.query(SystemConfigDB).filter(SystemConfigDB.key == "gemini_model").first()
                if cfg and cfg.value:
                    return cfg.value.strip()
            finally:
                db.close()
        except Exception:
            pass
        return self.default_model

    def is_enabled(self) -> bool:
        try:
            from backend.app.database.session import SessionLocal
            from backend.app.database.models import SystemConfigDB
            db = SessionLocal()
            try:
                cfg = db.query(SystemConfigDB).filter(SystemConfigDB.key == "gemini_enabled").first()
                if cfg and cfg.value:
                    return cfg.value.lower() in ["true", "1", "yes"]
            finally:
                db.close()
        except Exception:
            pass
        return self.enabled

    def check_rate_limits(self, camera_id: str) -> tuple[bool, str]:
        """Check if request is allowed under cooldown and hourly quota."""
        now = time.time()
        
        # Purge calls older than 1 hour (3600s)
        while self._call_history and self._call_history[0] < now - 3600:
            self._call_history.popleft()

        # Check hourly cap
        if len(self._call_history) >= self.max_requests_per_hour:
            return False, f"Hourly rate limit reached ({self.max_requests_per_hour} requests/hr)"

        # Check per-camera cooldown
        last = self._camera_last_call.get(camera_id, 0)
        if now - last < self.cooldown_seconds:
            wait_time = int(self.cooldown_seconds - (now - last))
            return False, f"Camera cooling down ({wait_time}s remaining)"

        return True, "OK"

    def record_call(self, camera_id: str):
        now = time.time()
        self._camera_last_call[camera_id] = now
        self._call_history.append(now)

    async def test_connection(self, api_key: Optional[str] = None, model: Optional[str] = None) -> Dict[str, Any]:
        """Test API key validity and model connectivity."""
        key = (api_key or secrets_vault.get_gemini_api_key() or "").strip()
        if not key:
            return {"success": False, "message": "No API key configured.", "status": "UNCONFIGURED"}

        target_model = (model or self.get_configured_model()).strip()
        url = f"{GEMINI_API_ENDPOINT}/{target_model}?key={key}"

        start_t = time.time()
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(url)
                latency = round((time.time() - start_t) * 1000, 1)
                
                if res.status_code == 200:
                    data = res.json()
                    display_name = data.get("displayName", target_model)
                    return {
                        "success": True,
                        "message": f"Connected to {display_name} successfully ({latency}ms).",
                        "status": "READY",
                        "model": target_model,
                        "latency_ms": latency
                    }
                elif res.status_code == 400 or res.status_code == 403:
                    return {
                        "success": False,
                        "message": "Invalid API key or model access denied.",
                        "status": "AUTH_ERROR",
                        "status_code": res.status_code
                    }
                elif res.status_code == 404:
                    return {
                        "success": False,
                        "message": f"Model '{target_model}' not found. Please verify model name.",
                        "status": "NOT_FOUND"
                    }
                else:
                    return {
                        "success": False,
                        "message": f"Upstream error {res.status_code}: {res.text[:100]}",
                        "status": "ERROR"
                    }
        except httpx.TimeoutException:
            return {"success": False, "message": "Connection timed out (upstream unreachable).", "status": "TIMEOUT"}
        except Exception as e:
            return {"success": False, "message": f"Network error: {str(e)}", "status": "OFFLINE"}

    async def analyze_frame(
        self, 
        frame_bgr: np.ndarray, 
        event_context: Dict[str, Any]
    ) -> VisionAnalysisResult:
        """Asynchronously consult Gemini for secondary reasoning."""
        model = self.get_configured_model()
        api_key = secrets_vault.get_gemini_api_key()

        if not self.is_enabled():
            return VisionAnalysisResult(
                status="DISABLED",
                model=model,
                error_message="Gemini Assisted Analysis is currently disabled by administrator."
            )

        if not api_key:
            return VisionAnalysisResult(
                status="OFFLINE",
                model=model,
                error_message="Gemini API key unconfigured. Platform operating in LOCAL ONLY perception mode."
            )

        camera_id = event_context.get("camera_id", "unknown")
        allowed, reason = self.check_rate_limits(camera_id)
        if not allowed:
            return VisionAnalysisResult(
                status="RATE_LIMITED",
                model=model,
                error_message=reason
            )

        if frame_bgr is None or frame_bgr.size == 0:
            return VisionAnalysisResult(
                status="ERROR",
                model=model,
                error_message="Empty frame provided for analysis."
            )

        # Encode frame to JPEG
        ret, buf = cv2.imencode(".jpg", frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, 80])
        if not ret:
            return VisionAnalysisResult(status="ERROR", model=model, error_message="Frame encoding failed.")
        b64_image = base64.b64encode(buf).decode("utf-8")

        prompt = (
            "You are a military-grade Border Surveillance AI Advisory Assistant for IBVAP.\n"
            "Examine this surveillance snapshot and provide a structured operational assessment.\n"
            f"Context from Local AI: Event: {event_context.get('event_type')}, Severity: {event_context.get('severity')}, "
            f"Class: {event_context.get('class_name')}, Local Risk: {event_context.get('risk_score')}/100, Behaviour: {event_context.get('behaviour')}.\n\n"
            "Respond in JSON format with exactly these keys:\n"
            "{\n"
            '  "situational_assessment": "1-2 concise sentences describing what is occurring in the frame",\n'
            '  "ambiguity_explanation": "Explain any visual ambiguities, lighting challenges, or object occlusions",\n'
            '  "confidence_assessment": "High" | "Moderate" | "Low",\n'
            '  "recommended_operator_response": "Clear standard operating procedure recommendation (e.g. dispatch patrol, maintain visual track, disregard wildlife)",\n'
            '  "threat_indicators": ["list", "of", "threats", "or", "hazards"]\n'
            "}"
        )

        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": b64_image
                        }
                    }
                ]
            }],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 450,
                "responseMimeType": "application/json"
            }
        }

        url = f"{GEMINI_API_ENDPOINT}/{model}:generateContent?key={api_key}"
        start_time = time.time()

        for attempt in range(self.max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                    res = await client.post(url, json=payload)
                    latency = (time.time() - start_time) * 1000

                    if res.status_code == 200:
                        self.record_call(camera_id)
                        resp_json = res.json()
                        text_resp = ""
                        try:
                            text_resp = resp_json["candidates"][0]["content"]["parts"][0]["text"]
                            parsed = json.loads(text_resp)
                        except Exception:
                            parsed = {
                                "situational_assessment": text_resp.strip() or "Analysis complete.",
                                "ambiguity_explanation": "Visual assessment derived without schema error.",
                                "confidence_assessment": "Moderate",
                                "recommended_operator_response": "Verify sector feed manually.",
                                "threat_indicators": []
                            }

                        return VisionAnalysisResult(
                            status="COMPLETED",
                            model=model,
                            situational_assessment=parsed.get("situational_assessment", "Scene analyzed."),
                            ambiguity_explanation=parsed.get("ambiguity_explanation", "No major ambiguities detected."),
                            confidence_assessment=parsed.get("confidence_assessment", "Moderate"),
                            recommended_operator_response=parsed.get("recommended_operator_response", "Continue monitoring."),
                            threat_indicators=parsed.get("threat_indicators", []),
                            latency_ms=latency
                        )
                    elif res.status_code in [429, 503] and attempt < self.max_retries:
                        await asyncio.sleep(1.5)
                        continue
                    else:
                        return VisionAnalysisResult(
                            status="ERROR",
                            model=model,
                            error_message=f"Gemini API returned {res.status_code}: {res.text[:120]}",
                            latency_ms=(time.time() - start_time) * 1000
                        )
            except httpx.TimeoutException:
                if attempt < self.max_retries:
                    await asyncio.sleep(1.0)
                    continue
                return VisionAnalysisResult(
                    status="TIMEOUT",
                    model=model,
                    error_message="Gemini advisory reasoning timed out (exceeded 8.0s limit).",
                    latency_ms=(time.time() - start_time) * 1000
                )
            except Exception as e:
                return VisionAnalysisResult(
                    status="OFFLINE",
                    model=model,
                    error_message=f"Network error communicating with Gemini: {str(e)}",
                    latency_ms=(time.time() - start_time) * 1000
                )

        return VisionAnalysisResult(status="OFFLINE", model=model, error_message="Gemini service unavailable.")

    def analyze_incident_sync(
        self, 
        event_id: str, 
        frame_bgr: np.ndarray, 
        camera_id: str, 
        event_data: dict, 
        callback=None
    ):
        """Synchronous wrapper to run async Gemini analysis in a background thread."""
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                context = {
                    "event_id": event_id,
                    "camera_id": camera_id,
                    "event_type": event_data.get("event_type", "INTRUSION_ENTRY"),
                    "severity": event_data.get("severity", "Medium"),
                    "class_name": event_data.get("class_name", "person"),
                    "risk_score": event_data.get("risk_score", 50),
                    "behaviour": event_data.get("behaviour", "Movement")
                }
                result = loop.run_until_complete(self.analyze_frame(frame_bgr, context))
            finally:
                loop.close()

            # Store result in EventDB
            from backend.app.database.session import SessionLocal
            from backend.app.database.models import EventDB
            db = SessionLocal()
            try:
                event = db.query(EventDB).filter(EventDB.event_id == event_id).first()
                if event:
                    event.gemini_analysis = json.dumps(result.to_dict())
                    event.gemini_status = result.status
                    db.commit()
            finally:
                db.close()

            # Notify UI via WebSocket
            if callback and result.status == "COMPLETED":
                callback({
                    "type": "GEMINI_ANALYSIS_COMPLETED",
                    "event_id": event_id,
                    "camera_id": camera_id,
                    "data": result.to_dict()
                })
        except Exception as e:
            print(f"[GeminiService] Background analysis failed for {event_id}: {e}")

gemini_service = GeminiVisionProvider()
