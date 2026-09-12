import sys
import time
import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from ai.inference.pipeline import CameraPipeline
from backend.app.database import init_db
from backend.app.database.session import SessionLocal
from backend.app.database.models import EventDB, EvidenceDB, CameraDB, VirtualZoneDB

def test_end_to_end_intrusion():
    print("--- RUNNING E2E INTRUSION VERIFICATION ---")
    init_db()

    cam_id = "DEMO-E2E-TEST"
    db = SessionLocal()
    try:
        # Clean up any existing test records
        db.query(EvidenceDB).filter(EvidenceDB.event_id.in_(
            db.query(EventDB.event_id).filter(EventDB.camera_id == cam_id)
        )).delete(synchronize_session=False)
        db.query(EventDB).filter(EventDB.camera_id == cam_id).delete()
        db.query(VirtualZoneDB).filter(VirtualZoneDB.zone_id == 'ZONE-E2E-RESTRICTED').delete()
        db.query(VirtualZoneDB).filter(VirtualZoneDB.camera_id == cam_id).delete()
        db.query(CameraDB).filter(CameraDB.camera_id == cam_id).delete()
        db.commit()

        # Add test camera
        video_path = str(PROJECT_ROOT / "demo" / "videos" / "border_intrusion.mp4")
        cam = CameraDB(
            camera_id=cam_id,
            name="E2E Intrusion Cam",
            rtsp_url=video_path,
            location="Perimeter Sector North",
            status="ONLINE",
            is_demo=True
        )
        db.add(cam)

        # Add restricted virtual zone
        zone = VirtualZoneDB(
            zone_id="ZONE-E2E-RESTRICTED",
            camera_id=cam_id,
            name="Restricted Zero Line",
            polygon_coords=json.dumps([[0.2, 0.52], [0.85, 0.52], [0.95, 0.92], [0.15, 0.92]]),
            zone_type="RESTRICTED",
            color="#EF4444"
        )
        db.add(zone)
        db.commit()
    finally:
        db.close()

    received_events = []

    def test_callback(payload):
        if payload.get("type") == "INCIDENT_ALERT":
            incident = payload.get("incident") or payload
            received_events.append(incident)
            print(f"[E2E] Alert Received: {incident.get('event_type')} - Score: {incident.get('risk_score')} - Severity: {incident.get('severity')}")

    pipeline = CameraPipeline(cam_id, video_path, event_callback=test_callback)
    pipeline.start()
    print("[E2E] Ingesting video frames...")
    time.sleep(7.0)
    pipeline.stop()

    assert len(received_events) > 0, "No alerts captured!"
    first_ev = received_events[0]
    print(f"[E2E] Captured Event Type: {first_ev.get('event_type')}")
    print(f"[E2E] Risk Score: {first_ev.get('risk_score')} (Severity: {first_ev.get('severity')})")

    assert first_ev.get("risk_score", 0) >= 70, f"Expected Critical score >= 70, got {first_ev.get('risk_score')}"
    assert first_ev.get("severity") == "Critical", f"Expected Critical severity, got {first_ev.get('severity')}"

    # Database verification
    db = SessionLocal()
    try:
        db_ev = db.query(EventDB).filter(EventDB.camera_id == cam_id).first()
        assert db_ev is not None, "Event not found in SQLite DB"
        assert db_ev.severity == "Critical"
        print(f"[E2E] Event verified in SQLite: {db_ev.event_id}")
    finally:
        db.close()

    print("--- END-TO-END VERIFICATION SUCCESSFUL ---")

if __name__ == "__main__":
    test_end_to_end_intrusion()