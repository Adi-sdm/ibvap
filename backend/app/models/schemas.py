import json
from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import List, Optional, Any, Dict

class CameraCreate(BaseModel):
    name: str
    rtsp_url: str
    location: Optional[str] = None
    fps: Optional[float] = 0.0
    resolution: Optional[str] = None
    profile: Optional[str] = "Border Fence Monitoring"
    sector: Optional[str] = "Sector Alpha"
    enabled_modules: Optional[Dict[str, bool]] = None
    sensitivity_preset: Optional[str] = "standard"
    alert_threshold: Optional[int] = 60
    overlay_config: Optional[Dict[str, bool]] = None
    gemini_enabled: Optional[bool] = True

class CameraOut(BaseModel):
    camera_id: str
    name: str
    rtsp_url: str
    location: Optional[str] = None
    fps: Optional[float] = 0.0
    resolution: Optional[str] = None
    status: str
    profile: Optional[str] = "Border Fence Monitoring"
    sector: Optional[str] = "Sector Alpha"
    enabled_modules: Optional[Any] = None # Parsed JSON dict or string
    sensitivity_preset: Optional[str] = "standard"
    alert_threshold: Optional[int] = 60
    overlay_config: Optional[Any] = None # Parsed JSON dict or string
    gemini_enabled: Optional[bool] = True
    is_demo: bool
    model_config = ConfigDict(from_attributes=True)

    @field_validator("enabled_modules", "overlay_config", mode="before")
    @classmethod
    def parse_json_dict(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return {}
        return v

class CameraConfigUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    profile: Optional[str] = None
    sector: Optional[str] = None
    enabled_modules: Optional[Dict[str, bool]] = None
    sensitivity_preset: Optional[str] = None
    alert_threshold: Optional[int] = None
    overlay_config: Optional[Dict[str, bool]] = None
    gemini_enabled: Optional[bool] = None

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
    gemini_analysis: Optional[Any] = None
    gemini_status: Optional[str] = "NONE"
    status: str
    operator_feedback: Optional[str] = None
    operator_notes: Optional[str] = None
    is_demo: bool
    evidence_snapshot: Optional[str] = None
    evidence_hash: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

    @field_validator("detected_objects", "explainability", mode="before")
    @classmethod
    def parse_json_list(cls, v):
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, list) else [str(parsed)]
            except Exception:
                return [v] if v else []
        elif v is None:
            return []
        return v

    @field_validator("gemini_analysis", mode="before")
    @classmethod
    def parse_gemini_analysis(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return None
        return v

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
    gemini_status: Optional[str] = "NONE"
    model_config = ConfigDict(from_attributes=True)

class ActivityTimelineItem(BaseModel):
    id: str
    timestamp: float
    stage: str
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

class SystemConfigOut(BaseModel):
    detection_conf: float = 0.25
    loitering_seconds: float = 8.0
    running_threshold: float = 0.02
    anomaly_sensitivity: float = 0.75
    alert_threshold: int = 60
    evidence_retention_days: int = 30
    gemini_model: str = "gemini-2.0-flash"
    gemini_low_conf_threshold: float = 0.45
    gemini_auto_trigger: bool = True
    cooldown_seconds: int = 15

class SystemConfigUpdate(BaseModel):
    detection_conf: Optional[float] = None
    loitering_seconds: Optional[float] = None
    running_threshold: Optional[float] = None
    anomaly_sensitivity: Optional[float] = None
    alert_threshold: Optional[int] = None
    evidence_retention_days: Optional[int] = None
    gemini_model: Optional[str] = None
    gemini_low_conf_threshold: Optional[float] = None
    gemini_auto_trigger: Optional[bool] = None
    cooldown_seconds: Optional[int] = None

class GeminiStatusResponse(BaseModel):
    configured: bool
    model: str
    enabled: bool
    masked_key: Optional[str] = None
    rate_limit_rpm: int = 10
    status: str # "READY", "UNCONFIGURED", "DISABLED", "RATE_LIMITED", "OFFLINE"

class GeminiConfigUpdate(BaseModel):
    api_key: Optional[str] = None
    model: Optional[str] = "gemini-2.0-flash"
    enabled: Optional[bool] = True
    rate_limit_rpm: Optional[int] = 10
    low_conf_threshold: Optional[float] = 0.45

class GeminiTestRequest(BaseModel):
    api_key: Optional[str] = None
    model: Optional[str] = None