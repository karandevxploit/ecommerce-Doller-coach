@echo off
setlocal

set "ROOT=%~dp0"

echo Starting Doller Coach backend and frontend...
echo Backend:  http://localhost:8001
echo Frontend: http://localhost:3000
echo.

start "Doller Coach Backend - 8001" cmd /k "cd /d ""%ROOT%backend"" && if exist server.lock del /f /q server.lock && npm run start"

timeout /t 3 /nobreak >nul

start "Doller Coach Frontend - 3000" cmd /k "cd /d ""%ROOT%frontend"" && npm run dev -- --host 0.0.0.0 --port 3000"

echo Done. Two windows are opening now.
echo Keep both windows open while working on the website.
pause
