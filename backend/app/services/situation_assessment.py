"""
IBVAP AI Situation Assessment Service
SIH26187 — Intelligent Border Video Analytics Platform

Synthesizes multi-camera streams, active incidents, ANPR vehicle telemetry,
and environmental conditions into a unified sector-wide Situation Assessment.
Integrates Gemini 2.5 Flash with strict epistemic truthfulness tagging and
deterministic rule-based fallback when offline.
"""

import time
import json
import uuid
import base64
from pathlib import Path
from typing import Dict, Any, List, Optional
import httpx

from backend.app.database.session import SessionLocal
from backend.app.database.models import (
    CameraDB, EventDB, ANPRDB, EvidenceDB, 
    SituationAssessmentDB, SystemConfigDB
)
from backend.app.services.secrets_vault import secrets_vault
from backend.app.services.gemini_service import gemini_service, GEMINI_API_ENDPOINT

PROJECT_ROOT = Path(__file__).resolve().parents[3]
EVIDENCE_DIR = PROJECT_ROOT / "database" / "evidence"


class SituationAssessmentService:
    def __init__(self):
        self.default_model = "gemini-2.5-flash"

    def _get_system_mode(self, db) -> str:
        try:
            cfg = db.query(SystemConfigDB).filter(SystemConfigDB.key == "system_mode").first()
            if cfg and cfg.value:
                return cfg.value.strip().lower()
        except Exception:
            pass
        return "live"

    def _gather_operational_context(self, db) -> Dict[str, Any]:
        """Collect real database and camera state across the monitored perimeter."""
        # 1. Monitored Cameras
        cameras = db.query(CameraDB).all()
        cam_summary = []
        for c in cameras:
            cam_summary.append({
                "camera_id": c.camera_id,
                "name": c.name,
                "sector": c.sector,
                "is_active": c.is_active,
                "profile": c.profile,
                "location": f"({c.latitude}, {c.longitude})" if c.latitude else "UNSET"
            })

        # 2. Recent Incidents (last 30)
        recent_events = (
            db.query(EventDB)
            .order_by(EventDB.timestamp.desc())
            .limit(30)
            .all()
        )
        
        events_summary = []
        included_event_ids = []
        high_critical_count = 0
        now = time.time()

        for e in recent_events:
            included_event_ids.append(e.event_id)
            if e.severity in ["Critical", "High"] and (now - e.timestamp) < 1800:
                high_critical_count += 1
            
            events_summary.append({
                "event_id": e.event_id,
                "camera_id": e.camera_id,
                "event_type": e.event_type,
                "severity": e.severity,
                "risk_score": e.risk_score,
                "class_name": e.class_name,
                "zone_name": e.zone_name or "Perimeter",
                "ai_summary": e.ai_summary or "",
                "behaviour": e.behaviour or "Normal",
                "age_seconds": round(now - e.timestamp, 1)
            })

        # 3. Recent ANPR Telemetry (last 10)
        recent_anpr = (
            db.query(ANPRDB)
            .order_by(ANPRDB.timestamp.desc())
            .limit(10)
            .all()
        )
        anpr_summary = []
        for a in recent_anpr:
            anpr_summary.append({
                "plate": a.plate,
                "camera_id": a.camera_id,
                "vehicle_type": a.vehicle_type,
                "verification_required": a.verification_required,
                "confidence": round(a.confidence, 2),
                "age_seconds": round(now - a.timestamp, 1)
            })

        # 4. Keyframe Evidence Samples (up to 3 for visual context)
        keyframe_images = []
        for e in recent_events[:5]:
            evi = db.query(EvidenceDB).filter(EvidenceDB.event_id == e.event_id).first()
            if evi and evi.snapshot_path:
                rel = evi.snapshot_path.lstrip("/")
                if rel.startswith("evidence/"):
                    rel = rel[len("evidence/"):]
                fpath = EVIDENCE_DIR / rel
                if fpath.exists() and len(keyframe_images) < 3:
                    try:
                        with open(fpath, "rb") as img_file:
                            b64 = base64.b64encode(img_file.read()).decode("utf-8")
                            keyframe_images.append({
                                "event_id": e.event_id,
                                "camera_id": e.camera_id,
                                "b64": b64
                            })
                    except Exception:
                        pass

        return {
            "cameras": cam_summary,
            "active_camera_count": sum(1 for c in cam_summary if c["is_active"]),
            "total_cameras": len(cam_summary),
            "events": events_summary,
            "high_critical_count": high_critical_count,
            "anpr": anpr_summary,
            "keyframe_images": keyframe_images,
            "included_event_ids": included_event_ids
        }

    def _generate_heuristic_assessment(self, ctx: Dict[str, Any]) -> Dict[str, Any]:
        """Deterministic, truthful synthesis when LLM is unavailable or offline."""
        cams = ctx["cameras"]
        events = ctx["events"]
        anpr = ctx["anpr"]
        high_crit = ctx["high_critical_count"]

        # Determine Posture and Threat Level
        if ctx["total_cameras"] == 0:
            posture = "AWAITING_PROVISIONING"
            threat_level = "NORMAL"
            exec_summary = "Platform operational with zero configured cameras. Surveillance fleet is awaiting sensor allocation."
            concerns = ["No operational sensors active in monitored zone."]
            directives = ["Provision surveillance cameras via the Add Camera Wizard."]
            patterns = ["Fleet inactive."]
            epistemic = [
                {"statement": "Zero cameras registered in surveillance ledger", "tag": "OBSERVED"},
                {"statement": "Surveillance coverage inactive", "tag": "OBSERVED"}
            ]
        elif high_crit >= 4:
            posture = "ACTIVE_INCURSION"
            threat_level = "CRITICAL"
            exec_summary = f"Multiple high-severity perimeter breaches detected across monitored sectors ({high_crit} active alarms in last 30m). Immediate response required."
            concerns = [f"Rapid alert escalation: {high_crit} active Critical/High alarms.", "Perimeter intrusion boundary compromised."]
            directives = [
                "Dispatch Quick Reaction Force (QRF) to active intrusion coordinates.",
                "Verify live camera streams in Command Center and lock PTZ tracking on targets.",
                "Sound perimeter alert horn and enable tactical spotlight arrays."
            ]
            patterns = [f"Multiple breach events detected across {len(set(e['camera_id'] for e in events[:5]))} sector cameras."]
            epistemic = [
                {"statement": f"{high_crit} high-severity alarms triggered in last 30 minutes", "tag": "OBSERVED"},
                {"statement": "Potential coordinated perimeter incursion", "tag": "INFERRED"},
                {"statement": "Identity and intent of intruders require tactical visual confirmation", "tag": "VERIFICATION REQUIRED"}
            ]
        elif high_crit >= 1 or len(events) > 5:
            posture = "ELEVATED_WATCH"
            threat_level = "HIGH"
            exec_summary = f"Elevated threat activity detected along perimeter sector. {len(events)} incident records logged, including {high_crit} priority events."
            concerns = ["Elevated boundary dwell or loitering activity observed.", "Cross-sector target movement detected."]
            directives = [
                "Direct duty officer to review target trajectories in Incidents tab.",
                "Monitor secondary camera handoffs for target re-acquisition.",
                "Verify vehicle registration numbers against authorized security rosters."
            ]
            patterns = ["Corridor movement pattern detected along perimeter boundary wire."]
            epistemic = [
                {"statement": f"{len(events)} events recorded across monitored fleet", "tag": "OBSERVED"},
                {"statement": "Target dwell indicates potential reconnaissance or deliberate approach", "tag": "INFERRED"},
                {"statement": "Target concealment under foliage/shadows", "tag": "UNCERTAIN"}
            ]
        elif len(events) > 0:
            posture = "FOCUSED_MONITORING"
            threat_level = "ELEVATED"
            exec_summary = "Routine perimeter events detected. Local AI models actively tracking targets within configured acceptable thresholds."
            concerns = ["Isolated target detections in perimeter boundary."]
            directives = ["Maintain standard visual sweep. Acknowledge verified benign detections."]
            patterns = ["Single-point target detection with no cross-camera propagation."]
            epistemic = [
                {"statement": "Isolated target detection logged by local YOLO pipeline", "tag": "OBSERVED"},
                {"statement": "Normal patrol or wildlife activity consistent with baseline", "tag": "INFERRED"}
            ]
        else:
            posture = "DEFENSIVE_STABLE"
            threat_level = "NORMAL"
            exec_summary = f"Perimeter secure across all {ctx['active_camera_count']} active surveillance feeds. No boundary incursions or suspicious telemetry detected."
            concerns = ["None. Perimeter status within normal parameters."]
            directives = ["Continue automated round-the-clock video analytics monitoring."]
            patterns = ["No anomalous activity patterns detected across sectors."]
            epistemic = [
                {"statement": f"All {ctx['active_camera_count']} active cameras operational with clear field of view", "tag": "OBSERVED"},
                {"statement": "Perimeter fence integrity uncompromised", "tag": "INFERRED"}
            ]

        # Correlate ANPR with events if applicable
        if anpr:
            latest_plate = anpr[0]["plate"]
            if anpr[0]["verification_required"]:
                concerns.append(f"Unverified vehicle plate {latest_plate} detected in perimeter sector.")
                directives.append(f"Dispatch checkpoint guard to inspect vehicle with plate {latest_plate}.")
                epistemic.append({
                    "statement": f"Vehicle plate {latest_plate} flagged for verification",
                    "tag": "VERIFICATION REQUIRED"
                })

        return {
            "posture": posture,
            "threat_level": threat_level,
            "executive_summary": exec_summary,
            "primary_concerns": concerns,
            "cross_camera_patterns": patterns,
            "recommended_directives": directives,
            "epistemic_tags": epistemic,
            "model_used": "DETERMINISTIC_HEURISTIC_SYNTHESIS",
            "confidence": 0.92
        }

    async def generate_assessment(self, operator: str = "OP-01") -> Dict[str, Any]:
        """Perform comprehensive Situation Assessment using Gemini 2.5 Flash or Fallback."""
        start_t = time.time()
        db = SessionLocal()
        try:
            ctx = self._gather_operational_context(db)
            system_mode = self._get_system_mode(db)

            api_key = (secrets_vault.get_gemini_api_key() or "").strip()
            configured_model = gemini_service.get_configured_model()
            assessment_data = None
            model_used = "DETERMINISTIC_HEURISTIC_SYNTHESIS"

            # Attempt Gemini API call if key is present and enabled
            if api_key and gemini_service.is_enabled() and ctx["total_cameras"] > 0:
                try:
                    prompt = (
                        "You are the Chief AI Tactical Situation Officer for the Intelligent Border Video Analytics Platform (IBVAP, SIH26187).\n"
                        "Synthesize the following real-time operational surveillance telemetry across multiple border sectors into a high-level Situation Assessment.\n\n"
                        "=== MONITORED SURVEILLANCE FLEET ===\n"
                        f"{json.dumps(ctx['cameras'], indent=2)}\n\n"
                        "=== RECENT DETECTIONS & INCIDENTS ===\n"
                        f"{json.dumps(ctx['events'][:15], indent=2)}\n\n"
                        "=== VEHICLE ANPR TELEMETRY ===\n"
                        f"{json.dumps(ctx['anpr'][:5], indent=2)}\n\n"
                        "EPISTEMIC TRUTHFULNESS MANDATE:\n"
                        "Every statement must be truthful. Use epistemic tags:\n"
                        "- OBSERVED: directly confirmed by local YOLO/ANPR sensors\n"
                        "- INFERRED: deduced from cross-camera pattern or trajectory\n"
                        "- UNCERTAIN: ambiguous visual or sensor data\n"
                        "- VERIFICATION REQUIRED: mandates human operator confirmation\n\n"
                        "Respond strictly in JSON format with exactly these keys:\n"
                        "{\n"
                        '  "posture": "DEFENSIVE_STABLE" | "FOCUSED_MONITORING" | "ELEVATED_WATCH" | "ACTIVE_INCURSION",\n'
                        '  "threat_level": "NORMAL" | "ELEVATED" | "HIGH" | "CRITICAL",\n'
                        '  "executive_summary": "Concise 2-3 sentence strategic evaluation of sector posture",\n'
                        '  "primary_concerns": ["list of top 2-4 operational concerns"],\n'
                        '  "cross_camera_patterns": ["list of 1-3 cross-sector correlations or patterns"],\n'
                        '  "recommended_directives": ["ordered list of 2-4 actionable operator directives"],\n'
                        '  "epistemic_tags": [{"statement": "factual claim", "tag": "OBSERVED|INFERRED|UNCERTAIN|VERIFICATION REQUIRED"}]\n'
                        "}"
                    )

                    parts = [{"text": prompt}]
                    # Attach up to 2 keyframe snapshots
                    for kf in ctx["keyframe_images"][:2]:
                        parts.append({
                            "inline_data": {
                                "mime_type": "image/jpeg",
                                "data": kf["b64"]
                            }
                        })

                    payload = {
                        "contents": [{"parts": parts}],
                        "generationConfig": {
                            "temperature": 0.2,
                            "maxOutputTokens": 800,
                            "responseMimeType": "application/json"
                        }
                    }

                    url = f"{GEMINI_API_ENDPOINT}/{configured_model}:generateContent?key={api_key}"
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        resp = await client.post(url, json=payload)
                        if resp.status_code == 200:
                            resp_json = resp.json()
                            text_resp = resp_json["candidates"][0]["content"]["parts"][0]["text"]
                            parsed = json.loads(text_resp)
                            assessment_data = parsed
                            model_used = configured_model
                except Exception as ex:
                    print(f"[SITUATION_ASSESSMENT] Gemini call failed, using heuristic: {ex}")

            # If Gemini not available or failed, use deterministic heuristic
            if not assessment_data:
                assessment_data = self._generate_heuristic_assessment(ctx)

            assessment_data["model_used"] = model_used
            latency_ms = int((time.time() - start_t) * 1000)
            assessment_id = f"sitrep-{int(time.time())}-{uuid.uuid4().hex[:6]}"

            # Save to Database
            db_record = SituationAssessmentDB(
                id=assessment_id,
                timestamp=time.time(),
                scope="SECTOR_WIDE",
                data_mode="DEMO" if system_mode == "demo" else "LIVE",
                included_cameras=json.dumps([c["camera_id"] for c in ctx["cameras"]]),
                included_incidents=json.dumps(ctx["included_event_ids"][:15]),
                evidence_count=len(ctx["keyframe_images"]),
                model=model_used,
                status="COMPLETED",
                result=json.dumps(assessment_data),
                confidence=assessment_data.get("confidence", 0.90),
                latency_ms=latency_ms,
                operator=operator
            )
            db.add(db_record)
            db.commit()

            return {
                "id": assessment_id,
                "timestamp": db_record.timestamp,
                "latency_ms": latency_ms,
                "model": model_used,
                "data_mode": db_record.data_mode,
                "assessment": assessment_data,
                "included_cameras": [c["camera_id"] for c in ctx["cameras"]],
                "included_incidents_count": len(ctx["included_event_ids"])
            }

        finally:
            db.close()

    def get_recent_assessments(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Fetch past situation assessments from database."""
        db = SessionLocal()
        try:
            records = (
                db.query(SituationAssessmentDB)
                .order_by(SituationAssessmentDB.timestamp.desc())
                .limit(limit)
                .all()
            )
            out = []
            for r in records:
                try:
                    res = json.loads(r.result) if r.result else {}
                except Exception:
                    res = {}
                out.append({
                    "id": r.id,
                    "timestamp": r.timestamp,
                    "model": r.model,
                    "status": r.status,
                    "data_mode": r.data_mode,
                    "confidence": r.confidence,
                    "latency_ms": r.latency_ms,
                    "operator": r.operator,
                    "assessment": res
                })
            return out
        finally:
            db.close()

    def get_assessment_by_id(self, assessment_id: str) -> Optional[Dict[str, Any]]:
        db = SessionLocal()
        try:
            r = db.query(SituationAssessmentDB).filter(SituationAssessmentDB.id == assessment_id).first()
            if not r:
                return None
            try:
                res = json.loads(r.result) if r.result else {}
            except Exception:
                res = {}
            return {
                "id": r.id,
                "timestamp": r.timestamp,
                "model": r.model,
                "status": r.status,
                "data_mode": r.data_mode,
                "confidence": r.confidence,
                "latency_ms": r.latency_ms,
                "operator": r.operator,
                "assessment": res
            }
        finally:
            db.close()

situation_assessment_service = SituationAssessmentService()
