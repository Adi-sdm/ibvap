# IBVAP — Intelligent Border Video Analytics Platform

[![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.12-blue?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Leaflet](https://img.shields.io/badge/GIS-Leaflet%201.9-199900?logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Tailwind CSS](https://img.shields.io/badge/Styles-Tailwind%20CSS-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![OpenCV](https://img.shields.io/badge/Computer%20Vision-OpenCV-5C3EE8?logo=opencv&logoColor=white)](https://opencv.org/)
[![YOLOv8](https://img.shields.io/badge/Edge%20AI-YOLOv8n-00FFFF)](https://github.com/ultralytics/ultralytics)
[![Gemini](https://img.shields.io/badge/Advisory%20AI-Google%20Gemini%20Vision-8E75C2?logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![Docker](https://img.shields.io/badge/Deployment-Docker%20%26%20Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Hackathon](https://img.shields.io/badge/Smart%20India%20Hackathon-2026%20(SIH26187)-orange)](#)

> **"Do not replace existing CCTV infrastructure — augment it with explainable, hybrid edge intelligence."**

**IBVAP (Intelligent Border Video Analytics Platform)** is a software-defined, defense-grade Edge AI surveillance platform designed for national border security, critical infrastructure protection, and perimeter checkpoints. It converts standard RTSP/IP cameras into an automated, explainable perimeter monitoring system featuring **Dual AI Perception (100% Offline Edge YOLOv8 + Multimodal Gemini Advisory)**, **Vehicle Watchlist Intelligence**, **Tactical GIS Geospatial Mapping**, **Ray-Casting Geofences**, and **Cryptographic SHA-256 Evidence Auditing**.

---

## 🏛️ System Architecture

IBVAP operates on a **Dual AI Hybrid Tier Architecture**: an ultra-low-latency on-premises edge pipeline handles continuous real-time tracking and threat heuristics, coupled with an asynchronous secondary multimodal reasoning layer for human-in-the-loop advisory verification.

```
                  ┌─────────────────────────────────────────────────────────┐
                  │    SURVEILLANCE CAMERAS (RTSP / USB Webcams / MP4s)     │
                  └───────────────────────────┬─────────────────────────────┘
                                              │
                                              ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                          EDGE INGESTION & PIPELINE ENGINE                                 │
│  • OpenCV VideoCapture Hardware Multiplexer                                               │
│  • Isolated Detector Instances per Stream (Zero Cross-Camera ByteTrack Collision)         │
│  • Watchdog Telemetry: FPS Monitoring, Freeze Detection, Auto-Reconnect Backoff           │
└─────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                              │
         ┌────────────────────────────────────┼────────────────────────────────────┐
         ▼                                    ▼                                    ▼
┌─────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
│   EDGE YOLOv8 TRACKER   │      │  ENVIRONMENTAL SENSORS  │      │   OPENCV HUD OVERLAY    │
│ • ByteTrack ID Locking  │      │ • Photometric Lux Sensor│      │ • Motion Breadcrumbs    │
│ • Ground Contact Points │      │ • Day/Night Detector    │      │ • Foot Contact Anchors  │
│ • Small Arms Heuristics │      │ • Sensor Occlusion Check│      │ • Zero-Light Warning    │
└────────────┬────────────┘      └────────────┬────────────┘      └────────────┬────────────┘
             │                                │                                │
             └────────────────────────────────┼────────────────────────────────┘
                                              │
                                              ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                             SPATIAL & BEHAVIORAL ANALYTICS                                │
│ • Ray-Casting Virtual Zones: Directional Crossing (INTRUSION_ENTRY / EXIT / LOITERING)   │
│ • Vehicle Intelligence: ANPR OCR (CLAHE + Bilateral Filtering) + Hotlist Watchlist Engine │
│ • Cross-Camera Predictive Handoff: Inter-Sector Speed & Transit Route Estimation          │
│ • Additive Heuristic Risk Engine: Transparent, audited 0–100 threat score accumulation    │
└─────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
┌───────────────────────────────────────────┐   ┌───────────────────────────────────────────┐
│     CRYPTOGRAPHIC EVIDENCE VAULT          │   │      MULTIMODAL GEMINI ADVISORY           │
│ • Auto JPEG Snapshot + 5s MP4 Clip        │   │ • Asynchronous Secondary Verification     │
│ • SHA-256 Tamper-Proof Checksum Hashing   │   │ • SecretsVault API Key Protection         │
│ • Exportable Forensic Incident Dossiers   │   │ • Quota Rate Limiting & Offline Fallback  │
└─────────────────────┬─────────────────────┘   └─────────────────────┬─────────────────────┘
                      │                                               │
                      └───────────────────────┬───────────────────────┘
                                              │
                                              ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                          FASTAPI REAL-TIME APPLICATION HUB                                │
│ • SQLite Database (`ibvap.db`) with Automatic Safe Schema Migrations                      │
│ • Tamper-Evident Audit Logging (`AuditLogDB`) with Supervisor Justification Tracking      │
│ • Asynchronous WebSocket Broadcasting (`/ws`) & Low-Latency MJPEG Video Stream Server    │
└─────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                              │
                                              ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                      TACTICAL OPERATOR DASHBOARD (React 18 + Vite)                        │
│ • Glass Command Theme • Leaflet GIS Map with Camera FOV Cones & Heading Vectors           │
│ • Multi-Grid & Single-View Streams • Vehicle Intel Hub • Dual AI Comparison Cards        │
│ • Privileged Command Modal • Virtual Zone Polygon Drawer • Incident Replay Scrubber      │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Core Algorithms & Innovations

### 1. Dual AI Hybrid Perception
- **Primary Tier (Edge)**: Runs 100% on-premises using YOLOv8n and ByteTrack. Delivers zero-cloud, real-time perimeter defense at 20+ FPS on edge hardware.
- **Secondary Tier (Multimodal AI Advisory)**: Integrates Google Gemini Vision via `GeminiVisionProvider`. Performs secondary semantic validation of high-risk events, evaluating nuanced physical context without blocking real-time alerts.
- **Privacy & Secrets Protection**: The `SecretsVault` manages credentials securely using local restricted stores and environment overrides, never exposing plaintext keys via REST APIs.

### 2. Isolated Pipeline Architecture & Surveillance Profiles
- **Stream Isolation**: Each active camera pipeline runs an isolated YOLOv8 detector instance, preventing multi-stream ByteTrack track collisions and state contamination.
- **Surveillance Profiles**: Pre-configured operational presets dynamically adapt detection thresholds, target classes, and heuristic weights:
  - **Border Fence Monitoring**: Zero-tolerance perimeter barrier intrusion, wire-crossing, and climbing detection.
  - **Checkpoint Monitoring**: Personnel lane control, vehicle queue inspection, and automated plate recognition.
  - **Vehicle Inspection**: High-precision ANPR, undercarriage scanning, and vehicle attribute audits.
  - **Sensitive Sector**: High-sensitivity asset zone tracking with strict loitering escalations.
  - **Custom Profile**: User-defined sensitivity presets, alert thresholds (0–100), and module toggles.

### 3. Vehicle Intelligence & Watchlist Hotlist Engine
- **Automated Plate Verification**: Matches detected plates against `AuthorizedVehicleDB`.
- **Attribute Discrepancy Detection**: Compares observed physical vehicle attributes against registered records (e.g., detecting a red SUV displaying a plate registered to a white sedan triggers an instant `ATTRIBUTE_MISMATCH` critical alert).
- **Watchlist & Stolen Intercepts**: Flags high-priority hotlist targets with immediate automated supervisor alerts.
- **Cross-Camera Handoff Correlation**: Estimates transit velocity and predicts next probable camera sectors for fleeing targets.

### 4. Ray-Casting Virtual Zones & Directional Heuristics
- **Ray-Casting Point-in-Polygon**: Evaluates ground-contact foot points (`x_center, y_max`) relative to arbitrary multi-vertex polygons.
- **Directional State Machine**: Tracks state transitions between frames to distinguish outside-to-inside `INTRUSION_ENTRY`, inside-to-outside `ZONE_EXIT`, and stationary `LOITERING`.

### 5. Tactical OpenCV HUD Frame Annotator
- High-performance HUD overlay rendering bounding boxes, track IDs, speed estimations, confidence scores, and historical movement breadcrumbs.
- **Zero-Light Shutter Occlusion Warning**: Detects physical lens covers or closed privacy shutters (`mean_pixel < 3.0`), rendering a prominent warning badge: `HARDWARE ACTIVE - ZERO LIGHT DETECTED`.
- **Interactive HUD Controls**: Floating on-stream widget (`OverlayControls`) allowing operators to toggle labels, confidence, tracks, zones, and debug metrics dynamically.

### 6. Tactical GIS Geospatial Mapping
- Interactive Leaflet mapping engine (`GISMap`) displaying camera positions, sector lines, and live threat markers.
- Renders directional heading vectors (0–360°), field-of-view (FOV) sector cones, and effective detection range radii for complete situational awareness.

### 7. Supervisor Authorization & Privileged Controls
- `PrivilegedActionModal` gates critical operational actions (e.g., deleting cameras, clearing logs, toggling AI bypasses).
- Requires supervisor passcode authentication and mandatory operational justification, permanently recorded in the tamper-evident audit trail (`AuditLogDB`).

### 8. Cryptographic Evidence Chain-of-Custody
- High-risk incidents trigger automated capture of raw JPEG snapshots and 5-second MP4 video clips.
- Every artifact is cryptographically hashed with **SHA-256** checksums, bundled into downloadable Forensic Incident Dossiers for legal evidence integrity.

---

## 📋 Surveillance Operational Profiles

| Profile Preset | Target Classes | Key Modules Enabled | Default Threshold |
| :--- | :--- | :--- | :--- |
| **Border Fence Monitoring** | Person, Backpack, Handbag, Suitcase | Intrusion, Loitering, Direction, Day/Night | 60 / 100 |
| **Checkpoint Monitoring** | Person, Car, Motorcycle, Bus, Truck | Intrusion, Direction, ANPR, Watchlist | 50 / 100 |
| **Vehicle Inspection** | Car, Motorcycle, Bus, Truck | ANPR, Attribute Verification, Handoff | 45 / 100 |
| **Sensitive Sector** | Person, Vehicle, Drone, Animals | All Modules + High Sensitivity | 40 / 100 |
| **Custom** | Fully configurable | Operator-selected modules | 0–100 Slider |

---

## 🚀 Quick Start Guide

### Option 1: One-Click Automated Launcher (Windows)
```cmd
installer\run_all.bat
```
Starts backend, frontend, and opens `http://localhost:3000`.

---

### Option 2: Manual Setup

#### 1. Backend & AI Engine
```cmd
# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate

# Install dependencies
pip install -r backend\requirements.txt

# Launch FastAPI backend
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

#### 2. Tactical React Dashboard
```cmd
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```
Open your browser at `http://localhost:3000`.

---

### Option 3: Docker Container Deployment
```bash
cd docker
docker-compose up -d --build
```
Access backend API documentation at `http://localhost:8000/docs`.

---

## 🧪 Comprehensive Verification Suite

Run the master automated verification suite covering all 7 core subsystems:
```cmd
python tests/test_all_scenarios.py
```
Or run the dedicated Windows test runner:
```cmd
installer\run_tests.bat
```

### Verified Test Matrix:
| Test Suite | File | Subsystem Validated |
| :--- | :--- | :--- |
| **Core Services** | `tests/test_core_services.py` | Additive risk scoring, explainable rules, spatio-temporal event fusion, SHA-256 evidence hashing |
| **Virtual Zones** | `tests/test_zones.py` | Ray-casting point-in-polygon, boundary crossing (entry/exit), loitering escalation |
| **Offline ANPR** | `tests/test_anpr.py` | License plate regex validation and low-confidence human-in-the-loop flagging |
| **Backend REST API** | `tests/test_backend_api.py` | Camera CRUD, zone management, event pagination, and demo mode switching |
| **End-to-End Surveillance** | `tests/test_end_to_end.py` | Real video frame ingestion, YOLOv8 inference, zone crossing, and SQLite audit logging |
| **Enterprise Features** | `tests/test_enterprise_features.py` | Secrets vault masking, surveillance profiles catalog, HUD annotator, and system settings |
| **Vehicle Intelligence** | `tests/test_vehicle_intel.py` | Authorized vehicle verification, attribute mismatch alerts, watchlist hotlist, and handoff prediction |

### Browser UI Automated Tests (Puppeteer):
- `node frontend/test_settings_browser.mjs` — Automated browser test for platform settings.
- `node frontend/test_ai_analysis_browser.mjs` — Automated browser test for AI analysis & HUD controls.
- `node frontend/test_gis_browser.mjs` — Automated browser test for Leaflet GIS map initialization.

---

## 📂 Repository Structure

```
ibvap/
├── ai/                              # Core AI & Computer Vision Subsystem
│   ├── anpr/                        # Offline ANPR engine with CLAHE & OCR
│   ├── behaviour/                   # Camera health watchdog & Day/Night lux assessment
│   ├── detection/                   # Direct model inference & evaluation scripts
│   ├── inference/                   # YOLOv8 pipeline, ByteTrack tracker, HUD annotator
│   └── zones/                       # Ray-casting point-in-polygon & directional crossing
├── backend/                         # FastAPI Backend & Persistence Layer
│   ├── app/
│   │   ├── api/                     # REST endpoints (cameras, zones, events, GIS, AI, vehicles)
│   │   ├── database/                # SQLAlchemy ORM models, session & safe migrations
│   │   ├── models/                  # Pydantic validation schemas
│   │   └── services/                # Risk engine, event fusion, Gemini vision, vehicle intel
│   ├── requirements.txt             # Backend Python dependencies
│   └── run_backend.py               # Standalone backend CLI runner
├── database/                        # Database storage & cryptographic evidence vault
│   └── evidence/                    # Auto-generated evidence snapshots, clips & metadata
├── demo/                            # Synthetic border surveillance generator & test videos
│   ├── generate_demo_videos.py      # OpenCV procedural video generator for border scenarios
│   └── videos/                      # Intrusion, nighttime, patrol, and checkpoint test clips
├── docker/                          # Containerization configuration
│   ├── Dockerfile                   # Headless OpenCV & FFmpeg Python runtime
│   └── docker-compose.yml           # Multi-container orchestration configuration
├── docs/                            # Architectural specifications & deployment runbooks
│   ├── architecture.md              # In-depth architectural designs & pipeline specifications
│   ├── deployment.md                # Edge appliance hardware requirements & container guides
│   └── setup.md                     # Step-by-step developer setup instructions
├── frontend/                        # Tactical React Operator Command Center
│   ├── public/                      # Static assets & icons
│   ├── src/
│   │   ├── components/              # Header, Sidebar, ZoneDrawer, ReplayModal, GeminiCard, HUD
│   │   ├── pages/                   # CommandCenter, Cameras, GISMap, VehicleIntel, AIAnalysis, Settings
│   │   └── services/                # API client with error handling & WebSocket telemetry
│   ├── package.json                 # Node dependencies (React, Leaflet, Tailwind, Lucide)
│   └── vite.config.js               # Vite build config with /api, /evidence, and /ws reverse proxies
├── installer/                       # Operational deployment scripts (Windows)
│   ├── run_all.bat                  # One-click launcher for backend + frontend
│   ├── run_tests.bat                # Automated verification runner
│   ├── start_backend.bat            # Standalone backend launcher
│   ├── start_frontend.bat           # Standalone frontend launcher
│   └── create_zip.py                # Clean distribution packaging utility
├── models/                          # Pre-trained edge AI model weights
│   └── yolov8n.pt                   # Lightweight YOLOv8 nano edge checkpoint
├── tests/                           # Unit, integration, and E2E verification test suites
│   ├── test_all_scenarios.py        # Master test runner (7 suites)
│   ├── test_enterprise_features.py  # Secrets, profiles, annotator tests
│   └── test_vehicle_intel.py        # Vehicle verification & watchlist tests
├── .gitattributes                   # LF normalization & binary asset definitions
├── .gitignore                       # Production ignore rules (caches, venvs, DBs, modules)
├── LICENSE                          # MIT License
└── README.md                        # Project documentation
```

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/system/mode` | Returns current operational mode (`live` or `demo`) |
| `GET` | `/api/system/stats` | Aggregate dashboard statistics (active cameras, incident counts) |
| `GET` | `/api/cameras` | List all cameras with health telemetry, profile, and GIS coordinates |
| `POST` | `/api/cameras` | Register a new camera (RTSP URL, USB index, profile, coordinates) |
| `PATCH` | `/api/cameras/{id}/config` | Dynamic camera configuration (modules, sensitivity, HUD overlay) |
| `DELETE` | `/api/cameras/{id}` | Remove a camera and associated virtual zones |
| `GET` | `/api/cameras/{id}/stream` | Low-latency MJPEG live stream with dynamic HUD overlays |
| `GET` | `/api/zones` | List virtual zones (filterable by `camera_id`) |
| `POST` | `/api/zones` | Define a new virtual polygon zone (`RESTRICTED` or `WARNING`) |
| `DELETE` | `/api/zones/{id}` | Delete a virtual zone |
| `GET` | `/api/events` | Paginated incident log (supports `source=LIVE` vs `DEMO` filtering) |
| `POST` | `/api/events/{id}/consult-gemini` | Request asynchronous secondary Gemini multimodal advisory |
| `GET` | `/api/vehicles/authorized` | List authorized vehicles registry |
| `POST` | `/api/vehicles/authorized` | Register a new authorized vehicle |
| `POST` | `/api/vehicles/verify` | Real-time plate and attribute mismatch verification |
| `GET` | `/api/vehicles/handoff/{id}` | Cross-camera predictive route correlation |
| `GET` | `/api/profiles` | Catalog of surveillance operational profiles |
| `GET` | `/api/ai/gemini/status` | Gemini advisory provider status (masked API key display) |
| `POST` | `/api/ai/gemini/config` | Update Gemini API key securely via SecretsVault |
| `GET` | `/api/evidence/{id}/dossier` | Retrieve complete forensic incident dossier with SHA-256 hashes |
| `POST` | `/api/demo/start` | Launch synthetic multi-camera border simulation |
| `POST` | `/api/demo/stop` | Terminate demo and restore live stream processing |

---

## 🖥️ Edge Appliance Hardware Specifications

| Component | Minimum Specification | Recommended Specification |
| :--- | :--- | :--- |
| **CPU** | Intel Core i5 (8th Gen) / AMD Ryzen 5 | Intel Core i7 (11th Gen+) / AMD Ryzen 7 |
| **RAM** | 8 GB DDR4 | 16 GB DDR4 / DDR5 |
| **GPU** | CPU-only inference fully supported | NVIDIA GTX 1650 / RTX 3060 / Jetson Orin |
| **Storage** | 128 GB SSD | 512 GB NVMe SSD |
| **OS** | Windows 10/11 (64-bit) / Ubuntu 22.04 LTS | Windows 11 Pro / Ubuntu 24.04 LTS |

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
