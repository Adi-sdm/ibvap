"""
Camera Health & Stream Telemetry Watchdog for IBVAP
Monitors live frame rate, detects video freeze, stream disconnection, and sensor blinding.
"""
import time
import cv2
import numpy as np
from typing import Dict, Any, Optional

class CameraHealthMonitor:
    def __init__(self, camera_id: str, expected_fps: float = 20.0):
        self.camera_id = camera_id
        self.expected_fps = expected_fps
        self.frame_count = 0
        self.start_time = time.time()
        self.last_frame_time = time.time()
        self.prev_gray: Optional[np.ndarray] = None
        self.consecutive_frozen_frames = 0
        self.frozen_threshold = 30 # ~1.5 seconds at 20fps
        self.status = "ONLINE"
        self.dropped_frames = 0
        self.recent_fps = expected_fps

    def update(self, frame: Optional[np.ndarray]) -> Dict[str, Any]:
        """
        Ingests frame and returns real-time camera health metrics.
        """
        now = time.time()
        time_since_last = now - self.last_frame_time
        
        expected_interval = 1.0 / self.expected_fps
        if time_since_last > (2 * expected_interval) and frame is not None:
            self.dropped_frames += 1

        # Check Disconnect / Offline
        if frame is None or time_since_last > 3.0:
            self.status = "OFFLINE"
            return {
                "camera_id": self.camera_id,
                "status": "OFFLINE",
                "fps": 0.0,
                "is_frozen": False,
                "dropped_frames": self.dropped_frames,
                "frame_interval_ms": round(time_since_last * 1000, 1),
                "error": "Stream disconnected or frame timeout"
            }

        self.frame_count += 1
        elapsed = now - self.start_time
        if elapsed >= 1.0:
            self.recent_fps = round(self.frame_count / elapsed, 1)
            self.frame_count = 0
            self.start_time = now

        # Convert to small gray frame for fast motion difference
        small_gray = cv2.resize(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), (160, 120))

        # Check Frozen Video
        is_frozen = False
        if self.prev_gray is not None:
            diff = np.mean(cv2.absdiff(self.prev_gray, small_gray))
            if diff < 0.25: # Virtually identical frames
                self.consecutive_frozen_frames += 1
                if self.consecutive_frozen_frames >= self.frozen_threshold:
                    is_frozen = True
            else:
                self.consecutive_frozen_frames = 0
        self.prev_gray = small_gray
        self.last_frame_time = now

        # Health status evaluation
        if is_frozen:
            self.status = "FROZEN"
        elif self.recent_fps < (self.expected_fps * 0.4):
            self.status = "DEGRADED_FPS"
        else:
            self.status = "ONLINE"

        return {
            "camera_id": self.camera_id,
            "status": self.status,
            "fps": self.recent_fps,
            "is_frozen": is_frozen,
            "dropped_frames": self.dropped_frames,
            "frame_interval_ms": round(time_since_last * 1000, 1)
        }