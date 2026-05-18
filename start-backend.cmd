@echo off
cd /d "%~dp0backend"
if exist server.lock del /f /q server.lock
node --max-old-space-size=2048 --expose-gc server.js
