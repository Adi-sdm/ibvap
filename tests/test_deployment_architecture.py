import sys
from pathlib import Path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_system_status_and_readiness():
    # 1. System status endpoint
    resp = client.get("/api/system/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "initialized" in data
    assert "mode" in data
    assert "total_cameras" in data
    assert "active_incidents" in data
    assert "emergency_mode" in data

    # 2. System readiness diagnostic (10-point check)
    resp = client.get("/api/system/readiness")
    assert resp.status_code == 200
    readiness = resp.json()
    assert "overall" in readiness
    assert "subsystems" in readiness
    assert "timestamp" in readiness
    subsystems = readiness["subsystems"]
    assert len(subsystems) >= 10
    names = [s["name"] for s in subsystems]
    assert any("Database" in n for n in names)
    assert any("Camera Ingestion" in n for n in names)
    assert any("AI Neural Inference" in n for n in names)
    assert any("Tracking" in n for n in names)
    assert any("Evidence" in n for n in names)
    assert any("Small-Arms" in n for n in names)

def test_system_initialize_and_sectors():
    import time
    # 1. Initialize system
    resp = client.post("/api/system/initialize", json={})
    assert resp.status_code == 200
    init_data = resp.json()
    assert init_data.get("initialized") is True

    # 2. Create sector
    sec_name = f"Sector Echo Test {int(time.time())}"
    sector_payload = {
        "name": sec_name,
        "boundary_coords": [[26.85, 70.90], [26.85, 71.00], [26.75, 71.00], [26.75, 70.90]],
        "priority": "HIGH",
        "notes": "Automated verification sector"
    }
    resp = client.post("/api/sectors", json=sector_payload)
    assert resp.status_code in [200, 201]
    created = resp.json()
    created_id = created["sector_id"]

    # 3. Retrieve sectors
    resp = client.get("/api/sectors")
    assert resp.status_code == 200
    sectors = resp.json()
    assert any(s["name"] == sec_name for s in sectors)

    # 4. Delete sector
    resp = client.delete(f"/api/sectors/{created_id}")
    assert resp.status_code == 200

def test_config_export_and_emergency_mode():
    # 1. Export configuration
    resp = client.get("/api/config/export")
    assert resp.status_code == 200
    export_data = resp.json()
    assert export_data.get("platform") == "IBVAP"
    assert "system_config" in export_data

    # 2. Toggle emergency mode
    resp = client.post("/api/system/emergency-mode", json={
        "emergency_mode": True,
        "officer": "Test Commander",
        "justification": "Threat Escalation Automated Test"
    })
    assert resp.status_code == 200
    assert resp.json().get("emergency_mode") is True

    # Check status reflects emergency mode
    status_resp = client.get("/api/system/status")
    assert status_resp.json().get("emergency_mode") is True

    # Turn off emergency mode
    resp = client.post("/api/system/emergency-mode", json={
        "emergency_mode": False,
        "officer": "Test Commander",
        "justification": "Return to Normal Operations"
    })
    assert resp.status_code == 200
    assert resp.json().get("emergency_mode") is False

def test_config_history_endpoint():
    resp = client.get("/api/config/history?limit=10")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


if __name__ == '__main__':
    import pytest
    pytest.main([__file__])
