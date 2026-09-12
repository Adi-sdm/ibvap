from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey
from datetime import datetime, timezone
from .session import Base

class CameraDB(Base):
    __tablename__ = "cameras"

    camera_id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    rtsp_url = Column(String, nullable=False) # RTSP URL, webcam index ("0"), or MP4 path
    location = Column(String, default="Unassigned")
    status = Column(String, default="ONLINE") # ONLINE, OFFLINE, DEGRADED, RECONNECTING
    fps = Column(Float, default=20.0)
    resolution = Column(String, default="800x600")
    profile = Column(String, default="Border Fence Monitoring") # Border Fence, Checkpoint, Vehicle Inspection, Sensitive Sector, Custom
    sector = Column(String, default="Unassigned")
    auth_username = Column(String, nullable=True)
    auth_password = Column(String, nullable=True)
    enabled_modules = Column(Text, default='{"intrusion": true, "loitering": true, "direction": true, "group": true, "animal_filter": true, "anpr": true, "small_arms": false, "day_night": true}')
    sensitivity_preset = Column(String, default="standard") # low, standard, high
    alert_threshold = Column(Integer, default=60) # 0-100 risk score required to dispatch incident
    overlay_config = Column(Text, default='{"labels": true, "confidence": true, "tracks": true, "zones": true, "speed": false, "debug": false}')
    gemini_enabled = Column(Boolean, default=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    direction = Column(Float, default=0.0) # degrees 0-360
    fov_degrees = Column(Float, default=60.0)
    range_meters = Column(Float, default=150.0)
    is_demo = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    maintenance_details = Column(Text, nullable=True) # JSON: in_maintenance, enabled_by, reason, start_time, duration_minutes
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class VirtualZoneDB(Base):
    __tablename__ = "zones"

    zone_id = Column(String, primary_key=True, index=True)
    camera_id = Column(String, ForeignKey("cameras.camera_id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    polygon_coords = Column(Text, nullable=False) # JSON string of [[x, y], ...] normalized
    zone_type = Column(String, default="RESTRICTED") # RESTRICTED, WARNING, CHECKPOINT
    color = Column(String, default="#EF4444")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class EventDB(Base):
    __tablename__ = "events"

    event_id = Column(String, primary_key=True, index=True)
    camera_id = Column(String, ForeignKey("cameras.camera_id"), nullable=False, index=True)
    event_type = Column(String, nullable=False) # INTRUSION_ENTRY, ZONE_EXIT, LOITERING, VEHICLE_ENTRY, NIGHT_MOVEMENT
    severity = Column(String, default="Medium") # Critical, High, Medium, Info
    timestamp = Column(Float, nullable=False, index=True)
    track_id = Column(Integer, nullable=True)
    confidence = Column(Float, default=0.0)
    risk_score = Column(Integer, default=0)
    zone_id = Column(String, nullable=True)
    zone_name = Column(String, nullable=True)
    class_name = Column(String, default="person")
    ai_summary = Column(Text, nullable=True)
    behaviour = Column(String, default="Normal")
    detected_objects = Column(Text, default="[]")
    explainability = Column(Text, default="[]") # JSON list of rules fired
    gemini_analysis = Column(Text, nullable=True) # JSON object from Gemini Assisted Analysis
    gemini_status = Column(String, default="NONE") # NONE, PENDING, COMPLETED, OFFLINE, FAILED
    status = Column(String, default='NEW')
    operator_feedback = Column(String, nullable=True)
    operator_notes = Column(Text, nullable=True)
    is_demo = Column(Boolean, default=False)
    data_mode = Column(String, default="LIVE") # LIVE, DEMO, VALIDATION
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class EvidenceDB(Base):
    __tablename__ = "evidence"

    event_id = Column(String, ForeignKey('events.event_id'), primary_key=True, index=True)
    snapshot_path = Column(String, nullable=False)
    video_clip_path = Column(String, nullable=True)
    metadata_path = Column(String, nullable=True)
    sha256_hash = Column(String, nullable=False)
    evidence_type = Column(String, default="KEYFRAME") # KEYFRAME, PRE-EVENT, POST-EVENT, ANPR_CROP, SNAPSHOT, VIDEO
    state = Column(String, default="SEALED") # NOT_CAPTURED, CAPTURE_QUEUED, CAPTURED, HASHED, SEALED, FAILED
    data_mode = Column(String, default="LIVE") # LIVE, DEMO, VALIDATION
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class ANPRDB(Base):
    __tablename__ = "anpr"

    id = Column(Integer, primary_key=True, autoincrement=True)
    plate = Column(String, index=True, nullable=False)
    confidence = Column(Float, default=0.0)
    camera_id = Column(String, nullable=False)
    timestamp = Column(Float, nullable=False)
    vehicle_type = Column(String, default="car")
    verification_required = Column(Boolean, default=False)
    snapshot_path = Column(String, nullable=True)
    is_demo = Column(Boolean, default=False)
    data_mode = Column(String, default="LIVE") # LIVE, DEMO, VALIDATION
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class AuditLogDB(Base):
    __tablename__ = 'audit_log'
    id = Column(Integer, primary_key=True, autoincrement=True)
    action = Column(String, nullable=False)
    entity_type = Column(String, nullable=True)
    entity_id = Column(String, nullable=True)
    details = Column(Text, nullable=True)
    timestamp = Column(Float, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class SystemConfigDB(Base):
    __tablename__ = 'system_config'
    key = Column(String, primary_key=True, index=True)
    value = Column(Text, nullable=False) # JSON encoded configuration data
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class AuthorizedVehicleDB(Base):
    __tablename__ = "authorized_vehicles"

    plate = Column(String, primary_key=True, index=True)
    owner_name = Column(String, nullable=False)
    department = Column(String, default="Border Security Force")
    vehicle_type = Column(String, default="SUV")
    authorized_color = Column(String, default="WHITE")
    authorized_sectors = Column(String, default="All Sectors")
    status = Column(String, default="ACTIVE") # ACTIVE, EXPIRED, FLAGGED, WATCHLIST
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class AuthorizedPersonDB(Base):
    __tablename__ = "authorized_personnel"

    personnel_id = Column(String, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    role = Column(String, default="Patrol Guard")
    clearance_level = Column(String, default="RESTRICTED") # TOP_SECRET, RESTRICTED, PUBLIC
    status = Column(String, default="ACTIVE") # ACTIVE, REVOKED, SUSPENDED
    assigned_sector = Column(String, default="Unassigned")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class OperationalSectorDB(Base):
    __tablename__ = "operational_sectors"

    sector_id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    boundary_coords = Column(Text, nullable=True) # JSON list of [lat, lng]
    priority = Column(String, default="NORMAL") # HIGH, NORMAL, LOW
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class SituationAssessmentDB(Base):
    __tablename__ = "situation_assessments"

    id = Column(String, primary_key=True, index=True)
    timestamp = Column(Float, nullable=False)
    scope = Column(String, default="CURRENT_SITUATION")
    data_mode = Column(String, default="LIVE") # LIVE, DEMO, VALIDATION
    included_cameras = Column(Text, default="[]") # JSON list of camera IDs
    included_incidents = Column(Text, default="[]") # JSON list of incident IDs
    evidence_count = Column(Integer, default=0)
    model = Column(String, default="gemini-3.6-flash")
    status = Column(String, default="COMPLETED") # COMPLETED, FAILED, RUNNING
    result = Column(Text, nullable=True) # JSON structured assessment
    confidence = Column(Float, default=0.85)
    latency_ms = Column(Integer, default=0)
    operator = Column(String, default="OP-01")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class ValidationRunDB(Base):
    __tablename__ = "validation_runs"

    id = Column(String, primary_key=True, index=True)
    test_name = Column(String, nullable=False)
    dataset_name = Column(String, default="STANDARD_PERIMETER_EVAL")
    condition = Column(String, default="ALL") # DAY, NIGHT, LOW_LIGHT, OCCLUSION, DISTANCE
    metrics = Column(Text, nullable=False) # JSON string: precision, recall, f1, fp, fn, fps, latency
    data_mode = Column(String, default="VALIDATION")
    timestamp = Column(Float, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class FaceGalleryDB(Base):
    __tablename__ = "face_gallery"

    person_id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    rank = Column(String, default="Staff")
    designation = Column(String, default="Personnel")
    organization = Column(String, default="Border Security Force")
    category = Column(String, default="OPERATIONAL") # OPERATIONAL, VISITOR, WATCHLIST, VIP, SECURITY, CONTRACTOR
    status = Column(String, default="ACTIVE") # ACTIVE, DISABLED, WATCHLIST
    photo_path = Column(String, nullable=True) # Relative path to primary photo in evidence vault
    photos_json = Column(Text, default="[]") # JSON list of relative photo paths
    embeddings_enc = Column(Text, nullable=False) # Fernet-encrypted JSON of 128-D embedding vectors
    quality_score = Column(Float, default=0.0) # Quality rating 0-100
    notes = Column(Text, nullable=True)
    is_demo = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class FaceRecognitionDB(Base):
    __tablename__ = "face_recognitions"

    recognition_id = Column(String, primary_key=True, index=True)
    camera_id = Column(String, ForeignKey("cameras.camera_id"), nullable=False, index=True)
    track_id = Column(Integer, nullable=True)
    person_id = Column(String, nullable=True, index=True) # None if UNKNOWN
    candidate_id = Column(String, nullable=True, index=True) # UNKNOWN-UXXXX if unknown candidate
    person_name = Column(String, default="Unknown Person")
    person_rank = Column(String, nullable=True)
    category = Column(String, default="UNKNOWN")
    confidence = Column(Float, default=0.0)
    status = Column(String, default="UNKNOWN") # MATCH, UNKNOWN, UNCERTAIN, UNKNOWN_PREVIOUSLY_SEEN, UNKNOWN_NEW
    situation = Column(String, default="SAFE") # SAFE, ATTENTION, UNSAFE
    situation_reason = Column(Text, nullable=True)
    snapshot_path = Column(String, nullable=True)
    bbox_json = Column(Text, default="[0,0,0,0]") # [x1, y1, x2, y2]
    sha256_hash = Column(String, nullable=True)
    event_id = Column(String, nullable=True) # Linked incident if created
    timestamp = Column(Float, nullable=False, index=True)
    is_demo = Column(Boolean, default=False)
    data_mode = Column(String, default="LIVE") # LIVE, DEMO, VALIDATION
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class UnknownFaceCandidateDB(Base):
    __tablename__ = "unknown_face_candidates"

    candidate_id = Column(String, primary_key=True, index=True) # e.g. UNKNOWN-U0001 or DEMO-U0001
    first_seen = Column(Float, nullable=False, index=True)
    last_seen = Column(Float, nullable=False, index=True)
    first_camera_id = Column(String, nullable=True)
    last_camera_id = Column(String, nullable=True, index=True)
    sighting_count = Column(Integer, default=1)
    best_snapshot_path = Column(String, nullable=True) # Relative path to best quality face crop
    best_snapshot_hash = Column(String, nullable=True) # SHA-256 seal
    best_quality_score = Column(Float, default=0.0) # 0.0 - 100.0
    best_quality_metrics = Column(Text, nullable=True) # JSON with sharpness, brightness, resolution, pose
    embeddings_enc = Column(Text, nullable=False) # Fernet-encrypted JSON of 128-D vector
    status = Column(String, default="ACTIVE", index=True) # ACTIVE, PROMOTED, ARCHIVED, EXPIRED
    promoted_to_person_id = Column(String, nullable=True) # e.g. PER-XXXX if promoted
    promoted_at = Column(DateTime, nullable=True)
    retention_until = Column(DateTime, nullable=True) # Auto-expiry retention
    notes = Column(Text, nullable=True)
    is_demo = Column(Boolean, default=False, index=True)
    data_mode = Column(String, default="LIVE") # LIVE, DEMO, VALIDATION
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class UnknownFaceSightingDB(Base):
    __tablename__ = "unknown_face_sightings"

    sighting_id = Column(String, primary_key=True, index=True)
    candidate_id = Column(String, ForeignKey("unknown_face_candidates.candidate_id"), nullable=False, index=True)
    camera_id = Column(String, ForeignKey("cameras.camera_id"), nullable=False, index=True)
    track_id = Column(Integer, nullable=True)
    timestamp = Column(Float, nullable=False, index=True)
    similarity_score = Column(Float, default=0.0)
    snapshot_path = Column(String, nullable=True)
    sha256_hash = Column(String, nullable=True)
    bbox_json = Column(Text, default="[0,0,0,0]")
    quality_score = Column(Float, default=0.0)
    quality_metrics = Column(Text, nullable=True) # JSON
    situation = Column(String, default="SAFE") # SAFE, ATTENTION, UNSAFE
    situation_reason = Column(Text, nullable=True)
    event_id = Column(String, nullable=True)
    is_demo = Column(Boolean, default=False)
    data_mode = Column(String, default="LIVE")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class FaceRecognitionSessionDB(Base):
    __tablename__ = "face_recognition_sessions"

    session_id = Column(String, primary_key=True, index=True)
    camera_id = Column(String, ForeignKey("cameras.camera_id"), nullable=False, index=True)
    track_id = Column(Integer, nullable=True)
    identity_type = Column(String, default="UNKNOWN") # KNOWN, UNKNOWN_NEW, UNKNOWN_PREVIOUSLY_SEEN, UNCERTAIN
    entity_id = Column(String, nullable=True, index=True) # person_id or candidate_id
    entity_name = Column(String, default="Unknown Subject")
    first_seen = Column(Float, nullable=False)
    last_seen = Column(Float, nullable=False)
    duration = Column(Float, default=0.0)
    sighting_count = Column(Integer, default=1)
    best_face_snapshot = Column(String, nullable=True)
    best_quality_score = Column(Float, default=0.0)
    situation_state = Column(String, default="SAFE") # SAFE, ATTENTION, UNSAFE
    is_active = Column(Boolean, default=True, index=True)
    is_demo = Column(Boolean, default=False)
    data_mode = Column(String, default="LIVE")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))