"""
Frame Annotator Engine
High-performance OpenCV HUD overlay renderer for IBVAP live streams.
Renders enterprise-grade tactical overlays based on dynamic camera configuration.
"""

import cv2
import numpy as np
from typing import List, Dict, Any, Optional

# Tactical Palette (BGR for OpenCV)
COLOR_RESTRICTED = (40, 40, 230)    # Red / Rose
COLOR_WARNING = (30, 140, 240)       # Amber
COLOR_CHECKPOINT = (240, 160, 40)    # Sky / Blue
COLOR_NEUTRAL = (180, 180, 180)      # Slate Gray
COLOR_PERSON = (50, 50, 235)         # Threat red
COLOR_VEHICLE = (235, 170, 40)       # Cyan/Blue
COLOR_ANIMAL = (50, 200, 80)         # Green
COLOR_BAG = (220, 80, 200)           # Purple

class FrameAnnotator:
    """Renders professional overlays onto video frames."""

    def __init__(self):
        self.font = cv2.FONT_HERSHEY_SIMPLEX

    def annotate(
        self,
        frame: np.ndarray,
        boxes: List[Dict[str, Any]],
        zones: List[Any],
        overlay_config: Optional[Dict[str, bool]] = None,
        telemetry: Optional[Dict[str, Any]] = None,
        trajectories: Optional[Dict[int, list]] = None
    ) -> np.ndarray:
        """Render annotations onto frame according to overlay configuration."""
        if frame is None:
            return frame

        config = overlay_config or {
            "labels": True,
            "confidence": True,
            "tracks": True,
            "zones": True,
            "speed": False,
            "debug": False
        }

        h, w = frame.shape[:2]
        output = frame.copy()

        # 1. Draw Virtual Zones
        if config.get("zones", True) and zones:
            output = self._draw_zones(output, zones, w, h)

        # 2. Draw Track Trajectories (Historical motion breadcrumbs)
        if config.get("tracks", True) and trajectories:
            output = self._draw_trajectories(output, trajectories, w, h)

        # 3. Draw Detections & Bounding Boxes
        if boxes:
            output = self._draw_boxes(output, boxes, config)

        # 4. Draw Operator Telemetry HUD
        if telemetry or config.get("debug", False):
            output = self._draw_telemetry(output, telemetry or {}, config, w, h)

        return output

    def _draw_zones(self, frame: np.ndarray, zones: List[Any], w: int, h: int) -> np.ndarray:
        overlay = frame.copy()
        for zone in zones:
            try:
                # Handle both dict and VirtualZone objects
                poly = getattr(zone, "polygon", None)
                if poly is None and isinstance(zone, dict):
                    poly = zone.get("polygon") or zone.get("polygon_coords")
                if not poly:
                    continue

                pts = np.array([[int(p[0] * w), int(p[1] * h)] for p in poly], np.int32)
                if len(pts) < 3:
                    continue
                pts = pts.reshape((-1, 1, 2))

                ztype = getattr(zone, "zone_type", "RESTRICTED")
                if isinstance(zone, dict):
                    ztype = zone.get("zone_type", "RESTRICTED")

                color = COLOR_RESTRICTED if ztype == "RESTRICTED" else (COLOR_WARNING if ztype == "WARNING" else COLOR_CHECKPOINT)

                # Fill semi-transparent polygon
                cv2.fillPoly(overlay, [pts], color)
                # Outer solid border
                cv2.polylines(frame, [pts], True, color, 2, cv2.LINE_AA)

                # Zone label badge
                name = getattr(zone, "name", ztype)
                if isinstance(zone, dict):
                    name = zone.get("name", ztype)
                centroid = pts.mean(axis=0)[0].astype(int)
                label = f"[{ztype}] {name}"
                (lw, lh), _ = cv2.getTextSize(label, self.font, 0.45, 1)
                cv2.rectangle(frame, (centroid[0] - 4, centroid[1] - lh - 4), (centroid[0] + lw + 4, centroid[1] + 4), (20, 20, 20), -1)
                cv2.putText(frame, label, (centroid[0], centroid[1]), self.font, 0.45, (255, 255, 255), 1, cv2.LINE_AA)
            except Exception:
                continue

        # Blend semi-transparent zones (alpha = 0.20)
        return cv2.addWeighted(overlay, 0.20, frame, 0.80, 0)

    def _draw_trajectories(self, frame: np.ndarray, trajectories: Dict[int, list], w: int, h: int) -> np.ndarray:
        for tid, points in trajectories.items():
            if not points or len(points) < 2:
                continue
            # Draw last 15 points
            recent = points[-15:]
            for i in range(1, len(recent)):
                p1 = (int(recent[i - 1][0] * w), int(recent[i - 1][1] * h))
                p2 = (int(recent[i][0] * w), int(recent[i][1] * h))
                alpha = i / len(recent)
                color = (int(255 * alpha), int(180 * alpha), 40)
                cv2.line(frame, p1, p2, color, max(1, int(2 * alpha)), cv2.LINE_AA)
        return frame

    def _draw_boxes(self, frame: np.ndarray, boxes: List[Dict[str, Any]], config: Dict[str, bool]) -> np.ndarray:
        for b in boxes:
            try:
                x1, y1, x2, y2 = [int(v) for v in b.get("bbox", [0, 0, 0, 0])]
                cls_name = b.get("class_name", "target")
                conf = b.get("confidence", 0.0)
                tid = b.get("track_id")
                beh = b.get("behaviour", "")

                frs = b.get("frs")
                # Assign color
                if frs and frs.get("is_watchlist"):
                    color = (30, 30, 240) # Red Watchlist
                elif frs and frs.get("status") == "MATCH":
                    color = (50, 205, 50) # Lime Green Verified Match
                elif frs and (frs.get("status") == "UNKNOWN_PREVIOUSLY_SEEN" or frs.get("identity_state") == "UNKNOWN_PREVIOUSLY_SEEN"):
                    color = (220, 180, 50) # Cyan / Light Slate Previously Seen Unknown
                elif frs and (frs.get("status") == "UNKNOWN" or frs.get("identity_state") == "UNKNOWN_NEW"):
                    color = (180, 160, 120) # Slate Neutral Unknown
                elif frs and frs.get("status") == "UNCERTAIN":
                    color = (30, 140, 240) # Amber Uncertain
                elif cls_name == "person":
                    color = COLOR_PERSON if (beh in ["Running", "Direction Reversal"] or b.get("in_restricted")) else COLOR_WARNING
                elif cls_name in ["car", "truck", "bus", "motorcycle"]:
                    color = COLOR_VEHICLE
                elif cls_name in ["dog", "cat", "horse", "cow", "sheep"]:
                    color = COLOR_ANIMAL
                elif cls_name in ["backpack", "handbag", "suitcase"]:
                    color = COLOR_BAG
                else:
                    color = COLOR_NEUTRAL

                # Draw corner brackets instead of heavy solid box (modern enterprise HUD look)
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 1, cv2.LINE_AA)
                corner_len = min(15, (x2 - x1) // 4, (y2 - y1) // 4)
                if corner_len > 3:
                    # Top-left
                    cv2.line(frame, (x1, y1), (x1 + corner_len, y1), color, 2)
                    cv2.line(frame, (x1, y1), (x1, y1 + corner_len), color, 2)
                    # Top-right
                    cv2.line(frame, (x2, y1), (x2 - corner_len, y1), color, 2)
                    cv2.line(frame, (x2, y1), (x2, y1 + corner_len), color, 2)
                    # Bottom-left
                    cv2.line(frame, (x1, y2), (x1 + corner_len, y2), color, 2)
                    cv2.line(frame, (x1, y2), (x1, y2 - corner_len), color, 2)
                    # Bottom-right
                    cv2.line(frame, (x2, y2), (x2 - corner_len, y2), color, 2)
                    cv2.line(frame, (x2, y2), (x2, y2 - corner_len), color, 2)

                # Construct Badge text
                parts = []
                if frs and frs.get("is_watchlist"):
                    parts.append(f"[WATCHLIST ALERT] {frs.get('name', 'POI').upper()}")
                elif frs and frs.get("status") == "MATCH":
                    match_conf = int(frs.get("confidence", 0.0) * 100)
                    parts.append(f"[MATCH] {frs.get('name', 'VERIFIED')} ({match_conf}%)")
                elif frs and (frs.get("status") == "UNKNOWN_PREVIOUSLY_SEEN" or frs.get("identity_state") == "UNKNOWN_PREVIOUSLY_SEEN"):
                    cand_id = frs.get("candidate_id", "UNKNOWN")
                    seen_conf = int(frs.get("confidence", 0.0) * 100)
                    parts.append(f"[SEEN UNKNOWN] {cand_id} ({seen_conf}%)")
                elif frs and (frs.get("status") == "UNKNOWN" or frs.get("identity_state") == "UNKNOWN_NEW"):
                    cand_id = frs.get("candidate_id") or f"#{tid}"
                    parts.append(f"[NEW UNKNOWN] {cand_id}")
                elif frs and frs.get("status") == "UNCERTAIN":
                    parts.append("[RECOGNITION UNCERTAIN]")
                else:
                    if config.get("tracks", True) and tid is not None:
                        parts.append(f"#{tid}")
                    if config.get("labels", True):
                        parts.append(cls_name.upper())
                    if config.get("confidence", True):
                        parts.append(f"{int(conf * 100)}%")

                # Situational Safety Tag
                if frs and frs.get("situation"):
                    parts.append(f"[{frs['situation']}]")

                if beh and beh not in ["Normal", "Walking"]:
                    parts.append(f"[{beh.upper()}]")

                if parts:
                    tag = " ".join(parts)
                    (tw, th), _ = cv2.getTextSize(tag, self.font, 0.40, 1)
                    # Draw dark pill background
                    tag_y1 = max(0, y1 - th - 6)
                    tag_y2 = max(th + 6, y1)
                    cv2.rectangle(frame, (x1, tag_y1), (x1 + tw + 8, tag_y2), (15, 23, 42), -1)
                    cv2.rectangle(frame, (x1, tag_y1), (x1 + tw + 8, tag_y2), color, 1)
                    cv2.putText(frame, tag, (x1 + 4, tag_y2 - 3), self.font, 0.40, (255, 255, 255), 1, cv2.LINE_AA)
            except Exception:
                continue

        return frame

    def _draw_telemetry(self, frame: np.ndarray, telemetry: Dict[str, Any], config: Dict[str, bool], w: int, h: int) -> np.ndarray:
        fps = telemetry.get("fps", 0.0)
        profile = telemetry.get("profile", "Perimeter")
        sector = telemetry.get("sector", "Sector Alpha")
        
        hud_text = f"IBVAP AI SECURE | {sector} | {profile} | {fps:.1f} FPS"
        (tw, th), _ = cv2.getTextSize(hud_text, self.font, 0.40, 1)
        
        cv2.rectangle(frame, (8, 8), (18 + tw, 14 + th), (15, 23, 42), -1)
        cv2.rectangle(frame, (8, 8), (18 + tw, 14 + th), (51, 65, 85), 1)
        cv2.putText(frame, hud_text, (13, 10 + th), self.font, 0.40, (148, 163, 184), 1, cv2.LINE_AA)
        
        # Live indicator dot
        cv2.circle(frame, (w - 20, 18), 5, (50, 220, 50), -1)
        cv2.putText(frame, "LIVE", (w - 60, 22), self.font, 0.38, (50, 220, 50), 1, cv2.LINE_AA)

        # Check for sensor occlusion / privacy shutter closed (mean pixel < 3.0)
        if np.mean(frame) < 3.0:
            warn_title = "HARDWARE ACTIVE — ZERO LIGHT DETECTED"
            warn_sub = "Webcam lens is covered or physical privacy shutter is closed."
            (wt1, ht1), _ = cv2.getTextSize(warn_title, self.font, 0.45, 1)
            (wt2, ht2), _ = cv2.getTextSize(warn_sub, self.font, 0.36, 1)
            max_tw = max(wt1, wt2)
            cx, cy = w // 2, h // 2
            cv2.rectangle(frame, (cx - max_tw//2 - 14, cy - 26), (cx + max_tw//2 + 14, cy + 26), (15, 23, 42), -1)
            cv2.rectangle(frame, (cx - max_tw//2 - 14, cy - 26), (cx + max_tw//2 + 14, cy + 26), (40, 140, 240), 1)
            cv2.putText(frame, warn_title, (cx - wt1//2, cy - 6), self.font, 0.45, (40, 180, 255), 1, cv2.LINE_AA)
            cv2.putText(frame, warn_sub, (cx - wt2//2, cy + 15), self.font, 0.36, (203, 213, 225), 1, cv2.LINE_AA)

        return frame

frame_annotator = FrameAnnotator()
