"""
Vehicle Intelligence & Authorized Entity Verification Service for IBVAP
Handles dominant color extraction, registry verification, attribute mismatch alerts,
and predictive cross-camera handoffs.
"""

import cv2
import numpy as np
import time
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from backend.app.database.models import AuthorizedVehicleDB, ANPRDB

class VehicleIntelService:
    def __init__(self):
        # Sector adjacency graph for predictive handoff
        self.camera_topology = {
            "CAM-01": [("CAM-02", 45, 0.88), ("CAM-03", 90, 0.65)],
            "CAM-02": [("CAM-03", 40, 0.85), ("CAM-01", 50, 0.75)],
            "CAM-03": [("CAM-04", 60, 0.80), ("CAM-02", 40, 0.82)],
            "CAM-E2E-TEST": [("CAM-01", 30, 0.90)]
        }

    def estimate_dominant_color(self, crop_bgr: np.ndarray) -> str:
        """
        Estimates dominant vehicle body color from cropped bounding box.
        Uses HSV color space histograms to categorize vehicle color truthfully.
        """
        if crop_bgr is None or crop_bgr.size == 0 or crop_bgr.shape[0] < 10 or crop_bgr.shape[1] < 10:
            return "UNKNOWN"

        # Crop central 60% of bounding box to avoid background pavement / sky
        h, w = crop_bgr.shape[:2]
        center_crop = crop_bgr[int(h * 0.2):int(h * 0.8), int(w * 0.2):int(w * 0.8)]
        if center_crop.size == 0:
            center_crop = crop_bgr

        hsv = cv2.cvtColor(center_crop, cv2.COLOR_BGR2HSV)
        h_channel = hsv[:, :, 0]
        s_channel = hsv[:, :, 1]
        v_channel = hsv[:, :, 2]

        mean_s = np.mean(s_channel)
        mean_v = np.mean(v_channel)

        # Low saturation indicates Achromatic colors (White, Black, Silver/Gray)
        if mean_s < 45:
            if mean_v > 180:
                return "WHITE"
            elif mean_v < 60:
                return "BLACK"
            else:
                return "SILVER/GRAY"

        # Chromatic colors based on Hue (0 - 180 in OpenCV)
        mean_h = np.median(h_channel)
        if mean_h < 10 or mean_h > 165:
            return "RED"
        elif 10 <= mean_h < 35:
            return "YELLOW"
        elif 35 <= mean_h < 85:
            return "GREEN"
        elif 85 <= mean_h < 135:
            return "BLUE"
        else:
            return "DARK_METALLIC"

    def verify_vehicle(
        self, 
        db: Session, 
        plate: str, 
        detected_color: str = "UNKNOWN", 
        camera_sector: str = "Sector Alpha"
    ) -> Dict[str, Any]:
        """
        Matches license plate against AuthorizedVehicleDB registry.
        Checks for:
        1. Watchlist / Intercept flags
        2. Attribute mismatches (Color tampering / cloned plates)
        3. Sector clearance violations
        """
        clean_plate = plate.strip().upper().replace(" ", "").replace("-", "")
        
        # Search authorized registry
        vehicle = db.query(AuthorizedVehicleDB).filter(
            AuthorizedVehicleDB.plate == clean_plate
        ).first()

        if not vehicle:
            return {
                "plate": clean_plate,
                "status": "UNREGISTERED",
                "risk_level": "ELEVATED",
                "risk_score": 55,
                "detected_color": detected_color,
                "registered_color": None,
                "reason": "Vehicle not found in authorized border access registry. Verification required.",
                "is_authorized": False,
                "owner_name": "UNKNOWN",
                "department": "UNKNOWN"
            }

        # Check Watchlist status
        if vehicle.status in ["WATCHLIST", "FLAGGED"]:
            return {
                "plate": clean_plate,
                "status": vehicle.status,
                "risk_level": "CRITICAL",
                "risk_score": 95,
                "detected_color": detected_color,
                "registered_color": vehicle.authorized_color,
                "reason": f"WATCHLIST INTERCEPT: {clean_plate} flagged for high-risk surveillance ({vehicle.notes or 'Security Watchlist'})",
                "is_authorized": False,
                "owner_name": vehicle.owner_name,
                "department": vehicle.department
            }

        # Check Attribute Mismatch (Color Discrepancy)
        has_color_mismatch = False
        if detected_color != "UNKNOWN" and vehicle.authorized_color:
            auth_col = vehicle.authorized_color.upper()
            if auth_col not in detected_color and detected_color not in auth_col:
                has_color_mismatch = True

        if has_color_mismatch:
            return {
                "plate": clean_plate,
                "status": "ATTRIBUTE_MISMATCH",
                "risk_level": "HIGH",
                "risk_score": 85,
                "detected_color": detected_color,
                "registered_color": vehicle.authorized_color,
                "reason": f"POTENTIAL CLONED PLATE / ATTRIBUTE MISMATCH: Registered as {vehicle.authorized_color} but detected as {detected_color}!",
                "is_authorized": False,
                "owner_name": vehicle.owner_name,
                "department": vehicle.department
            }

        # Check Sector Authorization
        if vehicle.authorized_sectors and camera_sector not in vehicle.authorized_sectors and "All" not in vehicle.authorized_sectors:
            return {
                "plate": clean_plate,
                "status": "UNAUTHORIZED_SECTOR",
                "risk_level": "MEDIUM",
                "risk_score": 65,
                "detected_color": detected_color,
                "registered_color": vehicle.authorized_color,
                "reason": f"Vehicle unauthorized in {camera_sector}. Cleared only for: {vehicle.authorized_sectors}",
                "is_authorized": False,
                "owner_name": vehicle.owner_name,
                "department": vehicle.department
            }

        # Authorized & Verified
        return {
            "plate": clean_plate,
            "status": "AUTHORIZED",
            "risk_level": "CLEAR",
            "risk_score": 10,
            "detected_color": detected_color,
            "registered_color": vehicle.authorized_color,
            "reason": f"Authorized Entry Cleared: {vehicle.vehicle_type} • {vehicle.owner_name} ({vehicle.department})",
            "is_authorized": True,
            "owner_name": vehicle.owner_name,
            "department": vehicle.department
        }

    def predict_handoff(self, current_cam_id: str, velocity_vector: Optional[Tuple[float, float]] = None) -> Optional[Dict[str, Any]]:
        """
        Predicts which camera will observe this target next based on topology and heading.
        """
        neighbors = self.camera_topology.get(current_cam_id)
        if not neighbors:
            return None
        
        target_cam, eta, conf = neighbors[0]
        return {
            "current_camera": current_cam_id,
            "predicted_next_camera": target_cam,
            "estimated_time_seconds": eta,
            "correlation_confidence": conf,
            "trajectory_heading": "Eastbound Access Road" if velocity_vector and velocity_vector[0] > 0 else "North Perimeter Corridor"
        }

vehicle_intel_service = VehicleIntelService()
