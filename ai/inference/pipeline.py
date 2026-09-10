import threading
import time
import queue
import json
import uuid
import cv2
import numpy as np
from pathlib import Path
from collections import defaultdict

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class CameraPipeline(threading.Thread):
    def __init__(self, camera_id: str, source: str, 
                 model=None, yolo_lock=None,
                 event_callback=None, evidence_dir=None):
        super().__init__(daemon=True)
        self.camera_id = camera_id
        self.source = source
        if model is not None:
            self.model = model
        else:
            try:
                from ai.inference.model_registry import model_registry
                self.model = model_registry.get_model("general_detector")
            except Exception as e:
                print(f"[{camera_id}] Error loading detector from registry: {e}")
                self.model = None
        self.yolo_lock = yolo_lock or threading.Lock()
        self.event_callback = event_callback
        self.evidence_dir = Path(evidence_dir) if evidence_dir else PROJECT_ROOT / "database" / "evidence"
        self.evidence_dir.mkdir(parents=True, exist_ok=True)
        
        self.running = False
        self.latest_frame = None
        self.frame_lock = threading.Lock()
        self.health_status = {"status": "INITIALIZING", "fps": 0, "resolution": "", "is_frozen": False, "frame_interval_ms": 0}
        
        # Track state with grace period
        self.track_last_seen = {}  # track_id -> frames_since_last_seen
        self.track_grace_frames = 5
        
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
        
        # Frame counter
        self.frame_count = 0
        self.process_every_n = 2  # Process detection every 2nd frame
        
        # Import components
        from ai.zones.zone_manager import ZoneTracker
        from ai.behaviour.day_night import environmental_sensor as env_sensor_inst
        # Or if it's a class:
        # from ai.behaviour.day_night import EnvironmentalSensor
        from ai.behaviour.camera_health import CameraHealthMonitor
        from ai.behaviour.behaviour_analyzer import BehaviourAnalyzer
        from ai.anpr.anpr_engine import anpr_engine
        from backend.app.services.risk_engine import risk_engine
        from backend.app.services.event_fusion import fusion_manager
        from backend.app.services.evidence_service import evidence_service
        
        self.zone_tracker = ZoneTracker()
        
        # The prompt instructed to use `EnvironmentalSensor()` but `day_night.py` might export an instance or class.
        # Let's assume `EnvironmentalSensor` class exists in `ai.behaviour.day_night`, but looking at pipeline.py lines 16, it was:
        # `from ai.behaviour.day_night import environmental_sensor`
        # And later: `env = environmental_sensor.analyze_frame(frame)`
        # I'll stick to the stub as closely as possible, maybe fixing imports.
        # Stub says: `from ai.behaviour.day_night import EnvironmentalSensor`
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
        
        # Using the instances from services if available
        self.risk_engine = risk_engine
        self.fusion_manager = fusion_manager
        self.evidence_service = evidence_service
        
        self.anpr_engine = anpr_engine
    
    def _load_zones(self):
        """Reload zones from database."""
        try:
            from backend.app.database.session import SessionLocal
            from backend.app.database.models import VirtualZoneDB
            from ai.zones.zone_manager import VirtualZone, Point
            
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
        
        # Check if it's a webcam
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
            print(f"[{self.camera_id}] Opened: {w}x{h} @ {fps:.1f} FPS")
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
                print(f"[{self.camera_id}] Reconnecting in {reconnect_delay}s...")
                time.sleep(reconnect_delay)
                reconnect_delay = min(reconnect_delay * 2, max_reconnect_delay)
                cap = self._open_capture()
                continue
            
            reconnect_delay = 5  # Reset on successful read
            ret, frame = cap.read()
            
            if not ret:
                # If webcam: sleep briefly and retry
                if isinstance(self.source, int) or (isinstance(self.source, str) and (self.source.isdigit() or self.source.lower() == "webcam")):
                    time.sleep(0.05)
                    continue
                # For video files: reopen instead of seeking
                elif not (isinstance(self.source, str) and self.source.startswith("rtsp://")):
                    cap.release()
                    cap = self._open_capture()
                    continue
                else:
                    # RTSP disconnect
                    cap.release()
                    cap = None
                    continue

            
            # Update health
            health = self.health_monitor.update(frame)
            self.health_status.update(health)
            self.health_status["status"] = "ONLINE"
            
            # Store latest frame for MJPEG streaming
            with self.frame_lock:
                self.latest_frame = frame.copy()
            
            # Buffer for evidence
            self.recent_frames.append(frame)
            if len(self.recent_frames) > self.max_recent_frames:
                self.recent_frames.pop(0)
            
            self.frame_count += 1
            
            # Periodic zone reload
            if time.time() - self.last_zone_reload > self.zone_reload_interval:
                self._load_zones()
            
            # Process detection every Nth frame
            if self.frame_count % self.process_every_n != 0:
                time.sleep(0.01)  # Small sleep to prevent CPU spinning
                continue
            
            # Run YOLO detection
            if self.model is None:
                time.sleep(0.04)
                continue
            
            try:
                with self.yolo_lock:
                    results = self.model.track(
                        frame, persist=True, tracker="bytetrack.yaml",
                        conf=0.25, verbose=False,
                        classes=[0, 1, 2, 3, 5, 7, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 26, 28]
                    )
            except Exception as e:
                print(f"[{self.camera_id}] Detection error: {e}")
                continue
            
            if not results or not len(results) > 0 or results[0].boxes is None:
                time.sleep(0.01)
                continue
            
            boxes = results[0].boxes
            h_frame, w_frame = frame.shape[:2]
            
            # Environmental check
            if hasattr(self.env_sensor, "analyze"):
                env = self.env_sensor.analyze(frame)
            elif hasattr(self.env_sensor, "analyze_frame"):
                env = self.env_sensor.analyze_frame(frame)
            else:
                env = {}
            is_night = env.get("is_night", False)
            
            # Pre-collect bags in this frame for person-proximity association
            bag_boxes = []
            for box in boxes:
                b_cls_id = int(box.cls[0])
                b_cls_name = results[0].names.get(b_cls_id, "unknown")
                if b_cls_name in ["backpack", "handbag", "suitcase"]:
                    bx1, by1, bx2, by2 = box.xyxy[0].tolist()
                    bag_boxes.append((b_cls_name, (bx1 + bx2)/2, (by1 + by2)/2))
            
            current_track_ids = set()
            
            for box in boxes:
                if box.id is None:
                    continue
                
                track_id = int(box.id[0])
                current_track_ids.add(track_id)
                self.track_last_seen[track_id] = 0  # Reset grace counter
                
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                cls_id = int(box.cls[0])
                cls_name = results[0].names.get(cls_id, "unknown")
                
                # Check for nearby carried bag
                carried_bag = None
                if cls_name == "person":
                    for bname, bcx, bcy in bag_boxes:
                        if (x1 - 30 <= bcx <= x2 + 30) and (y1 - 30 <= bcy <= y2 + 30):
                            carried_bag = bname
                            break

                # Normalized foot point
                foot_x = ((x1 + x2) / 2) / w_frame
                foot_y = y2 / h_frame
                
                # Update behaviour analyzer
                self.behaviour_analyzer.update(track_id, foot_x, foot_y, cls_name)
                behaviour = self.behaviour_analyzer.analyze(track_id)
                
                is_running = behaviour.get("is_running", False)
                is_loitering = behaviour.get("is_loitering", False)
                has_direction_change = behaviour.get("has_direction_change", False)
                is_group = behaviour.get("is_group_movement", False)
                is_unattended = behaviour.get("is_unattended_object", False)
                
                behaviour_label = "Running" if is_running else ("Loitering" if is_loitering else ("Direction Reversal" if has_direction_change else ("Group Movement" if is_group else "Walking")))
                
                detected_objs = [cls_name]
                if carried_bag:
                    detected_objs.append(carried_bag)
                
                # Check zones
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
                
                # Process zone events
                for zone_event in zone_events:
                    # Risk evaluation with behaviour flags
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
                    elif cls_name in ["dog", "cat", "horse", "cow", "sheep"]:
                        ai_summary = f"Animal activity ({cls_name}) detected near perimeter boundary."
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
                        # Store event in database
                        self._store_event(zone_event, cls_name, conf, frame)

                
                # ANPR for vehicles
                if cls_name in ["car", "truck", "bus"] and getattr(self.anpr_engine, "available", True):
                    now = time.time()
                    last = self.anpr_last_run.get(track_id, 0)
                    if now - last > self.anpr_cooldown:
                        self.anpr_last_run[track_id] = now
                        self._run_anpr(frame, x1, y1, x2, y2, track_id, cls_name)
            
            # Track cleanup with grace period
            for tid in list(self.track_last_seen.keys()):
                if tid not in current_track_ids:
                    self.track_last_seen[tid] += 1
                    if self.track_last_seen[tid] > self.track_grace_frames:
                        del self.track_last_seen[tid]
            
            # Clean behaviour analyzer
            self.behaviour_analyzer.cleanup_tracks(current_track_ids | set(self.track_last_seen.keys()))
            self.zone_tracker.cleanup_old_tracks(list(current_track_ids))
            
            time.sleep(0.01)  # Prevent CPU spinning
        
        if cap:
            cap.release()
        self.health_status["status"] = "OFFLINE"
    
    def _store_event(self, fused_event: dict, cls_name: str, conf: float, frame):
        """Store event in database and enqueue evidence capture."""
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
                    status="NEW",
                )
                db.add(event)
                db.commit()
            finally:
                db.close()
            
            # Enqueue evidence capture (non-blocking)
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

        except Exception as e:
            print(f"[{self.camera_id}] Event storage error: {e}")
    
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
        """Thread-safe access to latest frame for MJPEG streaming."""
        with self.frame_lock:
            return self.latest_frame.copy() if self.latest_frame is not None else None
            
    def get_latest_jpeg(self):
        with self.frame_lock:
            if self.latest_frame is not None:
                ret, buffer = cv2.imencode('.jpg', self.latest_frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                if ret:
                    return buffer.tobytes()
        return None
        
    def stop(self):
        self.running = False