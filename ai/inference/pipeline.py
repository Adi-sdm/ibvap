import threading
import time
import queue
import json
import uuid
import cv2
import numpy as np
from pathlib import Path
from collections import defaultdict
from typing import Optional, Dict, Any, List

PROJECT_ROOT = Path(__file__).resolve().parents[2]

class CameraPipeline(threading.Thread):
    def __init__(self, camera_id: str, source: Any, 
                 model=None, yolo_lock=None,
                 event_callback=None, evidence_dir=None,
                 profile: str = "Border Fence Monitoring",
                 sector: str = "Sector Alpha",
                 enabled_modules: Optional[Dict[str, bool]] = None,
                 alert_threshold: int = 60,
                 overlay_config: Optional[Dict[str, bool]] = None,
                 gemini_enabled: bool = True):
        super().__init__(daemon=True)
        self.camera_id = camera_id
        self.source = source
        # Provide an isolated YOLO instance per camera pipeline for independent ByteTrack tracking
        if model is not None and getattr(model, "_ibvap_isolated", False):
            self.model = model
        else:
            try:
                from ultralytics import YOLO
                self.model = YOLO(str(PROJECT_ROOT / "models" / "yolov8n.pt"))
                self.model._ibvap_isolated = True
            except Exception as e:
                print(f"[{camera_id}] Error loading isolated detector: {e}")
                self.model = None
        self.yolo_lock = threading.Lock()
        self.event_callback = event_callback
        self.evidence_dir = Path(evidence_dir) if evidence_dir else PROJECT_ROOT / "database" / "evidence"
        self.evidence_dir.mkdir(parents=True, exist_ok=True)
        
        self.running = False
        self.latest_frame = None
        self.latest_annotated = None
        self.frame_lock = threading.Lock()
        self.config_lock = threading.Lock()
        self.health_status = {"status": "INITIALIZING", "fps": 0, "resolution": "", "is_frozen": False, "frame_interval_ms": 0}
        
        # Configuration attributes
        self.profile = profile
        self.sector = sector
        self.alert_threshold = alert_threshold
        self.gemini_enabled = gemini_enabled
        
        self.enabled_modules = enabled_modules or {
            "intrusion": True,
            "loitering": True,
            "direction": True,
            "group": True,
            "animal_filter": True,
            "anpr": True,
            "small_arms": False,
            "day_night": True
        }
        
        self.overlay_config = overlay_config or {
            "labels": True,
            "confidence": True,
            "tracks": True,
            "zones": True,
            "speed": False,
            "debug": False
        }
        
        # Track state with grace period
        self.track_last_seen = {}  # track_id -> frames_since_last_seen
        self.track_grace_frames = 5
        self.track_trajectories = defaultdict(list)
        self.latest_detections = []
        
        # Zone reload
        self.zones = []
        self.last_zone_reload = 0
        self.zone_reload_interval = 30  # seconds
        
        # Evidence queue (background capture)
        self.evidence_queue = queue.Queue(maxsize=20)
        
        # Recent frames buffer for evidence clips
        self.recent_frames = []
        self.max_recent_frames = 100
        
        # ANPR throttle
        self.anpr_last_run = {}
        self.anpr_cooldown = 10  # seconds per track
        
        # Gemini advisory throttle per camera
        self.last_gemini_call = 0
        self.gemini_cooldown = 15  # seconds
        
        # Frame counter
        self.frame_count = 0
        self.process_every_n = 2  # Process detection every 2nd frame
        
        # Active YOLO classes
        self.active_class_ids = [0, 1, 2, 3, 5, 7, 14, 15, 16, 17, 18, 19, 24, 26, 28]
        self._refresh_active_classes()
        
        # Import components
        from ai.zones.zone_manager import ZoneTracker
        from ai.behaviour.camera_health import CameraHealthMonitor
        from ai.behaviour.behaviour_analyzer import BehaviourAnalyzer
        from ai.anpr.anpr_engine import anpr_engine
        from ai.inference.annotator import frame_annotator
        from backend.app.services.risk_engine import risk_engine
        from backend.app.services.event_fusion import fusion_manager
        from backend.app.services.evidence_service import evidence_service
        
        self.zone_tracker = ZoneTracker()
        self.annotator = frame_annotator
        
        try:
            from ai.behaviour.day_night import EnvironmentalSensor
            self.env_sensor = EnvironmentalSensor()
        except ImportError:
            class DummyEnvSensor:
                def analyze(self, frame):
                    from ai.behaviour.day_night import environmental_sensor
                    return environmental_sensor.analyze_frame(frame)
            self.env_sensor = DummyEnvSensor()
            
        self.health_monitor = CameraHealthMonitor(camera_id)
        self.behaviour_analyzer = BehaviourAnalyzer()
        
        self.risk_engine = risk_engine
        self.fusion_manager = fusion_manager
        self.evidence_service = evidence_service
        self.anpr_engine = anpr_engine

    def _refresh_active_classes(self):
        """Map camera profile and enabled modules to active YOLO class IDs."""
        try:
            from backend.app.services.profile_service import profile_service
            p_data = profile_service.get_profile(self.profile)
            base_ids = set(p_data.get("class_ids", [0, 2, 3, 5, 7, 24, 26, 28]))
            
            # Always ensure animals are detected if animal filter is on
            if self.enabled_modules.get("animal_filter", True):
                base_ids.update([15, 16, 17, 18, 19])  # cat, dog, horse, sheep, cow
                
            # If ANPR is disabled, remove vehicle classes unless profile mandates them
            if not self.enabled_modules.get("anpr", True) and self.profile == "Border Fence Monitoring":
                base_ids.discard(2)
                base_ids.discard(3)
                base_ids.discard(5)
                base_ids.discard(7)
                
            self.active_class_ids = list(base_ids)
        except Exception as e:
            print(f"[{self.camera_id}] Error calculating active classes: {e}")
            self.active_class_ids = [0, 1, 2, 3, 5, 7, 15, 16, 17, 18, 19, 24, 26, 28]

    def update_config(self, new_config: Dict[str, Any]):
        """Safely hot-reload camera operational configuration without restarting thread or connection."""
        with self.config_lock:
            if "profile" in new_config and new_config["profile"]:
                self.profile = str(new_config["profile"])
            if "sector" in new_config and new_config["sector"] is not None:
                self.sector = str(new_config["sector"])
            if "enabled_modules" in new_config and new_config["enabled_modules"] is not None:
                mods = new_config["enabled_modules"]
                if isinstance(mods, str):
                    try:
                        mods = json.loads(mods)
                    except Exception:
                        mods = {}
                if isinstance(mods, dict):
                    self.enabled_modules.update(mods)
            if "alert_threshold" in new_config and new_config["alert_threshold"] is not None:
                try:
                    self.alert_threshold = int(new_config["alert_threshold"])
                except ValueError:
                    pass
            if "overlay_config" in new_config and new_config["overlay_config"] is not None:
                ov = new_config["overlay_config"]
                if isinstance(ov, str):
                    try:
                        ov = json.loads(ov)
                    except Exception:
                        ov = {}
                if isinstance(ov, dict):
                    self.overlay_config.update(ov)
            if "gemini_enabled" in new_config and new_config["gemini_enabled"] is not None:
                self.gemini_enabled = bool(new_config["gemini_enabled"])
                
            self._refresh_active_classes()
            self._load_zones()
        print(f"[{self.camera_id}] Configuration hot-reloaded dynamically (Profile: {self.profile}).")

    def _load_zones(self):
        """Reload zones from database."""
        try:
            from backend.app.database.session import SessionLocal
            from backend.app.database.models import VirtualZoneDB
            from ai.zones.zone_manager import VirtualZone
            
            db = SessionLocal()
            try:
                db_zones = db.query(VirtualZoneDB).filter(
                    VirtualZoneDB.camera_id == self.camera_id
                ).all()
                
                self.zones = []
                for z in db_zones:
                    coords = json.loads(z.polygon_coords)
                    points = [c for c in coords]
                    self.zones.append(VirtualZone(
                        zone_id=z.zone_id,
                        camera_id=self.camera_id,
                        name=z.name,
                        zone_type=z.zone_type,
                        polygon=points
                    ))
                self.last_zone_reload = time.time()
                
                self.zone_tracker.clear_zones(self.camera_id)
                for z in self.zones:
                    self.zone_tracker.register_zone(z)
            finally:
                db.close()
        except Exception as e:
            print(f"[{self.camera_id}] Zone reload error: {e}")

    def _open_capture(self) -> cv2.VideoCapture:
        """Open video capture with RTSP, webcam, and local video support."""
        source = self.source
        
        if isinstance(source, int) or (isinstance(source, str) and (source.isdigit() or source.lower() == "webcam")):
            cam_idx = int(source) if (isinstance(source, int) or source.isdigit()) else 0
            cap = cv2.VideoCapture(cam_idx, cv2.CAP_DSHOW)
            if not cap.isOpened():
                cap = cv2.VideoCapture(cam_idx)
        elif isinstance(source, str) and source.startswith("rtsp://"):
            import os
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|stimeout;5000000"
            cap = cv2.VideoCapture(source)
        else:
            cap = cv2.VideoCapture(source)

        if cap.isOpened():
            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = cap.get(cv2.CAP_PROP_FPS) or 20.0
            self.health_status["resolution"] = f"{w}x{h}"
            self.health_status["fps"] = round(fps, 1)
            print(f"[{self.camera_id}] Video feed connected: {w}x{h} @ {fps:.1f} FPS")
        return cap

    def run(self):
        self.running = True
        self._load_zones()
        
        # Start evidence worker thread
        evidence_thread = threading.Thread(target=self._evidence_worker, daemon=True)
        evidence_thread.start()
        
        cap = self._open_capture()
        reconnect_delay = 5
        max_reconnect_delay = 30
        
        while self.running:
            if not cap or not cap.isOpened():
                self.health_status["status"] = "RECONNECTING"
                time.sleep(reconnect_delay)
                reconnect_delay = min(reconnect_delay * 2, max_reconnect_delay)
                cap = self._open_capture()
                continue
            
            reconnect_delay = 5
            ret, frame = cap.read()
            
            if not ret:
                if isinstance(self.source, int) or (isinstance(self.source, str) and (str(self.source).isdigit() or str(self.source).lower() == "webcam")):
                    time.sleep(0.05)
                    continue
                elif not (isinstance(self.source, str) and self.source.startswith("rtsp://")):
                    cap.release()
                    cap = self._open_capture()
                    continue
                else:
                    cap.release()
                    cap = None
                    continue

            # Update health
            health = self.health_monitor.update(frame)
            self.health_status.update(health)
            self.health_status["status"] = "ONLINE"
            
            # Buffer for evidence
            self.recent_frames.append(frame)
            if len(self.recent_frames) > self.max_recent_frames:
                self.recent_frames.pop(0)
            
            self.frame_count += 1
            
            # Periodic zone reload
            if time.time() - self.last_zone_reload > self.zone_reload_interval:
                self._load_zones()
            
            # Process detection every Nth frame
            if self.frame_count % self.process_every_n != 0 or self.model is None:
                # Render previous detections on current frame for smooth stream
                with self.frame_lock:
                    self.latest_frame = frame.copy()
                    self.latest_annotated = self.annotator.annotate(
                        frame=frame,
                        boxes=self.latest_detections,
                        zones=self.zones,
                        overlay_config=self.overlay_config,
                        telemetry={
                            "fps": self.health_status.get("fps", 0),
                            "profile": self.profile,
                            "sector": self.sector,
                            "camera_id": self.camera_id
                        },
                        trajectories=self.track_trajectories
                    )
                time.sleep(0.01)
                continue
            
            # Run YOLO detection with active class filter
            with self.config_lock:
                target_classes = list(self.active_class_ids)
                
            results = None
            try:
                with self.yolo_lock:
                    results = self.model.track(
                        frame, persist=True, tracker="bytetrack.yaml",
                        conf=0.25, verbose=False,
                        classes=target_classes
                    )
            except Exception as e:
                print(f"[{self.camera_id}] Track error: {e}, falling back to predict()")
                try:
                    with self.yolo_lock:
                        results = self.model.predict(
                            frame, conf=0.25, verbose=False,
                            classes=target_classes
                        )
                except Exception as ex:
                    print(f"[{self.camera_id}] Detection error: {ex}")
                    continue
            
            current_detections = []
            current_track_ids = set()
            
            if results and len(results) > 0 and results[0].boxes is not None:
                boxes = results[0].boxes
                h_frame, w_frame = frame.shape[:2]
                
                # Environmental check
                if hasattr(self.env_sensor, "analyze"):
                    env = self.env_sensor.analyze(frame)
                elif hasattr(self.env_sensor, "analyze_frame"):
                    env = self.env_sensor.analyze_frame(frame)
                else:
                    env = {}
                is_night = env.get("is_night", False) if self.enabled_modules.get("day_night", True) else False
                
                # Pre-collect bags for proximity
                bag_boxes = []
                for box in boxes:
                    b_cls_id = int(box.cls[0])
                    b_cls_name = results[0].names.get(b_cls_id, "unknown")
                    if b_cls_name in ["backpack", "handbag", "suitcase"]:
                        bx1, by1, bx2, by2 = box.xyxy[0].tolist()
                        bag_boxes.append((b_cls_name, (bx1 + bx2)/2, (by1 + by2)/2))
                
                unassigned_counter = 0
                for box in boxes:
                    track_id = int(box.id[0]) if (box.id is not None and len(box.id) > 0) else None
                    if track_id is not None:
                        current_track_ids.add(track_id)
                        self.track_last_seen[track_id] = 0
                    else:
                        unassigned_counter += 1
                        track_id = unassigned_counter
                    
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    conf = float(box.conf[0])
                    cls_id = int(box.cls[0])
                    cls_name = results[0].names.get(cls_id, "unknown")
                    
                    carried_bag = None
                    if cls_name == "person":
                        for bname, bcx, bcy in bag_boxes:
                            if (x1 - 30 <= bcx <= x2 + 30) and (y1 - 30 <= bcy <= y2 + 30):
                                carried_bag = bname
                                break

                    foot_x = ((x1 + x2) / 2) / w_frame
                    foot_y = y2 / h_frame
                    
                    self.track_trajectories[track_id].append((foot_x, foot_y))
                    if len(self.track_trajectories[track_id]) > 30:
                        self.track_trajectories[track_id].pop(0)

                    self.behaviour_analyzer.update(track_id, foot_x, foot_y, cls_name)
                    behaviour = self.behaviour_analyzer.analyze(track_id)
                    
                    is_running = behaviour.get("is_running", False) if self.enabled_modules.get("direction", True) else False
                    is_loitering = behaviour.get("is_loitering", False) if self.enabled_modules.get("loitering", True) else False
                    has_direction_change = behaviour.get("has_direction_change", False) if self.enabled_modules.get("direction", True) else False
                    is_group = behaviour.get("is_group_movement", False) if self.enabled_modules.get("group", True) else False
                    is_unattended = behaviour.get("is_unattended_object", False)
                    
                    behaviour_label = "Running" if is_running else ("Loitering" if is_loitering else ("Direction Reversal" if has_direction_change else ("Group Movement" if is_group else "Walking")))
                    
                    detected_objs = [cls_name]
                    if carried_bag:
                        detected_objs.append(carried_bag)
                    
                    in_restricted_zone = False
                    
                    # Virtual Zone Evaluation
                    zone_events = []
                    if self.zones:
                        zone_events = self.zone_tracker.update_track(
                            camera_id=self.camera_id,
                            track_id=track_id, 
                            class_name=cls_name,
                            norm_x=foot_x, 
                            norm_y=foot_y, 
                            confidence=conf,
                            bbox=[x1, y1, x2, y2],
                            timestamp=time.time()
                        )
                    elif cls_name == "person":
                        # Zero manual virtual zones: provide baseline perimeter intrusion evaluation
                        zone_events = [{
                            "camera_id": self.camera_id,
                            "track_id": track_id,
                            "event_type": "INTRUSION_ENTRY",
                            "zone_id": f"PERIMETER_{self.camera_id[:8]}",
                            "zone_name": f"{self.sector} Perimeter",
                            "zone_type": "RESTRICTED",
                            "class_name": cls_name,
                            "confidence": conf,
                            "timestamp": time.time(),
                            "bbox": [x1, y1, x2, y2],
                            "loitering_seconds": 0
                        }]
                    
                    for zone_event in zone_events:
                        if zone_event.get("zone_type") == "RESTRICTED":
                            in_restricted_zone = True
                            
                        # Animal suppression filter
                        if self.enabled_modules.get("animal_filter", True) and cls_name in ["dog", "cat", "horse", "cow", "sheep"]:
                            # Suppress intrusion escalation for animals
                            continue
                            
                        score, severity, explainability = self.risk_engine.evaluate(
                            event_type=zone_event["event_type"],
                            zone_type=zone_event["zone_type"],
                            class_name=zone_event["class_name"],
                            is_night=is_night,
                            loitering_seconds=zone_event.get("loitering_seconds", 0),
                            is_running=is_running,
                            has_direction_change=has_direction_change,
                            is_group_movement=is_group,
                            is_unattended_object=is_unattended,
                            is_suspicious_vehicle=(cls_name != "person" and is_running),
                            has_carried_bag=bool(carried_bag)
                        )
                        
                        # Filter by dynamic alert threshold
                        if score < self.alert_threshold:
                            continue
                        
                        if is_running and carried_bag:
                            ai_summary = f"Person detected running towards restricted boundary carrying {carried_bag}."
                        elif is_running:
                            ai_summary = "Person detected running rapidly towards perimeter boundary."
                        elif is_loitering:
                            dwell = zone_event.get("loitering_seconds", 0)
                            ai_summary = f"Person loitering within perimeter sector ({dwell:.1f}s dwell time)."
                        elif has_direction_change:
                            ai_summary = "Person executed sudden direction reversal near perimeter boundary wire."
                        elif carried_bag:
                            ai_summary = f"Person detected near perimeter carrying {carried_bag}."
                        elif cls_name in ["car", "truck", "bus", "motorcycle"]:
                            ai_summary = f"Vehicle ({cls_name}) detected entering perimeter corridor."
                        else:
                            ai_summary = f"Target activity detected in perimeter sector by {cls_name}."
                        
                        zone_event["risk_score"] = score
                        zone_event["severity"] = severity
                        zone_event["explainability"] = explainability
                        zone_event["ai_summary"] = ai_summary
                        zone_event["behaviour"] = behaviour_label
                        zone_event["detected_objects"] = detected_objs
                        
                        fused = self.fusion_manager.process_event(zone_event)
                        if fused:
                            self._store_event(zone_event, cls_name, conf, frame)

                    # Framing & Posture Estimation (truthful geometry-based classification)
                    bw = (x2 - x1) / max(w_frame, 1)
                    bh = (y2 - y1) / max(h_frame, 1)
                    aspect = (y2 - y1) / max(x2 - x1, 1e-4)
                    touches_edge = (x1 <= 5 or y1 <= 5 or x2 >= w_frame - 5 or y2 >= h_frame - 5)

                    if cls_name == "person":
                        if bh >= 0.45 and 1.8 <= aspect <= 4.2 and not touches_edge:
                            framing = "FULL_BODY"
                        elif (bh >= 0.35 and bw >= 0.28) or (bh >= 0.5 and aspect < 1.8):
                            framing = "FACE_CLOSE_RANGE"
                        elif 0.18 <= bh < 0.45 and (touches_edge or aspect < 2.0):
                            framing = "UPPER_BODY"
                        elif touches_edge or bh < 0.12 or aspect < 1.0 or aspect > 4.5:
                            framing = "WIDE_SCENE" if bh < 0.12 else "PARTIAL_BODY"
                        elif bh < 0.18:
                            framing = "WIDE_SCENE"
                        else:
                            framing = "FULL_BODY"
                        
                        posture = "UPRIGHT" if aspect >= 1.7 else ("CROUCHING / BENT" if aspect < 1.3 else "NORMAL")
                    else:
                        framing = "NON_HUMAN"
                        posture = "N/A"

                    # ANPR for vehicles
                    if self.enabled_modules.get("anpr", True) and cls_name in ["car", "truck", "bus"] and getattr(self.anpr_engine, "available", True):
                        now = time.time()
                        last = self.anpr_last_run.get(track_id, 0)
                        if now - last > self.anpr_cooldown:
                            self.anpr_last_run[track_id] = now
                            self._run_anpr(frame, x1, y1, x2, y2, track_id, cls_name)
                            
                    current_detections.append({
                        "bbox": [x1, y1, x2, y2],
                        "class_name": cls_name,
                        "confidence": conf,
                        "track_id": track_id,
                        "behaviour": behaviour_label,
                        "in_restricted": in_restricted_zone,
                        "framing": framing,
                        "posture": posture,
                        "carried_bag": carried_bag
                    })

            self.latest_detections = current_detections

            # Render updated annotated frame
            with self.frame_lock:
                self.latest_frame = frame.copy()
                self.latest_annotated = self.annotator.annotate(
                    frame=frame,
                    boxes=self.latest_detections,
                    zones=self.zones,
                    overlay_config=self.overlay_config,
                    telemetry={
                        "fps": self.health_status.get("fps", 0),
                        "profile": self.profile,
                        "sector": self.sector,
                        "camera_id": self.camera_id
                    },
                    trajectories=self.track_trajectories
                )

            # Track cleanup
            for tid in list(self.track_last_seen.keys()):
                if tid not in current_track_ids:
                    self.track_last_seen[tid] += 1
                    if self.track_last_seen[tid] > self.track_grace_frames:
                        del self.track_last_seen[tid]
                        if tid in self.track_trajectories:
                            del self.track_trajectories[tid]
            
            self.behaviour_analyzer.cleanup_tracks(current_track_ids | set(self.track_last_seen.keys()))
            self.zone_tracker.cleanup_old_tracks(list(current_track_ids))
            
            time.sleep(0.01)
        
        if cap:
            cap.release()
        self.health_status["status"] = "OFFLINE"

    def _store_event(self, fused_event: dict, cls_name: str, conf: float, frame):
        """Store event in database, trigger secondary Gemini advisory if qualified, and enqueue evidence."""
        try:
            from backend.app.database.session import SessionLocal
            from backend.app.database.models import EventDB
            
            event_id = fused_event.get("event_id", str(uuid.uuid4()))
            db = SessionLocal()
            try:
                event = EventDB(
                    event_id=event_id,
                    camera_id=self.camera_id,
                    event_type=fused_event["event_type"],
                    severity=fused_event["severity"],
                    timestamp=time.time(),
                    track_id=fused_event.get("track_id"),
                    confidence=conf,
                    risk_score=fused_event["risk_score"],
                    zone_id=fused_event.get("zone_id"),
                    zone_name=fused_event.get("zone_name"),
                    class_name=cls_name,
                    ai_summary=fused_event.get("ai_summary"),
                    behaviour=fused_event.get("behaviour", "Normal"),
                    detected_objects=json.dumps(fused_event.get("detected_objects", [cls_name])),
                    explainability=json.dumps(fused_event.get("explainability", [])),
                    gemini_status="PENDING" if self.gemini_enabled else "NONE",
                    status="NEW",
                )
                db.add(event)
                db.commit()
            finally:
                db.close()
            
            # Enqueue evidence capture
            try:
                self.evidence_queue.put_nowait({
                    "event_id": event_id,
                    "event_data": fused_event,
                    "frame": frame.copy(),
                    "recent_frames": list(self.recent_frames[-50:]),
                })
            except queue.Full:
                print(f"[{self.camera_id}] Evidence queue full, skipping capture for {event_id}")
            
            # Callback for WebSocket broadcast
            if self.event_callback:
                self.event_callback({
                    "type": "INCIDENT_ALERT",
                    "event_id": event_id,
                    "camera_id": self.camera_id,
                    "event_type": fused_event["event_type"],
                    "severity": fused_event["severity"],
                    "risk_score": fused_event["risk_score"],
                    "track_id": fused_event.get("track_id"),
                    "zone_name": fused_event.get("zone_name"),
                    "class_name": cls_name,
                    "ai_summary": fused_event.get("ai_summary"),
                    "behaviour": fused_event.get("behaviour", "Normal"),
                    "detected_objects": fused_event.get("detected_objects", [cls_name]),
                    "confidence": conf,
                    "timestamp": time.time(),
                    "explainability": fused_event.get("explainability", []),
                    "incident": fused_event
                })

            # Check secondary Gemini automated advisory trigger (non-blocking in background)
            now = time.time()
            if self.gemini_enabled and (now - self.last_gemini_call > self.gemini_cooldown):
                # Trigger criteria: low confidence or high risk score
                if conf < 0.45 or fused_event["risk_score"] >= 80:
                    self.last_gemini_call = now
                    self._dispatch_gemini_background(event_id, frame.copy(), fused_event)

        except Exception as e:
            print(f"[{self.camera_id}] Event storage error: {e}")

    def _dispatch_gemini_background(self, event_id: str, frame: np.ndarray, event_data: dict):
        """Asynchronously dispatches Gemini reasoning without blocking local inference."""
        def worker():
            try:
                from backend.app.services.gemini_service import gemini_service
                gemini_service.analyze_incident_sync(
                    event_id=event_id,
                    frame_bgr=frame,
                    camera_id=self.camera_id,
                    event_data=event_data,
                    callback=self.event_callback
                )
            except Exception as ex:
                print(f"[{self.camera_id}] Gemini background dispatch error: {ex}")
                
        threading.Thread(target=worker, daemon=True).start()

    def _run_anpr(self, frame, x1, y1, x2, y2, track_id, cls_name):
        """Run ANPR on a vehicle detection."""
        try:
            if hasattr(self.anpr_engine, "extract_plate_from_vehicle"):
                result = self.anpr_engine.extract_plate_from_vehicle(
                    frame, [x1, y1, x2, y2], cls_name
                )
            else:
                result = self.anpr_engine.recognize(
                    frame, int(x1), int(y1), int(x2), int(y2)
                )
            if result and result.get("plate"):
                from backend.app.database.session import SessionLocal
                from backend.app.database.models import ANPRDB
                
                db = SessionLocal()
                try:
                    record = ANPRDB(
                        plate=result["plate"],
                        confidence=result.get("confidence", 0),
                        camera_id=self.camera_id,
                        timestamp=time.time(),
                        vehicle_type=cls_name,
                        verification_required=result.get("verification_required", False),
                    )
                    db.add(record)
                    db.commit()
                finally:
                    db.close()
                
                if self.event_callback:
                    self.event_callback({
                        "type": "ANPR_DETECTION",
                        "data": {
                            "plate": result["plate"],
                            "confidence": result.get("confidence", 0),
                            "camera": self.camera_id,
                            "vehicle_type": cls_name,
                            "timestamp": time.time(),
                        }
                    })
        except Exception as e:
            print(f"[{self.camera_id}] ANPR error: {e}")

    def _evidence_worker(self):
        """Background thread for evidence capture — doesn't block inference."""
        while self.running:
            try:
                item = self.evidence_queue.get(timeout=1)
                evidence_info = self.evidence_service.capture_evidence(
                    event_id=item["event_id"],
                    frame=item["frame"],
                    camera_id=self.camera_id,
                    event_data=item["event_data"],
                    recent_frames=item["recent_frames"],
                )
                
                if evidence_info:
                    from backend.app.database.session import SessionLocal
                    from backend.app.database.models import EvidenceDB
                    db = SessionLocal()
                    try:
                        db_evi = EvidenceDB(
                            event_id=item["event_id"],
                            snapshot_path=evidence_info.get("snapshot_path"),
                            video_clip_path=evidence_info.get("clip_path"),
                            metadata_path=evidence_info.get("metadata_path"),
                            sha256_hash=evidence_info.get("sha256_hash")
                        )
                        db.merge(db_evi)
                        db.commit()
                    except Exception as ex:
                        print(f"[{self.camera_id}] Evidence DB error: {ex}")
                    finally:
                        db.close()
            except queue.Empty:
                continue
            except Exception as e:
                print(f"[{self.camera_id}] Evidence capture error: {e}")

    def get_latest_frame(self):
        with self.frame_lock:
            return self.latest_frame.copy() if self.latest_frame is not None else None

    def get_latest_jpeg(self, annotated: bool = True):
        with self.frame_lock:
            target = self.latest_annotated if (annotated and self.latest_annotated is not None) else self.latest_frame
            if target is not None:
                ret, buffer = cv2.imencode('.jpg', target, [cv2.IMWRITE_JPEG_QUALITY, 80])
                if ret:
                    return buffer.tobytes()
        return None
        
    def get_live_activity_analysis(self) -> dict:
        """Returns truthful, comprehensive real-time activity and framing analysis."""
        with self.frame_lock:
            detections = list(self.latest_detections)
            health = dict(self.health_status)
        
        analyzer = self.behaviour_analyzer
        tracks_analysis = []
        
        for det in detections:
            tid = det.get("track_id")
            cname = det.get("class_name", "person")
            history = analyzer.track_histories.get(tid, [])
            beh = analyzer.analyze(tid) if tid else {}
            
            dwell_time = 0.0
            speed_norm = 0.0
            if len(history) >= 2:
                dwell_time = round(history[-1][2] - history[0][2], 1)
                dx = history[-1][0] - history[-2][0]
                dy = history[-1][1] - history[-2][1]
                speed_norm = round((dx**2 + dy**2)**0.5, 4)
                
            direction_label = "Towards Restricted Zone" if (len(history) >= 2 and history[-1][1] > history[-2][1]) else ("Parallel to Fence" if len(history) >= 2 else "Stationary")
            framing = det.get("framing", "UNKNOWN")
            
            tags = {
                "observed": [
                    f"BBox [{int(det['bbox'][0])}, {int(det['bbox'][1])}, {int(det['bbox'][2])}, {int(det['bbox'][3])}]",
                    f"Confidence: {int(det.get('confidence', 0) * 100)}%",
                    f"Track ID: #{tid}",
                    f"Class: {cname}"
                ],
                "inferred": [
                    f"Movement: {det.get('behaviour', 'Walking')}",
                    f"Framing: {framing}",
                    f"Direction: {direction_label}",
                    f"Est. Posture: {det.get('posture', 'UPRIGHT')}"
                ],
                "unavailable": [
                    "Skeletal Keypoints (yolov8n-pose.pt not loaded)",
                    "Small Arms Detector (small_arms_yolov8.pt not loaded)"
                ],
                "insufficient_evidence": []
            }
            
            if len(history) < 5:
                tags["insufficient_evidence"].append("Short track history (<5 frames) for velocity convergence")
            if framing == "PARTIAL_BODY":
                tags["insufficient_evidence"].append("Subject partially occluded by frame boundary")
                
            tracks_analysis.append({
                "track_id": tid,
                "class_name": cname,
                "confidence": det.get("confidence", 0.0),
                "bbox": det.get("bbox"),
                "framing": framing,
                "posture": det.get("posture", "UPRIGHT"),
                "behaviour": det.get("behaviour", "Walking"),
                "dwell_time": dwell_time,
                "speed_norm": speed_norm,
                "direction": direction_label,
                "in_restricted": det.get("in_restricted", False),
                "evidence_tags": tags
            })
            
        return {
            "camera_id": self.camera_id,
            "camera_name": self.name,
            "sector": self.sector,
            "framing_overview": tracks_analysis[0]["framing"] if tracks_analysis else "SCENE_IDLE",
            "active_tracks_count": len(tracks_analysis),
            "tracks": tracks_analysis,
            "pose_model_status": "UNAVAILABLE (yolov8n-pose.pt not loaded)",
            "weapon_model_status": "UNAVAILABLE (small_arms_yolov8.pt not loaded)",
            "timestamp": time.time()
        }

    def stop(self):
        self.running = False