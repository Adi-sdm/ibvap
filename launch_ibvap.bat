@echo off
title IBVAP - Intelligent Border Video Analytics Platform (SIH26187)
cd /d "%~dp0"

echo ===================================================================
echo   IBVAP ENTERPRISE LAUNCHER
echo   Problem Statement SIH26187
echo ===================================================================

echo.
echo [1/3] Running Pre-Flight System Diagnostics...
.venv\Scripts\python.exe packaging\diagnostics.py
if errorlevel 1 (
    echo Diagnostics detected issues. Continuing with best effort...
)

echo.
echo [2/3] Starting Backend Server (Uvicorn on port 8000)...
start "IBVAP Backend Service" cmd /k ".venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000"

timeout /t 2 /nobreak >nul

echo.
echo [3/3] Starting Frontend Dashboard (Vite on port 5173)...
start "IBVAP Dashboard" cmd /k "cd frontend && npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo Opening browser to http://localhost:5173...
start http://localhost:5173

echo.
echo IBVAP is now running!
echo Backend:  http://localhost:8000/docs
echo Frontend: http://localhost:5173
echo.
echo Press any key to close this launcher console (services will remain running).
pause >nul
