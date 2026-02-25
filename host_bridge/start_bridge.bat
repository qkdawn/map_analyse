@echo off
setlocal

cd /d %~dp0\..

if "%ARCGIS_BRIDGE_PORT%"=="" set ARCGIS_BRIDGE_PORT=18081

python -m uvicorn host_bridge.main:app --host 0.0.0.0 --port %ARCGIS_BRIDGE_PORT%
