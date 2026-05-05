@echo off
echo ==========================================
echo   EMQX Broker 测试脚本
echo ==========================================
echo.

cd /d "C:\EMQX"

echo 检查 EMQX 状态...
bin\emqx_ctl.bat status

echo.
echo 检查端口...
netstat -ano | findstr ":1883"

echo.
echo ==========================================
echo   测试 MQTT 连接
echo ==========================================
echo.

cd /d "d:\Trae CN\bin\dry_cleaning_system\backend"

echo 使用 npm mqtt 库测试连接到 1883...
node -e "const mqtt=require('mqtt');const c=mqtt.connect('mqtt://localhost:1883',{clientId:'test_emqx_'+Date.now()});c.on('connect',()=>{console.log('✅ EMQX 连接成功!');c.end();process.exit(0);});c.on('error',(e)=>{console.log('❌ 错误:',e.message);process.exit(1);});setTimeout(()=>{console.log('❌ 5秒超时');process.exit(1);},5000);"

pause
