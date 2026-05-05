@echo off
chcp 65001 >nul
cd /d "d:\Trae CN\bin\dry_cleaning_system\backend"
echo 正在启动后端服务...
node server.js
pause
