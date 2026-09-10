from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import json
import cv2
import base64
import uuid

from backend.app.database.session import get_db
from backend.app.database.models import CameraDB, VirtualZoneDB, EventDB, EvidenceDB, ANPRDB, AuditLogDB
from backend.app.models.schemas import (
    CameraCreate, CameraOut, VirtualZoneCreate, VirtualZoneOut, 
    EventOut, EventStatusUpdate, EventFeedbackUpdate, ANPROut,
    CameraTestRequest, CameraTestResponse, SystemStats, AuditLogOut,
    EvidenceVaultItem, ActivityTimelineItem, AITrackAnalysis, AISensitivityConfig
)


router = APIRouter()

# --- CAMERAS ---
@router.get("/cameras", response_model=List[CameraOut])
def list_cameras(include_demo: bool = False, db: Session = Depends(get_db)):
    query = db.query(CameraDB)
    if not include_demo:
        query = query.filter(CameraDB.is_demo == False)
    return query.all()

@router.post("/cameras", response_model=CameraOut)
def create_camera(cam: CameraCreate, db: Session = Depends(get_db)):
    camera_id = str(uuid.uuid4())
    db_cam = CameraDB(
        camera_id=camera_id,
        name=cam.name,
        rtsp_url=cam.rtsp_url,
        location=cam.location,
        fps=cam.fps or 0.0,
        resolution=cam.resolution,
        status="ONLINE",
        is_demo=False
    )
    db.add(db_cam)
    db.commit()
    db.refresh(db_cam)
    
    from backend.app.main import start_camera_pipeline
    start_camera_pipeline(camera_id, cam.rtsp_url)
    
    return db_cam

@router.post("/cameras/test-connection", response_model=CameraTestResponse)
def test_connection(req: CameraTestRequest):
    url = req.rtsp_url.strip()
    if url.isdigit() or url.lower() == "webcam":
        cam_idx = int(url) if url.isdigit() else 0
        cap = cv2.VideoCapture(cam_idx, cv2.CAP_DSHOW)
    elif url.startswith("rtsp://"):
        import os
        os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|stimeout;5000000"
        cap = cv2.VideoCapture(url)
    else:
        cap = cv2.VideoCapture(url)
    if not cap.isOpened():

        return CameraTestResponse(
            success=False, 
            message="Could not connect to video stream. Ensure the device is on the same network and reachable."
        )
    
    ret, frame = cap.read()
    if not ret or frame is None:
        cap.release()
        return CameraTestResponse(
            success=False, 
            message="Connected to stream, but could not decode video frames."
        )
    
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 20.0
    
    _, buffer = cv2.imencode('.jpg', frame)
    preview_frame = base64.b64encode(buffer).decode('utf-8')
    cap.release()
    
    return CameraTestResponse(
        success=True, 
        message="Connection successful",
        width=width,
        height=height,
        fps=fps,
        preview_frame=preview_frame
    )

@router.delete("/cameras/{camera_id}")
def delete_camera(camera_id: str, db: Session = Depends(get_db)):
    cam = db.query(CameraDB).filter(CameraDB.camera_id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    
    db.query(VirtualZoneDB).filter(VirtualZoneDB.camera_id == camera_id).delete()
    db.delete(cam)
    db.commit()
    
    from backend.app.main import stop_camera_pipeline
    stop_camera_pipeline(camera_id)
    
    return {"status": "deleted"}

@router.get("/cameras/{camera_id}/health")
def get_camera_health(camera_id: str, db: Session = Depends(get_db)):
    cam = db.query(CameraDB).filter(CameraDB.camera_id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    
    from backend.app.main import active_pipelines
    pipeline = active_pipelines.get(camera_id)
    is_running = pipeline.running if pipeline else False
    
    return {
        "status": "ONLINE" if is_running else "OFFLINE",
        "fps": getattr(pipeline, 'fps', 0) if is_running else 0,
        "is_running": is_running
    }

# --- ZONES ---
@router.get("/zones", response_model=List[VirtualZoneOut])
def list_zones(camera_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(VirtualZoneDB)
    if camera_id:
        query = query.filter(VirtualZoneDB.camera_id == camera_id)
    zones = query.all()
    results = []
    for z in zones:
        results.append(VirtualZoneOut(
            zone_id=z.zone_id,
            camera_id=z.camera_id,
            name=z.name,
            polygon_coords=json.loads(z.polygon_coords),
            zone_type=z.zone_type,
            color=z.color
        ))
    return results

@router.post("/zones", response_model=VirtualZoneOut)
def create_zone(zone_in: VirtualZoneCreate, db: Session = Depends(get_db)):
    coords_json = json.dumps(zone_in.polygon_coords)
    zone_id = str(uuid.uuid4())
    db_zone = VirtualZoneDB(
        zone_id=zone_id,
        camera_id=zone_in.camera_id,
        name=zone_in.name,
        polygon_coords=coords_json,
        zone_type=zone_in.zone_type,
        color=zone_in.color or "#EF4444"
    )
    db.add(db_zone)
    db.commit()
    db.refresh(db_zone)

    return VirtualZoneOut(
        zone_id=db_zone.zone_id,
        camera_id=db_zone.camera_id,
        name=db_zone.name,
        polygon_coords=json.loads(db_zone.polygon_coords),
        zone_type=db_zone.zone_type,
        color=db_zone.color
    )

@router.delete("/zones/{zone_id}")
def delete_zone(zone_id: str, db: Session = Depends(get_db)):
    z = db.query(VirtualZoneDB).filter(VirtualZoneDB.zone_id == zone_id).first()
    if not z:
        raise HTTPException(status_code=404, detail="Zone not found")
    db.delete(z)
    db.commit()
    return {"status": "deleted"}

# --- EVENTS ---
@router.get("/events")
def list_events(
    offset: int = 0,
    limit: int = 50,
    is_demo: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(EventDB, EvidenceDB).outerjoin(EvidenceDB, EventDB.event_id == EvidenceDB.event_id)
    if not is_demo:
        query = query.filter(EventDB.is_demo == False)
    
    total = query.count()
    results = query.order_by(EventDB.timestamp.desc()).offset(offset).limit(limit).all()
    
    items = []
    for ev, evidence in results:
        items.append({
            "event_id": ev.event_id,
            "camera_id": ev.camera_id,
            "event_type": ev.event_type,
            "severity": ev.severity,
            "timestamp": ev.timestamp,
            "track_id": ev.track_id,
            "confidence": ev.confidence,
            "risk_score": ev.risk_score,
            "zone_id": ev.zone_id,
            "zone_name": ev.zone_name,
            "class_name": ev.class_name,
            "ai_summary": getattr(ev, "ai_summary", None),
            "behaviour": getattr(ev, "behaviour", "Normal"),
            "detected_objects": json.loads(ev.detected_objects) if getattr(ev, "detected_objects", None) and ev.detected_objects.startswith("[") else ([ev.class_name] if ev.class_name else []),
            "explainability": json.loads(ev.explainability) if ev.explainability else [],
            "status": ev.status,
            "operator_feedback": ev.operator_feedback,
            "operator_notes": ev.operator_notes,
            "is_demo": ev.is_demo,
            "evidence_snapshot": evidence.snapshot_path if evidence else None,
            "evidence_hash": evidence.sha256_hash if evidence else None
        })
    return {"items": items, "total": total, "offset": offset, "limit": limit}

@router.get("/events/{event_id}")
def get_event(event_id: str, db: Session = Depends(get_db)):
    result = db.query(EventDB, EvidenceDB).outerjoin(EvidenceDB, EventDB.event_id == EvidenceDB.event_id).filter(EventDB.event_id == event_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Event not found")
    ev, evidence = result
    return {
        "event_id": ev.event_id,
        "camera_id": ev.camera_id,
        "event_type": ev.event_type,
        "severity": ev.severity,
        "timestamp": ev.timestamp,
        "track_id": ev.track_id,
        "confidence": ev.confidence,
        "risk_score": ev.risk_score,
        "zone_id": ev.zone_id,
        "zone_name": ev.zone_name,
        "class_name": ev.class_name,
        "ai_summary": getattr(ev, "ai_summary", None),
        "behaviour": getattr(ev, "behaviour", "Normal"),
        "detected_objects": json.loads(ev.detected_objects) if getattr(ev, "detected_objects", None) and ev.detected_objects.startswith("[") else ([ev.class_name] if ev.class_name else []),
        "explainability": json.loads(ev.explainability) if ev.explainability else [],
        "status": ev.status,
        "operator_feedback": ev.operator_feedback,
        "operator_notes": ev.operator_notes,
        "is_demo": ev.is_demo,
        "evidence_snapshot": evidence.snapshot_path if evidence else None,
        "evidence_hash": evidence.sha256_hash if evidence else None
    }


@router.patch("/events/{event_id}/status")
def update_event_status(event_id: str, update: EventStatusUpdate, db: Session = Depends(get_db)):
    ev = db.query(EventDB).filter(EventDB.event_id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    ev.status = update.status
    db.commit()
    return {"status": "updated", "event_id": event_id}

@router.patch("/events/{event_id}/feedback")
def update_event_feedback(event_id: str, update: EventFeedbackUpdate, db: Session = Depends(get_db)):
    ev = db.query(EventDB).filter(EventDB.event_id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    ev.operator_feedback = update.feedback
    if update.notes is not None:
        ev.operator_notes = update.notes
    db.commit()
    return {"status": "updated", "event_id": event_id}

# --- ANPR ---
@router.get("/anpr", response_model=List[ANPROut])
def list_anpr(is_demo: bool = False, offset: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    query = db.query(ANPRDB)
    if not is_demo:
        query = query.filter(ANPRDB.is_demo == False)
    return query.order_by(ANPRDB.timestamp.desc()).offset(offset).limit(limit).all()

# --- SYSTEM ---
@router.get("/system/mode")
def get_system_mode():
    from backend.app.main import system_mode
    return {"mode": system_mode}

@router.get("/system/stats", response_model=SystemStats)
def get_system_stats(db: Session = Depends(get_db)):
    total_cameras = db.query(CameraDB).count()
    from backend.app.main import active_pipelines
    active_cameras = len(active_pipelines)
    total_incidents = db.query(EventDB).count()
    active_incidents = db.query(EventDB).filter(EventDB.status.in_(['NEW', 'UNDER_INVESTIGATION', 'ESCALATED'])).count()
    total_tracks = db.query(EventDB.track_id).distinct().count()
    total_anpr = db.query(ANPRDB).count()
    
    return SystemStats(
        total_cameras=total_cameras,
        active_cameras=active_cameras,
        total_incidents=total_incidents,
        active_incidents=active_incidents,
        total_tracks=total_tracks,
        total_anpr=total_anpr
    )

# --- AUDIT LOG ---
@router.get("/audit-log", response_model=List[AuditLogOut])
def get_audit_log(limit: int = 100, db: Session = Depends(get_db)):
    return db.query(AuditLogDB).order_by(AuditLogDB.timestamp.desc()).limit(limit).all()

# --- DEMO ---
@router.post("/demo/start")
def start_demo():
    from backend.app.main import start_demo_mode
    start_demo_mode()
    return {"status": "started"}

@router.post("/demo/stop")
def stop_demo():
    from backend.app.main import stop_demo_mode
    stop_demo_mode()
    return {"status": "stopped"}

# --- EVIDENCE VAULT ---
@router.get("/evidence", response_model=Dict[str, Any])
def list_evidence(
    camera_id: Optional[str] = None,
    search: Optional[str] = None,
    offset: int = 0,
    limit: int = 25,
    db: Session = Depends(get_db)
):
    query = db.query(EvidenceDB).join(EventDB, EvidenceDB.event_id == EventDB.event_id)
    if camera_id:
        query = query.filter(EventDB.camera_id == camera_id)
    if search:
        s = f"%{search}%"
        query = query.filter(
            (EvidenceDB.event_id.ilike(s)) |
            (EvidenceDB.sha256_hash.ilike(s)) |
            (EventDB.camera_id.ilike(s)) |
            (EventDB.event_type.ilike(s))
        )
    total = query.count()
    records = query.order_by(EvidenceDB.created_at.desc()).offset(offset).limit(limit).all()
    
    items = []
    for ev_db in records:
        event = db.query(EventDB).filter(EventDB.event_id == ev_db.event_id).first()
        cam = db.query(CameraDB).filter(CameraDB.camera_id == event.camera_id).first() if event else None
        items.append({
            "event_id": ev_db.event_id,
            "camera_id": event.camera_id if event else "Unknown",
            "camera_name": cam.name if cam else (event.camera_id if event else "Perimeter Camera"),
            "timestamp": event.timestamp if event else ev_db.created_at.timestamp(),
            "event_type": event.event_type if event else "ALERT",
            "severity": event.severity if event else "Medium",
            "snapshot_path": ev_db.snapshot_path,
            "video_clip_path": ev_db.video_clip_path,
            "sha256_hash": ev_db.sha256_hash,
            "verified": True,
            "ai_summary": getattr(event, "ai_summary", None) if event else None
        })
    return {"items": items, "total": total, "offset": offset, "limit": limit}

# --- ACTIVITY TIMELINE ---
@router.get("/system/timeline")
def get_system_timeline(limit: int = 30):
    from backend.app.main import recent_activities
    return recent_activities[:limit]

# --- AI ANALYSIS ---
@router.get("/ai/analysis")
def get_ai_analysis():
    from backend.app.main import active_pipelines
    analyses = []
    for cid, pipe in active_pipelines.items():
        if hasattr(pipe, "behaviour_analyzer"):
            analyzer = pipe.behaviour_analyzer
            for tid, history in analyzer.track_histories.items():
                if not history:
                    continue
                cname = analyzer.track_classes.get(tid, "person")
                beh = analyzer.analyze(tid)
                beh_label = "Running" if beh.get("is_running") else ("Loitering" if beh.get("is_loitering") else ("Direction Reversal" if beh.get("has_direction_change") else "Walking"))
                
                # Speed computation
                speed = 0.0
                if len(history) >= 2:
                    dx = history[-1][0] - history[-2][0]
                    dy = history[-1][1] - history[-2][1]
                    speed = (dx**2 + dy**2)**0.5
                
                direction = "Towards Restricted Zone" if (len(history) >= 2 and history[-1][1] > history[-2][1]) else "Along Perimeter Line"
                deviation = 91 if (beh.get("is_running") or beh.get("has_direction_change")) else 12
                risk = 85 if beh.get("is_running") else (65 if beh.get("is_loitering") else 20)
                
                traj = [[round(p[0], 3), round(p[1], 3)] for p in history[-15:]]
                analyses.append({
                    "track_id": tid,
                    "camera_id": cid,
                    "class_name": cname,
                    "speed_norm": round(speed, 4),
                    "behaviour": beh_label,
                    "direction": direction,
                    "trajectory": traj,
                    "pattern_deviation": deviation,
                    "risk_score": risk,
                    "detected_objects": [cname],
                    "last_seen": history[-1][2]
                })
    return analyses

# Global in-memory sensitivity settings
current_sensitivity = {
    "detection_conf": 0.25,
    "loitering_seconds": 8.0,
    "running_threshold": 0.02,
    "anomaly_sensitivity": 0.75
}

@router.get("/settings/sensitivity")
def get_sensitivity():
    return current_sensitivity

@router.patch("/settings/sensitivity")
def update_sensitivity(config: AISensitivityConfig):
    current_sensitivity.update(config.model_dump())
    return {"status": "updated", "config": current_sensitivity}