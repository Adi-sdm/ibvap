from .session import Base, engine, run_safe_migrations
from .models import (
    CameraDB, VirtualZoneDB, EventDB, EvidenceDB, ANPRDB,
    AuditLogDB, SystemConfigDB, OperationalSectorDB, SituationAssessmentDB,
    ValidationRunDB, FaceGalleryDB, FaceRecognitionDB,
    UnknownFaceCandidateDB, UnknownFaceSightingDB, FaceRecognitionSessionDB
)

def init_db():
    Base.metadata.create_all(bind=engine)
    run_safe_migrations()