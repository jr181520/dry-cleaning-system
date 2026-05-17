@echo off
echo ========================================
echo   WSL EMQX 启动脚本
echo ========================================
echo.

:: 等待WSL完全启动（增加等待时间）
echo [1/4] Waiting for WSL to be ready...
set /a count=0
:wait_wsl
wsl -d Ubuntu -- bash -c "exit" 2>nul
if errorlevel 1 (
    set /a count+=1
    if %count% LSS 15 (
        echo   Attempt %count%/15 - WSL not ready, waiting...
        timeout /t 2 /nobreak >nul
        goto wait_wsl
    )
)
echo WSL ready!

:: 启动EMQX
echo.
echo [2/4] Starting EMQX...
wsl -d Ubuntu -- bash -c "cd /opt/emqx && /opt/emqx/bin/emqx start"

:: 等待EMQX启动
echo.
echo [3/4] Waiting for EMQX to start...
timeout /t 5 /nobreak >nul

:: 验证EMQX
echo.
echo [4/4] Verifying EMQX...
wsl -d Ubuntu -- bash -c "ss -tlnp | grep -q 1883 && echo EMQX is running! || echo EMQX failed!"

echo.
echo ========================================
echo   Done!
echo ========================================
