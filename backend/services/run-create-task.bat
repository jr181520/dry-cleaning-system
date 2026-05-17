@echo off
chcp 65001 >nul 2>&1
:: EMQX Auto-Start Task Creator v2

echo ==========================================
echo   EMQX Startup Task Creator v2
echo ==========================================
echo.
echo Creating scheduled task with admin rights...
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0create-emqx-task-v2.ps1" -Force

echo.
echo Done! Press any key to exit...
pause >nul
