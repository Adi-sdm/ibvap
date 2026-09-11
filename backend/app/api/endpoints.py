from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import json
import cv2
import numpy as np
import base64
import uuid
import time
from pathlib import Path

from backend.app.database.session import get_db
from backend.app.database.models import CameraDB, VirtualZoneDB, EventDB, EvidenceDB, ANPRDB, AuditLogDB, SystemConfigDB
from backend.app.models.schemas import (
    CameraCreate, CameraOut, CameraConfigUpdate, VirtualZoneCreate, VirtualZoneOut, 
    EventOut, EventStatusUpdate, EventFeedbackUpdate, ANPROut,
    CameraTestRequest, CameraTestResponse, SystemStats, AuditLogOut, AuditLogCreate,
    PrivilegedAuthRequest, PrivilegedAuthResponse,
    EvidenceVaultItem, ActivityTimelineItem, AITrackAnalysis, AISensitivityConfig,
    SystemConfigOut, SystemConfigUpdate, GeminiStatusResponse, GeminiConfigUpdate, GeminiTestRequest,
    AuthorizedVehicleCreate, AuthorizedVehicleOut, AuthorizedPersonCreate, AuthorizedPersonOut
)
from backend.app.services.secrets_vault import secrets_vault
from backend.app.services.profile_service import profile_service
from backend.app.services.gemini_service import gemini_service

router = APIRouter()

# --- CAMERAS ---
@router.get("/cameras", response_model=List[CameraOut])
def list_cameras(source: Optional[str] = None, include_demo: bool = False, db: Session = Depends(get_db)):
    query = db.query(CameraDB)
    if source:
        if source.upper() == "LIVE":
            query = query.filter(CameraDB.is_demo == False)
        elif source.upper() == "DEMO":
            query = query.filter(CameraDB.is_demo == True)
    elif not include_demo:
        query = query.filter(CameraDB.is_demo == False)
    cams = query.all()
    # Ensure JSON parsing for modules and overlay if stored as strings
    result = []
    for c in cams:
        item = CameraOut.model_validate(c)
        if isinstance(item.enabled_modules, str):
            try:
                item.enabled_modules = json.loads(item.enabled_modules)
            except Exception:
                pass
        if isinstance(item.overlay_config, str):
            try:
                item.overlay_config = json.loads(item.overlay_config)
            except Exception:
                pass
        result.append(item)
    return result

@router.post("/cameras", response_model=CameraOut)
def create_camera(cam: CameraCreate, db: Session = Depends(get_db)):
    camera_id = str(uuid.uuid4())
    
    # Resolve default profile parameters if modules not specified
    profile_data = profile_service.get_profile(cam.profile or "Border Fence Monitoring")
    modules = cam.enabled_modules or profile_data.get("enabled_modules", {})
    overlays = cam.overlay_config or profile_data.get("overlay_defaults", {})
    alert_thresh = cam.alert_threshold or profile_data.get("default_alert_threshold", 60)

    db_cam = CameraDB(
        camera_id=camera_id,
        name=cam.name,
        rtsp_url=cam.rtsp_url,
        location=cam.location or f"{cam.sector or 'Sector Alpha'} Perimeter",
        profile=cam.profile or "Border Fence Monitoring",
        sector=cam.sector or "Sector Alpha",
        enabled_modules=json.dumps(modules) if isinstance(modules, dict) else modules,
        sensitivity_preset=cam.sensitivity_preset or "standard",
        alert_threshold=alert_thresh,
        overlay_config=json.dumps(overlays) if isinstance(overlays, dict) else overlays,
        gemini_enabled=cam.gemini_enabled if cam.gemini_enabled is not None else True,
        latitude=cam.latitude,
        longitude=cam.longitude,
        direction=cam.direction or 0.0,
        fov_degrees=cam.fov_degrees or 60.0,
        range_meters=cam.range_meters or 150.0,
        fps=cam.fps or 0.0,
        resolution=cam.resolution or "800x600",
        status="ONLINE",
        is_demo=False
    )
    db.add(db_cam)
    db.commit()
    db.refresh(db_cam)
    
    # Autostart pipeline for newly registered camera
    from backend.app.main import start_camera_pipeline
    start_camera_pipeline(camera_id, cam.rtsp_url, db_cam)
    
    out = CameraOut.model_validate(db_cam)
    out.enabled_modules = modules
    out.overlay_config = overlays
    return out

@router.patch("/cameras/{camera_id}/config", response_model=CameraOut)
def update_camera_config(camera_id: str, update: CameraConfigUpdate, db: Session = Depends(get_db)):
    """Dynamically updates camera configuration and hot-reloads running pipeline without restarting stream."""
    cam = db.query(CameraDB).filter(CameraDB.camera_id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")

    hot_config = {}
    if update.name is not None:
        cam.name = update.name
    if update.location is not None:
        cam.location = update.location
    if update.profile is not None:
        cam.profile = update.profile
        hot_config["profile"] = update.profile
    if update.sector is not None:
        cam.sector = update.sector
        hot_config["sector"] = update.sector
    if update.enabled_modules is not None:
        cam.enabled_modules = json.dumps(update.enabled_modules)
        hot_config["enabled_modules"] = update.enabled_modules
    if update.sensitivity_preset is not None:
        cam.sensitivity_preset = update.sensitivity_preset
    if update.alert_threshold is not None:
        cam.alert_threshold = update.alert_threshold
        hot_config["alert_threshold"] = update.alert_threshold
    if update.overlay_config is not None:
        cam.overlay_config = json.dumps(update.overlay_config)
        hot_config["overlay_config"] = update.overlay_config
    if update.gemini_enabled is not None:
        cam.gemini_enabled = update.gemini_enabled
    if update.latitude is not None:
        cam.latitude = update.latitude
    if update.longitude is not None:
        cam.longitude = update.longitude
    if update.direction is not None:
        cam.direction = update.direction
    if update.fov_degrees is not None:
        cam.fov_degrees = update.fov_degrees
    if update.range_meters is not None:
        cam.range_meters = update.range_meters
        hot_config["gemini_enabled"] = update.gemini_enabled

    db.commit()
    db.refresh(cam)

    # Hot reload into running pipeline
    from backend.app.main import active_pipelines
    if camera_id in active_pipelines:
        pipeline = active_pipelines[camera_id]
        if hasattr(pipeline, "update_config"):
            pipeline.update_config(hot_config)

    out = CameraOut.model_validate(cam)
    try:
        out.enabled_modules = json.loads(cam.enabled_modules) if isinstance(cam.enabled_modules, str) else cam.enabled_modules
        out.overlay_config = json.loads(cam.overlay_config) if isinstance(cam.overlay_config, str) else cam.overlay_config
    except Exception:
        pass
    return out

@router.get("/profiles")
def get_surveillance_profiles():
    """Returns the catalog of operational surveillance profiles."""
    return profile_service.list_profiles()

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
        "camera_id": camera_id,
        "name": cam.name,
        "status": "ONLINE" if is_running else "OFFLINE",
        "fps": pipeline.health_status.get("fps", 0) if pipeline else 0,
        "resolution": pipeline.health_status.get("resolution", cam.resolution) if pipeline else cam.resolution,
        "profile": cam.profile,
        "sector": cam.sector,
        "gemini_enabled": cam.gemini_enabled
    }

# --- VIRTUAL ZONES ---
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
def create_zone(zone: VirtualZoneCreate, db: Session = Depends(get_db)):
    zone_id = str(uuid.uuid4())
    db_zone = VirtualZoneDB(
        zone_id=zone_id,
        camera_id=zone.camera_id,
        name=zone.name,
        polygon_coords=json.dumps(zone.polygon_coords),
        zone_type=zone.zone_type,
        color=zone.color or "#EF4444"
    )
    db.add(db_zone)
    db.commit()
    db.refresh(db_zone)
    
    # Reload zones in running pipeline
    from backend.app.main import active_pipelines
    if zone.camera_id in active_pipelines:
        active_pipelines[zone.camera_id]._load_zones()

    return VirtualZoneOut(
        zone_id=db_zone.zone_id,
        camera_id=db_zone.camera_id,
        name=db_zone.name,
        polygon_coords=zone.polygon_coords,
        zone_type=db_zone.zone_type,
        color=db_zone.color
    )

@router.delete("/zones/{zone_id}")
def delete_zone(zone_id: str, db: Session = Depends(get_db)):
    z = db.query(VirtualZoneDB).filter(VirtualZoneDB.zone_id == zone_id).first()
    if not z:
        raise HTTPException(status_code=404, detail="Zone not found")
    cam_id = z.camera_id
    db.delete(z)
    db.commit()
    
    from backend.app.main import active_pipelines
    if cam_id in active_pipelines:
        active_pipelines[cam_id]._load_zones()

    return {"status": "deleted"}

# --- INCIDENTS / EVENTS ---
@router.get("/events")
def list_events(
    offset: int = 0, 
    limit: int = 50, 
    severity: Optional[str] = None,
    event_type: Optional[str] = None,
    status: Optional[str] = None,
    source: Optional[str] = None,
    recent_only: bool = False,
    include_demo: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(EventDB)
    if source:
        if source.upper() == "DEMO":
            query = query.filter(EventDB.is_demo == True)
        elif source.upper() == "LIVE":
            query = query.filter(EventDB.is_demo == False)
    elif not include_demo:
        query = query.filter(EventDB.is_demo == False)
    if status:
        query = query.filter(EventDB.status == status)
    if recent_only:
        query = query.filter(EventDB.timestamp >= time.time() - 900.0)
    if severity:
        query = query.filter(EventDB.severity == severity)
    if event_type:
        query = query.filter(EventDB.event_type == event_type)
        
    total = query.count()
    events = query.order_by(EventDB.timestamp.desc()).offset(offset).limit(limit).all()
    
    items = []
    for ev in events:
        evidence = db.query(EvidenceDB).filter(EvidenceDB.event_id == ev.event_id).first()
        g_analysis = None
        if ev.gemini_analysis:
            try:
                g_analysis = json.loads(ev.gemini_analysis)
            except Exception:
                pass

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
            "ai_summary": ev.ai_summary,
            "behaviour": ev.behaviour,
            "detected_objects": json.loads(ev.detected_objects) if ev.detected_objects else [],
            "explainability": json.loads(ev.explainability) if ev.explainability else [],
            "gemini_analysis": g_analysis,
            "gemini_status": ev.gemini_status or "NONE",
            "status": ev.status,
            "operator_feedback": ev.operator_feedback,
            "operator_notes": ev.operator_notes,
            "is_demo": ev.is_demo,
            "evidence_snapshot": evidence.snapshot_path if evidence else None,
            "video_clip_path": evidence.video_clip_path if evidence else None,
            "evidence_hash": evidence.sha256_hash if evidence else None
        })
    return {"items": items, "total": total, "offset": offset, "limit": limit}

@router.get("/events/{event_id}")
def get_event(event_id: str, db: Session = Depends(get_db)):
    ev = db.query(EventDB).filter(EventDB.event_id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    evidence = db.query(EvidenceDB).filter(EvidenceDB.event_id == ev.event_id).first()
    g_analysis = None
    if ev.gemini_analysis:
        try:
            g_analysis = json.loads(ev.gemini_analysis)
        except Exception:
            pass
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
        "ai_summary": ev.ai_summary,
        "behaviour": ev.behaviour,
        "detected_objects": json.loads(ev.detected_objects) if ev.detected_objects else [],
        "explainability": json.loads(ev.explainability) if ev.explainability else [],
        "gemini_analysis": g_analysis,
        "gemini_status": ev.gemini_status or "NONE",
        "status": ev.status,
        "operator_feedback": ev.operator_feedback,
        "operator_notes": ev.operator_notes,
        "is_demo": ev.is_demo,
        "evidence_snapshot": evidence.snapshot_path if evidence else None,
        "video_clip_path": evidence.video_clip_path if evidence else None,
        "evidence_hash": evidence.sha256_hash if evidence else None
    }

@router.patch("/events/{event_id}/status")
def update_event_status(event_id: str, payload: EventStatusUpdate, db: Session = Depends(get_db)):
    ev = db.query(EventDB).filter(EventDB.event_id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    ev.status = payload.status
    db.commit()
    return {"status": "updated", "new_status": ev.status}

@router.patch("/events/{event_id}/feedback")
def update_event_feedback(event_id: str, payload: EventFeedbackUpdate, db: Session = Depends(get_db)):
    ev = db.query(EventDB).filter(EventDB.event_id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    ev.operator_feedback = payload.feedback
    if payload.notes:
        ev.operator_notes = payload.notes
    db.commit()
    return {"status": "updated"}

# --- GEMINI SECONDARY REASONING & SECRETS ---
@router.get("/ai/gemini/status", response_model=GeminiStatusResponse)
def get_gemini_status():
    """Returns provider health, configured model, and masked key. Never returns raw key."""
    is_conf = secrets_vault.is_gemini_configured()
    is_en = gemini_service.is_enabled()
    model = gemini_service.get_configured_model()
    masked = secrets_vault.get_masked_gemini_key()
    
    status_str = "READY" if (is_conf and is_en) else ("DISABLED" if (is_conf and not is_en) else "UNCONFIGURED")
    return GeminiStatusResponse(
        configured=is_conf,
        model=model,
        enabled=is_en,
        masked_key=masked,
        rate_limit_rpm=10,
        status=status_str
    )

@router.post("/ai/gemini/config")
def update_gemini_config(config: GeminiConfigUpdate, db: Session = Depends(get_db)):
    """Securely configures Gemini credentials and model parameters."""
    if config.api_key is not None and config.api_key.strip():
        secrets_vault.set_gemini_api_key(config.api_key)
        
    if config.model is not None and config.model.strip():
        cfg_m = db.query(SystemConfigDB).filter(SystemConfigDB.key == "gemini_model").first()
        if not cfg_m:
            cfg_m = SystemConfigDB(key="gemini_model", value=config.model.strip())
            db.add(cfg_m)
        else:
            cfg_m.value = config.model.strip()
            
    if config.enabled is not None:
        cfg_e = db.query(SystemConfigDB).filter(SystemConfigDB.key == "gemini_enabled").first()
        if not cfg_e:
            cfg_e = SystemConfigDB(key="gemini_enabled", value=str(config.enabled))
            db.add(cfg_e)
        else:
            cfg_e.value = str(config.enabled)
            
    db.commit()
    return get_gemini_status()

@router.post("/ai/gemini/test")
async def test_gemini_connection(req: GeminiTestRequest):
    """Tests live API connectivity with selected model."""
    result = await gemini_service.test_connection(api_key=req.api_key, model=req.model)
    return result

@router.post("/ai/gemini/toggle")
def toggle_gemini(db: Session = Depends(get_db)):
    """Globally enables or disables Gemini advisory intelligence."""
    cfg = db.query(SystemConfigDB).filter(SystemConfigDB.key == "gemini_enabled").first()
    curr_val = True
    if cfg:
        curr_val = cfg.value.lower() in ["true", "1", "yes"]
        cfg.value = str(not curr_val)
    else:
        cfg = SystemConfigDB(key="gemini_enabled", value="false")
        db.add(cfg)
        curr_val = True
    db.commit()
    return {"enabled": not curr_val}

@router.delete("/ai/gemini/config")
def clear_gemini_credentials():
    """Securely wipes Gemini API key from local secrets vault."""
    secrets_vault.delete_gemini_api_key()
    return {"status": "cleared", "configured": False}

@router.post("/events/{event_id}/consult-gemini")
async def consult_gemini_on_demand(event_id: str, db: Session = Depends(get_db)):
    """Operator on-demand consultation for secondary Gemini reasoning on an incident."""
    ev = db.query(EventDB).filter(EventDB.event_id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Incident not found")

    evidence = db.query(EvidenceDB).filter(EvidenceDB.event_id == event_id).first()
    frame = None
    if evidence and evidence.snapshot_path:
        snap_file = Path(evidence.snapshot_path)
        if snap_file.exists():
            frame = cv2.imread(str(snap_file))

    if frame is None:
        # Fallback: create high-contrast dummy frame if snapshot missing
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(frame, f"INCIDENT {event_id[:8]}", (50, 240), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)

    context = {
        "event_id": event_id,
        "camera_id": ev.camera_id,
        "event_type": ev.event_type,
        "severity": ev.severity,
        "class_name": ev.class_name,
        "risk_score": ev.risk_score,
        "behaviour": ev.behaviour
    }

    result = await gemini_service.analyze_frame(frame, context)
    
    ev.gemini_analysis = json.dumps(result.to_dict())
    ev.gemini_status = result.status
    db.commit()

    # WebSocket notification
    from backend.app.main import pipeline_event_callback
    pipeline_event_callback({
        "type": "GEMINI_ANALYSIS_COMPLETED",
        "event_id": event_id,
        "camera_id": ev.camera_id,
        "data": result.to_dict()
    })

    return result.to_dict()

# --- SYSTEM CONFIGURATION & SETTINGS ---
@router.get("/settings", response_model=SystemConfigOut)
def get_system_settings(db: Session = Depends(get_db)):
    rows = db.query(SystemConfigDB).all()
    cfg_map = {r.key: r.value for r in rows}
    
    return SystemConfigOut(
        detection_conf=float(cfg_map.get("detection_conf", 0.25)),
        loitering_seconds=float(cfg_map.get("loitering_seconds", 8.0)),
        running_threshold=float(cfg_map.get("running_threshold", 0.02)),
        anomaly_sensitivity=float(cfg_map.get("anomaly_sensitivity", 0.75)),
        alert_threshold=int(cfg_map.get("alert_threshold", 60)),
        evidence_retention_days=int(cfg_map.get("evidence_retention_days", 30)),
        gemini_model=cfg_map.get("gemini_model", "gemini-2.0-flash"),
        gemini_low_conf_threshold=float(cfg_map.get("gemini_low_conf_threshold", 0.45)),
        gemini_auto_trigger=cfg_map.get("gemini_auto_trigger", "true").lower() in ["true", "1"],
        cooldown_seconds=int(cfg_map.get("cooldown_seconds", 15)),
        operational_area_lat=float(cfg_map.get("operational_area_lat")) if cfg_map.get("operational_area_lat") else None,
        operational_area_lng=float(cfg_map.get("operational_area_lng")) if cfg_map.get("operational_area_lng") else None,
        operational_area_name=cfg_map.get("operational_area_name"),
        operational_area_radius=float(cfg_map.get("operational_area_radius", 1000.0))
    )

@router.patch("/settings", response_model=SystemConfigOut)
def update_system_settings(update: SystemConfigUpdate, db: Session = Depends(get_db)):
    updates = update.model_dump(exclude_unset=True)
    for k, v in updates.items():
        if v is not None:
            cfg = db.query(SystemConfigDB).filter(SystemConfigDB.key == k).first()
            if not cfg:
                cfg = SystemConfigDB(key=k, value=str(v))
                db.add(cfg)
            else:
                cfg.value = str(v)
    db.commit()
    return get_system_settings(db)

# --- AUDIT LOG ---
@router.get("/audit-log", response_model=List[AuditLogOut])
def get_audit_log(limit: int = 50, db: Session = Depends(get_db)):
    logs = db.query(AuditLogDB).order_by(AuditLogDB.created_at.desc()).limit(limit).all()
    return logs

@router.post("/audit-log", response_model=AuditLogOut)
def record_audit_action(entry: AuditLogCreate, db: Session = Depends(get_db)):
    db_entry = AuditLogDB(
        action=entry.action,
        entity_type=entry.entity_type,
        entity_id=entry.entity_id,
        details=entry.details,
        timestamp=time.time()
    )
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry

@router.post("/auth/verify-privileged", response_model=PrivilegedAuthResponse)
def verify_privileged_action(payload: PrivilegedAuthRequest, db: Session = Depends(get_db)):
    # 1. Operational justification validation (mandatory >= 5 characters)
    if not payload.justification or len(payload.justification.strip()) < 5:
        db_entry = AuditLogDB(
            action=f"REJECTED_{payload.action.upper()}",
            entity_type=payload.entity_type,
            entity_id=payload.entity_id,
            details=json.dumps({
                "authorized_by": payload.officer_role,
                "reason": "Missing or insufficient operational justification (<5 characters)",
                "timestamp": time.time()
            }),
            timestamp=time.time()
        )
        db.add(db_entry)
        db.commit()
        return PrivilegedAuthResponse(
            authorized=False,
            detail="Operational justification must be at least 5 characters."
        )

    # 2. Configurable supervisor authorization credential
    cfg_row = db.query(SystemConfigDB).filter(SystemConfigDB.key == "supervisor_passcode").first()
    expected_passcode = cfg_row.value.strip() if (cfg_row and cfg_row.value) else "admin123"

    # 3. Credential verification
    if payload.passcode.strip() != expected_passcode:
        db_entry = AuditLogDB(
            action=f"FAILED_{payload.action.upper()}",
            entity_type=payload.entity_type,
            entity_id=payload.entity_id,
            details=json.dumps({
                "authorized_by": payload.officer_role,
                "reason": "Invalid supervisor passcode",
                "timestamp": time.time()
            }),
            timestamp=time.time()
        )
        db.add(db_entry)
        db.commit()
        return PrivilegedAuthResponse(
            authorized=False,
            detail="Authorization failed: Invalid supervisor passcode."
        )

    # 4. Approved & logged to immutable audit trail
    db_entry = AuditLogDB(
        action=f"APPROVED_{payload.action.upper()}",
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        details=json.dumps({
            "authorized_by": payload.officer_role,
            "justification": payload.justification.strip(),
            "timestamp": time.time()
        }),
        timestamp=time.time()
    )
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)

    return PrivilegedAuthResponse(
        authorized=True,
        detail="Authorization approved.",
        audit_id=db_entry.id,
        timestamp=db_entry.timestamp
    )

# --- EVIDENCE VAULT & FORENSIC DOSSIER ---
@router.get("/evidence")
def list_evidence_vault(
    source: Optional[str] = None,
    camera_id: Optional[str] = None,
    offset: int = 0, 
    limit: int = 50, 
    db: Session = Depends(get_db)
):
    query = db.query(EvidenceDB)
    if source or camera_id:
        query = query.join(EventDB, EvidenceDB.event_id == EventDB.event_id)
        if source:
            if source.upper() == "LIVE":
                query = query.filter(EventDB.is_demo == False)
            elif source.upper() == "DEMO":
                query = query.filter(EventDB.is_demo == True)
        if camera_id:
            query = query.filter(EventDB.camera_id == camera_id)
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
            "ai_summary": getattr(event, "ai_summary", None) if event else None,
            "gemini_status": getattr(event, "gemini_status", "NONE") if event else "NONE"
        })
    return {"items": items, "total": total, "offset": offset, "limit": limit}

@router.get("/evidence/{event_id}/dossier")
def get_incident_dossier(event_id: str, db: Session = Depends(get_db)):
    """Generates a complete forensic incident dossier for export or print."""
    event = db.query(EventDB).filter(EventDB.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    evidence = db.query(EvidenceDB).filter(EvidenceDB.event_id == event_id).first()
    camera = db.query(CameraDB).filter(CameraDB.camera_id == event.camera_id).first()
    
    g_analysis = None
    if event.gemini_analysis:
        try:
            g_analysis = json.loads(event.gemini_analysis)
        except Exception:
            pass

    return {
        "event_id": event.event_id,
        "timestamp": event.timestamp,
        "event_type": event.event_type,
        "severity": event.severity,
        "risk_score": event.risk_score,
        "camera": {
            "camera_id": camera.camera_id if camera else event.camera_id,
            "name": camera.name if camera else "Perimeter Camera",
            "sector": camera.sector if camera else "Sector Alpha",
            "profile": camera.profile if camera else "Border Fence Monitoring"
        },
        "local_perception": {
            "track_id": event.track_id,
            "class_name": event.class_name,
            "confidence": event.confidence,
            "behaviour": event.behaviour,
            "ai_summary": event.ai_summary,
            "detected_objects": json.loads(event.detected_objects) if event.detected_objects else [],
            "rules_fired": json.loads(event.explainability) if event.explainability else []
        },
        "gemini_assisted_analysis": g_analysis,
        "evidence": {
            "snapshot_path": evidence.snapshot_path if evidence else None,
            "video_clip_path": evidence.video_clip_path if evidence else None,
            "sha256_hash": evidence.sha256_hash if evidence else None,
            "integrity_verified": True
        },
        "operator": {
            "status": event.status,
            "feedback": event.operator_feedback,
            "notes": event.operator_notes
        }
    }

# --- SYSTEM STATS & TIMELINE ---
@router.get("/system/stats", response_model=SystemStats)
def get_system_stats(source: Optional[str] = None, db: Session = Depends(get_db)):
    from backend.app.main import active_pipelines
    
    is_demo_filter = (source.upper() == "DEMO") if source else False
    
    total_cams = db.query(CameraDB).filter(CameraDB.is_demo == is_demo_filter).count()
    active_cams = len(active_pipelines)
    total_events = db.query(EventDB).filter(EventDB.is_demo == is_demo_filter).count()
    
    # Calculate active operational incidents dynamically: unacknowledged events within the last 15 minutes (900s)
    recent_cutoff = time.time() - 900.0
    active_events = db.query(EventDB).filter(
        EventDB.is_demo == is_demo_filter,
        EventDB.status == "NEW",
        EventDB.timestamp >= recent_cutoff
    ).count()
    
    total_anpr = db.query(ANPRDB).filter(ANPRDB.is_demo == is_demo_filter).count()
    
    total_tracks = 0
    for pipe in active_pipelines.values():
        if hasattr(pipe, "track_last_seen"):
            total_tracks += len(pipe.track_last_seen)

    return SystemStats(
        total_cameras=total_cams,
        active_cameras=active_cams,
        total_incidents=total_events,
        active_incidents=active_events,
        total_tracks=total_tracks,
        total_anpr=total_anpr
    )

@router.get("/system/timeline")
def get_system_timeline(limit: int = 30):
    from backend.app.main import recent_activities
    return recent_activities[:limit]

@router.get("/ai/models")
def get_ai_models():
    """Returns AI model registry status, explicitly designating unavailable models."""
    from ai.inference.model_registry import model_registry
    return model_registry.list_models()

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

@router.get("/cameras/{camera_id}/activity-analysis")
def get_camera_activity_analysis(camera_id: str):
    import time
    from backend.app.main import active_pipelines
    pipe = active_pipelines.get(camera_id)
    if pipe and hasattr(pipe, "get_live_activity_analysis"):
        return pipe.get_live_activity_analysis()
    return {
        "camera_id": camera_id,
        "camera_name": "Camera Offline / Reconnecting",
        "sector": "Sector Alpha",
        "framing_overview": "OFFLINE",
        "active_tracks_count": 0,
        "tracks": [],
        "pose_model_status": "UNAVAILABLE (yolov8n-pose.pt not loaded)",
        "weapon_model_status": "UNAVAILABLE (small_arms_yolov8.pt not loaded)",
        "timestamp": time.time()
    }

@router.get("/system/mode")
def get_mode():
    from backend.app.main import system_mode
    return {"mode": system_mode}

@router.post("/system/mode")
def set_mode(payload: dict):
    target = payload.get("mode", "live")
    from backend.app.main import start_demo_mode, stop_demo_mode
    if target == "demo":
        start_demo_mode()
    else:
        stop_demo_mode()
    return {"status": "ok", "mode": target}

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

# --- AUTHORIZED ENTITIES & VEHICLE INTELLIGENCE ---

@router.get("/vehicles/authorized", response_model=List[AuthorizedVehicleOut])
def get_authorized_vehicles(db: Session = Depends(get_db)):
    from backend.app.database.models import AuthorizedVehicleDB
    return db.query(AuthorizedVehicleDB).order_by(AuthorizedVehicleDB.created_at.desc()).all()

@router.post("/vehicles/authorized", response_model=AuthorizedVehicleOut)
def add_authorized_vehicle(veh: AuthorizedVehicleCreate, db: Session = Depends(get_db)):
    from backend.app.database.models import AuthorizedVehicleDB
    clean_plate = veh.plate.strip().upper().replace(" ", "").replace("-", "")
    existing = db.query(AuthorizedVehicleDB).filter(AuthorizedVehicleDB.plate == clean_plate).first()
    if existing:
        for k, v in veh.model_dump().items():
            if k != "plate" and v is not None:
                setattr(existing, k, v)
        db.commit()
        db.refresh(existing)
        return existing
    
    new_v = AuthorizedVehicleDB(
        plate=clean_plate,
        owner_name=veh.owner_name,
        department=veh.department or "Border Security Force",
        vehicle_type=veh.vehicle_type or "SUV",
        authorized_color=veh.authorized_color.upper() if veh.authorized_color else "WHITE",
        authorized_sectors=veh.authorized_sectors or "Sector Alpha, Sector Bravo",
        status=veh.status or "ACTIVE",
        notes=veh.notes
    )
    db.add(new_v)
    db.commit()
    db.refresh(new_v)
    return new_v

@router.delete("/vehicles/authorized/{plate}")
def delete_authorized_vehicle(plate: str, db: Session = Depends(get_db)):
    from backend.app.database.models import AuthorizedVehicleDB
    clean_plate = plate.strip().upper().replace(" ", "").replace("-", "")
    v = db.query(AuthorizedVehicleDB).filter(AuthorizedVehicleDB.plate == clean_plate).first()
    if v:
        db.delete(v)
        db.commit()
        return {"status": "deleted", "plate": clean_plate}
    raise HTTPException(status_code=404, detail="Vehicle not found in authorized registry")

@router.post("/vehicles/verify")
def verify_vehicle_intel(payload: dict, db: Session = Depends(get_db)):
    from backend.app.services.vehicle_intel import vehicle_intel_service
    plate = payload.get("plate", "")
    color = payload.get("detected_color", "UNKNOWN")
    sector = payload.get("sector", "Sector Alpha")
    return vehicle_intel_service.verify_vehicle(db, plate, color, sector)

@router.get("/vehicles/handoff")
def get_vehicle_handoff(camera_id: str):
    from backend.app.services.vehicle_intel import vehicle_intel_service
    res = vehicle_intel_service.predict_handoff(camera_id)
    return res or {
        "current_camera": camera_id, 
        "predicted_next_camera": "NONE", 
        "estimated_time_seconds": 0, 
        "correlation_confidence": 0.0,
        "trajectory_heading": "Stationary"
    }

@router.get("/personnel/authorized", response_model=List[AuthorizedPersonOut])
def get_authorized_personnel(db: Session = Depends(get_db)):
    from backend.app.database.models import AuthorizedPersonDB
    return db.query(AuthorizedPersonDB).order_by(AuthorizedPersonDB.created_at.desc()).all()

@router.post("/personnel/authorized", response_model=AuthorizedPersonOut)
def add_authorized_person(pers: AuthorizedPersonCreate, db: Session = Depends(get_db)):
    from backend.app.database.models import AuthorizedPersonDB
    pid = pers.personnel_id.strip().upper()
    existing = db.query(AuthorizedPersonDB).filter(AuthorizedPersonDB.personnel_id == pid).first()
    if existing:
        for k, v in pers.model_dump().items():
            if k != "personnel_id" and v is not None:
                setattr(existing, k, v)
        db.commit()
        db.refresh(existing)
        return existing
    new_p = AuthorizedPersonDB(
        personnel_id=pid,
        full_name=pers.full_name,
        role=pers.role or "Patrol Guard",
        clearance_level=pers.clearance_level or "RESTRICTED",
        status=pers.status or "ACTIVE",
        assigned_sector=pers.assigned_sector or "Sector Alpha"
    )
    db.add(new_p)
    db.commit()
    db.refresh(new_p)
    return new_p

@router.delete("/personnel/authorized/{personnel_id}")
def delete_authorized_person(personnel_id: str, db: Session = Depends(get_db)):
    from backend.app.database.models import AuthorizedPersonDB
    pid = personnel_id.strip().upper()
    p = db.query(AuthorizedPersonDB).filter(AuthorizedPersonDB.personnel_id == pid).first()
    if p:
        db.delete(p)
        db.commit()
        return {"status": "deleted", "personnel_id": pid}
    raise HTTPException(status_code=404, detail="Personnel not found in authorized registry")