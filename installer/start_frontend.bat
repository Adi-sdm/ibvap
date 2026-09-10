@echo off
title IBVAP - Frontend Dashboard
cd /d "%~dp0\..\frontend"
set "PATH=C:\Program Files\nodejs;%PATH%"
echo Starting IBVAP React Operator Dashboard...
npm run dev -- --host 0.0.0.0
pause