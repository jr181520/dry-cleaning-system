@echo off
chcp 65001 >nul
cd /d "d:\Trae CN\bin\dry_cleaning_system\backend"
node start-mqtt-broker.js
pause
