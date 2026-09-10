from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey
from datetime import datetime, timezone
from .session import Base

class CameraDB(Base):
    __tablename__ = "cameras"

    camera_id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    rtsp_url = Column(String, nullable=False) # Can be RTSP URL or MP4 path
    location = Column(String, default="Perimeter Sector A")
    status = Column(String, default="ONLINE") # ONLINE, OFFLINE, DEGRADED
    fps = Column(Float, default=20.0)
    resolution = Column(String, default="800x600")
    is_demo = Column(Boolean, default=False)
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
    action = Column(String, nullable=False)  # CAMERA_ADDED, CAMERA_DELETED, INCIDENT_STATUS_CHANGED, etc.
    entity_type = Column(String, nullable=True)  # camera, event, zone
    entity_id = Column(String, nullable=True)
    details = Column(Text, nullable=True)  # JSON string with extra info
    timestamp = Column(Float, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))