@echo off
title IBVAP - System Launcher
echo ================================================================
echo Starting IBVAP (Intelligent Border Video Analytics Platform)
echo SIH 2026 - Problem Statement SIH26187
echo ================================================================
cd /d "%~dp0\.."

start "IBVAP Backend & AI" cmd /k "installer\start_backend.bat"
timeout /t 3 /nobreak >nul
start "IBVAP Frontend Dashboard" cmd /k "installer\start_frontend.bat"
timeout /t 2 /nobreak >nul

echo Opening browser at http://localhost:3000...
start http://localhost:3000
echo System online!