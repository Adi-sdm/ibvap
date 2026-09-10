"""
Virtual Zone & Direction-Aware Crossing Engine for IBVAP
Implements ray-casting point-in-polygon and directional crossing state machines.
"""
from typing import List, Tuple, Dict, Any, Optional
import math
import time
import uuid

class Point:
    def __init__(self, x: float, y: float):
        self.x = float(x)
        self.y = float(y)

    def to_tuple(self) -> Tuple[float, float]:
        return (self.x, self.y)

class VirtualZone:
    def __init__(self, zone_id: str, camera_id: str, name: str, 
                 polygon: List[Tuple[float, float]], zone_type: str = "RESTRICTED",
                 color: str = "#EF4444"):
        """
        polygon: List of (x, y) tuples normalized to [0.0, 1.0].
        zone_type: 'RESTRICTED', 'WARNING', 'CHECKPOINT'
        """
        self.zone_id = zone_id
        self.camera_id = camera_id
        self.name = name
        self.polygon = [Point(p[0], p[1]) for p in polygon]
        self.zone_type = zone_type
        self.color = color

    def is_inside(self, norm_x: float, norm_y: float) -> bool:
        """
        Ray-casting algorithm to determine if a point is inside the polygon.
        """
        n = len(self.polygon)
        if n < 3:
            return False

        inside = False
        p1 = self.polygon[0]
        for i in range(1, n + 1):
            p2 = self.polygon[i % n]
            if norm_y > min(p1.y, p2.y):
                if norm_y <= max(p1.y, p2.y):
                    if norm_x <= max(p1.x, p2.x):
                        if p1.y != p2.y:
                            x_inters = (norm_y - p1.y) * (p2.x - p1.x) / (p2.y - p1.y) + p1.x
                            if norm_x <= x_inters:
                                inside = not inside
            p1 = p2
        return inside

    def segments_intersect(self, p1: Point, p2: Point, q1: Point, q2: Point) -> bool:
        """Check if segment p1-p2 intersects segment q1-q2"""
        def ccw(a, b, c):
            return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x)
        return (ccw(p1, q1, q2) != ccw(p2, q1, q2)) and (ccw(p1, p2, q1) != ccw(p1, p2, q2))

    def line_crosses_boundary(self, prev_pt: Tuple[float, float], curr_pt: Tuple[float, float]) -> bool:
        """Determines if the line segment between consecutive positions intersects any polygon edge"""
        p1 = Point(prev_pt[0], prev_pt[1])
        p2 = Point(curr_pt[0], curr_pt[1])
        n = len(self.polygon)
        for i in range(n):
            q1 = self.polygon[i]
            q2 = self.polygon[(i + 1) % n]
            if self.segments_intersect(p1, p2, q1, q2):
                return True
        return False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "zone_id": self.zone_id,
            "camera_id": self.camera_id,
            "name": self.name,
            "polygon": [(p.x, p.y) for p in self.polygon],
            "zone_type": self.zone_type,
            "color": self.color
        }


class ZoneTracker:
    """
    Maintains per-track state across frames to compute directional crossings and dwell times.
    """
    def __init__(self, loitering_threshold_seconds: float = 8.0):
        self.zones: Dict[str, VirtualZone] = {}
        # track_states: track_id -> { zone_id: { "was_inside": bool, "first_inside_time": float, "last_seen_time": float } }
        self.track_states: Dict[int, Dict[str, Dict[str, Any]]] = {}
        self.position_history: Dict[int, List[Tuple[float, float, float]]] = {}
        self.loitering_threshold = loitering_threshold_seconds
        self.track_absence_frames: Dict[int, int] = {}
        self.max_absence_frames = 5

    def register_zone(self, zone: VirtualZone):
        self.zones[zone.zone_id] = zone

    def remove_zone(self, zone_id: str):
        if zone_id in self.zones:
            del self.zones[zone_id]

    def clear_zones(self, camera_id: Optional[str] = None):
        if camera_id is None:
            self.zones.clear()
        else:
            self.zones = {zid: z for zid, z in self.zones.items() if z.camera_id != camera_id}

    def update_track(self, camera_id: str, track_id: int, class_name: str,
                     norm_x: float, norm_y: float, confidence: float,
                     bbox: List[float], timestamp: Optional[float] = None) -> List[Dict[str, Any]]:
        """
        Updates object location and evaluates directional crossings across all active zones for camera.
        Returns a list of generated event objects.
        """
        now = timestamp if timestamp is not None else time.time()
        events = []

        if track_id not in self.track_states:
            self.track_states[track_id] = {}
        if track_id not in self.position_history:
            self.position_history[track_id] = []

        # Keep last 20 positions for trajectory analysis
        self.position_history[track_id].append((norm_x, norm_y, now))
        if len(self.position_history[track_id]) > 20:
            self.position_history[track_id].pop(0)

        prev_pos = self.position_history[track_id][-2] if len(self.position_history[track_id]) >= 2 else (norm_x, norm_y, now)

        for zone_id, zone in self.zones.items():
            if zone.camera_id != camera_id:
                continue

            currently_inside = zone.is_inside(norm_x, norm_y)
            zone_state = self.track_states[track_id].get(zone_id, {
                "was_inside": False,
                "first_inside_time": None,
                "loiter_alerted": False,
                "entry_alerted": False
            })

            was_inside = zone_state["was_inside"]
            boundary_crossed = zone.line_crosses_boundary((prev_pos[0], prev_pos[1]), (norm_x, norm_y))

            # Direction-Aware Rule 1: Outside -> Inside (ENTRY / INTRUSION)
            if not was_inside and currently_inside:
                zone_state["was_inside"] = True
                zone_state["first_inside_time"] = now
                zone_state["entry_alerted"] = True
                zone_state["loiter_alerted"] = False

                event = {
                    "event_id": str(uuid.uuid4()),
                    "camera_id": camera_id,
                    "zone_id": zone.zone_id,
                    "zone_name": zone.name,
                    "zone_type": zone.zone_type,
                    "track_id": track_id,
                    "class_name": class_name,
                    "event_type": "INTRUSION_ENTRY" if zone.zone_type == "RESTRICTED" else "ZONE_ENTRY",
                    "timestamp": now,
                    "confidence": confidence,
                    "bbox": bbox,
                    "norm_position": [norm_x, norm_y],
                    "trajectory_prev": [prev_pos[0], prev_pos[1]],
                    "direction": "OUTSIDE_TO_INSIDE",
                    "loitering_seconds": 0.0
                }
                events.append(event)

            # Direction-Aware Rule 2: Inside -> Outside (EXIT)
            elif was_inside and not currently_inside:
                dwell_time = (now - zone_state["first_inside_time"]) if zone_state["first_inside_time"] else 0.0
                zone_state["was_inside"] = False
                zone_state["first_inside_time"] = None
                zone_state["loiter_alerted"] = False

                event = {
                    "event_id": str(uuid.uuid4()),
                    "camera_id": camera_id,
                    "zone_id": zone.zone_id,
                    "zone_name": zone.name,
                    "zone_type": zone.zone_type,
                    "track_id": track_id,
                    "class_name": class_name,
                    "event_type": "ZONE_EXIT",
                    "timestamp": now,
                    "confidence": confidence,
                    "bbox": bbox,
                    "norm_position": [norm_x, norm_y],
                    "trajectory_prev": [prev_pos[0], prev_pos[1]],
                    "direction": "INSIDE_TO_OUTSIDE",
                    "loitering_seconds": dwell_time
                }
                events.append(event)

            # Rule 3: Continued Inside (Loitering check)
            elif was_inside and currently_inside:
                if zone_state["first_inside_time"] is not None:
                    dwell = now - zone_state["first_inside_time"]
                    if dwell >= self.loitering_threshold and not zone_state["loiter_alerted"]:
                        zone_state["loiter_alerted"] = True
                        event = {
                            "event_id": str(uuid.uuid4()),
                            "camera_id": camera_id,
                            "zone_id": zone.zone_id,
                            "zone_name": zone.name,
                            "zone_type": zone.zone_type,
                            "track_id": track_id,
                            "class_name": class_name,
                            "event_type": "LOITERING",
                            "timestamp": now,
                            "confidence": confidence,
                            "bbox": bbox,
                            "norm_position": [norm_x, norm_y],
                            "loitering_seconds": round(dwell, 1),
                            "direction": "STATIONARY_INSIDE"
                        }
                        events.append(event)

            self.track_states[track_id][zone_id] = zone_state

        return events

    def cleanup_old_tracks(self, active_track_ids: List[int]):
        """Remove tracks that are no longer active to prevent memory bloat, with a 5 frame grace period."""
        current_ids = set(active_track_ids)
        
        # Reset absence for active tracks
        for tid in current_ids:
            if tid in self.track_absence_frames:
                del self.track_absence_frames[tid]
                
        # Increment absence for missing tracks
        missing_tids = [tid for tid in self.track_states if tid not in current_ids]
        for tid in missing_tids:
            self.track_absence_frames[tid] = self.track_absence_frames.get(tid, 0) + 1
            if self.track_absence_frames[tid] >= self.max_absence_frames:
                del self.track_states[tid]
                if tid in self.position_history:
                    del self.position_history[tid]
                del self.track_absence_frames[tid]