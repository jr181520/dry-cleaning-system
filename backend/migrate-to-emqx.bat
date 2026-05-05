@echo off
echo ==========================================
echo   EMQX 迁移脚本
echo ==========================================
echo.

echo [1/4] 检查 EMQX 状态...
cd C:\EMQX
bin\emqx_ctl.bat status
if errorlevel 1 (
    echo.
    echo ❌ EMQX 未运行，正在启动...
    start "EMQX Broker" cmd /k "emqx-edge start"
    timeout /t 5 /nobreak >nul
)

echo.
echo [2/4] 检查端口 1883...
netstat -ano | findstr ":1883.*LISTENING"
if errorlevel 1 (
    echo ❌ EMQX 未监听端口 1883
    echo 提示：请确保 EMQX 正常启动
    pause
    exit /b 1
)
echo ✅ 端口 1883 已就绪

echo.
echo [3/4] 测试 MQTT 连接...
cd d:\Trae CN\bin\dry_cleaning_system\backend
node -e "const mqtt=require('mqtt');const c=mqtt.connect('mqtt://localhost:1883',{clientId:'migration_test'});c.on('connect',()=>{console.log('✅ MQTT 连接成功!');c.end();process.exit(0);});c.on('error',(e)=>{console.log('❌ 错误:',e.message);process.exit(1);});setTimeout(()=>{console.log('❌ 超时');process.exit(1);},5000);"
if errorlevel 1 (
    echo ❌ MQTT 连接失败
    pause
    exit /b 1
)

echo.
echo [4/4] 检查后端配置...
findstr /C:"MQTT_BROKER=mqtt://localhost:1883" .env >nul
if errorlevel 1 (
    echo ❌ 后端配置未更新
    echo 请手动更新 backend\.env
    pause
    exit /b 1
)
echo ✅ 后端配置正确

echo.
echo ==========================================
echo   🎉 迁移完成！
echo ==========================================
echo.
echo 下一步：
echo   1. 停止旧的 Aedes Broker（端口 1884）
echo   2. 重启后端服务: npm start
echo   3. 测试前端 MQTT 功能
echo.
echo EMQX 管理界面: http://localhost:18083
echo.
pause
