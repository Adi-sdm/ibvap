# IBVAP System Architecture & Technical Specifications

**Intelligent Border Video Analytics Platform (IBVAP)**  
*Smart India Hackathon 2026 — Problem Statement SIH26187*

---

## 1. Core Engineering Philosophy
> **"Do not replace existing CCTV infrastructure — augment it with explainable, hybrid edge intelligence."**

IBVAP is a software-defined AI video surveillance platform engineered for air-gapped border outposts, checkpoints, and military perimeters. It transforms standard analog/IP RTSP video feeds, recorded surveillance archives, and USB cameras into an autonomous threat detection network without requiring specialized edge AI hardware modifications or continuous cloud connectivity.

---

## 2. Multi-Stage Pipeline Architecture

```
[ Existing Border Cameras ] (RTSP IP Stream / MP4 Recording / USB Webcam)
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    IBVAP INGESTION ENGINE                       │
│ • OpenCV VideoCapture Hardware Multiplexer                      │
│ • Isolated YOLOv8 Detector Instance per Camera Stream           │
│ • Consecutive Failure Counter & Exponential Reconnect Backoff   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
┌───────────────────────────────┐       ┌───────────────────────────────┐
│     ENVIRONMENTAL SENSING     │       │    CAMERA HEALTH WATCHDOG     │
│ • Photometric Lux Sensor      │       │ • FPS Telemetry Counter       │
│ • Day/Night Illumination Lux  │       │ • Video Freeze Detector       │
│ • Lens Shutter Occlusion HUD  │       │ • Disconnect Recovery Loop    │
└───────────────┬───────────────┘       └───────────────┬───────────────┘
                │                                       │
                └───────────────────┬───────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│               YOLOv8 OBJECT LOCALIZATION & TRACKING             │
│ • Edge Model: YOLOv8n (nano PyTorch / ONNX checkpoint)          │
│ • ByteTrack Algorithm: Persistent Multi-Frame track_id Locking  │
│ • Ground Contact Foot-Point Mapping: (x_center, y_max)          │
│ • Historical Motion Breadcrumb Trajectories                     │
└───────────────────────────────────┬─────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                  SPATIAL VIRTUAL ZONE ENGINE                    │
│ • Ray-Casting Point-in-Polygon Geofence Calculation             │
│ • Directional Crossing State Machine (ENTRY vs EXIT)            │
│ • Loitering Escalation (Time-in-Zone Duration Accumulator)       │
└───────────────────────────────────┬─────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│               OFFLINE ANPR & VEHICLE INTELLIGENCE               │
│ • Vehicle Localization, Bounding Box Crop & Upscaling           │
│ • OpenCV Contrast Enhancement: CLAHE + Bilateral Filter         │
│ • Offline Optical Character Recognition (OCR)                   │
│ • AuthorizedVehicleDB Verification: Registered vs Observed Plate│
│ • Attribute Mismatch Alert: Color / Body Discrepancy Detection  │
│ • Watchlist & Stolen Vehicle Intercept Flags                    │
│ • Cross-Camera Predictive Handoff Routing                       │
└───────────────────────────────────┬─────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│             EXPLAINABLE ADDITIVE RISK ENGINE (0–100)            │
│ • Additive Heuristic Rule Auditor: Transparent Rule Traceability│
│ • Multi-Signal Spatio-Temporal Event Fusion                     │
│ • Severity Classification: Info (0–39), Med (40–59),            │
│   High (60–79), Critical (80–100)                               │
└───────────────────────────────────┬─────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌───────────────────────────────────────┐   ┌───────────────────────────────────────┐
│     CRYPTOGRAPHIC EVIDENCE VAULT      │   │      DUAL AI MULTIMODAL ADVISORY      │
│ • Auto High-Res JPEG Frame Snapshot   │   │ • Google Gemini Vision Integration    │
│ • 5-Second Rolling MP4 Video Clip     │   │ • Asynchronous Advisory Verification  │
│ • Metadata JSON with Audit Trace      │   │ • SecretsVault Local Storage          │
│ • Cryptographic SHA-256 Hashing       │   │ • Rate Quota & Offline Fallback       │
└───────────────────┬───────────────────┘   └───────────────────┬───────────────────┘
                    │                                           │
                    └───────────────────┬───────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              FASTAPI BACKEND & WEBSOCKET ENGINE                 │
│ • SQLAlchemy ORM with SQLite Persistence (`ibvap.db`)           │
│ • Safe Automatic Database Schema Migrations                     │
│ • Tamper-Evident Audit Logging (`AuditLogDB`)                   │
│ • Low-Latency MJPEG Video Stream Server                         │
└───────────────────────────────────┬─────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│             TACTICAL OPERATOR COMMAND CENTER (React 18)         │
│ • Glass Command Design System with Dark-Mode Contrast           │
│ • Leaflet Tactical GIS Map with FOV Cones & Heading Vectors     │
│ • Live Multi-Grid & Single-View Streaming                       │
│ • Vehicle Intelligence Registry & Watchlist Analytics           │
│ • Privileged Command Modal with Supervisor Passcode Auth        │
│ • Interactive Virtual Zone Polygon Editor                       │
│ • Forensic Incident Replay & Evidence Dossier Downloads         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Algorithmic Specifications

### 3.1 Point-in-Polygon Geofencing (Jordan Curve Theorem)
Virtual zones are defined by $N$ normalized coordinates $(x_i, y_i) \in [0.0, 1.0]$. The test point $P(x, y)$ is selected as the target's ground-contact foot point:
$$P = \left( rac{x_{\min} + x_{\max}}{2}, \; y_{\max} ight)$$
A horizontal test ray is cast from $P$ to $+\infty$. If the ray intersects an odd number of polygon segments, $P$ is inside the zone:
$$	ext{Inside} = \left( \sum_{i=1}^{N} 	ext{intersects}(P, \; V_i, \; V_{i+1}) ight) \pmod 2 \equiv 1$$

### 3.2 Directional Transition State Machine
Let $S_t \in \{	ext{OUTSIDE}, 	ext{INSIDE}\}$ be the tracking state of target $k$ at time $t$:
- $S_{t-1} = 	ext{OUTSIDE} \land S_t = 	ext{INSIDE} \implies 	ext{INTRUSION\_ENTRY}$
- $S_{t-1} = 	ext{INSIDE} \land S_t = 	ext{OUTSIDE} \implies 	ext{ZONE\_EXIT}$
- $S_{t-1} = 	ext{INSIDE} \land S_t = 	ext{INSIDE} \land (t - t_{	ext{entry}} \ge T_{	ext{threshold}}) \implies 	ext{LOITERING}$

### 3.3 Additive Heuristic Risk Accumulator
Risk score $R \in [0, 100]$ accumulates additively through explainable rules:
$$R = \min\left(100, \; R_{	ext{base}} + \sum_{j} \Delta R_jight)$$
Every $\Delta R_j$ is appended to an audited `explainability` list displayed to the operator (e.g. `Target in Restricted Zone (+35)`, `Nocturnal movement (+15)`).

### 3.4 Vehicle Attribute Mismatch Engine
When a plate is recognized via OCR, the system queries `AuthorizedVehicleDB`:
- If plate does not exist: $	ext{UNREGISTERED}$ alert.
- If plate is in watchlist: $	ext{WATCHLIST}$ critical alert ($R \ge 90$).
- If plate is registered with authorized color $C_{	ext{auth}}$, but detected visual color $C_{	ext{detected}} 
eq C_{	ext{auth}}$:
  $$	ext{Alert} = 	ext{ATTRIBUTE\_MISMATCH} \quad (R \ge 80)$$

---

## 4. Cryptographic Evidence Chain-of-Custody

For forensic integrity:
1. Snapshot JPEG and 5-second MP4 video clip are written to the `database/evidence/` vault.
2. Binary data is hashed using **SHA-256**:
   $$H = 	ext{SHA256}(	ext{bytes})$$
3. Hash $H$, timestamp, camera ID, track ID, and rules are sealed into `EvidenceDB` and `AuditLogDB`.
4. Operators can re-verify the hash with one click or export the incident as an official evidence dossier.
