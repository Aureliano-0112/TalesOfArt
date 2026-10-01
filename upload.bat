@echo off
rem ASCII-only launcher. All Chinese messages live in tools\upload.ps1.
rem cmd.exe parses .bat files using the system code page, so UTF-8 Chinese
rem in this file would swallow the bytes that follow it.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\upload.ps1"
echo.
pause