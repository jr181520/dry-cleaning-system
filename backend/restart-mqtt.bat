@echo off
echo ========================================
echo   MQTT Broker 重启脚本
echo ========================================
echo.

echo [1/3] 正在查找并停止 MQTT Broker...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":1884.*LISTENING"') do (
    echo    找到进程 PID: %%a
    echo    正在终止进程...
    taskkill /F /PID %%a >nul 2>&1
    echo    进程已终止
)

echo.
echo [2/3] 等待端口释放...
timeout /t 2 /nobreak >nul

echo.
echo [3/3] 正在启动 MQTT Broker...
echo.

cd /d "%~dp0"
start "MQTT Broker" cmd /k "node start-mqtt-broker.js"

echo.
echo ========================================
echo   MQTT Broker 正在启动...
echo ========================================
echo.
echo 提示：
echo   1. 新窗口将显示 Broker 启动日志
echo   2. 看到 "MQTT Broker 已启动" 后表示成功
echo   3. 保持该窗口开启
echo.
echo 正在测试连接（10秒后）...
timeout /t 10 /nobreak

echo.
echo 测试 MQTT 连接...
node -e "const mqtt=require('mqtt');const c=mqtt.connect('mqtt://localhost:1884');c.on('connect',()=>{console.log('✅ 连接成功!');c.end();process.exit(0);});c.on('error',(e)=>{console.log('❌ 错误:',e.message);process.exit(1);});setTimeout(()=>{console.log('❌ 超时');process.exit(1);},5000);"
