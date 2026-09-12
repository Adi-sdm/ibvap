# ==============================================================================
# IBVAP - Uninstaller & Decommissioning Script
# SIH26187 - Intelligent Border Video Analytics Platform
# ==============================================================================

[CmdletBinding()]
param (
    [switch]$PurgeData = $false
)

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  IBVAP UNINSTALLATION & SYSTEM DECOMMISSIONING" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Terminate running processes
Write-Host "`nStopping active IBVAP processes..." -ForegroundColor Yellow
Get-Process -Name "python", "node" -ErrorAction SilentlyContinue | Where-Object { 
    $_.MainWindowTitle -like "*IBVAP*" -or $_.CommandLine -like "*uvicorn*" 
} | Stop-Process -Force -ErrorAction SilentlyContinue

# 2. Remove desktop shortcut
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "IBVAP Surveillance Platform.lnk"
if (Test-Path $ShortcutPath) {
    Remove-Item $ShortcutPath -Force
    Write-Host "Removed desktop shortcut." -ForegroundColor Green
}

# 3. Persistent Data Protection
$DataDir = "C:\ProgramData\IBVAP"
if (Test-Path $DataDir) {
    if ($PurgeData) {
        Remove-Item -Path $DataDir -Recurse -Force
        Write-Host "Purged persistent data at $DataDir." -ForegroundColor Red
    } else {
        Write-Host "Persistent data retained at $DataDir (database, evidence, and vault preserved)." -ForegroundColor Green
    }
}

Write-Host "`nUninstallation complete." -ForegroundColor Green
