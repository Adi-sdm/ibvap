"""
ANPR (Automatic Number Plate Recognition) Engine for IBVAP
Vehicle Detection -> Plate Localization -> OpenCV Contrast Enhancement -> Offline OCR -> Format Validation & Confidence Flagging
No dummy data: Only outputs real OCR results with confidence metrics.
"""
import cv2
import numpy as np
import re
from typing import Dict, Any, Optional, Tuple

class ANPREngine:
    def __init__(self, use_easyocr: bool = True, min_confidence: float = 0.75):
        self.min_confidence = min_confidence
        self.reader = None
        self.available = False
        self.use_easyocr = use_easyocr
        if use_easyocr:
            try:
                import easyocr
                self.reader = easyocr.Reader(['en'], gpu=False, verbose=False)
                self.available = True
            except ImportError:
                print("[ANPR] Warning: easyocr not installed. ANPR is disabled.")
            except Exception as e:
                print(f"[ANPR] EasyOCR init: {e}")

    def recognize(self, frame: np.ndarray, x1: int, y1: int, x2: int, y2: int) -> Optional[Dict[str, Any]]:
        if not self.available:
            return None
        return self.extract_plate_from_vehicle(frame, [x1, y1, x2, y2], "vehicle")

    def preprocess_plate(self, plate_crop: np.ndarray) -> np.ndarray:
        if plate_crop is None or plate_crop.size == 0:
            return plate_crop

        h, w = plate_crop.shape[:2]
        if h < 40 or w < 120:
            plate_crop = cv2.resize(plate_crop, (max(160, w * 2), max(60, h * 2)), interpolation=cv2.INTER_CUBIC)

        gray = cv2.cvtColor(plate_crop, cv2.COLOR_BGR2GRAY) if len(plate_crop.shape) == 3 else plate_crop
        filtered = cv2.bilateralFilter(gray, 11, 17, 17)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        return clahe.apply(filtered)

    def validate_format(self, text: str) -> Tuple[bool, str]:
        cleaned = re.sub(r'[^A-Z0-9]', '', text.upper())
        indian_pattern = r'^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$'
        if re.match(indian_pattern, cleaned):
            return True, cleaned
        
        if 4 <= len(cleaned) <= 12 and any(c.isalnum() for c in cleaned):
            return True, cleaned

        return False, cleaned

    def extract_plate_from_vehicle(self, frame: np.ndarray, vehicle_bbox: list, vehicle_type: str = "car") -> Optional[Dict[str, Any]]:
        x1, y1, x2, y2 = [int(v) for v in vehicle_bbox]
        h, w = frame.shape[:2]
        x1, y1, x2, y2 = max(0, x1), max(0, y1), min(w, x2), min(h, y2)
        
        if (x2 - x1) < 30 or (y2 - y1) < 30:
            return None

        veh_crop = frame[y1:y2, x1:x2]
        vh, vw = veh_crop.shape[:2]

        plate_roi_y1 = int(vh * 0.45)
        plate_roi = veh_crop[plate_roi_y1:vh, :]
        if plate_roi.size == 0:
            return None

        enhanced = self.preprocess_plate(plate_roi)
        plate_text = ""
        confidence = 0.0

        if self.reader is not None:
            try:
                results = self.reader.readtext(enhanced, detail=1)
                best_conf = 0.0
                best_text = ""
                for bbox, text, conf in results:
                    cleaned_candidate = re.sub(r'[^A-Z0-9]', '', text.upper())
                    if len(cleaned_candidate) >= 3 and conf > best_conf:
                        best_conf = float(conf)
                        best_text = text.upper().strip()
                plate_text = best_text
                confidence = best_conf
            except Exception as e:
                print(f"[ANPR] OCR error: {e}")

        # If no valid text detected by OCR, do not hallucinate a fake plate
        if not plate_text or len(re.sub(r'[^A-Z0-9]', '', plate_text)) < 3:
            return None

        is_valid_format, normalized_plate = self.validate_format(plate_text)
        verification_required = (confidence < self.min_confidence) or (not is_valid_format)

        return {
            "plate": plate_text,
            "normalized_plate": normalized_plate,
            "confidence": round(confidence, 2),
            "vehicle_type": vehicle_type,
            "is_valid_format": is_valid_format,
            "verification_required": verification_required,
            "status_label": "VERIFIED" if not verification_required else "⚠ Verification Required"
        }

anpr_engine = ANPREngine(use_easyocr=True)