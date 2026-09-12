import time
import json
import uuid
import threading
from typing import Dict, Any, List, Optional

SEVERITY_WEIGHTS = {
    "Info": 1,
    "Low": 1,
    "Medium": 2,
    "High": 3,
    "Critical": 4
}

class IncidentFusionManager:
    def __init__(self, fusion_window_seconds: float = 30.0):
        self.fusion_window = fusion_window_seconds
        self.active_incidents: Dict[str, Dict[str, Any]] = {}
        self.lock = threading.Lock()

    def get_incident_key(self, camera_id: str, track_id: int) -> str:
        return f"{camera_id}_{track_id}"
        
    def _cleanup_stale(self, now: float):
        keys_to_remove = []
        for k, v in self.active_incidents.items():
            if (now - v.get("last_update", now)) > 60.0:
                keys_to_remove.append(k)
        for k in keys_to_remove:
            del self.active_incidents[k]

    def process_event(self, event: Dict[str, Any]) -> Dict[str, Any]:
        camera_id = event["camera_id"]
        track_id = event.get("track_id")
        now = event.get("timestamp", time.time())

        with self.lock:
            self._cleanup_stale(now)

            if track_id is None:
                # Single event without track
                event["event_id"] = event.get("event_id") or str(uuid.uuid4())
                event["is_new"] = True
                event["is_escalation"] = False
                event["timeline"] = [{"state": "ALERT", "time": now, "detail": event["event_type"]}]
                event["timeline_json"] = json.dumps(event["timeline"])
                return event

            key = self.get_incident_key(camera_id, track_id)
            existing = self.active_incidents.get(key)

            if existing and (now - existing["last_update"]) <= self.fusion_window:
                existing["last_update"] = now
                
                # Check for escalation
                prev_sev = existing.get("severity", "Medium")
                new_sev = event.get("severity", "Medium")
                sev_escalated = SEVERITY_WEIGHTS.get(new_sev, 1) > SEVERITY_WEIGHTS.get(prev_sev, 1)
                score_escalated = event.get("risk_score", 0) >= (existing.get("risk_score", 0) + 15)
                is_escalation = sev_escalated or score_escalated

                existing["is_new"] = False
                existing["is_escalation"] = is_escalation

                # Update severity and risk score if higher
                if event.get("risk_score", 0) > existing.get("risk_score", 0):
                    existing["risk_score"] = event["risk_score"]
                    existing["severity"] = event["severity"]
                    existing["event_type"] = event["event_type"]
                    existing["ai_summary"] = event.get("ai_summary", existing.get("ai_summary"))

                # Merge explainability rules
                new_rules = event.get("explainability", [])
                for r in new_rules:
                    if r not in existing.get("explainability", []):
                        existing.setdefault("explainability", []).append(r)

                # Append timeline entry only if state changed or last entry was > 4s ago
                timeline = existing.setdefault("timeline", [])
                last_time = timeline[-1]["time"] if timeline else 0
                if is_escalation or (now - last_time > 4.0):
                    timeline.append({
                        "state": event["event_type"],
                        "time": now,
                        "detail": f"{event.get('class_name', 'Target')} ({event.get('severity', 'Alert')}) in {event.get('zone_name', 'zone')}"
                    })
                
                existing["timeline_json"] = json.dumps(existing["timeline"])
                return existing
            else:
                event_id = event.get("event_id") or str(uuid.uuid4())
                event["event_id"] = event_id
                event["is_new"] = True
                event["is_escalation"] = False
                event["first_seen"] = now
                event["last_update"] = now
                event["timeline"] = [
                    {"state": "DETECTED", "time": now - 0.5, "detail": f"Target track #{track_id} acquired"},
                    {"state": event["event_type"], "time": now, "detail": f"Triggered {event['event_type']} in {event.get('zone_name', 'zone')}"}
                ]
                event["timeline_json"] = json.dumps(event["timeline"])
                self.active_incidents[key] = event
                return event

fusion_manager = IncidentFusionManager()