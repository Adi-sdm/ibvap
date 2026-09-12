"""
IBVAP Modular Small-Arms Detector Interface
SIH26187 — Intelligent Border Video Analytics Platform

Provides truthful detection capabilities for weapon-like objects carried by tracked persons.
Requires dedicated weights file (models/small_arms_yolov8.pt).
Truthful contract: If weights are absent, status is NOT LOADED, never simulating weapon detections.
"""

from pathlib import Path
from typing import Dict, Any, List, Optional
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_MODEL_PATH = PROJECT_ROOT / "models" / "small_arms_yolov8.pt"

class SmallArmsDetector:
    def __init__(self, model_path: Path = DEFAULT_MODEL_PATH):
        self.model_path = Path(model_path)
        self.model = None
        self.available = False
        self.status = "NOT LOADED"
        self.reason = f"Weights file '{self.model_path.name}' not found on filesystem."
        self._load_model()

    def _load_model(self):
        if not self.model_path.exists():
            self.model = None
            self.available = False
            self.status = "NOT LOADED"
            self.reason = f"Weights file '{self.model_path.name}' not found."
            return

        try:
            from ultralytics import YOLO
            self.model = YOLO(str(self.model_path))
            self.available = True
            self.status = "ONLINE"
            self.reason = "Model loaded successfully."
        except Exception as e:
            self.model = None
            self.available = False
            self.status = "LOAD_ERROR"
            self.reason = f"Failed to initialize weights: {e}"

    def get_status(self) -> Dict[str, Any]:
        return {
            "module": "small_arms_detector",
            "available": self.available,
            "status": self.status,
            "model_path": str(self.model_path),
            "reason": self.reason
        }

    def detect_weapon(self, person_crop: np.ndarray, conf_threshold: float = 0.5) -> Optional[Dict[str, Any]]:
        """
        Run inference on a cropped person frame.
        Returns detection info if weapon detected, or None if unavailable / no detection.
        """
        if not self.available or self.model is None or person_crop is None or person_crop.size == 0:
            return None

        try:
            results = self.model.predict(source=person_crop, conf=conf_threshold, verbose=False)
            if not results or len(results[0].boxes) == 0:
                return None

            boxes = results[0].boxes
            top_box = boxes[0]
            conf = float(top_box.conf[0])
            cls_id = int(top_box.cls[0])
            cls_name = self.model.names.get(cls_id, "Potential weapon-like object")

            return {
                "detected": True,
                "label": "Potential weapon-like object",
                "class_name": cls_name,
                "confidence": conf,
                "epistemic_tag": "VERIFICATION REQUIRED"
            }
        except Exception as e:
            print(f"[SMALL_ARMS] Inference error: {e}")
            return None

small_arms_detector = SmallArmsDetector()
