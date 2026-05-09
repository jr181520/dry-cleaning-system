@echo off
chcp 65001 >nul
echo ======================================
echo   干洗店系统 - 设置开机自启动
echo ======================================
echo.

echo 正在创建后端服务开机自启动任务...
schtasks /create /tn "DryCleaningBackend" /tr "cmd /c cd /d ^"d:\Trae CN\bin\dry_cleaning_system\backend^" ^&^& node server.js" /sc onlogon /rl highest /f

if %errorlevel% equ 0 (
    echo   ✅ 后端服务任务创建成功
) else (
    echo   ⚠️  后端服务任务可能已存在
)

echo.
echo 正在创建MQTT服务开机自启动任务...
schtasks /create /tn "DryCleaningMQTT" /tr "cmd /c cd /d ^"d:\Trae CN\bin\dry_cleaning_system\backend^" ^&^& node start-mqtt-broker.js" /sc onlogon /rl highest /f

if %errorlevel% equ 0 (
    echo   ✅ MQTT服务任务创建成功
) else (
    echo   ⚠️  MQTT服务任务可能已存在
)

echo.
echo ======================================
echo 开机自启动设置完成！
echo ======================================
echo.
echo 已配置开机自动启动：
echo   1. 后端服务 (端口 3000/3001)
echo   2. MQTT服务 (端口 1883)
echo.
echo 下次开机时将自动启动。
echo.

pause
