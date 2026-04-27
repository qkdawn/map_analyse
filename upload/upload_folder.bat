@echo off
set SCRIPT_DIR=%~dp0
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%upload_folder.ps1" -LocalFolder "E:\PeopleData" -StartFileIndex 1
pause
