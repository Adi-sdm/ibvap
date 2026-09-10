# IBVAP System Architecture

**Intelligent Border Video Analytics Platform (IBVAP)**
*Smart India Hackathon 2026 — Problem Statement SIH26187*

---

## 1. Core Philosophy
> **"Do not replace existing CCTV cameras. Add intelligence to them."**

IBVAP is a software-defined AI video surveillance platform designed to ingest legacy RTSP streams, IP cameras, and MP4 video recordings without requiring hardware modifications or cloud connectivity.

---

## 2. System Architecture Diagram

```
[ Existing Border Cameras ] (RTSP / MP4 / USB)
            │
            ▼
┌─────────────────────────────────────────────────────────┐
│              IBVAP Ingestion Engine                     │
│  (OpenCV VideoCapture — Unified I/O across all sources) │
└───────────────────────────┬─────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────┐
│ Environmental Sensor  │       │ Camera Health Monitor │
│ • Mean Luminance      │       │ • FPS Telemetry       │
│ • Contrast / Haze     │       │ • Freeze Detection    │
│ • Day/Night Detector  │       │ • Disconnect Watchdog │
└───────────┬───────────┘       └───────────┬───────────┘
            │                               │
            ▼                               │
┌───────────────────────────────────────┐   │
│ YOLO Object Detector (v8n / 11n)      │   │
│ • Person, Vehicle, Bicycle, Truck     │   │
└───────────────────┬───────────────────┘   │
                    │                       │
                    ▼                       │
┌───────────────────────────────────────┐   │
│ ByteTrack Motion Tracker              │   │
│ • Persistent Multi-Frame IDs          │   │
│ • Ground Contact Foot-Point Mapping   │   │
└───────────────────┬───────────────────┘   │
                    │                       │
                    ▼                       │
┌───────────────────────────────────────┐   │
│ Virtual Zone Engine                   │   │
│ • Ray-Casting Point-in-Polygon        │   │
│ • Direction-Aware Boundary Crossing   │   │
│ • Loitering Duration Escalation       │   │
└───────────────────┬───────────────────┘   │
                    │                       │
                    ▼                       │
┌───────────────────────────────────────┐   │
│ Offline ANPR Engine                   │   │
│ • Vehicle Localization & Crop         │   │
│ • OpenCV CLAHE / Bilateral Filter     │   │
│ • Offline OCR with Confidence Flag    │   │
└───────────────────┬───────────────────┘   │
                    │                       │
                    ▼                       │
┌───────────────────────────────────────┐   │
│ Explainable Risk Engine (0-100)       │   │
│ • Additive Heuristics Rule Audit      │   │
│ • Multi-Signal Spatio-Temporal Fusion │   │
└───────────────────┬───────────────────┘   │
                    │                       │
                    ▼                       │
┌───────────────────────────────────────┐   │
│ Evidence Vault                        │   │
│ • Auto JPEG Snapshot + 5s MP4 Clip    │   │
│ • Metadata.json + SHA-256 Checksum    │   │
└───────────────────┬───────────────────┘   │
                    │                       │
                    ▼                       ▼
┌─────────────────────────────────────────────────────────┐
│ FastAPI Backend & Real-Time WebSocket Hub               │
│ • SQLite Database (`ibvap.db`)                          │
│ • REST Endpoints (`/api/cameras`, `/api/events`, etc.)  │
│ • Live MJPEG Video Stream (`/api/cameras/{id}/stream`)  │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│ Tactical React Operator Command Center                  │
│ • Overview • Live Monitoring • Incidents • Virtual Zones│
│ • ANPR Feed • Camera Health • Analytics • Replay Modal  │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Four Core Questions Answered in Every Alert

1. **What is happening?**
   Target identity, persistent track ID, and action (e.g. `INTRUSION_ENTRY`, `LOITERING`, `VEHICLE_APPROACH`).
2. **Where is it happening?**
   Exact camera ID, physical sector location, and operator-defined virtual zone name.
3. **How serious is it?**
   Explainable 0–100 risk score and severity tier (`Critical`, `High`, `Medium`, `Info`). Every point maps directly to a transparent heuristic rule.
4. **What should the operator do?**
   Clear, standard operating procedures (SOP), e.g. *"Dispatch Quick Reaction Force (QRF) to Sector 4 outer fence"*.

---

## 4. Cryptographic Evidence Chain-of-Custody

For any incident reaching `High` or `Critical` severity:
1. High-resolution raw frame snapshot saved to disk.
2. Short video clip (buffer of preceding and subsequent frames) encoded and saved.
3. Metadata JSON file written containing timestamp, camera, track info, and rules fired.
4. Cryptographic **SHA-256 hash** computed on the stored files and recorded in SQLite.
5. Operator dashboard displays the verified hash with one-click verification for legal evidence submission.