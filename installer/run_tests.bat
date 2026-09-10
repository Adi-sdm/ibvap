@echo off
title IBVAP - Verification Test Runner
cd /d "%~dp0\.."
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
)
echo Running All IBVAP Automated Tests...
python tests\test_all_scenarios.py
pause