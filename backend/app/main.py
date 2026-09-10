from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import asyncio, json, time, threading, cv2, sys, os

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

EVIDENCE_DIR = PROJECT_ROOT / "database" / "evidence"
DEMO_VIDEO_DIR = PROJECT_ROOT / "demo" / "videos"
MODEL_PATH = PROJECT_ROOT / "models" / "yolov8n.pt"

# Ensure dirs exist
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)

# --- State ---
active_pipelines: dict = {}  # camera_id -> CameraPipeline thread
ws_clients: list = []
system_mode = "live"  # "live" or "demo"
shared_yolo_model = None  # Single YOLO instance shared across threads
yolo_lock = threading.Lock()  # Lock for thread-safe inference

# --- Lifespan (replaces deprecated on_event) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    from backend.app.database import init_db
    init_db()
    
    # Load shared YOLO model once
    global shared_yolo_model
    try:
        from ultralytics import YOLO
        shared_yolo_model = YOLO(str(MODEL_PATH))
        print(f"[SYSTEM] YOLO model loaded: {MODEL_PATH}")
    except Exception as e:
        print(f"[SYSTEM] YOLO model failed to load: {e}")
    
    yield
    
    # Shutdown
    for pipe in active_pipelines.values():
        pipe.running = False
    for pipe in active_pipelines.values():
        pipe.join(timeout=5)
    active_pipelines.clear()

app = FastAPI(title="IBVAP", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for evidence
app.mount("/evidence", StaticFiles(directory=str(EVIDENCE_DIR)), name="evidence")

# Import and include API router
from backend.app.api.endpoints import router
app.include_router(router, prefix="/api")

# --- WebSocket Hub ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_text(json.dumps(message))
            except Exception:
                self.disconnect(connection)

manager = ConnectionManager()

@app.websocket("/ws/events")
async def websocket_events(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        await websocket.send_text(json.dumps({
            "type": "CONNECTION_ESTABLISHED",
            "active_cameras": list(active_pipelines.keys()),
            "timestamp": time.time()
        }))
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

# --- Operational Activity Ring Buffer ---
recent_activities: list = []

def add_timeline_activity(stage: str, title: str, description: str, camera_id: str, track_id: int = None, severity: str = "Info"):
    import uuid
    item = {
        "id": f"ACT-{uuid.uuid4().hex[:8]}",
        "timestamp": time.time(),
        "stage": stage,
        "title": title,
        "description": description,
        "camera_id": camera_id,
        "track_id": track_id,
        "severity": severity
    }
    recent_activities.insert(0, item)
    if len(recent_activities) > 50:
        recent_activities.pop()
    return item

def pipeline_event_callback(event_payload: dict):
    # Log timeline activities based on event
    if event_payload.get("type") == "INCIDENT_ALERT":
        cid = event_payload.get("camera_id", "Unknown")
        tid = event_payload.get("track_id")
        sev = event_payload.get("severity", "Info")
        etype = event_payload.get("event_type", "INCIDENT")
        score = event_payload.get("risk_score", 0)
        beh = event_payload.get("behaviour", "Movement")
        
        add_timeline_activity(
            stage="BEHAVIOUR_ANALYZED",
            title=f"Behaviour Analyzed: {beh}",
            description=f"Track #{tid} classified as {beh} near {event_payload.get('zone_name', 'boundary')}",
            camera_id=cid,
            track_id=tid,
            severity="Info"
        )
        add_timeline_activity(
            stage="INCIDENT_CREATED",
            title=f"Incident Generated: {etype} ({score}/100)",
            description=event_payload.get("ai_summary", f"{sev} alarm dispatched for track #{tid}"),
            camera_id=cid,
            track_id=tid,
            severity=sev
        )
        add_timeline_activity(
            stage="EVIDENCE_STORED",
            title="Forensic Evidence Archived",
            description="Snapshot and 5s video clip hashed with SHA-256 integrity check",
            camera_id=cid,
            track_id=tid,
            severity="Info"
        )
        
    elif event_payload.get("type") == "ANPR_DETECTION":
        data = event_payload.get("data", {})
        add_timeline_activity(
            stage="VEHICLE_RECOGNIZED",
            title=f"License Plate Recognized: {data.get('plate')}",
            description=f"{data.get('vehicle_type', 'Vehicle').capitalize()} plate extracted with confidence {data.get('confidence', 0):.0%}",
            camera_id=data.get("camera", "Unknown"),
            severity="Info"
        )

    # Push to WebSocket clients asynchronously
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None
        
    if loop and loop.is_running():
        asyncio.run_coroutine_threadsafe(manager.broadcast(event_payload), loop)

# --- Pipelines ---
from ai.inference.pipeline import CameraPipeline

def start_camera_pipeline(camera_id: str, source: str):
    if camera_id in active_pipelines:
        return
    
    actual_source = source
    if isinstance(source, str) and (source.isdigit() or source.lower() == "webcam"):
        actual_source = int(source) if source.isdigit() else 0

    pipeline = CameraPipeline(
        camera_id=camera_id,
        source=actual_source,
        model=shared_yolo_model,
        yolo_lock=yolo_lock,
        event_callback=pipeline_event_callback
    )
    pipeline.start()
    active_pipelines[camera_id] = pipeline


def stop_camera_pipeline(camera_id: str):
    if camera_id in active_pipelines:
        pipeline = active_pipelines[camera_id]
        pipeline.stop()
        pipeline.join(timeout=5)
        del active_pipelines[camera_id]

# --- Stream ---
def generate_mjpeg(camera_id: str):
    pipeline = active_pipelines.get(camera_id)
    if not pipeline:
        return
    while pipeline.running:
        try:
            frame_bytes = pipeline.get_latest_jpeg()
            if frame_bytes:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            time.sleep(0.04)
        except Exception:
            pass

@app.get("/api/cameras/{camera_id}/stream")
def stream_camera_feed(camera_id: str):
    if camera_id not in active_pipelines:
        raise HTTPException(status_code=404, detail="Camera stream not found or inactive")
    return StreamingResponse(
        generate_mjpeg(camera_id),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@app.post("/api/cameras/{camera_id}/start")
def start_pipeline_endpoint(camera_id: str):
    from backend.app.database.session import SessionLocal
    from backend.app.database.models import CameraDB
    db = SessionLocal()
    try:
        cam = db.query(CameraDB).filter(CameraDB.camera_id == camera_id).first()
        if not cam:
            raise HTTPException(status_code=404, detail="Camera not found")
        start_camera_pipeline(camera_id, cam.rtsp_url)
    finally:
        db.close()
    return {"status": "started"}

@app.post("/api/cameras/{camera_id}/stop")
def stop_pipeline_endpoint(camera_id: str):
    stop_camera_pipeline(camera_id)
    return {"status": "stopped"}

# --- Demo Mode ---
def start_demo_mode():
    global system_mode
    if system_mode == "demo":
        return
    system_mode = "demo"
    from backend.app.database.session import SessionLocal
    from backend.app.database.models import CameraDB
    import uuid
    
    demo_cams = [
        {"name": "Border Intrusion Demo", "url": str(DEMO_VIDEO_DIR / "border_intrusion.mp4")},
        {"name": "Perimeter Patrol Demo", "url": str(DEMO_VIDEO_DIR / "perimeter_patrol.mp4")},
        {"name": "Night Movement Demo", "url": str(DEMO_VIDEO_DIR / "night_movement.mp4")}
    ]
    
    db = SessionLocal()
    try:
        for dc in demo_cams:
            cid = f"DEMO-{uuid.uuid4().hex[:8]}"
            cam = CameraDB(
                camera_id=cid,
                name=dc["name"],
                rtsp_url=dc["url"],
                status="ONLINE",
                is_demo=True
            )
            db.add(cam)
            db.commit()
            start_camera_pipeline(cid, dc["url"])
    finally:
        db.close()

def stop_demo_mode():
    global system_mode
    if system_mode == "live":
        return
    system_mode = "live"
    from backend.app.database.session import SessionLocal
    from backend.app.database.models import CameraDB, EventDB, ANPRDB, EvidenceDB
    
    db = SessionLocal()
    try:
        # Get all demo cameras
        demo_cams = db.query(CameraDB).filter(CameraDB.is_demo == True).all()
        for c in demo_cams:
            stop_camera_pipeline(c.camera_id)
            
        # Delete demo events and their evidence
        demo_events = db.query(EventDB).filter(EventDB.is_demo == True).all()
        for ev in demo_events:
            db.query(EvidenceDB).filter(EvidenceDB.event_id == ev.event_id).delete()
            
        db.query(EventDB).filter(EventDB.is_demo == True).delete()
        db.query(ANPRDB).filter(ANPRDB.is_demo == True).delete()
        db.query(CameraDB).filter(CameraDB.is_demo == True).delete()
        db.commit()
    finally:
        db.close()