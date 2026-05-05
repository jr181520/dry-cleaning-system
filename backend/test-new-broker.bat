@echo off
echo ==========================================
echo   测试新的 MQTT Broker
echo ==========================================
echo.

echo [1/2] 正在停止旧的 MQTT Broker...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":1884.*LISTENING"') do (
    echo    停止进程 PID: %%a
    taskkill /F /PID %%a >nul 2>&1
)
echo.

echo [2/2] 启动新的 MQTT Broker（带详细日志）...
echo.
cd /d "%~dp0"
start "MQTT Broker (测试版)" cmd /k "node simple-broker-test.js"

echo.
echo ==========================================
echo   新 Broker 已启动！
echo ==========================================
echo.
echo 请在新窗口中查看日志输出。
echo 启动后，运行 quick-connect-test.js 测试连接。
echo.
pause
