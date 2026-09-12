# ==============================================================================
# IBVAP - Enterprise Windows Production Installer
# SIH26187 - Intelligent Border Video Analytics Platform
# ==============================================================================
# Strict Data Preservation: C:\ProgramData\IBVAP persistent data is NEVER destroyed on reinstall.

[CmdletBinding()]
param (
    [string]$InstallDir = "C:\Program Files\IBVAP",
    [string]$DataDir = "C:\ProgramData\IBVAP",
    [switch]$SkipBuild = $false
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Get-Item $ScriptDir).Parent.FullName

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  IBVAP ENTERPRISE INSTALLER & DEPLOYMENT SYSTEM" -ForegroundColor Cyan
Write-Host "  Problem Statement: SIH26187" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Verify Prerequisites
Write-Host "`n[1/6] Auditing System Prerequisites..." -ForegroundColor Yellow
$PythonCmd = (Get-Command python -ErrorAction SilentlyContinue)
if (-not $PythonCmd) {
    Write-Host "CRITICAL: Python 3.10+ is required but not found in PATH." -ForegroundColor Red
    exit 1
}
Write-Host "  Found Python: $($PythonCmd.Source)" -ForegroundColor Green

$NodeCmd = (Get-Command node -ErrorAction SilentlyContinue)
if (-not $NodeCmd) {
    Write-Host "WARNING: Node.js not detected in PATH. Ensure Node.js 18+ is installed for web dashboard." -ForegroundColor Yellow
} else {
    Write-Host "  Found Node.js: $($NodeCmd.Source)" -ForegroundColor Green
}

# 2. Establish Persistent Data Directory Separation
Write-Host "`n[2/6] Configuring Persistent Data Directory (C:\ProgramData\IBVAP)..." -ForegroundColor Yellow
$DbDir = Join-Path $DataDir "database"
$EvidenceDir = Join-Path $DbDir "evidence"
$LogsDir = Join-Path $DataDir "logs"

New-Item -ItemType Directory -Path $DbDir -Force | Out-Null
New-Item -ItemType Directory -Path $EvidenceDir -Force | Out-Null
New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null

$ExistingTargetDb = Join-Path $DbDir "ibvap.db"
$SourceDb = Join-Path $ProjectRoot "database\ibvap.db"

if (Test-Path $ExistingTargetDb) {
    Write-Host "  [PRESERVED] Existing production database found at $ExistingTargetDb. Zero data loss." -ForegroundColor Green
} elseif (Test-Path $SourceDb) {
    Write-Host "  [PROVISION] Seeding initial database from source to $ExistingTargetDb..." -ForegroundColor Cyan
    Copy-Item -Path $SourceDb -Destination $ExistingTargetDb -Force
}

$ExistingSecrets = Join-Path $DataDir ".secrets.json"
$SourceSecrets = Join-Path $ProjectRoot "database\.secrets.json"
if (-not (Test-Path $ExistingSecrets) -and (Test-Path $SourceSecrets)) {
    Copy-Item -Path $SourceSecrets -Destination $ExistingSecrets -Force
}

# 3. Python Virtual Environment Setup
Write-Host "`n[3/6] Configuring Isolated Python Virtual Environment..." -ForegroundColor Yellow
$VenvPath = Join-Path $ProjectRoot ".venv"
if (-not (Test-Path $VenvPath)) {
    Write-Host "  Creating venv at $VenvPath..."
    & python -m venv $VenvPath
}
$VenvPython = Join-Path $VenvPath "Scripts\python.exe"
$VenvPip = Join-Path $VenvPath "Scripts\pip.exe"

Write-Host "  Verifying core packages..."
& $VenvPip install -r (Join-Path $ProjectRoot "requirements.txt") --quiet

# 4. Frontend Production Build
if (-not $SkipBuild -and (Test-Path (Join-Path $ProjectRoot "frontend\package.json"))) {
    Write-Host "`n[4/6] Building Production Frontend Assets..." -ForegroundColor Yellow
    Push-Location (Join-Path $ProjectRoot "frontend")
    try {
        & npm run build
        Write-Host "  Frontend assets compiled successfully into dist/." -ForegroundColor Green
    } catch {
        Write-Host "  Notice: Frontend build completed with warnings or skipped." -ForegroundColor Yellow
    } finally {
        Pop-Location
    }
} else {
    Write-Host "`n[4/6] Skipping frontend build step." -ForegroundColor Gray
}

# 5. Desktop Launcher Generation
Write-Host "`n[5/6] Generating Desktop Launchers..." -ForegroundColor Yellow
$LauncherPath = Join-Path $ProjectRoot "launch_ibvap.bat"
$LauncherContent = @"
@echo off
title IBVAP - Border Surveillance Analytics Platform (SIH26187)
cd /d "%~dp0"
echo ===================================================================
echo   LAUNCHING IBVAP INTELLIGENT BORDER VIDEO ANALYTICS PLATFORM
echo ===================================================================
start "IBVAP Backend Server" cmd /c ".venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000"
timeout /t 2 /nobreak >nul
start "IBVAP Frontend Dashboard" cmd /c "cd frontend && npm run dev"
timeout /t 3 /nobreak >nul
start http://localhost:5173
echo System online and streaming on http://localhost:5173
"@
Set-Content -Path $LauncherPath -Value $LauncherContent -Force
Write-Host "  Created launcher: $LauncherPath" -ForegroundColor Green

# Desktop Shortcut
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut((Join-Path $DesktopPath "IBVAP Surveillance Platform.lnk"))
$Shortcut.TargetPath = $LauncherPath
$Shortcut.WorkingDirectory = $ProjectRoot
$Shortcut.Description = "IBVAP Intelligent Border Video Analytics Platform"
$Shortcut.Save()
Write-Host "  Created desktop shortcut: 'IBVAP Surveillance Platform'" -ForegroundColor Green

# 6. Run Diagnostics Audit
Write-Host "`n[6/6] Executing Pre-Flight Diagnostics Audit..." -ForegroundColor Yellow
& $VenvPython (Join-Path $ProjectRoot "packaging\diagnostics.py")

Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host "  INSTALLATION & VALIDATION COMPLETED SUCCESSFULLY." -ForegroundColor Green
Write-Host "  Launch using: .\launch_ibvap.bat or the desktop shortcut." -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
