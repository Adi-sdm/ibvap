import time
import json
from backend.app.database.session import SessionLocal
from backend.app.database.models import AuditLogDB

def log_action(action: str, entity_type: str = None, entity_id: str = None, details: dict = None):
    """Record an action in the audit log."""
    db = SessionLocal()
    try:
        entry = AuditLogDB(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=json.dumps(details) if details else None,
            timestamp=time.time()
        )
        db.add(entry)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[AUDIT] Failed to log: {e}")
    finally:
        db.close()
