@echo off
chcp 65001 >nul
title 测试终端MQTT-WLED桥接服务

echo.
echo ═══════════════════════════════════════════════════════════
echo          测试终端MQTT-WLED桥接服务
echo ═══════════════════════════════════════════════════════════
echo.

REM 检查Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到Node.js，请先安装
    pause
    exit /b 1
)

REM 检查npm依赖
cd /d "%~dp0"
if not exist "node_modules" (
    echo [安装] 正在安装MQTT依赖...
    call npm install
)

echo.
echo [测试] 请选择测试模式:
echo   1. 仅测试MQTT连接
echo   2. 仅测试WLED连接
echo   3. 完整测试(MQTT + WLED)
echo   4. 发送测试命令
echo.
set /p TEST_MODE=请输入选项 (1-4):

set STORE_ID=TEST001
set WLED_IP=192.168.1.101

if "%TEST_MODE%"=="1" goto test_mqtt
if "%TEST_MODE%"=="2" goto test_wled
if "%TEST_MODE%"=="3" goto test_full
if "%TEST_MODE%"=="4" goto test_command

:menu
set /p TEST_MODE=无效选项，请重新输入 (1-4):
if "%TEST_MODE%"=="1" goto test_mqtt
if "%TEST_MODE%"=="2" goto test_wled
if "%TEST_MODE%"=="3" goto test_full
if "%TEST_MODE%"=="4" goto test_command
goto menu

:test_mqtt
echo.
echo ═══════════════════════════════════════════════════════════
echo [测试] MQTT连接测试
echo ═══════════════════════════════════════════════════════════
echo.

node -e "
const mqtt = require('mqtt');
console.log('[测试] 正在连接 MQTT Broker...');
const client = mqtt.connect('mqtt://localhost:1883', {
    clientId: 'test_client_' + Date.now()
});

client.on('connect', () => {
    console.log('✓ MQTT连接成功!');
    console.log('[测试] 订阅测试主题...');
    client.subscribe('dryclean/test/#', (err) => {
        if (err) {
            console.error('✗ 订阅失败:', err);
            process.exit(1);
        }
        console.log('✓ 订阅成功!');
        console.log('[测试] 发送测试消息...');
        client.publish('dryclean/test/TEST001/light', JSON.stringify({
            action: 'test',
            message: 'Hello from test!'
        }), {}, () => {
            console.log('✓ 消息已发送');
            setTimeout(() => {
                console.log('[测试] 关闭连接...');
                client.end();
                console.log('✓ 测试完成!');
                process.exit(0);
            }, 2000);
        });
    });
});

client.on('message', (topic, msg) => {
    console.log('[收到] 主题:', topic);
    console.log('[收到] 消息:', msg.toString());
});

client.on('error', (err) => {
    console.error('✗ MQTT错误:', err.message);
    process.exit(1);
});

setTimeout(() => {
    console.error('✗ 测试超时');
    client.end();
    process.exit(1);
}, 10000);
"
goto end

:test_wled
echo.
echo ═══════════════════════════════════════════════════════════
echo [测试] WLED连接测试
echo ═══════════════════════════════════════════════════════════
echo.
echo 请输入WLED设备IP:
set /p WLED_IP:
if "%WLED_IP%"=="" set WLED_IP=192.168.1.101

node -e "
const http = require('http');

console.log('[测试] 正在连接 WLED (%WLED_IP%)...');

const req = http.request({
    hostname: '%WLED_IP%',
    port: 80,
    path: '/json',
    method: 'GET'
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const result = JSON.parse(data);
            console.log('✓ WLED连接成功!');
            console.log('  设备信息:');
            console.log('    MAC:', result.info ? result.info.mac : '未知');
            console.log('    版本:', result.info ? result.info.ver : '未知');
            console.log('    当前状态:', result.state ? (result.state.on ? '开启' : '关闭') : '未知');
            
            console.log('[测试] 发送开灯命令...');
            const offReq = http.request({
                hostname: '%WLED_IP%',
                port: 80,
                path: '/json/state',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }, (offRes) => {
                let offData = '';
                offRes.on('data', chunk => offData += chunk);
                offRes.on('end', () => {
                    console.log('✓ 开灯命令已发送');
                    console.log('[测试] 5秒后关闭灯条...');
                    setTimeout(() => {
                        const onReq = http.request({
                            hostname: '%WLED_IP%',
                            port: 80,
                            path: '/json/state',
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' }
                        }, () => {
                            console.log('✓ 测试完成!');
                            process.exit(0);
                        });
                        onReq.write(JSON.stringify({ on: false }));
                        onReq.end();
                    }, 5000);
                });
            });
            offReq.write(JSON.stringify({ on: true, bri: 255, seg: [{ col: [[255, 0, 0]] }] }));
            offReq.end();
        } catch (e) {
            console.error('✗ 解析响应失败:', e.message);
            console.log('  原始响应:', data.substring(0, 200));
            process.exit(1);
        }
    });
});

req.on('error', (err) => {
    console.error('✗ WLED连接失败:', err.message);
    process.exit(1);
});

req.end();

setTimeout(() => {
    console.error('✗ 测试超时');
    process.exit(1);
}, 10000);
"
goto end

:test_full
echo.
echo ═══════════════════════════════════════════════════════════
echo [测试] 完整测试 (MQTT + WLED)
echo ═══════════════════════════════════════════════════════════
echo.

set /p STORE_ID=请输入门店ID (如 ST001):
if "%STORE_ID%"=="" set STORE_ID=ST001

set /p WLED_IP=请输入WLED IP:
if "%WLED_IP%"=="" set WLED_IP=192.168.1.101

echo.
echo ═══════════════════════════════════════════════════════════
echo 测试配置:
echo   门店ID: %STORE_ID%
echo   WLED IP: %WLED_IP%
echo   MQTT: mqtt://localhost:1883
echo ═══════════════════════════════════════════════════════════
echo.

echo [提示] 请确保终端桥接服务已启动在另一个窗口
echo 按任意键继续...
pause >nul

node terminal-bridge.js %STORE_ID% %WLED_IP%

:end
echo.
pause
