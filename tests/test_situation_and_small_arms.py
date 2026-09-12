import sys
from pathlib import Path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.small_arms import small_arms_detector
from backend.app.services.situation_assessment import situation_assessment_service

client = TestClient(app)

def test_small_arms_detector_truthful_status():
    status = small_arms_detector.get_status()
    assert status["module"] == "small_arms_detector"
    assert status["status"] in ["NOT LOADED", "ONLINE"]
    if not status["available"]:
        assert "small_arms_yolov8.pt" in status["reason"]
        # Must not simulate weapon detections
        res = small_arms_detector.detect_weapon(None)
        assert res is None

import asyncio

def test_situation_assessment_generation():
    res = asyncio.run(situation_assessment_service.generate_assessment(operator="OP-TEST"))
    assert "id" in res
    assert "assessment" in res
    asmt = res["assessment"]
    assert "posture" in asmt
    assert "threat_level" in asmt
    assert "executive_summary" in asmt
    assert "epistemic_tags" in asmt
    assert isinstance(asmt["epistemic_tags"], list)

def test_situation_assessment_api_endpoints():
    post_res = client.post("/api/ai/situation-assessment")
    assert post_res.status_code == 200
    data = post_res.json()
    assert "id" in data
    assert "assessment" in data

    asmt_id = data["id"]
    get_res = client.get("/api/ai/situation-assessments")
    assert get_res.status_code == 200
    items = get_res.json()
    assert len(items) >= 1

    single_res = client.get(f"/api/ai/situation-assessments/{asmt_id}")
    assert single_res.status_code == 200
    assert single_res.json()["id"] == asmt_id

def test_system_readiness_includes_small_arms():
    res = client.get("/api/system/readiness")
    assert res.status_code == 200
    subsystems = res.json().get("subsystems", [])
    names = [s["name"] for s in subsystems]
    assert "Small-Arms Neural Detector" in names


if __name__ == '__main__':
    import pytest
    pytest.main([__file__])
