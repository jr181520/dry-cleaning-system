@echo off
chcp 65001 >nul
echo ==========================================
echo   干洗店管理系统 - 服务启动器
echo ==========================================
echo.

echo [1/3] 启动 MQTT Broker (端口 1883)...
cd /d "%~dp0backend"
start "MQTT Broker" cmd /k "node start-mqtt-broker.js"
timeout /t 2 /nobreak >nul

echo [2/3] 启动后端服务 (端口 3000)...
start "Backend Server" cmd /k "npm start"
timeout /t 3 /nobreak >nul

echo [3/3] 检查服务状态...
curl -s http://localhost:3000/api/health >nul 2>&1 && echo   ✓ 后端服务已启动 || echo   ✗ 后端服务启动失败
netstat -an | findstr ":1883" >nul 2>&1 && echo   ✓ MQTT Broker 已启动 || echo   ✗ MQTT Broker 启动失败

echo.
echo ==========================================
echo   所有服务已启动！
echo ==========================================
echo.
echo 打开浏览器访问:
echo   管理员端: http://localhost:3000
echo   客户端: http://localhost:3000/c-index.html
echo   移动端: http://localhost:3000/m-index.html
echo.
echo 按任意键关闭此窗口（服务继续在后台运行）...
pause >nul
