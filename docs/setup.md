# IBVAP Setup & Installation Guide

## Prerequisites
- **Python**: 3.11 or 3.12 (64-bit)
- **Node.js**: v18+ or v20+ / v24+
- **OS**: Windows 10/11 or Ubuntu Linux 22.04/24.04

---

## Quick Start (Windows)

1. Clone or extract the repository:
   ```cmd
   cd ibvap
   ```

2. Run the automated launcher:
   ```cmd
   installer\run_all.bat
   ```
   This script will:
   - Start the FastAPI backend with AI inference worker at `http://127.0.0.1:8000`
   - Start the Vite React operator dashboard at `http://127.0.0.1:3000`
   - Automatically launch your default browser to the dashboard.

---

## Manual Step-by-Step Setup

### 1. Backend & AI Environment
```cmd
python -m venv .venv
.venv\Scripts\activate
pip install -r backend/requirements.txt
```

### 2. Frontend Environment
```cmd
cd frontend
npm install
npm run build
```

### 3. Run Automated Tests
```cmd
python tests/test_all_scenarios.py
```