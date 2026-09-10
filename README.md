# IBVAP - Intelligent Border Video Analytics Platform

[![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.12-blue?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Styles-Tailwind%20CSS-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![OpenCV](https://img.shields.io/badge/Computer%20Vision-OpenCV-5C3EE8?logo=opencv&logoColor=white)](https://opencv.org/)
[![YOLOv8](https://img.shields.io/badge/AI%20Inference-YOLOv8n-00FFFF)](https://github.com/ultralytics/ultralytics)
[![Docker](https://img.shields.io/badge/Deployment-Docker%20%26%20Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Hackathon](https://img.shields.io/badge/Smart%20India%20Hackathon-2026%20(SIH26187)-orange)](#)

> **"Do not replace existing CCTV infrastructure -- augment it with explainable, offline edge intelligence."**

IBVAP is a software-defined, 100% air-gapped Edge AI surveillance platform engineered for border defense, perimeter security, and checkpoint monitoring. It turns standard RTSP/IP cameras into an automated perimeter security system capable of persistent tracking, directional intrusion detection, explainable risk scoring, and cryptographic evidence verification -- with zero cloud dependency.

---

## System Architecture

```
[ Existing Border Cameras ] (RTSP IP Stream / MP4 Recording / USB Webcam)
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                  IBVAP Ingestion Engine                     │
│    (OpenCV VideoCapture — Unified I/O across all sources)   │
└─────────────────────────────┬───────────────────────────────┘
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
  │ YOLOv8 Object Detector                │   │
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
  │ • Directional Crossing (Entry/Exit)   │   │
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
  │ Cryptographic Evidence Vault          │   │
  │ • Auto JPEG Snapshot + 5s MP4 Clip    │   │
  │ • SHA-256 Tamper-Proof Checksum       │   │
  └───────────────────┬───────────────────┘   │
                      │                       │
                      ▼                       ▼
┌─────────────────────────────────────────────────────────────┐
│          FastAPI Backend & Real-Time WebSocket Hub          │
│ • SQLite Database (`ibvap.db`)                              │
│ • REST Endpoints (`/api/cameras`, `/api/events`, etc.)      │
│ • Low-Latency MJPEG Video Stream Multiplexer                │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│          Tactical Operator Command Center (React)           │
│ • Overview • Live Monitoring (2x2 Grid / Single View)       │
│ • Incident Replay • Virtual Zone Drawer • ANPR Feed         │
│ • Camera Health Telemetry • Threat Heatmap Analytics        │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Capabilities

- **Unified Ingestion Pipeline**: OpenCV `VideoCapture` pipeline treats RTSP streams, recorded MP4 surveillance footage, and USB webcams identically without special plugins.
- **Persistent Multi-Target Tracking**: Integrated ByteTrack algorithm maintains persistent `track_id` values across occlusions and motion blurs using ground-contact foot-point estimation.
- **Direction-Aware Virtual Zones**: Ray-casting point-in-polygon engine distinguishes outside-to-inside `INTRUSION_ENTRY`, inside-to-outside `ZONE_EXIT`, and stationary `LOITERING` duration.
- **Explainable 0-100 Risk Engine**: Additive heuristic model with a fully audited rule chain. Every alert explicitly shows why points were added (e.g., `Target in Restricted Zone (+35)`, `Low-light nocturnal movement (+15)`).
- **Multi-Signal Event Fusion**: Collapses rapid, fragmented detections of the same physical target into a single evolving incident record with a chronological timeline.
- **Cryptographic Evidence Vault**: Automatically captures high-resolution JPEG snapshots and 5-second MP4 video clips, hashing all artifacts with **SHA-256** checksums for tamper-proof legal verification.
- **Offline Automatic Number Plate Recognition (ANPR)**: Localizes vehicles, crops plate regions, enhances contrast via OpenCV CLAHE and bilateral filtering, and performs offline OCR with automatic human-in-the-loop flagging (`Verification Required`) for low-confidence reads.
- **Camera Health Watchdog**: Monitors FPS telemetry, latency, video freeze states, and RTSP stream drops, automatically attempting reconnection without system crashes.
- **Tactical Operator Dashboard**: Modern, high-contrast dark-mode interface built with React 18, Vite, and Tailwind CSS.
- **Zero Cloud AI Dependency**: 100% on-premises execution -- no cloud API dependencies, ensuring strict defense-grade data sovereignty.

---

## Quick Start (Windows)

### Option 1: One-Click Automated Launcher
Simply double-click or run:
```cmd
installer\run_all.bat
```
This launcher automatically:
1. Starts the FastAPI backend & AI engine on port `8000`.
2. Starts the Vite React dashboard on port `3000`.
3. Opens your default web browser to `http://localhost:3000`.

---

### Option 2: Manual Setup

#### 1. Backend & AI Environment
```cmd
# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate

# Install Python dependencies
pip install -r backend\requirements.txt
```

#### 2. Frontend Dashboard
```cmd
cd frontend
npm install
npm run build
```

#### 3. Run Backend & Frontend
In Terminal 1:
```cmd
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```
In Terminal 2:
```cmd
cd frontend
npm run dev -- --host 0.0.0.0
```
Open your browser at `http://localhost:3000`.

---

### Option 3: Docker Deployment

Deploy the platform in isolated containers:
```bash
cd docker
docker-compose up -d --build
```
The backend service will be exposed at `http://localhost:8000`.

---

## Verification & Compliance Testing

Run the end-to-end automated verification suite:
```cmd
python tests/test_all_scenarios.py
```
Or run the dedicated Windows test runner:
```cmd
installer\run_tests.bat
```

### Verified Test Suites:
| Test Suite | File | What It Validates |
| :--- | :--- | :--- |
| **Core Services** | `tests/test_core_services.py` | Additive risk scoring, explainability strings, spatio-temporal fusion, SHA-256 evidence hashing |
| **Virtual Zones** | `tests/test_zones.py` | Ray-casting point-in-polygon, directional crossing (entry/exit), loitering escalation |
| **Offline ANPR** | `tests/test_anpr.py` | Plate format validation (Indian license plate patterns) and confidence threshold flagging |
| **Backend REST API** | `tests/test_backend_api.py` | Camera CRUD, zone management, event pagination, and demo mode switching |
| **End-to-End Pipeline** | `tests/test_end_to_end.py` | Real video frame ingestion, YOLOv8 detection, zone crossing, and SQLite event persistence |

---

## Repository Structure

```
ibvap/
├── ai/                              # Core AI & Computer Vision Subsystem
│   ├── anpr/                        # Offline ANPR engine with CLAHE & OCR
│   ├── behaviour/                   # Camera health watchdog & Day/Night lux assessment
│   ├── detection/                   # Direct model inference & evaluation scripts
│   ├── inference/                   # YOLOv8 pipeline, ByteTrack tracker, small arms heuristics
│   └── zones/                       # Ray-casting point-in-polygon & directional crossing
├── backend/                         # FastAPI Backend & Business Logic
│   ├── app/
│   │   ├── api/                     # REST endpoints (cameras, zones, events, health, stream)
│   │   ├── database/                # SQLAlchemy models, SQLite engine & sessions
│   │   ├── models/                  # Pydantic request/response validation schemas
│   │   └── services/                # Risk engine, event fusion, evidence vault, audit logging
│   ├── requirements.txt             # Python backend dependencies
│   └── run_backend.py               # Backend CLI runner
├── database/                        # Database schemas & cryptographic evidence vault
│   └── evidence/                    # Auto-generated evidence snapshots, clips & metadata
├── demo/                            # Demonstration assets & synthetic video generator
│   ├── generate_demo_videos.py      # OpenCV procedural video generator for border scenarios
│   └── videos/                      # Intrusion, nighttime, patrol, and checkpoint test clips
├── docker/                          # Containerization configuration
│   ├── Dockerfile                   # Headless OpenCV & FFmpeg Python runtime
│   └── docker-compose.yml           # Multi-container service configuration
├── docs/                            # In-depth architectural & operational documentation
│   ├── architecture.md              # Detailed pipeline architecture & decision rationales
│   ├── deployment.md                # Edge hardware requirements & container runbooks
│   └── setup.md                     # Step-by-step developer installation guide
├── frontend/                        # Tactical React Operator Dashboard
│   ├── public/                      # Static branding assets
│   ├── src/
│   │   ├── components/              # Header, Navbar, Sidebar, ZoneDrawer, ReplayModal, RiskBadge
│   │   ├── pages/                   # CommandCenter, Cameras, Incidents, Analytics, Settings
│   │   └── services/                # Axios API client & WebSocket connections
│   ├── package.json                 # Node dependencies
│   └── vite.config.js               # Vite build configuration
├── installer/                       # Operational deployment scripts (Windows)
│   ├── run_all.bat                  # One-click launcher for backend + frontend
│   ├── run_tests.bat                # Automated verification runner
│   ├── start_backend.bat            # Standalone backend service launcher
│   ├── start_frontend.bat           # Standalone frontend service launcher
│   └── create_zip.py                # Clean distribution archiver
├── models/                          # Pre-trained edge AI model weights
│   └── yolov8n.pt                   # Lightweight YOLOv8 nano edge checkpoint
├── tests/                           # Unit, integration, and E2E verification tests
│   └── test_all_scenarios.py        # Master test runner
├── .gitattributes                   # LF normalization & binary asset definitions
├── .gitignore                       # Production ignore rules (caches, venvs, DBs, modules)
├── LICENSE                          # MIT License
└── README.md                        # Project documentation
```

---

## REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/system/mode` | Returns current operational mode (`live` or `demo`) |
| `GET` | `/api/system/stats` | Aggregate dashboard statistics (active cameras, incident counts) |
| `GET` | `/api/cameras` | List all configured surveillance cameras with health telemetry |
| `POST` | `/api/cameras` | Register a new camera (RTSP URL, USB index, or video path) |
| `DELETE` | `/api/cameras/{id}` | Remove a camera and associated zones |
| `GET` | `/api/cameras/{id}/stream` | Low-latency MJPEG live video stream |
| `GET` | `/api/zones` | List virtual zones (filterable by `camera_id`) |
| `POST` | `/api/zones` | Define a new virtual polygon zone (`RESTRICTED` or `WARNING`) |
| `DELETE` | `/api/zones/{id}` | Delete a virtual zone |
| `GET` | `/api/events` | Paginated incident log with explainable risk breakdown |
| `GET` | `/api/evidence/{id}` | Retrieve cryptographic evidence bundle (image, clip, SHA-256 hash) |
| `POST` | `/api/demo/start` | Start synthetic multi-camera simulation loop |
| `POST` | `/api/demo/stop` | Return to live stream processing |

---

## Edge Appliance Hardware Specifications

| Component | Minimum Specification | Recommended Specification |
| :--- | :--- | :--- |
| **CPU** | Intel Core i5 (8th Gen) / AMD Ryzen 5 | Intel Core i7 (11th Gen+) / AMD Ryzen 7 |
| **RAM** | 8 GB DDR4 | 16 GB DDR4 / DDR5 |
| **GPU** | CPU-only inference supported | NVIDIA GTX 1650 / RTX 3060 / Jetson Orin |
| **Storage** | 128 GB SSD | 512 GB NVMe SSD |
| **OS** | Windows 10/11 (64-bit) / Ubuntu 22.04 LTS | Windows 11 Pro / Ubuntu 24.04 LTS |

---

## License

This project is licensed under the **MIT License** -- see the [LICENSE](LICENSE) file for details.
