from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import declarative_base, sessionmaker
from pathlib import Path
import os
import shutil

DB_DIR = Path(__file__).resolve().parents[3] / 'database'
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_FILE = DB_DIR / 'ibvap.db'
DATABASE_URL = f"sqlite:///{DB_FILE}"

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False}
)

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def run_safe_migrations():
    """Safely apply column additions to existing SQLite tables with zero data loss."""
    if DB_FILE.exists():
        backup_file = DB_DIR / 'ibvap.db.bak'
        try:
            shutil.copy2(DB_FILE, backup_file)
        except Exception as e:
            print(f"[Database] Warning: could not create db backup: {e}")

    with engine.connect() as conn:
        # 1. Cameras table columns
        try:
            result = conn.execute(text("PRAGMA table_info(cameras)"))
            existing_cam_cols = {row[1] for row in result.fetchall()}
            
            cam_columns_to_add = [
                ("profile", "TEXT DEFAULT 'Border Fence Monitoring'"),
                ("sector", "TEXT DEFAULT 'Sector Alpha'"),
                ("auth_username", "TEXT"),
                ("auth_password", "TEXT"),
                ("enabled_modules", "TEXT DEFAULT '{\"intrusion\": true, \"loitering\": true, \"direction\": true, \"group\": true, \"animal_filter\": true, \"anpr\": true, \"small_arms\": false, \"day_night\": true}'"),
                ("sensitivity_preset", "TEXT DEFAULT 'standard'"),
                ("alert_threshold", "INTEGER DEFAULT 60"),
                ("overlay_config", "TEXT DEFAULT '{\"labels\": true, \"confidence\": true, \"tracks\": true, \"zones\": true, \"speed\": false, \"debug\": false}'"),
                ("gemini_enabled", "BOOLEAN DEFAULT 1"),
            ]
            for col_name, col_def in cam_columns_to_add:
                if col_name not in existing_cam_cols:
                    conn.execute(text(f"ALTER TABLE cameras ADD COLUMN {col_name} {col_def}"))
                    print(f"[Database Migration] Added cameras.{col_name}")
            conn.commit()
        except Exception as e:
            print(f"[Database Migration] Error migrating cameras: {e}")

        # 2. Events table columns
        try:
            result = conn.execute(text("PRAGMA table_info(events)"))
            existing_event_cols = {row[1] for row in result.fetchall()}
            
            event_columns_to_add = [
                ("gemini_analysis", "TEXT"),
                ("gemini_status", "TEXT DEFAULT 'NONE'"),
            ]
            for col_name, col_def in event_columns_to_add:
                if col_name not in existing_event_cols:
                    conn.execute(text(f"ALTER TABLE events ADD COLUMN {col_name} {col_def}"))
                    print(f"[Database Migration] Added events.{col_name}")
            conn.commit()
        except Exception as e:
            print(f"[Database Migration] Error migrating events: {e}")