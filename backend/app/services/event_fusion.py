import time
import threading
from typing import Dict, Any, List, Optional

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
            if (now - v["last_update"]) > 60.0:
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
                event["timeline"] = [{"state": "ALERT", "time": now, "detail": event["event_type"]}]
                import json
                event["timeline_json"] = json.dumps(event["timeline"])
                return event

            key = self.get_incident_key(camera_id, track_id)
            existing = self.active_incidents.get(key)

            if existing and (now - existing["last_update"]) <= self.fusion_window:
                existing["last_update"] = now
                if event.get("risk_score", 0) > existing.get("risk_score", 0):
                    existing["risk_score"] = event["risk_score"]
                    existing["severity"] = event["severity"]
                    existing["event_type"] = event["event_type"]

                new_rules = event.get("explainability", [])
                for r in new_rules:
                    if r not in existing.get("explainability", []):
                        existing.setdefault("explainability", []).append(r)

                existing["timeline"].append({
                    "state": event["event_type"],
                    "time": now,
                    "detail": f"{event.get('class_name', 'Target')} in {event.get('zone_name', 'zone')}"
                })
                
                import json
                existing["timeline_json"] = json.dumps(existing["timeline"])
                return existing
            else:
                event["timeline"] = [
                    {"state": "DETECTED", "time": now - 1.0, "detail": f"Target track #{track_id} acquired"},
                    {"state": event["event_type"], "time": now, "detail": f"Triggered {event['event_type']} in {event.get('zone_name', 'zone')}"}
                ]
                event["last_update"] = now
                
                import json
                event["timeline_json"] = json.dumps(event["timeline"])
                self.active_incidents[key] = event
                return event

fusion_manager = IncidentFusionManager()