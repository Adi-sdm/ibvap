from .session import Base, engine
from .models import CameraDB, VirtualZoneDB, EventDB, EvidenceDB, ANPRDB, AuditLogDB

def init_db():
    Base.metadata.create_all(bind=engine)