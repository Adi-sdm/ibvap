from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Any, Dict

class CameraCreate(BaseModel):
    name: str
    rtsp_url: str
    location: Optional[str] = None
    fps: Optional[float] = 0.0
    resolution: Optional[str] = None

class CameraOut(CameraCreate):
    camera_id: str
    status: str
    is_demo: bool
    model_config = ConfigDict(from_attributes=True)

class VirtualZoneCreate(BaseModel):
    camera_id: str
    name: str
    polygon_coords: List[List[float]] # [[x, y], ...]
    zone_type: str = "RESTRICTED"
    color: Optional[str] = None

class VirtualZoneOut(VirtualZoneCreate):
    zone_id: str
    model_config = ConfigDict(from_attributes=True)

class EventOut(BaseModel):
    event_id: str
    camera_id: str
    event_type: str
    severity: str
    timestamp: float
    track_id: Optional[int] = None
    confidence: float
    risk_score: int
    zone_id: Optional[str] = None
    zone_name: Optional[str] = None
    class_name: Optional[str] = "person"
    ai_summary: Optional[str] = None
    behaviour: Optional[str] = "Normal"
    detected_objects: List[str] = []
    explainability: List[str] = []
    status: str
    operator_feedback: Optional[str] = None
    operator_notes: Optional[str] = None
    is_demo: bool
    evidence_snapshot: Optional[str] = None
    evidence_hash: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class EventStatusUpdate(BaseModel):
    status: str

class EventFeedbackUpdate(BaseModel):
    feedback: str
    notes: Optional[str] = None

class ANPROut(BaseModel):
    id: int
    plate: str
    confidence: float
    camera_id: str
    timestamp: float
    vehicle_type: str
    verification_required: bool
    snapshot_path: Optional[str] = None
    is_demo: bool
    model_config = ConfigDict(from_attributes=True)

class CameraTestRequest(BaseModel):
    rtsp_url: str

class CameraTestResponse(BaseModel):
    success: bool
    message: str
    width: Optional[int] = None
    height: Optional[int] = None
    fps: Optional[float] = None
    preview_frame: Optional[str] = None

class SystemStats(BaseModel):
    total_cameras: int
    active_cameras: int
    total_incidents: int
    active_incidents: int
    total_tracks: int
    total_anpr: int

class AuditLogOut(BaseModel):
    id: int
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    details: Optional[str] = None
    timestamp: float
    created_at: Any
    model_config = ConfigDict(from_attributes=True)

class EvidenceVaultItem(BaseModel):
    event_id: str
    camera_id: str
    camera_name: Optional[str] = "Perimeter Camera"
    timestamp: float
    event_type: str
    severity: str
    snapshot_path: str
    video_clip_path: Optional[str] = None
    sha256_hash: str
    verified: bool = True
    ai_summary: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class ActivityTimelineItem(BaseModel):
    id: str
    timestamp: float
    stage: str # DETECTION_STARTED, TRACK_ESTABLISHED, BEHAVIOUR_ANALYZED, INCIDENT_CREATED, EVIDENCE_STORED
    title: str
    description: str
    camera_id: str
    track_id: Optional[int] = None
    severity: Optional[str] = "Info"

class AITrackAnalysis(BaseModel):
    track_id: int
    camera_id: str
    class_name: str
    speed_norm: float
    behaviour: str
    direction: str
    trajectory: List[List[float]] = []
    pattern_deviation: int
    risk_score: int
    detected_objects: List[str] = []
    last_seen: float

class AISensitivityConfig(BaseModel):
    detection_conf: float = 0.25
    loitering_seconds: float = 8.0
    running_threshold: float = 0.02
    anomaly_sensitivity: float = 0.75