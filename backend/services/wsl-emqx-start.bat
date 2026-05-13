@echo off
:: EMQX 生产级启动脚本 (BAT 版本，兼容性更好)
:: 解决 WSL 就绪检测和 EMQX 启动问题

setlocal enabledelayedexpansion

set "LOG_DIR=D:\Trae CN\bin\dry_cleaning_system\backend\services\logs"
set "LOG_FILE=%LOG_DIR%\emqx-startup.log"
set "MAX_WAIT=60"
set "WAIT_INTERVAL=3"

:: 创建日志目录
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

call :Log "========================================"
call :Log "EMQX Startup Script - %date% %time%"
call :Log "========================================"

:: 1. 等待 WSL 就绪
call :Log "[1/5] Waiting for WSL to be ready..."
set "wsl_ready=0"
set "elapsed=0"

:wait_wsl
wsl -e bash -c "exit" 2>nul
if !errorlevel! equ 0 (
    set "wsl_ready=1"
    call :Log "WSL ready after %elapsed% seconds"
) else (
    if !elapsed! LSS %MAX_WAIT% (
        timeout /t %WAIT_INTERVAL% /nobreak >nul
        set /a "elapsed+=!WAIT_INTERVAL!"
        call :Log "WSL not ready, waiting... (!elapsed!/!MAX_WAIT!)" "WARN"
        goto :wait_wsl
    ) else (
        call :Log "WSL did not become ready within %MAX_WAIT% seconds" "ERROR"
        exit /b 1
    )
)

:: 2. 检查 EMQX 是否已运行
call :Log "[2/5] Checking if EMQX is already running..."
for /f "delims=" %%i in ('wsl -e bash -c "pgrep -f emqx > /dev/null && echo RUNNING || echo NOT_RUNNING" 2^>nul') do set "emqx_status=%%i"
if "!emqx_status!"=="RUNNING" (
    call :Log "EMQX is already running"
    exit /b 0
)

:: 3. 启动 EMQX
call :Log "[3/5] Starting EMQX..."
wsl -e bash -c "cd /opt/emqx && /opt/emqx/bin/emqx start" 2>nul
if !errorlevel! neq 0 (
    call :Log "Failed to execute emqx start command" "ERROR"
    exit /b 1
)
call :Log "EMQX start command executed"

:: 4. 等待 EMQX 启动
call :Log "[4/5] Waiting for EMQX to fully start (10 seconds)..."
timeout /t 10 /nobreak >nul

:: 5. 验证 EMQX 运行状态
call :Log "[5/5] Verifying EMQX status..."
for /f "delims=" %%i in ('wsl -e bash -c "ss -tlnp 2^>/dev/null | grep ':1883' | head -1" 2^>nul') do set "verification=%%i"

if defined verification (
    call :Log "SUCCESS: EMQX is running - !verification!"
    exit /b 0
) else (
    call :Log "WARNING: Could not verify port 1883, checking API..." "WARN"
    for /f "delims=" %%i in ('wsl -e bash -c "curl -s http://localhost:18083/api/v5/healthcheck 2^>nul | head -1" 2^>nul') do set "api_check=%%i"
    
    if defined api_check (
        call :Log "SUCCESS: EMQX API is responding"
        exit /b 0
    ) else (
        call :Log "WARNING: Could not verify EMQX, but start was initiated" "WARN"
        exit /b 0
    )
)

:Log
echo [%date% %time%] %~2 %~1
if not "%~2"=="" (
    echo [%date% %time%] [%~2] %~1 >> "%LOG_FILE%"
) else (
    echo [%date% %time%] [INFO] %~1 >> "%LOG_FILE%"
)
exit /b 0
