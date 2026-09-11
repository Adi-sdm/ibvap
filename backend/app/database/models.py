from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey
from datetime import datetime, timezone
from .session import Base

class CameraDB(Base):
    __tablename__ = "cameras"

    camera_id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    rtsp_url = Column(String, nullable=False) # RTSP URL, webcam index ("0"), or MP4 path
    location = Column(String, default="Perimeter Sector A")
    status = Column(String, default="ONLINE") # ONLINE, OFFLINE, DEGRADED, RECONNECTING
    fps = Column(Float, default=20.0)
    resolution = Column(String, default="800x600")
    profile = Column(String, default="Border Fence Monitoring") # Border Fence, Checkpoint, Vehicle Inspection, Sensitive Sector, Custom
    sector = Column(String, default="Sector Alpha")
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
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class EvidenceDB(Base):
    __tablename__ = "evidence"

    event_id = Column(String, ForeignKey('events.event_id'), primary_key=True, index=True)
    snapshot_path = Column(String, nullable=False)
    video_clip_path = Column(String, nullable=True)
    metadata_path = Column(String, nullable=True)
    sha256_hash = Column(String, nullable=False)
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
    authorized_sectors = Column(String, default="Sector Alpha, Sector Bravo")
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
    assigned_sector = Column(String, default="Sector Alpha")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class OperationalSectorDB(Base):
    __tablename__ = "operational_sectors"

    sector_id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    boundary_coords = Column(Text, nullable=True) # JSON list of [lat, lng]
    priority = Column(String, default="NORMAL") # HIGH, NORMAL, LOW
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))