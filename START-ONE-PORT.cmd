@echo off
setlocal

set "ROOT=%~dp0"

echo Starting Doller Coach on one port...
echo Website + API: http://localhost:8001
echo Ngrok command: ngrok http 8001
echo.

echo Building frontend first...
cd /d "%ROOT%frontend"
call npm run build
if errorlevel 1 (
  echo.
  echo Frontend build failed. Fix the error above first.
  pause
  exit /b 1
)

echo.
echo Starting backend with frontend attached...
cd /d "%ROOT%backend"
if exist server.lock del /f /q server.lock
call npm run start

pause
