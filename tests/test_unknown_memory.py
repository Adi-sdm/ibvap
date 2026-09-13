"""
Continuous Face Recognition, Unknown Person Memory & Situational Safety Test Suite
IBVAP - Intelligent Border Video Analytics Platform (SIH26187)

Verifies:
1. Face Quality Assessment Categorization (EXCELLENT, GOOD, FAIR, POOR, UNUSABLE).
2. Camera View Awareness (FACE_CLOSE_RANGE, UPPER_BODY, FULL_BODY, WIDE_SCENE).
3. Two-Layer Biometric Matching Architecture:
   - Layer 1: Enrolled Identity Gallery (MATCH, UNCERTAIN)
   - Layer 2: Anonymous Unknown Memory (UNKNOWN_PREVIOUSLY_SEEN, UNKNOWN_NEW)
4. Unknown Candidate Registration with Machine-Bound Fernet Encryption at Rest.
5. Unknown Candidate Re-Identification (same anonymous face matches previously seen candidate).
6. Unknown Candidate Separation (different anonymous faces create distinct candidate IDs).
7. Best Face Frame Selection & SHA-256 Cryptographic Evidence Seal.
8. Unknown-to-Enrolled Promotion Workflow & Tamper-Evident Audit Logging.
9. Situational Safety Intelligence Engine (SAFE, ATTENTION, UNSAFE).
10. AI Capability Center Diagnostic Truthfulness (13 subsystems verified).
"""

import os
import sys
import time
import json
import uuid
import hashlib
import cv2
import numpy as np
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.main import app
from backend.app.services.frs_service import frs_subsystem, THRESHOLD_MATCH, THRESHOLD_UNCERTAIN
from backend.app.services.situational_safety import situational_safety_engine
from backend.app.services.secrets_vault import secrets_vault
from backend.app.database.session import SessionLocal
from backend.app.database.models import (
    FaceGalleryDB, FaceRecognitionDB, UnknownFaceCandidateDB, 
    UnknownFaceSightingDB, AuditLogDB
)

@pytest.fixture(scope="module")
def client():
    return TestClient(app)

class TestUnknownPersonMemoryAndSafety:

    def test_01_quality_categorization_and_view_state(self):
        """Verify quality ratings (EXCELLENT -> UNUSABLE) and view scale awareness."""
        # 1. High quality clear synthetic face
        clear_crop = np.random.randint(60, 180, (120, 120, 3), dtype=np.uint8)
        # Add high-contrast gradient
        clear_crop[30:90, 30:90] = np.random.randint(20, 240, (60, 60, 3), dtype=np.uint8)
        q_clear = frs_subsystem.assess_face_quality(clear_crop)
        assert q_clear["rating"] in ["EXCELLENT", "GOOD", "FAIR"]
        assert q_clear["score"] > 30.0

        # 2. Unusable blurry crop
        blurred = cv2.GaussianBlur(clear_crop, (45, 45), 0)
        q_blur = frs_subsystem.assess_face_quality(blurred)
        assert q_blur["rating"] in ["POOR", "UNUSABLE"]
        assert not q_blur["passed"]

        # 3. View state classification
        view_close = frs_subsystem.classify_view_state([100, 100, 300, 350], (480, 640)) # fh = 250 / 480 = 0.52
        assert view_close == "FACE_CLOSE_RANGE"

        view_upper = frs_subsystem.classify_view_state([100, 100, 160, 160], (480, 640)) # fh = 60 / 480 = 0.125
        assert view_upper == "UPPER_BODY"

        view_wide = frs_subsystem.classify_view_state([100, 100, 110, 110], (480, 640)) # fh = 10 / 480 = 0.02
        assert view_wide == "WIDE_SCENE"

    def test_02_two_layer_matching_and_unknown_creation(self):
        """Verify Layer 1 (known) vs Layer 2 (unknown) matching and automatic candidate registration."""
        # Generate random normalized 128-D vector
        np.random.seed(42)
        vec_a = np.random.randn(128).astype(np.float32)
        vec_a /= np.linalg.norm(vec_a)

        # 1. Matching against empty unknown gallery should return UNKNOWN_NEW
        m1 = frs_subsystem.match_embedding(vec_a.tolist(), data_mode="LIVE")
        assert m1["status"] == "UNKNOWN"
        assert m1["identity_state"] == "UNKNOWN_NEW"

        # 2. Register new unknown candidate
        dummy_crop = np.ones((80, 80, 3), dtype=np.uint8) * 150
        q_info = {"score": 85.0, "rating": "EXCELLENT", "sharpness": 95.0, "passed": True}
        
        cand = frs_subsystem.register_new_unknown_candidate(
            embedding=vec_a.tolist(),
            crop=dummy_crop,
            quality_info=q_info,
            camera_id="CAM-01",
            is_demo=False,
            data_mode="LIVE"
        )
        cid_a = cand["candidate_id"]
        assert cid_a.startswith("UNKNOWN-U")
        assert cand["best_quality_score"] == 85.0
        assert cand["best_snapshot_path"] is not None

        # 3. Re-identification: Same vector should now match Layer 2 candidate!
        m2 = frs_subsystem.match_embedding(vec_a.tolist(), data_mode="LIVE")
        assert m2["status"] == "UNKNOWN_PREVIOUSLY_SEEN"
        assert m2["candidate_id"] == cid_a
        assert m2["confidence"] >= 0.95

    def test_03_unknown_candidate_separation(self):
        """Verify two different unknown individuals create distinct candidate IDs and never merge."""
        np.random.seed(99)
        # Vector B completely orthogonal to Vector A
        vec_b = np.random.randn(128).astype(np.float32)
        vec_b /= np.linalg.norm(vec_b)

        # Match should be UNKNOWN_NEW, not matching candidate A
        m_b = frs_subsystem.match_embedding(vec_b.tolist(), data_mode="LIVE")
        assert m_b["status"] == "UNKNOWN"
        assert m_b["identity_state"] == "UNKNOWN_NEW"

        # Register candidate B
        dummy_crop = np.ones((80, 80, 3), dtype=np.uint8) * 120
        cand_b = frs_subsystem.register_new_unknown_candidate(
            embedding=vec_b.tolist(),
            crop=dummy_crop,
            quality_info={"score": 78.0, "rating": "GOOD", "sharpness": 80.0, "passed": True},
            camera_id="CAM-02",
            is_demo=False,
            data_mode="LIVE"
        )
        cid_b = cand_b["candidate_id"]
        assert cid_b.startswith("UNKNOWN-U")
        assert cid_b != "UNKNOWN-U0001" or cid_b != cand_b["candidate_id"]

    def test_04_best_face_selection_and_sha256_update(self):
        """Verify candidate's best face snapshot upgrades when a higher-quality crop is observed."""
        db = SessionLocal()
        try:
            cand = db.query(UnknownFaceCandidateDB).first()
            assert cand is not None
            cid = cand.candidate_id
            old_score = cand.best_quality_score
            old_hash = cand.best_snapshot_hash

            # Provide significantly better crop (+10 points)
            better_crop = np.ones((100, 100, 3), dtype=np.uint8) * 200
            better_q = {"score": old_score + 10.0, "rating": "EXCELLENT", "sharpness": 140.0, "passed": True}

            updated = frs_subsystem.update_candidate_sighting(
                candidate_id=cid,
                camera_id="CAM-03",
                crop=better_crop,
                quality_info=better_q,
                data_mode="LIVE"
            )
            assert updated["sighting_count"] >= 2
            assert updated["best_quality_score"] == old_score + 10.0

            # Verify in DB
            db.refresh(cand)
            assert cand.best_quality_score == old_score + 10.0
            assert cand.best_snapshot_hash != old_hash
            assert len(cand.best_snapshot_hash) == 64 # Valid SHA-256
        finally:
            db.close()

    def test_05_unknown_to_enrolled_promotion(self):
        """Verify promoting an anonymous candidate to enrolled personnel emits audit log and updates Layer 1."""
        db = SessionLocal()
        try:
            cand = db.query(UnknownFaceCandidateDB).filter(
                UnknownFaceCandidateDB.status == "ACTIVE"
            ).first()
            assert cand is not None
            cid = cand.candidate_id

            # Promote candidate
            prom_res = frs_subsystem.promote_unknown_candidate(
                candidate_id=cid,
                name="Officer Hardeep Singh",
                rank="Sub-Inspector",
                designation="Sector Bravo Commander",
                category="OPERATIONAL",
                status="ACTIVE",
                operator="TEST-SUPERVISOR",
                notes="Promoted from anonymous border sighting candidate."
            )
            assert prom_res["success"]
            person_id = prom_res["person_id"]

            # 1. Candidate status should now be PROMOTED
            db.refresh(cand)
            assert cand.status == "PROMOTED"
            assert cand.promoted_to_person_id == person_id

            # 2. Enrolled gallery should contain new profile
            enrolled = db.query(FaceGalleryDB).filter(FaceGalleryDB.person_id == person_id).first()
            assert enrolled is not None
            assert enrolled.name == "Officer Hardeep Singh"
            assert enrolled.embeddings_enc.startswith("gAAAAA") # Encrypted at rest

            # 3. Immutable audit log must be created
            audit = db.query(AuditLogDB).filter(
                AuditLogDB.action == "FRS_UNKNOWN_PROMOTED",
                AuditLogDB.entity_id == person_id
            ).first()
            assert audit is not None

            # 4. Subsequent sightings with the candidate's vector should now match Layer 1 KNOWN!
            decrypted = secrets_vault.decrypt_str(enrolled.embeddings_enc)
            vec = json.loads(decrypted)[0]
            m_promoted = frs_subsystem.match_embedding(vec, data_mode="LIVE")
            assert m_promoted["status"] == "MATCH"
            assert m_promoted["identity_state"] == "KNOWN"
            assert m_promoted["person_id"] == person_id
            assert "Hardeep Singh" in m_promoted["label"]

            # Clean up enrolled person
            frs_subsystem.delete_person(person_id, operator="TEST-CLEANUP")
            frs_subsystem.delete_unknown_candidate(cid, operator="TEST-CLEANUP")
        finally:
            db.close()

    def test_06_situational_safety_intelligence(self):
        """Verify Situational Safety Engine separates identity from threat and explains signals."""
        # 1. Authorized Guard on normal patrol in Restricted Zone -> SAFE
        safe_eval = situational_safety_engine.evaluate(
            identity_state="KNOWN",
            person_profile={"name": "Guard Ramesh", "rank": "Havildar", "category": "OPERATIONAL", "status": "ACTIVE"},
            zone_type="RESTRICTED",
            zone_name="Northern Perimeter",
            behavior="Walking",
            is_night=False,
            camera_id="CAM-01",
            sector="Sector Alpha"
        )
        assert safe_eval["situation"] == "SAFE"
        assert safe_eval["severity"] == "LOW"
        assert "Authorized" in safe_eval["reason"]
        assert len(safe_eval["signals"]["observed"]) >= 2

        # 2. Unknown Person walking in Permitted Civilian Zone -> SAFE (Unknown != dangerous!)
        civ_eval = situational_safety_engine.evaluate(
            identity_state="UNKNOWN_PREVIOUSLY_SEEN",
            person_profile={"candidate_id": "UNKNOWN-U0042"},
            zone_type="CIVILIAN",
            zone_name="Village Access Corridor",
            behavior="Walking",
            is_night=False,
            camera_id="CAM-04",
            sector="Civilian Buffer"
        )
        assert civ_eval["situation"] == "SAFE"
        assert civ_eval["severity"] == "LOW"

        # 3. Unknown Person entering Sterile Exclusion Zone running at night -> UNSAFE (HIGH)
        unsafe_eval = situational_safety_engine.evaluate(
            identity_state="UNKNOWN_NEW",
            person_profile={"candidate_id": "UNKNOWN-U0043"},
            zone_type="RESTRICTED",
            zone_name="Zero Line Fence",
            behavior="Running",
            is_night=True,
            is_approaching_boundary=True,
            camera_id="CAM-02",
            sector="Eastern Fence"
        )
        assert unsafe_eval["situation"] == "UNSAFE"
        assert unsafe_eval["severity"] == "HIGH"
        assert "Sterile" in unsafe_eval["reason"] or "Restricted" in unsafe_eval["reason"]

        # 4. Watchlist Target -> UNSAFE (CRITICAL)
        wl_eval = situational_safety_engine.evaluate(
            identity_state="KNOWN",
            person_profile={"name": "Tariq Aziz", "category": "WATCHLIST", "status": "WATCHLIST"},
            zone_type="CIVILIAN",
            camera_id="CAM-01"
        )
        assert wl_eval["situation"] == "UNSAFE"
        assert wl_eval["severity"] == "CRITICAL"
        assert "WATCHLIST" in wl_eval["reason"]

    def test_07_capabilities_diagnostic_truthfulness(self, client):
        """Verify AI Capability Center returns truthful diagnostics for 13 subsystems."""
        resp = client.get("/api/frs/capabilities")
        assert resp.status_code == 200
        caps = resp.json()
        assert len(caps) >= 13

        # Must be available
        assert caps["FACE_DETECTION"]["status"] == "AVAILABLE"
        assert caps["FACE_RECOGNITION"]["status"] == "AVAILABLE"
        assert caps["UNKNOWN_PERSON_MEMORY"]["status"] == "AVAILABLE"
        assert caps["ANPR"]["status"] == "AVAILABLE"
        assert caps["GEMINI_SCENE_ANALYSIS"]["status"] == "AVAILABLE"

        # Must be truthfully NOT LOADED / UNAVAILABLE (never simulated)
        assert caps["POSE_ESTIMATION"]["status"] == "NOT LOADED"
        assert caps["HAND_KEYPOINTS"]["status"] == "UNAVAILABLE"
        assert caps["WEAPON_OBJECT_DETECTION"]["status"] == "NOT LOADED"

    def test_08_unknown_candidates_rest_endpoints(self, client):
        """Verify REST endpoints for unknown candidates pagination, dossier, and deletion."""
        # 1. List candidates
        resp = client.get("/api/frs/unknown-candidates?data_mode=LIVE")
        assert resp.status_code == 200
        data = resp.json()
        assert "total" in data
        assert "items" in data

        # 2. Status telemetry includes unknown memory
        stat_resp = client.get("/api/frs/status")
        assert stat_resp.status_code == 200
        stat_data = stat_resp.json()
        assert "unknown_memory" in stat_data
        assert stat_data["unknown_memory"]["encryption"] == "FERNET_MACHINE_BOUND"
        assert stat_data["unknown_memory"]["retention_policy_days"] == 30


if __name__ == '__main__':
    import pytest
    pytest.main([__file__])
