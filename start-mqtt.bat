@echo off
chcp 65001 >nul
echo ==========================================
echo   干洗系统 MQTT Broker 启动脚本
echo ==========================================
echo.

cd /d "d:\Trae CN\bin\dry_cleaning_system\backend"

echo 正在启动 MQTT Broker...
echo.

node start-mqtt-broker.js

pause
