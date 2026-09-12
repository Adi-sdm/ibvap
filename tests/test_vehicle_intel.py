import pytest
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database.session import SessionLocal
from backend.app.services.vehicle_intel import vehicle_intel_service
from backend.app.database.models import AuthorizedVehicleDB

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture(autouse=True)
def setup_test_vehicles():
    db = SessionLocal()
    try:
        # Ensure test vehicle records exist for test run
        v1 = db.query(AuthorizedVehicleDB).filter(AuthorizedVehicleDB.plate == "DL01AB1234").first()
        if not v1:
            v1 = AuthorizedVehicleDB(
                plate="DL01AB1234",
                owner_name="Test Patrol Unit Alpha",
                department="Border Security",
                vehicle_type="SUV",
                authorized_color="WHITE",
                authorized_sectors="Sector Alpha",
                status="ACTIVE"
            )
            db.add(v1)
        v2 = db.query(AuthorizedVehicleDB).filter(AuthorizedVehicleDB.plate == "PB02XY9999").first()
        if not v2:
            v2 = AuthorizedVehicleDB(
                plate="PB02XY9999",
                owner_name="Test Syndicate Vehicle",
                department="Unknown",
                vehicle_type="TRUCK",
                authorized_color="BLACK",
                authorized_sectors="Sector Alpha",
                status="WATCHLIST"
            )
            db.add(v2)
        db.commit()
    finally:
        db.close()

def test_vehicle_intel_verification_logic():
    db = SessionLocal()
    try:
        # 1. Authorized Match
        res1 = vehicle_intel_service.verify_vehicle(db, "DL01AB1234", "WHITE", "Sector Alpha")
        assert res1["status"] == "AUTHORIZED"
        assert res1["is_authorized"] is True
        assert res1["risk_score"] <= 20

        # 2. Attribute Mismatch (Color Discrepancy)
        res2 = vehicle_intel_service.verify_vehicle(db, "DL01AB1234", "RED", "Sector Alpha")
        assert res2["status"] == "ATTRIBUTE_MISMATCH"
        assert res2["is_authorized"] is False
        assert res2["risk_score"] >= 80

        # 3. Watchlist Flagged Intercept
        res3 = vehicle_intel_service.verify_vehicle(db, "PB02XY9999", "BLACK", "Sector Alpha")
        assert res3["status"] == "WATCHLIST"
        assert res3["is_authorized"] is False
        assert res3["risk_score"] >= 90

        # 4. Unregistered Plate
        res4 = vehicle_intel_service.verify_vehicle(db, "XX99ZZ0000", "SILVER/GRAY", "Sector Alpha")
        assert res4["status"] == "UNREGISTERED"
        assert res4["is_authorized"] is False
    finally:
        db.close()

def test_vehicle_handoff_prediction():
    res = vehicle_intel_service.predict_handoff("CAM-01")
    assert res is not None
    assert res["current_camera"] == "CAM-01"
    assert res["predicted_next_camera"] == "CAM-02"
    assert res["correlation_confidence"] > 0.8
    assert res["estimated_time_seconds"] > 0

def test_vehicle_intel_api_endpoints(client):
    # Test GET authorized vehicles
    res = client.get("/api/vehicles/authorized")
    assert res.status_code == 200
    assert isinstance(res.json(), list)

    # Test POST verify
    res_verify = client.post("/api/vehicles/verify", json={
        "plate": "DL01AB1234",
        "detected_color": "WHITE",
        "sector": "Sector Alpha"
    })
    assert res_verify.status_code == 200
    assert res_verify.json()["status"] == "AUTHORIZED"

    # Test GET handoff
    res_handoff = client.get("/api/vehicles/handoff?camera_id=CAM-01")
    assert res_handoff.status_code == 200
    assert res_handoff.json()["predicted_next_camera"] == "CAM-02"

    # Test GET activity analysis endpoint
    res_activity = client.get("/api/cameras/CAM-01/activity-analysis")
    assert res_activity.status_code == 200
    data = res_activity.json()
    assert "framing_overview" in data
    assert "tracks" in data
    assert "pose_model_status" in data

if __name__ == "__main__":
    db = SessionLocal()
    try:
        v1 = db.query(AuthorizedVehicleDB).filter(AuthorizedVehicleDB.plate == "DL01AB1234").first()
        if not v1:
            v1 = AuthorizedVehicleDB(
                plate="DL01AB1234",
                owner_name="Test Patrol Unit Alpha",
                department="Border Security",
                vehicle_type="SUV",
                authorized_color="WHITE",
                authorized_sectors="Sector Alpha",
                status="ACTIVE"
            )
            db.add(v1)
        v2 = db.query(AuthorizedVehicleDB).filter(AuthorizedVehicleDB.plate == "PB02XY9999").first()
        if not v2:
            v2 = AuthorizedVehicleDB(
                plate="PB02XY9999",
                owner_name="Test Syndicate Vehicle",
                department="Unknown",
                vehicle_type="TRUCK",
                authorized_color="BLACK",
                authorized_sectors="Sector Alpha",
                status="WATCHLIST"
            )
            db.add(v2)
        db.commit()
    finally:
        db.close()

    test_vehicle_intel_verification_logic()
    test_vehicle_handoff_prediction()
    test_vehicle_intel_api_endpoints(TestClient(app))
    print("ALL VEHICLE INTEL TESTS PASSED!")
