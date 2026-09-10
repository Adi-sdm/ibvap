import pytest
import sys
import os
import time

from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.app.services.risk_engine import risk_engine
from backend.app.services.event_fusion import IncidentFusionManager
from backend.app.services.evidence_service import evidence_service
import numpy as np

def test_risk_scoring_and_explainability():
    # Scenario: Intrusion at night in restricted zone
    score, severity, explainability = risk_engine.evaluate(
        event_type="INTRUSION_ENTRY",
        zone_type="RESTRICTED",
        class_name="person",
        is_night=True,
        loitering_seconds=0.0
    )
    # Base: 10, Restricted: 35, Boundary: 30, Night: 15 = 90
    assert score == 90
    assert severity == "Critical"
    assert any("Perimeter Zone" in r for r in explainability)
    assert any("Low-light / nocturnal" in r for r in explainability)
    assert any("Target identified as 'person'" in r for r in explainability)

def test_event_fusion():
    fusion = IncidentFusionManager(fusion_window_seconds=10.0)
    
    # Event 1: Entry
    ev1 = {
        "event_id": "e1",
        "camera_id": "cam1",
        "track_id": 42,
        "class_name": "person",
        "zone_name": "Sector 4 Fence",
        "event_type": "ZONE_ENTRY",
        "risk_score": 45,
        "severity": "Medium",
        "timestamp": 1000.0,
        "explainability": ["Rule A"]
    }
    fused1 = fusion.process_event(ev1)
    assert len(fused1["timeline"]) >= 2
    assert fused1["risk_score"] == 45

    # Event 2: Loitering on same track within 5 seconds -> must fuse into same record
    ev2 = {
        "event_id": "e2",
        "camera_id": "cam1",
        "track_id": 42,
        "class_name": "person",
        "zone_name": "Sector 4 Fence",
        "event_type": "LOITERING",
        "risk_score": 75,
        "severity": "Critical",
        "timestamp": 1005.0,
        "explainability": ["Rule B"]
    }
    fused2 = fusion.process_event(ev2)
    assert fused2["risk_score"] == 75, "Risk score should escalate to highest value"
    assert fused2["severity"] == "Critical"
    assert "Rule A" in fused2["explainability"]
    assert "Rule B" in fused2["explainability"]
    assert len(fused2["timeline"]) == 3, "Timeline should have appended the new state"

def test_evidence_sha256():
    dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    res = evidence_service.capture_evidence("test_ev_99", dummy_frame, "cam1", {"test": "data"})
    assert "sha256_hash" in res
    assert len(res["sha256_hash"]) == 64 # 64 hex characters for SHA-256
    print(f"Verified Evidence SHA-256: {res['sha256_hash']}")

if __name__ == "__main__":
    test_risk_scoring_and_explainability()
    test_event_fusion()
    test_evidence_sha256()
    print("ALL CORE UNIT TESTS PASSED!")
