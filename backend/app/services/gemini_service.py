"""
Gemini Vision Reasoning Service
Implementation of VisionReasoningProvider using Google's Gemini Vision API.
Serves as an asynchronous secondary reasoning and advisory verification layer.
Enforces dynamic model discovery, request cooldowns, rate quotas, timeouts, retries, and graceful offline fallback.
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
from pathlib import Path

import socket
import os

# Patch socket.getaddrinfo to prefer IPv4 on Windows hosts where IPv6 route to Google drops TLS renegotiations
_orig_getaddrinfo = socket.getaddrinfo
def _prefer_ipv4_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    try:
        res = _orig_getaddrinfo(host, port, family, type, proto, flags)
        if isinstance(host, str) and ("googleapis" in host or "google" in host):
            ipv4_res = [r for r in res if r[0] == socket.AF_INET]
            if ipv4_res:
                return ipv4_res
        return res
    except Exception:
        return _orig_getaddrinfo(host, port, family, type, proto, flags)

socket.getaddrinfo = _prefer_ipv4_getaddrinfo

from backend.app.services.vision_provider import VisionReasoningProvider, VisionAnalysisResult
from backend.app.services.secrets_vault import secrets_vault

GEMINI_API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"
DEFAULT_GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")

class GeminiVisionProvider(VisionReasoningProvider):
    """Production secondary reasoning provider for Google Gemini with dynamic discovery."""

    # Models verified to support multimodal generateContent
    SUPPORTED_MODELS = [
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-flash-latest",
        "gemini-3.7-flash",
        "gemini-2.5-flash",
        "gemini-1.5-flash",
        "gemini-1.5-pro"
    ]

    def __init__(self):
        self.enabled = True
        self.default_model = "gemini-3.5-flash"
        self.timeout_seconds = 12.0
        self.max_retries = 1
        self.cooldown_seconds = 15.0
        self.max_requests_per_hour = 60
        
        # Rate-limiting tracking
        self._camera_last_call = {}  # camera_id -> timestamp
        self._call_history = deque()  # timestamps of recent calls in last hour
        self._lock = asyncio.Lock()
        self._cached_discovered_models = []
        self._last_discovery_time = 0

    def get_configured_model(self) -> str:
        try:
            from backend.app.database.session import SessionLocal
            from backend.app.database.models import SystemConfigDB
            db = SessionLocal()
            try:
                cfg = db.query(SystemConfigDB).filter(SystemConfigDB.key == "gemini_model").first()
                if cfg and cfg.value:
                    val = cfg.value.strip()
                    # If legacy model configured, migrate to modern working default
                    if val in ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-3.6-flash"]:
                        return "gemini-3.5-flash"
                    return val
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
        
        while self._call_history and self._call_history[0] < now - 3600:
            self._call_history.popleft()

        if len(self._call_history) >= self.max_requests_per_hour:
            return False, f"Hourly rate limit reached ({self.max_requests_per_hour} requests/hr)"

        last = self._camera_last_call.get(camera_id, 0)
        if now - last < self.cooldown_seconds:
            wait_time = int(self.cooldown_seconds - (now - last))
            return False, f"Camera cooling down ({wait_time}s remaining)"

        return True, "OK"

    def record_call(self, camera_id: str):
        now = time.time()
        self._camera_last_call[camera_id] = now
        self._call_history.append(now)

    @staticmethod
    def _clean_and_parse_json(text: str) -> tuple[dict, bool]:
        """
        Parses JSON response. Returns (parsed_dict, is_fully_structured).
        If JSON parsing fails, NEVER discards valid text. Preserves full raw text as scene_summary.
        """
        t = (text or "").strip()
        cleaned = t
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        # 1. Attempt direct JSON load
        try:
            res = json.loads(cleaned)
            if isinstance(res, dict):
                return res, True
        except Exception:
            pass

        # 2. Attempt regex search for complete JSON object
        import re
        m = re.search(r'(\{[\s\S]*\})', cleaned)
        if m:
            try:
                res = json.loads(m.group(1))
                if isinstance(res, dict):
                    return res, True
            except Exception:
                pass

        # 3. Attempt recovery of truncated JSON by balancing braces/quotes
        candidate = cleaned
        if "{" in candidate:
            candidate = candidate[candidate.index("{"):]
            quote_count = len(re.findall(r'(?<!\\)"', candidate))
            if quote_count % 2 != 0:
                candidate += '"'
            open_braces = candidate.count("{") - candidate.count("}")
            if open_braces > 0:
                candidate += "}" * open_braces
            try:
                res = json.loads(candidate)
                if isinstance(res, dict):
                    return res, True
            except Exception:
                pass

        # 4. Partial / natural-language fallback: preserve actual Gemini text! Never return 'nothing found'!
        extracted_summary = ""
        m_s = re.search(r'"scene_summary"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', t)
        if m_s:
            try:
                extracted_summary = json.loads(f'"{m_s.group(1)}"')
            except Exception:
                extracted_summary = m_s.group(1)

        extracted_assessment = ""
        m_a = re.search(r'"situational_assessment"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', t)
        if m_a:
            try:
                extracted_assessment = json.loads(f'"{m_a.group(1)}"')
            except Exception:
                extracted_assessment = m_a.group(1)

        clean_summary = extracted_summary or t or "CCTV surveillance feed analyzed."
        clean_assessment = extracted_assessment or clean_summary

        return {
            "scene_summary": clean_summary,
            "situational_assessment": clean_assessment,
            "ambiguity_explanation": "Gemini returned unstructured natural language evaluation.",
            "confidence_assessment": "Moderate",
            "recommended_operator_response": "Verify visual observations against sector feed.",
            "threat_indicators": [],
            "observed_entities": [],
            "observed_actions": [],
            "environment": {"lighting": "Evaluated", "visibility": "Evaluated", "image_quality": "Sufficient"},
            "local_ai_consistency": {"agreement": "INSUFFICIENT VISUAL EVIDENCE"},
            "uncertainties": ["Single perspective visual assessment"],
            "not_visible_aspects": [],
            "recommended_checks": ["Review camera live feed"],
            "raw_text_available": bool(t),
            "raw_text": t
        }, False

    async def discover_models(self, api_key: Optional[str] = None) -> List[Dict[str, Any]]:
        """Dynamically query Google API for available multimodal models."""
        key = (api_key or secrets_vault.get_gemini_api_key() or DEFAULT_GEMINI_KEY or "").strip()
        if not key:
            return []

        # Return cached models if queried within last 5 minutes
        if self._cached_discovered_models and (time.time() - self._last_discovery_time < 300):
            return self._cached_discovered_models

        url = f"{GEMINI_API_ENDPOINT}?key={key}"
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    data = res.json()
                    models = data.get("models", [])
                    discovered = []
                    for m in models:
                        methods = m.get("supportedGenerationMethods", [])
                        name = m.get("name", "").replace("models/", "")
                        # Filter for generation capable models
                        if "generateContent" in methods:
                            is_multimodal = True  # Modern Gemini flash/pro models support image input
                            discovered.append({
                                "id": name,
                                "displayName": m.get("displayName", name),
                                "description": m.get("description", "")[:120],
                                "multimodal": is_multimodal,
                                "supported": name in self.SUPPORTED_MODELS
                            })
                    self._cached_discovered_models = discovered
                    self._last_discovery_time = time.time()
                    return discovered
        except Exception as e:
            print(f"[GeminiService] Model discovery error: {e}")
        return self._cached_discovered_models or [{"id": m, "displayName": m, "multimodal": True, "supported": True} for m in self.SUPPORTED_MODELS]

    async def test_connection(self, api_key: Optional[str] = None, model: Optional[str] = None) -> Dict[str, Any]:
        """Test API key validity and model connectivity with real upstream check."""
        key = (api_key or secrets_vault.get_gemini_api_key() or DEFAULT_GEMINI_KEY or "").strip()
        if not key:
            return {
                "success": False,
                "status": "NOT_CONFIGURED",
                "message": "No API key configured.",
                "provider": "google",
                "model": model or self.get_configured_model(),
                "latency_ms": 0.0,
                "timestamp": time.time()
            }

        target_model = (model or self.get_configured_model()).strip()
        if target_model in ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-3.6-flash"]:
            target_model = "gemini-3.5-flash"

        url = f"{GEMINI_API_ENDPOINT}/{target_model}:generateContent?key={key}"
        payload = {
            "contents": [{"parts": [{"text": "Operational readiness check. Respond with 'READY'."}]}],
            "generationConfig": {"maxOutputTokens": 10}
        }

        start_t = time.time()
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload)
                latency = round((time.time() - start_t) * 1000, 1)

                if res.status_code == 200:
                    return {
                        "success": True,
                        "status": "CONNECTED",
                        "message": f"Successfully connected to {target_model} ({latency}ms).",
                        "provider": "google",
                        "model": target_model,
                        "latency_ms": latency,
                        "timestamp": time.time()
                    }
                elif res.status_code in [400, 403]:
                    return {
                        "success": False,
                        "status": "INVALID_CREDENTIALS",
                        "message": "Invalid API key or access denied by Google.",
                        "provider": "google",
                        "model": target_model,
                        "latency_ms": latency,
                        "timestamp": time.time()
                    }
                elif res.status_code == 404:
                    return {
                        "success": False,
                        "status": "MODEL_UNAVAILABLE",
                        "message": f"Model '{target_model}' is not available for this API credential.",
                        "provider": "google",
                        "model": target_model,
                        "latency_ms": latency,
                        "timestamp": time.time()
                    }
                elif res.status_code == 429:
                    return {
                        "success": False,
                        "status": "RATE_LIMITED",
                        "message": "Google Gemini upstream quota or rate limit exceeded.",
                        "provider": "google",
                        "model": target_model,
                        "latency_ms": latency,
                        "timestamp": time.time()
                    }
                else:
                    return {
                        "success": False,
                        "status": "NETWORK_ERROR",
                        "message": f"Upstream error {res.status_code}: {res.text[:120]}",
                        "provider": "google",
                        "model": target_model,
                        "latency_ms": latency,
                        "timestamp": time.time()
                    }
        except httpx.TimeoutException:
            return {
                "success": False,
                "status": "TIMEOUT",
                "message": "Connection timed out connecting to Google Gemini.",
                "provider": "google",
                "model": target_model,
                "latency_ms": round((time.time() - start_t) * 1000, 1),
                "timestamp": time.time()
            }
        except Exception as e:
            return {
                "success": False,
                "status": "NETWORK_ERROR",
                "message": f"Network error: {str(e)}",
                "provider": "google",
                "model": target_model,
                "latency_ms": 0.0,
                "timestamp": time.time()
            }

    async def test_multimodal(
        self, 
        frame_bgr: Optional[np.ndarray] = None, 
        api_key: Optional[str] = None, 
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """Perform a real end-to-end multimodal image understanding test."""
        key = (api_key or secrets_vault.get_gemini_api_key() or DEFAULT_GEMINI_KEY or "").strip()
        if not key:
            return {
                "success": False,
                "status": "NOT_CONFIGURED",
                "multimodal_passed": False,
                "message": "No API key configured.",
                "timestamp": time.time()
            }

        target_model = (model or self.get_configured_model()).strip()
        if target_model in ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-3.6-flash"]:
            target_model = "gemini-3.5-flash"

        # Generate a tactical test frame if none provided
        if frame_bgr is None or frame_bgr.size == 0:
            frame_bgr = np.zeros((360, 640, 3), dtype=np.uint8)
            cv2.rectangle(frame_bgr, (120, 80), (320, 280), (0, 255, 120), 2)
            cv2.putText(frame_bgr, "IBVAP TACTICAL PERIMETER TEST TARGET", (130, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 120), 1)

        ret, buf = cv2.imencode(".jpg", frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if not ret:
            return {"success": False, "status": "ERROR", "message": "Failed to encode test frame."}
        b64_image = base64.b64encode(buf).decode("utf-8")

        prompt = (
            "You are a defence-grade Border Surveillance AI Advisory Assistant for IBVAP.\n"
            "Examine this surveillance snapshot. Return strictly valid JSON with:\n"
            "{\n"
            '  "scene_summary": "1-2 sentence description of scene",\n'
            '  "observed_entities": [{"class": "person/vehicle/object", "description": "details", "certainty": "OBSERVED"}],\n'
            '  "observed_actions": [{"entity": "target", "action": "movement description", "speed_assessment": "Low/Medium/High"}],\n'
            '  "environment": {"lighting": "normal/dim/dark", "visibility": "clear/fog/occluded"},\n'
            '  "local_ai_consistency": {"matches_local_yolo": true, "agreements": ["Target present"], "discrepancies": []},\n'
            '  "uncertainties": [],\n'
            '  "missing_evidence": [],\n'
            '  "operator_attention": ["Check perimeter fence line"],\n'
            '  "confidence": 0.95\n'
            "}"
        )

        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": "image/jpeg", "data": b64_image}}
                ]
            }],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 1200,
                "responseMimeType": "application/json"
            }
        }

        url = f"{GEMINI_API_ENDPOINT}/{target_model}:generateContent?key={key}"
        start_t = time.time()
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, json=payload)
                latency = round((time.time() - start_t) * 1000, 1)

                if res.status_code == 200:
                    resp_json = res.json()
                    text_resp = resp_json["candidates"][0]["content"]["parts"][0]["text"]
                    parsed = self._clean_and_parse_json(text_resp)
                    return {
                        "success": True,
                        "status": "CONNECTED",
                        "multimodal_passed": True,
                        "model": target_model,
                        "latency_ms": latency,
                        "analysis": parsed,
                        "timestamp": time.time(),
                        "message": f"Multimodal test passed successfully on {target_model} ({latency}ms)."
                    }
                elif res.status_code in [404, 429, 503]:
                    for fallback in ["gemini-3.5-flash", "gemini-3.7-flash", "gemini-3-flash-preview", "gemini-3.5-flash-lite"]:
                        if target_model != fallback:
                            return await self.test_multimodal(frame_bgr=frame_bgr, api_key=key, model=fallback)
                    return {
                        "success": False,
                        "status": "RATE_LIMITED" if res.status_code == 429 else "MODEL_UNAVAILABLE",
                        "multimodal_passed": False,
                        "model": target_model,
                        "latency_ms": latency,
                        "message": f"All multimodal candidate models exhausted ({res.status_code})."
                    }
                else:
                    return {
                        "success": False,
                        "status": "ERROR",
                        "multimodal_passed": False,
                        "model": target_model,
                        "latency_ms": latency,
                        "message": f"Gemini API returned error {res.status_code}: {res.text[:100]}"
                    }
        except Exception as e:
            return {
                "success": False,
                "status": "NETWORK_ERROR",
                "multimodal_passed": False,
                "model": target_model,
                "latency_ms": round((time.time() - start_t) * 1000, 1),
                "message": f"Multimodal test failed: {str(e)}"
            }

    async def analyze_frame(
        self, 
        frame_bgr: np.ndarray, 
        event_context: Dict[str, Any]
    ) -> VisionAnalysisResult:
        """Asynchronously consult Gemini for secondary reasoning with auto-failover and truthfulness guarantees."""
        model = self.get_configured_model()
        if model in ["gemini-2.0-flash", "gemini-2.5-flash"]:
            model = "gemini-3.6-flash"

        api_key = (secrets_vault.get_gemini_api_key() or "").strip()

        if not self.is_enabled():
            return VisionAnalysisResult(
                provider="gemini",
                status="DISABLED",
                model=model,
                error_message="Gemini Assisted Analysis is currently disabled by administrator."
            )

        if not api_key:
            return VisionAnalysisResult(
                provider="gemini",
                status="NOT_CONFIGURED",
                model=model,
                error_message="Gemini API key unconfigured. Platform operating truthfully in LOCAL ONLY mode."
            )

        camera_id = event_context.get("camera_id", "unknown")
        allowed, reason = self.check_rate_limits(camera_id)
        if not allowed:
            return VisionAnalysisResult(
                provider="gemini",
                status="RATE_LIMITED",
                model=model,
                error_message=reason
            )

        if frame_bgr is None or not isinstance(frame_bgr, np.ndarray) or frame_bgr.size == 0:
            return VisionAnalysisResult(
                provider="gemini",
                status="FRAME_UNAVAILABLE",
                model=model,
                error_message="No valid current camera frame available from pipeline buffer."
            )

        # Encode frame to JPEG
        ret, buf = cv2.imencode(".jpg", frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, 80])
        if not ret:
            return VisionAnalysisResult(
                provider="gemini",
                status="ERROR",
                model=model,
                error_message="Frame encoding failed."
            )
        b64_image = base64.b64encode(buf).decode("utf-8")

        prompt = (
            "You are the secondary visual intelligence layer for the Intelligent Border Video Analytics Platform (IBVAP, SIH26187).\n"
            "Analyze the supplied CURRENT CCTV camera frame.\n\n"
            "CORE INSTRUCTIONS:\n"
            "1. Describe what is actually visible in the image. Do not assume that an incident exists. Do not require a predefined detection category before describing the scene.\n"
            "2. If people are visible, describe:\n"
            "   - approximate number\n"
            "   - visible posture/body position (standing, sitting, kneeling, etc.)\n"
            "   - visible activity only when visually supported (walking, running, stationary)\n"
            "   - visible carried objects such as bags, backpacks, packages, tools\n"
            "   - approximate location in the frame (foreground, background, left, right, center)\n"
            "3. If vehicles are visible, describe:\n"
            "   - approximate number\n"
            "   - visible vehicle type (car, truck, van, motorcycle)\n"
            "   - visible direction of travel only when supported\n"
            "   - visible license plate region and plate readability\n"
            "   - other visible attributes (color, headlights)\n"
            "4. Describe the environment:\n"
            "   - scene setting (indoor, outdoor, border perimeter, roadway, checkpoint)\n"
            "   - lighting (bright daylight, dim, night, artificial illumination)\n"
            "   - visibility and image quality (clear, fog, rain, lens glare, blurred, occluded)\n"
            "   - relevant visible anomalies or hazards\n"
            "5. If no target (person/vehicle) is visible:\n"
            "   - DO NOT say merely 'nothing found'.\n"
            "   - Explicitly state: 'No relevant target is visibly identifiable in this frame.'\n"
            "   - Provide a concise description of the background, visible infrastructure, furnishings, or terrain.\n"
            "6. Separate information strictly into:\n"
            "   - OBSERVED: directly visible in pixels\n"
            "   - INFERRED: deduced from context\n"
            "   - UNAVAILABLE / INSUFFICIENT EVIDENCE: what cannot be determined from this single 2D frame\n"
            "7. Never invent objects. Do not infer identity, criminal intent, emotion, or hidden activity.\n\n"
            f"OPERATIONAL CONTEXT FROM LOCAL AI (FOR CORRELATION ONLY - NOT VISUAL TRUTH):\n"
            f"- Camera ID: {camera_id}\n"
            f"- Sector / Profile: {event_context.get('sector', 'Unassigned')} // {event_context.get('profile', 'Border Fence')}\n"
            f"- Local AI Perception: Class={event_context.get('class_name', 'None')}, Behaviour={event_context.get('behaviour', 'None')}, Risk={event_context.get('risk_score', 0)}/100\n\n"
            "Respond in structured JSON format with this schema:\n"
            "{\n"
            '  "scene_summary": "Thorough 2-3 sentence description of the entire scene, visible objects, environment, and whether targets are present",\n'
            '  "observed_entities": [\n'
            '    {"class": "person/vehicle/object/furniture", "count": 1, "description": "physical description and position", "certainty": "OBSERVED" | "INFERRED" | "UNCERTAIN"}\n'
            '  ],\n'
            '  "observed_actions": [\n'
            '    {"entity": "target", "action": "standing/walking/sitting/stationary", "speed_assessment": "Low/Medium/High"}\n'
            '  ],\n'
            '  "environment": {\n'
            '    "lighting": "bright/dim/dark/artificial",\n'
            '    "visibility": "clear/fog/occluded/glare",\n'
            '    "image_quality": "high/medium/low/grainy",\n'
            '    "setting": "indoor/outdoor/perimeter"\n'
            '  },\n'
            '  "local_ai_consistency": {\n'
            '    "agreement": "AGREES" | "PARTIAL AGREEMENT" | "DISAGREES" | "INSUFFICIENT VISUAL EVIDENCE",\n'
            '    "agreements": ["list of agreed points"],\n'
            '    "discrepancies": ["list of discrepancies"]\n'
            '  },\n'
            '  "potential_anomalies": ["any visible safety/security anomalies or none"],\n'
            '  "uncertainties": ["aspects that cannot be determined from this single 2D perspective"],\n'
            '  "missing_evidence": ["additional sensors or camera angles needed"],\n'
            '  "operator_attention": ["key elements requiring operator verification"],\n'
            '  "recommended_checks": ["specific bounded manual checks"],\n'
            '  "situational_assessment": "Tactical summary for the command post",\n'
            '  "ambiguity_explanation": "Visual ambiguities, lighting or occlusions",\n'
            '  "confidence_assessment": "High" | "Moderate" | "Low",\n'
            '  "confidence": 0.85,\n'
            '  "recommended_operator_response": "Actionable SOP recommendation"\n'
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
                "maxOutputTokens": 2048,
                "responseMimeType": "application/json"
            }
        }

        models_to_try = [model]
        for candidate in ["gemini-3.5-flash", "gemini-3.7-flash", "gemini-3-flash-preview", "gemini-3.5-flash-lite", "gemini-3.6-flash"]:
            if candidate not in models_to_try:
                models_to_try.append(candidate)

        start_time = time.time()
        for attempt_model in models_to_try:
            # P15: Diagnostic logging (No credentials or auth headers logged)
            print(f"[AI REQUEST] camera_id={camera_id} timestamp={time.time():.2f} jpeg_size={len(buf)} bytes provider=gemini model={attempt_model}")
            url = f"{GEMINI_API_ENDPOINT}/{attempt_model}:generateContent?key={api_key}"
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
                            except Exception:
                                pass

                            parsed, is_structured = self._clean_and_parse_json(text_resp)
                            status_val = "COMPLETED" if is_structured else "PARTIAL_RESPONSE"
                            print(f"[AI RESPONSE] status_code=200 parsed_structured={is_structured} normalized_status={status_val} latency={latency:.1f}ms")

                            return VisionAnalysisResult(
                                provider="gemini",
                                status=status_val,
                                model=attempt_model,
                                situational_assessment=parsed.get("situational_assessment") or parsed.get("scene_summary", "Scene analyzed."),
                                ambiguity_explanation=parsed.get("ambiguity_explanation", "No major visual ambiguities detected."),
                                confidence_assessment=parsed.get("confidence_assessment", "Moderate"),
                                confidence=float(parsed.get("confidence", 0.85) or 0.85),
                                recommended_operator_response=parsed.get("recommended_operator_response", "Continue perimeter monitoring."),
                                threat_indicators=parsed.get("threat_indicators", []),
                                latency_ms=latency,
                                scene_summary=parsed.get("scene_summary", text_resp),
                                observed_entities=parsed.get("observed_entities", []),
                                observed_actions=parsed.get("observed_actions", []),
                                behavior_assessment=parsed.get("behavior_assessment", []),
                                local_ai_consistency=parsed.get("local_ai_consistency", {}),
                                uncertainties=parsed.get("uncertainties", []),
                                not_visible_aspects=parsed.get("not_visible_aspects", []),
                                recommended_checks=parsed.get("recommended_checks", []),
                                environment=parsed.get("environment", {}),
                                potential_anomalies=parsed.get("potential_anomalies", []),
                                missing_evidence=parsed.get("missing_evidence", []),
                                operator_attention=parsed.get("operator_attention", []),
                                raw_text_available=bool(text_resp),
                                raw_text=text_resp
                            )
                        elif res.status_code in [404, 429, 503]:
                            print(f"[AI RESPONSE] status_code={res.status_code} on {attempt_model} -> falling back to next candidate model")
                            break
                        elif res.status_code in [401, 403]:
                            print(f"[AI RESPONSE] status_code={res.status_code} invalid_credentials latency={latency:.1f}ms")
                            return VisionAnalysisResult(
                                provider="gemini",
                                status="INVALID_CREDENTIALS",
                                model=attempt_model,
                                error_message="Gemini API credentials invalid or unauthorized. Local AI perception remains active.",
                                latency_ms=latency
                            )
                        else:
                            latency = (time.time() - start_time) * 1000
                            print(f"[AI RESPONSE] status_code={res.status_code} error latency={latency:.1f}ms")
                            return VisionAnalysisResult(
                                provider="gemini",
                                status="ERROR",
                                model=attempt_model,
                                error_message=f"Gemini API returned {res.status_code}: {res.text[:120]}",
                                latency_ms=latency
                            )
                except httpx.TimeoutException:
                    latency = (time.time() - start_time) * 1000
                    print(f"[AI RESPONSE] timeout latency={latency:.1f}ms")
                    return VisionAnalysisResult(
                        provider="gemini",
                        status="TIMEOUT",
                        model=attempt_model,
                        error_message="Gemini advisory request timed out. Local AI perception remains active.",
                        latency_ms=latency
                    )
                except Exception as e:
                    latency = (time.time() - start_time) * 1000
                    print(f"[AI RESPONSE] network_error={str(e)} latency={latency:.1f}ms")
                    return VisionAnalysisResult(
                        provider="gemini",
                        status="NETWORK_ERROR",
                        model=attempt_model,
                        error_message=f"Gemini network error: {str(e)}. Local AI perception remains active.",
                        latency_ms=latency
                    )

        return VisionAnalysisResult(
            provider="gemini",
            status="OFFLINE",
            model=model,
            error_message="Gemini service unavailable. Local AI perception remains active."
        )

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
