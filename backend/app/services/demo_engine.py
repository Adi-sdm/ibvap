"""
IBVAP Isolated Simulation & Demo Engine
SIH26187 - Intelligent Border Video Analytics Platform

Provides a self-contained, reproducible, multi-camera surveillance simulation.
Enforces strict isolation from live operational data (data_mode="DEMO", is_demo=True).
Simulates realistic vehicle journeys, ANPR reads, cross-camera handoffs, and operational anomalies.
"""

import time
import math
import random
import threading
import json
import uuid
import cv2
import numpy as np
from pathlib import Path
from typing import Dict, Any, Optional, List

PROJECT_ROOT = Path(__file__).resolve().parents[3]

# Explicit 4-camera synthetic fleet with GIS coordinates & FOV coverage
SIMULATED_FLEET = [
    {
        "camera_id": "SIM-CAM-01",
        "name": "Northern Gate Checkpoint",
        "latitude": 26.9124,
        "longitude": 70.9022,
        "viewing_angle": 45.0,
        "fov": 70.0,
        "sector": "Sector North",
        "profile": "Checkpoint ANPR & Perimeter",
        "corridor_index": 0
    },
    {
        "camera_id": "SIM-CAM-02",
        "name": "Perimeter Route Alpha",
        "latitude": 26.9150,
        "longitude": 70.9060,
        "viewing_angle": 65.0,
        "fov": 65.0,
        "sector": "Sector East",
        "profile": "Border Fence Monitoring",
        "corridor_index": 1
    },
    {
        "camera_id": "SIM-CAM-03",
        "name": "Border Sentry Post 3",
        "latitude": 26.9185,
        "longitude": 70.9095,
        "viewing_angle": 80.0,
        "fov": 75.0,
        "sector": "Sector Central",
        "profile": "Border Fence Monitoring",
        "corridor_index": 2
    },
    {
        "camera_id": "SIM-CAM-04",
        "name": "Restricted Depot Buffer",
        "latitude": 26.9220,
        "longitude": 70.9130,
        "viewing_angle": 110.0,
        "fov": 80.0,
        "sector": "Sector Depot",
        "profile": "Restricted Zone Sentry",
        "corridor_index": 3
    }
]

class DemoEngine:
    def __init__(self):
        self.state = "STOPPED"  # STOPPED, RUNNING, PAUSED
        self.scenario_type = "NORMAL"  # NORMAL, ROUTE_DEVIATION, UNEXPECTED_TURN, CAMERA_FAILURE, MULTI_VEHICLE
        self.seed = 42
        self.speed = 1.0
        self.current_step = 0
        self.total_steps = 120  # 120 ticks @ ~1s per tick at 1x
        self.lock = threading.Lock()
        self.worker_thread = None
        self.stop_requested = False
        self.rng = random.Random(42)

        # Simulation state
        self.vehicles = []
        self.camera_states = {}  # camera_id -> {"status": "ONLINE", "frame": ndarray}
        self.active_tracks = {}
        self.scenario_meta = {}
        self.history = []

    def start(self, scenario_type: str = "NORMAL", seed: int = 42, speed: float = 1.0) -> Dict[str, Any]:
        with self.lock:
            if self.state == "RUNNING":
                self.stop_internal()

            self.scenario_type = scenario_type.upper()
            self.seed = seed
            self.speed = max(0.5, min(float(speed), 10.0))
            self.rng = random.Random(seed)
            self.current_step = 0
            self.stop_requested = False
            self.state = "RUNNING"
            self.history = []

            # Provision vehicles according to scenario
            self._init_scenario_vehicles()
            # Register synthetic cameras in database with is_demo=True
            self._provision_demo_cameras()

            self.worker_thread = threading.Thread(target=self._run_loop, daemon=True)
            self.worker_thread.start()

            return self.get_status()

    def pause(self) -> Dict[str, Any]:
        with self.lock:
            if self.state == "RUNNING":
                self.state = "PAUSED"
            return self.get_status()

    def resume(self) -> Dict[str, Any]:
        with self.lock:
            if self.state == "PAUSED":
                self.state = "RUNNING"
            return self.get_status()

    def step(self) -> Dict[str, Any]:
        with self.lock:
            if self.state in ["PAUSED", "STOPPED"]:
                self.state = "PAUSED"
                self._execute_step()
            return self.get_status()

    def reset(self) -> Dict[str, Any]:
        self.stop()
        return self.get_status()

    def stop(self) -> Dict[str, Any]:
        with self.lock:
            self.stop_internal()
            return self.get_status()

    def stop_internal(self):
        self.stop_requested = True
        self.state = "STOPPED"
        self._teardown_demo_data()

    def set_speed(self, speed: float) -> Dict[str, Any]:
        with self.lock:
            self.speed = max(0.5, min(float(speed), 10.0))
            return self.get_status()

    def get_status(self) -> Dict[str, Any]:
        return {
            "state": self.state,
            "scenario_type": self.scenario_type,
            "seed": self.seed,
            "speed": self.speed,
            "current_step": self.current_step,
            "total_steps": self.total_steps,
            "progress_percent": round((self.current_step / max(1, self.total_steps)) * 100, 1),
            "vehicles": self.vehicles,
            "cameras": list(self.camera_states.keys()),
            "active_tracks_count": len(self.active_tracks),
            "scenario_meta": self.scenario_meta
        }

    def _init_scenario_vehicles(self):
        self.vehicles = []
        base_plates = ["DL 01 AB 1234", "RJ 14 XY 9876", "HR 26 DQ 5544", "UP 16 CZ 7711"]
        self.rng.shuffle(base_plates)

        if self.scenario_type == "NORMAL":
            self.vehicles.append({
                "vehicle_id": "SIM-VEH-01",
                "plate": base_plates[0],
                "color": "WHITE",
                "type": "SUV",
                "authorized": True,
                "current_camera_idx": 0,
                "progress_in_camera": 0.0,
                "route_status": "NORMAL",
                "journey": ["SIM-CAM-01", "SIM-CAM-02", "SIM-CAM-03", "SIM-CAM-04"],
                "speed_kmh": 42.0
            })
            self.scenario_meta = {
                "name": "Scheduled Logistics Convoy",
                "description": "Authorized white SUV traversing standard security corridor across all 4 sectors."
            }

        elif self.scenario_type == "ROUTE_DEVIATION":
            self.vehicles.append({
                "vehicle_id": "SIM-VEH-02",
                "plate": base_plates[0],
                "color": "BLACK",
                "type": "SEDAN",
                "authorized": False,
                "current_camera_idx": 0,
                "progress_in_camera": 0.0,
                "route_status": "DEVIATED",
                "deviation_step": 45,
                "journey": ["SIM-CAM-01", "SIM-CAM-02", "UNPATROLLED_BUFFER"],
                "speed_kmh": 58.0
            })
            self.scenario_meta = {
                "name": "Corridor Deviation Incursion",
                "description": "Unregistered black sedan enters Northern Checkpoint, then diverges into unpatrolled border scrub at Sector East."
            }

        elif self.scenario_type == "UNEXPECTED_TURN":
            self.vehicles.append({
                "vehicle_id": "SIM-VEH-03",
                "plate": base_plates[0],
                "color": "SILVER",
                "type": "PICKUP",
                "authorized": False,
                "current_camera_idx": 0,
                "progress_in_camera": 0.0,
                "route_status": "ABRUPT_TURN",
                "turn_step": 60,
                "journey": ["SIM-CAM-01", "SIM-CAM-02", "SIM-CAM-03"],
                "speed_kmh": 65.0
            })
            self.scenario_meta = {
                "name": "Abrupt Perimeter Wire Approach",
                "description": "Vehicle executes sudden 90-degree turn directly towards restricted border fence at Post 3."
            }

        elif self.scenario_type == "CAMERA_FAILURE":
            self.vehicles.append({
                "vehicle_id": "SIM-VEH-04",
                "plate": base_plates[0],
                "color": "DARK_BLUE",
                "type": "TRUCK",
                "authorized": True,
                "current_camera_idx": 0,
                "progress_in_camera": 0.0,
                "route_status": "NORMAL",
                "journey": ["SIM-CAM-01", "SIM-CAM-02", "SIM-CAM-03", "SIM-CAM-04"],
                "speed_kmh": 35.0
            })
            self.scenario_meta = {
                "name": "Optical Feed Sensor Dropout",
                "description": "SIM-CAM-02 suffers hardware connection dropout while tracking target vehicle."
            }

        elif self.scenario_type == "MULTI_VEHICLE":
            self.vehicles.append({
                "vehicle_id": "SIM-VEH-05",
                "plate": base_plates[0],
                "color": "WHITE",
                "type": "SUV",
                "authorized": True,
                "current_camera_idx": 0,
                "progress_in_camera": 0.0,
                "route_status": "NORMAL",
                "journey": ["SIM-CAM-01", "SIM-CAM-02", "SIM-CAM-03", "SIM-CAM-04"],
                "speed_kmh": 40.0
            })
            self.vehicles.append({
                "vehicle_id": "SIM-VEH-06",
                "plate": base_plates[1],
                "color": "RED",
                "type": "SEDAN",
                "authorized": False,
                "current_camera_idx": 3,
                "progress_in_camera": 0.0,
                "route_status": "REVERSE_CORRIDOR",
                "journey": ["SIM-CAM-04", "SIM-CAM-03", "SIM-CAM-02", "SIM-CAM-01"],
                "speed_kmh": 50.0
            })
            self.scenario_meta = {
                "name": "Multi-Target Bi-Directional Encounter",
                "description": "Simultaneous tracking of authorized vehicle moving northbound and unauthorized target moving southbound."
            }

    def _provision_demo_cameras(self):
        """Idempotently insert synthetic fleet cameras into database tagged is_demo=True."""
        try:
            from backend.app.database.session import SessionLocal
            from backend.app.database.models import CameraDB
            db = SessionLocal()
            try:
                for cam_info in SIMULATED_FLEET:
                    cid = cam_info["camera_id"]
                    existing = db.query(CameraDB).filter(CameraDB.camera_id == cid).first()
                    if not existing:
                        cam = CameraDB(
                            camera_id=cid,
                            name=cam_info["name"],
                            rtsp_url=f"synthetic://{cid.lower()}",
                            status="ONLINE",
                            profile=cam_info["profile"],
                            sector=cam_info["sector"],
                            latitude=cam_info["latitude"],
                            longitude=cam_info["longitude"],
                            direction=cam_info["viewing_angle"],
                            fov_degrees=cam_info["fov"],
                            is_demo=True
                        )
                        db.add(cam)
                    else:
                        existing.is_demo = True
                        existing.status = "ONLINE"
                        existing.latitude = cam_info["latitude"]
                        existing.longitude = cam_info["longitude"]
                        existing.direction = cam_info["viewing_angle"]
                        existing.fov_degrees = cam_info["fov"]
                db.commit()
            finally:
                db.close()
        except Exception as e:
            print(f"[DemoEngine] Error provisioning cameras: {e}")

    def _teardown_demo_data(self):
        """Cleans up all temporary records tagged is_demo=True, ensuring strict data isolation."""
        try:
            from backend.app.database.session import SessionLocal
            from backend.app.database.models import CameraDB, EventDB, ANPRDB, EvidenceDB
            db = SessionLocal()
            try:
                demo_cams = db.query(CameraDB).filter(CameraDB.is_demo == True).all()
                demo_cam_ids = [c.camera_id for c in demo_cams]
                
                # Delete demo events and evidence
                evs = db.query(EventDB).filter((EventDB.is_demo == True) | (EventDB.camera_id.in_(demo_cam_ids))).all()
                for ev in evs:
                    db.query(EvidenceDB).filter(EvidenceDB.event_id == ev.event_id).delete(synchronize_session=False)

                db.query(EventDB).filter((EventDB.is_demo == True) | (EventDB.camera_id.in_(demo_cam_ids))).delete(synchronize_session=False)
                db.query(ANPRDB).filter(ANPRDB.is_demo == True).delete(synchronize_session=False)
                db.query(CameraDB).filter(CameraDB.is_demo == True).delete(synchronize_session=False)
                db.commit()
            finally:
                db.close()
        except Exception as e:
            print(f"[DemoEngine] Error cleaning demo data: {e}")

    def _run_loop(self):
        while not self.stop_requested and self.current_step < self.total_steps:
            if self.state == "RUNNING":
                self._execute_step()
            sleep_duration = max(0.05, 1.0 / self.speed)
            time.sleep(sleep_duration)

        if self.current_step >= self.total_steps:
            with self.lock:
                self.state = "STOPPED"

    def _execute_step(self):
        self.current_step += 1
        step = self.current_step

        # Check for CAMERA_FAILURE condition
        if self.scenario_type == "CAMERA_FAILURE" and 30 <= step <= 65:
            self.camera_states["SIM-CAM-02"] = "OFFLINE"
        else:
            self.camera_states["SIM-CAM-02"] = "ONLINE"

        for veh in self.vehicles:
            total_cams = len(SIMULATED_FLEET)
            # Advance vehicle position through multi-camera sequence
            c_idx = int((step / self.total_steps) * total_cams)
            c_idx = min(c_idx, total_cams - 1)
            veh["current_camera_idx"] = c_idx
            active_cam_id = SIMULATED_FLEET[c_idx]["camera_id"]

            # Trigger ANPR read when entering a new camera
            if step % 25 == 1:
                self._record_demo_anpr(veh, active_cam_id)

            # Trigger situational alert if deviation or unexpected turn occurs
            if self.scenario_type == "ROUTE_DEVIATION" and step == 45:
                self._record_demo_event(
                    veh, 
                    active_cam_id, 
                    event_type="CORRIDOR_DEVIATION", 
                    severity="HIGH", 
                    risk=82,
                    summary=f"Vehicle {veh['plate']} departed registered logistics corridor towards unpatrolled desert buffer."
                )
            elif self.scenario_type == "UNEXPECTED_TURN" and step == 60:
                self._record_demo_event(
                    veh, 
                    active_cam_id, 
                    event_type="PERIMETER_WIRE_APPROACH", 
                    severity="CRITICAL", 
                    risk=94,
                    summary=f"Vehicle {veh['plate']} made abrupt 90-degree turn approaching restricted border perimeter fence."
                )

    def _record_demo_anpr(self, veh: dict, camera_id: str):
        try:
            from backend.app.database.session import SessionLocal
            from backend.app.database.models import ANPRDB
            db = SessionLocal()
            try:
                rec = ANPRDB(
                    plate=veh["plate"].replace(" ", ""),
                    confidence=round(self.rng.uniform(0.92, 0.98), 2),
                    camera_id=camera_id,
                    timestamp=time.time(),
                    vehicle_type=veh.get("type", "car").lower(),
                    is_demo=True,
                    data_mode="DEMO"
                )
                db.add(rec)
                db.commit()
            finally:
                db.close()
        except Exception as e:
            print(f"[DemoEngine] ANPR error: {e}")

    def _record_demo_event(self, veh: dict, camera_id: str, event_type: str, severity: str, risk: int, summary: str):
        try:
            from backend.app.database.session import SessionLocal
            from backend.app.database.models import EventDB, EvidenceDB
            db = SessionLocal()
            try:
                ev_id = f"demo-ev-{uuid.uuid4().hex[:10]}"
                ev = EventDB(
                    event_id=ev_id,
                    camera_id=camera_id,
                    timestamp=time.time(),
                    event_type=event_type,
                    severity=severity,
                    class_name="vehicle",
                    risk_score=risk,
                    behaviour="Direction Reversal / Route Deviation",
                    ai_summary=summary,
                    status="NEW",
                    is_demo=True,
                    data_mode="DEMO"
                )
                db.add(ev)
                
                # Synthetic snapshot evidence
                evidence = EvidenceDB(
                    evidence_id=f"demo-evi-{uuid.uuid4().hex[:10]}",
                    event_id=ev_id,
                    camera_id=camera_id,
                    timestamp=time.time(),
                    evidence_type="KEYFRAME",
                    state="SEALED",
                    data_mode="DEMO"
                )
                db.add(evidence)
                db.commit()

                # Broadcast via WebSocket
                from backend.app.main import pipeline_event_callback
                pipeline_event_callback({
                    "type": "NEW_INCIDENT",
                    "event_id": ev_id,
                    "camera_id": camera_id,
                    "event_type": event_type,
                    "severity": severity,
                    "risk_score": risk,
                    "summary": summary,
                    "is_demo": True
                })
            finally:
                db.close()
        except Exception as e:
            print(f"[DemoEngine] Event error: {e}")

    def generate_ai_scenario(self, prompt: str) -> Dict[str, Any]:
        """Generates structured simulation parameters using AI / deterministic scenario template."""
        p_lower = prompt.lower()
        if "night" in p_lower or "dark" in p_lower:
            return {
                "scenario_name": "Night Reconnaissance Probe",
                "scenario_type": "ROUTE_DEVIATION",
                "description": "Low-light vehicle probing boundary wire under thermal / night-vision mode.",
                "vehicles": [{"plate": "RJ 19 BR 4410", "color": "BLACK", "type": "SUV", "authorized": False}],
                "camera_events": [{"camera_id": "SIM-CAM-03", "action": "ALERT", "at_step": 40}],
                "anomaly_description": "Target extinguishes headlights at Perimeter Sentry 3."
            }
        elif "convoy" in p_lower or "multi" in p_lower:
            return {
                "scenario_name": "Coordinated Multi-Target Breach",
                "scenario_type": "MULTI_VEHICLE",
                "description": "Two vehicles attempt synchronized entry through disparate border corridors.",
                "vehicles": [
                    {"plate": "PB 10 CQ 8822", "color": "RED", "type": "SEDAN", "authorized": False},
                    {"plate": "DL 04 EF 3391", "color": "WHITE", "type": "TRUCK", "authorized": True}
                ],
                "camera_events": [{"camera_id": "SIM-CAM-02", "action": "CROSSING", "at_step": 50}],
                "anomaly_description": "Secondary vehicle cuts across restricted buffer."
            }
        else:
            return {
                "scenario_name": "Intelligent Perimeter Patrol",
                "scenario_type": "NORMAL",
                "description": "Standard border surveillance verification sweep across sectors North through Depot.",
                "vehicles": [{"plate": "DL 01 AB 1234", "color": "WHITE", "type": "SUV", "authorized": True}],
                "camera_events": [{"camera_id": "SIM-CAM-01", "action": "NORMAL", "at_step": 10}],
                "anomaly_description": "Normal patrol corridor adherence."
            }

demo_engine = DemoEngine()
