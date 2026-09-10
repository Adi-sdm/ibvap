import sys
from pathlib import Path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))
import pytest
import numpy as np
import cv2
import json
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.secrets_vault import secrets_vault
from ai.inference.model_registry import model_registry
from ai.inference.annotator import frame_annotator

client = TestClient(app)

def test_model_registry_truthfulness():
    """Verify missing small_arms_yolov8.pt reports MODEL UNAVAILABLE without fake detections."""
    models = model_registry.list_models()
    sa_model = next((m for m in models if m["name"] == "small_arms_detector"), None)
    assert sa_model is not None
    assert sa_model["available"] is False
    assert sa_model["status"] == "MODEL UNAVAILABLE"

def test_secrets_vault_security():
    """Verify Gemini API key is not stored in SQLite and returns masked representation."""
    test_key = "AIzaSyDummySecretKeyForSurveillance9988"
    secrets_vault.set_gemini_api_key(test_key)
    
    assert secrets_vault.is_gemini_configured() is True
    masked = secrets_vault.get_masked_gemini_key()
    assert masked.startswith("AIzaSy")
    assert masked.endswith("9988")
    assert "DummySecretKey" not in masked
    
    # Check status endpoint never returns plaintext key
    response = client.get("/api/ai/gemini/status")
    assert response.status_code == 200
    data = response.json()
    assert data["configured"] is True
    assert "AIzaSy" in data["masked_key"]
    assert "DummySecretKey" not in json.dumps(data)
    
    # Cleanup
    secrets_vault.delete_gemini_api_key()
    assert secrets_vault.is_gemini_configured() is False

def test_surveillance_profiles_catalog():
    """Verify profile catalog returns all standard presets."""
    res = client.get("/api/profiles")
    assert res.status_code == 200
    profiles = res.json()
    assert len(profiles) >= 4
    names = [p["name"] for p in profiles]
    assert "Border Fence Monitoring" in names
    assert "Checkpoint Monitoring" in names
    assert "Vehicle Inspection" in names

def test_frame_annotator_rendering():
    """Verify FrameAnnotator renders clean HUD annotations on synthetic frame without crashing."""
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    boxes = [{
        "bbox": [100, 100, 200, 300],
        "class_name": "person",
        "confidence": 0.88,
        "track_id": 42,
        "behaviour": "Running"
    }]
    zones = [{
        "name": "Buffer Zone",
        "zone_type": "RESTRICTED",
        "polygon": [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.1, 0.5]]
    }]
    
    annotated = frame_annotator.annotate(
        frame=frame,
        boxes=boxes,
        zones=zones,
        overlay_config={"labels": True, "confidence": True, "tracks": True, "zones": True, "debug": True},
        telemetry={"fps": 22.5, "profile": "Border Fence", "sector": "Sector Alpha"}
    )
    assert annotated is not None
    assert annotated.shape == (480, 640, 3)
    # Check that pixels were drawn (not all black anymore)
    assert annotated.sum() > 0

def test_system_settings_persistence():
    """Verify dynamic platform settings can be read and updated."""
    res = client.get("/api/settings")
    assert res.status_code == 200
    settings = res.json()
    assert "detection_conf" in settings
    assert "alert_threshold" in settings
    
    update_res = client.patch("/api/settings", json={"alert_threshold": 65, "loitering_seconds": 12.0})
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["alert_threshold"] == 65
    assert updated["loitering_seconds"] == 12.0
