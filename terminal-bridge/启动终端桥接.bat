@echo off
chcp 65001 >nul
title 终端MQTT-WLED桥接服务

echo.
echo ╔════════════════════════════════════════════════════╗
echo ║       终端MQTT-WLED桥接服务                         ║
echo ╠════════════════════════════════════════════════════╣
echo.
echo 请输入门店编号 (如 ST001):
set /p STORE_ID=
if "%STORE_ID%"=="" set STORE_ID=ST001

echo.
echo 请输入WLED设备IP (如 192.168.1.101):
set /p WLED_IP=
if "%WLED_IP%"=="" set WLED_IP=192.168.1.101

echo.
echo 选择环境:
echo   1. 开发环境 (dev)
echo   2. 生产环境 (prod)
set /p ENV_CHOICE=
if "%ENV_CHOICE%"=="1" set MQTT_ENV=dev
if "%ENV_CHOICE%"=="2" set MQTT_ENV=prod
if "%MQTT_ENV%"=="" set MQTT_ENV=prod

echo.
echo ═════════════════════════════════════════════════════
echo   门店ID: %STORE_ID%
echo   WLED IP: %WLED_IP%
echo   环境: %MQTT_ENV%
echo   MQTT Broker: mqtt://localhost:1883
echo ═════════════════════════════════════════════════════
echo.

cd /d "%~dp0"

REM 检查npm依赖
if not exist "node_modules" (
    echo [安装] 正在安装依赖...
    call npm install
)

echo [启动] 正在启动桥接服务...
echo.
set MQTT_BROKER=mqtt://localhost:1883
set STORE_ID=%STORE_ID%
set WLED_IP=%WLED_IP%
set MQTT_ENV=%MQTT_ENV%

node terminal-bridge.js %STORE_ID% %WLED_IP%

pause
