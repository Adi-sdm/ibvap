from fastapi.testclient import TestClient
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.main import app
from backend.app.database import init_db

init_db()
client = TestClient(app)

def test_system_endpoints():
    resp = client.get("/api/system/mode")
    assert resp.status_code == 200
    data = resp.json()
    assert "mode" in data

    stats_resp = client.get("/api/system/stats")
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert "total_cameras" in stats
    assert "active_incidents" in stats

def test_camera_crud_and_zones():
    cam_data = {
        "name": "Perimeter Test Camera 01",
        "rtsp_url": "test_stream_01.mp4",
        "location": "North Sector Test"
    }
    create_resp = client.post("/api/cameras", json=cam_data)
    assert create_resp.status_code == 200
    created_cam = create_resp.json()
    camera_id = created_cam["camera_id"]
    assert camera_id is not None
    assert created_cam["name"] == cam_data["name"]

    cams_resp = client.get("/api/cameras")
    assert cams_resp.status_code == 200
    cams = cams_resp.json()
    cam_ids = [c["camera_id"] for c in cams]
    assert camera_id in cam_ids

    zone_data = {
        "camera_id": camera_id,
        "name": "Zero Line Perimeter",
        "polygon_coords": [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]],
        "zone_type": "RESTRICTED",
        "color": "#EF4444"
    }
    zone_resp = client.post("/api/zones", json=zone_data)
    assert zone_resp.status_code == 200
    created_zone = zone_resp.json()
    zone_id = created_zone["zone_id"]
    assert zone_id is not None

    list_zones_resp = client.get(f"/api/zones?camera_id={camera_id}")
    assert list_zones_resp.status_code == 200
    zones = list_zones_resp.json()
    assert any(z["zone_id"] == zone_id for z in zones)

    del_zone_resp = client.delete(f"/api/zones/{zone_id}")
    assert del_zone_resp.status_code == 200

    del_cam_resp = client.delete(f"/api/cameras/{camera_id}")
    assert del_cam_resp.status_code == 200

def test_events_pagination():
    resp = client.get("/api/events?offset=0&limit=10")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert isinstance(data["items"], list)

def test_demo_mode_toggle():
    start_resp = client.post("/api/demo/start")
    assert start_resp.status_code == 200
    assert start_resp.json().get("status") == "started"

    mode_resp = client.get("/api/system/mode")
    assert mode_resp.json().get("mode") == "demo"

    stop_resp = client.post("/api/demo/stop")
    assert stop_resp.status_code == 200
    assert stop_resp.json().get("status") == "stopped"

    mode_resp2 = client.get("/api/system/mode")
    assert mode_resp2.json().get("mode") == "live"

def test_audit_log_and_gis_spatial_endpoints():
    # 1. Test Audit Log creation and retrieval
    audit_payload = {
        "action": "PRIVILEGED_HALT_PIPELINE",
        "entity_type": "CAMERA",
        "entity_id": "CAM-TEST-AUDIT",
        "details": "Authorized by Duty Commander: Routine sensor maintenance"
    }
    post_resp = client.post("/api/audit-log", json=audit_payload)
    assert post_resp.status_code == 200
    created_entry = post_resp.json()
    assert created_entry["action"] == audit_payload["action"]
    assert created_entry["entity_id"] == audit_payload["entity_id"]

    get_resp = client.get("/api/audit-log")
    assert get_resp.status_code == 200
    logs = get_resp.json()
    assert isinstance(logs, list)
    assert len(logs) >= 1
    assert any(l["action"] == "PRIVILEGED_HALT_PIPELINE" for l in logs)

    # 2. Test Camera Spatial GIS fields
    cam_data = {
        "name": "GIS Calibrated Camera",
        "rtsp_url": "test_gis_stream.mp4",
        "sector": "Sector Bravo",
        "latitude": 32.1234,
        "longitude": 74.5678,
        "direction": 45.0,
        "fov_degrees": 75.0,
        "range_meters": 200.0
    }
    cam_resp = client.post("/api/cameras", json=cam_data)
    assert cam_resp.status_code == 200
    cam = cam_resp.json()
    assert cam["latitude"] == 32.1234
    assert cam["longitude"] == 74.5678
    assert cam["direction"] == 45.0
    assert cam["fov_degrees"] == 75.0
    assert cam["range_meters"] == 200.0

    # 3. Test Patching Spatial GIS config
    patch_resp = client.patch(f"/api/cameras/{cam['camera_id']}/config", json={
        "direction": 90.0,
        "fov_degrees": 90.0,
        "range_meters": 250.0
    })
    assert patch_resp.status_code == 200
    patched_cam = patch_resp.json()
    assert patched_cam["direction"] == 90.0
    assert patched_cam["fov_degrees"] == 90.0
    assert patched_cam["range_meters"] == 250.0

    # Clean up test camera
    client.delete(f"/api/cameras/{cam['camera_id']}")

if __name__ == '__main__':
    import pytest
    pytest.main([__file__])
