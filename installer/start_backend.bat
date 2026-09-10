@echo off
title IBVAP - Backend & AI Engine
cd /d "%~dp0\.."
echo Starting IBVAP Backend and AI Engine...
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
)
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
pause