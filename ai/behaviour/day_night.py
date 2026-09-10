"""
Adaptive Day/Night & Environmental Lighting Sensor for IBVAP
Extracts real-time illumination statistics from frames without requiring external lux meters.
"""
import cv2
import numpy as np
from typing import Dict, Any, Tuple

class EnvironmentalSensor:
    def __init__(self, night_threshold: float = 65.0, dark_threshold: float = 30.0):
        self.night_threshold = night_threshold
        self.dark_threshold = dark_threshold

    def analyze_frame(self, frame: np.ndarray) -> Dict[str, Any]:
        """
        Analyzes frame luminance, contrast, and histogram distribution.
        """
        if frame is None or frame.size == 0:
            return {"is_night": False, "brightness": 0.0, "contrast": 0.0, "condition": "UNKNOWN"}

        # Convert to Grayscale
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if len(frame.shape) == 3 else frame
        
        # Calculate mean luminance and standard deviation (contrast)
        mean_brightness = float(np.mean(gray))
        contrast = float(np.std(gray))

        # Determine condition
        if mean_brightness < self.dark_threshold:
            condition = "NIGHT_PITCH_BLACK"
            is_night = True
        elif mean_brightness < self.night_threshold:
            condition = "NIGHT_LOW_LIGHT"
            is_night = True
        elif contrast < 18.0 and mean_brightness > 120.0:
            condition = "DAY_FOG_HAZE"
            is_night = False
        else:
            condition = "DAY_CLEAR"
            is_night = False

        return {
            "is_night": is_night,
            "brightness": round(mean_brightness, 1),
            "contrast": round(contrast, 1),
            "condition": condition
        }

environmental_sensor = EnvironmentalSensor()