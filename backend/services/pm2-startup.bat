@echo off
echo ========================================
echo   开机自启动 - PM2 后端服务
echo ========================================
echo.

:: 等待系统完全启动
echo [1/4] Waiting for system to be ready...
timeout /t 10 /nobreak >nul

:: 启动 PM2 后端服务
echo.
echo [2/4] Starting PM2 ecosystem...
cd /d D:\Trae CN\bin\dry_cleaning_system\backend
call pm2 start ecosystem.config.js --env production

:: 等待服务启动
echo.
echo [3/4] Waiting for backend to start...
timeout /t 5 /nobreak >nul

:: 验证服务状态
echo.
echo [4/4] Verifying service status...
call pm2 list

echo.
echo ========================================
echo   PM2 Backend started!
echo ========================================
pause
