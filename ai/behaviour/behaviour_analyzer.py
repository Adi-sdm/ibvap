"""Behaviour Analyzer — detects suspicious movement patterns from track history.

Analyzes position history of tracked objects to detect:
- Running (high speed)
- Loitering (staying in same area)
- Sudden direction change
- Group movement (multiple tracks with similar velocity)
- Unattended object (static non-person detection)
"""
import math
import time
from collections import defaultdict


class BehaviourAnalyzer:
    """Analyzes track position histories to detect behavioural anomalies."""
    
    def __init__(self, fps: float = 20.0):
        self.fps = max(fps, 1.0)
        # track_id -> list of (x, y, timestamp)
        self.track_histories = defaultdict(list)
        # track_id -> class_name
        self.track_classes = {}
        self.max_history = 60  # Keep last 60 positions (~3 seconds at 20fps)
        
        # Thresholds (in normalized coordinates per frame)
        self.running_speed_threshold = 0.02  # ~2% of frame width per frame = fast movement
        self.loitering_radius = 0.05  # Stay within 5% of frame dimensions
        self.loitering_time = 8.0  # seconds
        self.direction_change_angle = 120.0  # degrees
        self.group_proximity = 0.15  # 15% of frame dimensions
        self.group_velocity_similarity = 0.8  # cosine similarity threshold
        self.static_object_time = 15.0  # seconds for unattended object
    
    def update(self, track_id: int, x: float, y: float, class_name: str = "person"):
        """Add a new position for a track. x, y should be normalized [0, 1]."""
        now = time.time()
        self.track_histories[track_id].append((x, y, now))
        self.track_classes[track_id] = class_name
        
        # Trim history
        if len(self.track_histories[track_id]) > self.max_history:
            self.track_histories[track_id] = self.track_histories[track_id][-self.max_history:]
    
    def analyze(self, track_id: int) -> dict:
        """Analyze a track's behaviour. Returns dict of boolean flags."""
        result = {
            "is_running": False,
            "is_loitering": False,
            "has_direction_change": False,
            "is_group_movement": False,
            "is_unattended_object": False,
        }
        
        history = self.track_histories.get(track_id, [])
        if len(history) < 3:
            return result
        
        result["is_running"] = self._check_running(history)
        result["is_loitering"] = self._check_loitering(history)
        result["has_direction_change"] = self._check_direction_change(history)
        result["is_unattended_object"] = self._check_unattended(track_id, history)
        result["is_group_movement"] = self._check_group_movement(track_id)
        
        return result
    
    def _check_running(self, history: list) -> bool:
        """Check if recent movement speed exceeds threshold."""
        if len(history) < 5:
            return False
        recent = history[-5:]
        total_dist = 0
        for i in range(1, len(recent)):
            dx = recent[i][0] - recent[i-1][0]
            dy = recent[i][1] - recent[i-1][1]
            total_dist += math.sqrt(dx*dx + dy*dy)
        avg_speed = total_dist / (len(recent) - 1)
        return avg_speed > self.running_speed_threshold
    
    def _check_loitering(self, history: list) -> bool:
        """Check if track stays within a small radius for extended time."""
        if len(history) < 10:
            return False
        
        latest = history[-1]
        earliest_in_area = latest[2]  # timestamp
        
        # Walk backwards through history to find how long in same area
        for i in range(len(history) - 2, -1, -1):
            dx = history[i][0] - latest[0]
            dy = history[i][1] - latest[1]
            dist = math.sqrt(dx*dx + dy*dy)
            if dist > self.loitering_radius:
                break
            earliest_in_area = history[i][2]
        
        dwell_time = latest[2] - earliest_in_area
        return dwell_time >= self.loitering_time
    
    def _check_direction_change(self, history: list) -> bool:
        """Check for sudden direction reversal in recent movement."""
        if len(history) < 8:
            return False
        
        # Compare velocity vector of last 4 positions vs previous 4
        recent = history[-4:]
        prev = history[-8:-4]
        
        vx1 = prev[-1][0] - prev[0][0]
        vy1 = prev[-1][1] - prev[0][1]
        vx2 = recent[-1][0] - recent[0][0]
        vy2 = recent[-1][1] - recent[0][1]
        
        mag1 = math.sqrt(vx1*vx1 + vy1*vy1)
        mag2 = math.sqrt(vx2*vx2 + vy2*vy2)
        
        if mag1 < 0.001 or mag2 < 0.001:
            return False  # Not enough movement to determine direction
        
        cos_angle = (vx1*vx2 + vy1*vy2) / (mag1 * mag2)
        cos_angle = max(-1.0, min(1.0, cos_angle))  # Clamp for numerical stability
        angle = math.degrees(math.acos(cos_angle))
        
        return angle >= self.direction_change_angle
    
    def _check_unattended(self, track_id: int, history: list) -> bool:
        """Check if a non-person object has been stationary for extended time."""
        class_name = self.track_classes.get(track_id, "person")
        if class_name == "person":
            return False  # Only flag non-person objects
        
        if len(history) < 10:
            return False
        
        # Check if mostly stationary
        latest = history[-1]
        max_displacement = 0
        earliest_static = latest[2]
        
        for i in range(len(history) - 2, -1, -1):
            dx = history[i][0] - latest[0]
            dy = history[i][1] - latest[1]
            dist = math.sqrt(dx*dx + dy*dy)
            if dist > 0.02:  # Moved more than 2% of frame
                break
            earliest_static = history[i][2]
        
        static_time = latest[2] - earliest_static
        return static_time >= self.static_object_time
    
    def _check_group_movement(self, track_id: int) -> bool:
        """Check if this track is moving in a group (3+ tracks with similar velocity nearby)."""
        my_history = self.track_histories.get(track_id, [])
        if len(my_history) < 5:
            return False
        
        my_pos = my_history[-1]
        my_vel = (
            my_history[-1][0] - my_history[-3][0],
            my_history[-1][1] - my_history[-3][1]
        )
        
        nearby_similar = 0
        for other_id, other_history in self.track_histories.items():
            if other_id == track_id or len(other_history) < 5:
                continue
            
            other_pos = other_history[-1]
            dx = my_pos[0] - other_pos[0]
            dy = my_pos[1] - other_pos[1]
            dist = math.sqrt(dx*dx + dy*dy)
            
            if dist > self.group_proximity:
                continue
            
            other_vel = (
                other_history[-1][0] - other_history[-3][0],
                other_history[-1][1] - other_history[-3][1]
            )
            
            # Cosine similarity of velocity vectors
            dot = my_vel[0]*other_vel[0] + my_vel[1]*other_vel[1]
            mag1 = math.sqrt(my_vel[0]**2 + my_vel[1]**2)
            mag2 = math.sqrt(other_vel[0]**2 + other_vel[1]**2)
            
            if mag1 < 0.001 or mag2 < 0.001:
                continue
            
            similarity = dot / (mag1 * mag2)
            if similarity >= self.group_velocity_similarity:
                nearby_similar += 1
        
        return nearby_similar >= 2  # Need 3+ total (self + 2 others)
    
    def cleanup_tracks(self, active_track_ids: set):
        """Remove tracks that are no longer active."""
        stale = [tid for tid in self.track_histories if tid not in active_track_ids]
        for tid in stale:
            del self.track_histories[tid]
            self.track_classes.pop(tid, None)
