/**
 * 终端MQTT-WLED桥接服务
 * 
 * 功能：
 * 1. 订阅MQTT主题，接收后台控制命令
 * 2. 将MQTT命令转换为WLED HTTP API调用
 * 3. 上报灯条状态和心跳到MQTT
 * 
 * 使用方法：
 *   node terminal-bridge.js <storeId> [wledIp]
 *   例: node terminal-bridge.js ST001 192.168.1.101
 */

const mqtt = require('mqtt');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ============ 配置区 ============
const CONFIG = {
    // MQTT配置 - 连接后台Broker
    MQTT_BROKER: process.env.MQTT_BROKER || 'mqtt://localhost:1883',
    MQTT_USERNAME: process.env.MQTT_USERNAME || '',
    MQTT_PASSWORD: process.env.MQTT_PASSWORD || '',
    CLIENT_PREFIX: 'terminal_bridge_',
    
    // MQTT主题前缀
    TOPIC_PREFIX: 'dryclean',
    ENV: process.env.MQTT_ENV || 'prod', // dev 或 prod
    
    // WLED默认配置
    DEFAULT_WLED_IP: '192.168.1.101',
    WLED_PORT: 80,
    
    // 心跳间隔（毫秒）
    HEARTBEAT_INTERVAL: 15000,
    
    // 状态上报间隔（毫秒）
    STATUS_REPORT_INTERVAL: 30000
};

// ============ 全局变量 ============
let mqttClient = null;
let wledClient = null;
let terminalId = '';
let storeId = '';
let wledIp = '';
let wledMac = '';

// 灯条状态
const lightState = {
    online: true,
    lastUpdate: Date.now(),
    mode: 'idle',
    color: '#000000',
    brightness: 0
};

// ============ 工具函数 ============

// Hex转RGB数组
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : [0, 0, 0];
}

// 解析颜色名称到Hex
function colorNameToHex(colorName) {
    const colors = {
        red: '#ff0000',
        green: '#00ff00',
        blue: '#0000ff',
        yellow: '#ffff00',
        purple: '#ff00ff',
        cyan: '#00ffff',
        white: '#ffffff',
        orange: '#ff5500',
        pink: '#ff69b4'
    };
    return colors[colorName.toLowerCase()] || '#00ff00';
}

// HTTP请求封装
function httpRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ raw: data });
                }
            });
        });
        req.on('error', reject);
        if (postData) {
            req.write(JSON.stringify(postData));
        }
        req.end();
    });
}

// ============ WLED控制 ============

// 发送WLED命令
async function sendWledCommand(state) {
    try {
        const options = {
            hostname: wledIp,
            port: CONFIG.WLED_PORT,
            path: '/json/state',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        const result = await httpRequest(options, state);
        console.log(`[WLED] 命令发送成功:`, state);
        return result;
    } catch (error) {
        console.error(`[WLED] 命令发送失败:`, error.message);
        return { error: error.message };
    }
}

// 获取WLED状态
async function getWledStatus() {
    try {
        const options = {
            hostname: wledIp,
            port: CONFIG.WLED_PORT,
            path: '/json',
            method: 'GET'
        };
        const result = await httpRequest(options);
        
        // 提取MAC地址
        if (result.info && result.info.mac) {
            wledMac = result.info.mac;
        }
        
        return result;
    } catch (error) {
        console.error(`[WLED] 状态获取失败:`, error.message);
        return { error: error.message };
    }
}

// 开灯
async function wledTurnOn(color = '#00ff00', brightness = 255, effect = 0) {
    const rgb = hexToRgb(color);
    return await sendWledCommand({
        on: true,
        bri: brightness,
        seg: [{
            col: [rgb],
            fx: effect
        }]
    });
}

// 关灯
async function wledTurnOff() {
    return await sendWledCommand({
        on: false
    });
}

// 闪烁效果（呼吸灯）
async function wledPulse(color = '#ff0000') {
    const rgb = hexToRgb(color);
    return await sendWledCommand({
        on: true,
        bri: 255,
        seg: [{
            col: [rgb],
            fx: 2, // Breathe效果
            tt: 30 // 过渡时间
        }]
    });
}

// ============ MQTT功能 ============

// 连接到MQTT Broker
function connectMqtt() {
    return new Promise((resolve, reject) => {
        const clientId = CONFIG.CLIENT_PREFIX + storeId + '_' + Date.now();
        
        const options = {
            clientId: clientId,
            keepalive: 60,
            reconnectPeriod: 5000,
            connectTimeout: 10000
        };
        
        if (CONFIG.MQTT_USERNAME) {
            options.username = CONFIG.MQTT_USERNAME;
            options.password = CONFIG.MQTT_PASSWORD;
        }
        
        console.log(`[MQTT] 正在连接 ${CONFIG.MQTT_BROKER}...`);
        mqttClient = mqtt.connect(CONFIG.MQTT_BROKER, options);
        
        mqttClient.on('connect', () => {
            console.log(`[MQTT] 连接成功! ClientID: ${clientId}`);
            
            // 订阅控制主题
            const controlTopic = `${CONFIG.TOPIC_PREFIX}/${CONFIG.ENV}/${storeId}/light`;
            mqttClient.subscribe(controlTopic, { qos: 1 }, (err) => {
                if (err) {
                    console.error('[MQTT] 订阅失败:', err);
                } else {
                    console.log(`[MQTT] 已订阅: ${controlTopic}`);
                }
            });
            
            // 订阅通用控制（兼容多门店）
            const genericTopic = `${CONFIG.TOPIC_PREFIX}/+/+/light`;
            mqttClient.subscribe(genericTopic, { qos: 1 }, (err) => {
                if (err) {
                    console.error('[MQTT] 通用订阅失败:', err);
                } else {
                    console.log(`[MQTT] 已订阅: ${genericTopic}`);
                }
            });
            
            // 发送注册消息
            sendRegistration();
            
            resolve(true);
        });
        
        mqttClient.on('message', (topic, message) => {
            handleMessage(topic, message);
        });
        
        mqttClient.on('error', (error) => {
            console.error('[MQTT] 错误:', error.message);
            reject(error);
        });
        
        mqttClient.on('offline', () => {
            console.log('[MQTT] 连接离线');
        });
        
        mqttClient.on('reconnect', () => {
            console.log('[MQTT] 正在重连...');
        });
    });
}

// 处理MQTT消息
async function handleMessage(topic, message) {
    try {
        const msg = JSON.parse(message.toString());
        console.log(`[MQTT] 收到消息 [${topic}]:`, msg);
        
        // 检查是否针对本终端
        const topicParts = topic.split('/');
        const msgStoreId = topicParts[2];
        
        // 如果不是发给本门店的消息，跳过（除非是通用主题）
        if (msgStoreId && msgStoreId !== storeId && topicParts[1] !== '+') {
            return;
        }
        
        // 处理控制命令
        switch (msg.action) {
            case 'on':
                await handleLightOn(msg);
                break;
            case 'off':
                await handleLightOff(msg);
                break;
            case 'all_off':
                await handleAllOff(msg);
                break;
            case 'pulse':
            case 'blink':
                await handleLightPulse(msg);
                break;
            case 'query_status':
                await reportStatus();
                break;
            default:
                console.log(`[MQTT] 未知命令: ${msg.action}`);
        }
        
        // 上报执行结果
        reportExecution(msg.action, true);
        
    } catch (error) {
        console.error('[MQTT] 消息处理失败:', error.message);
    }
}

// 处理开灯命令
async function handleLightOn(msg) {
    lightState.mode = 'on';
    lightState.color = msg.color ? colorNameToHex(msg.color) : '#00ff00';
    lightState.brightness = msg.brightness || 255;
    lightState.lastUpdate = Date.now();
    
    await wledTurnOn(lightState.color, lightState.brightness);
}

// 处理关灯命令
async function handleLightOff(msg) {
    lightState.mode = 'off';
    lightState.lastUpdate = Date.now();
    
    await wledTurnOff();
}

// 处理全关命令
async function handleAllOff(msg) {
    lightState.mode = 'all_off';
    lightState.lastUpdate = Date.now();
    
    await wledTurnOff();
}

// 处理闪烁命令
async function handleLightPulse(msg) {
    lightState.mode = 'pulse';
    lightState.color = msg.color ? colorNameToHex(msg.color) : '#ff0000';
    lightState.lastUpdate = Date.now();
    
    await wledPulse(lightState.color);
}

// 发送注册消息
function sendRegistration() {
    const registration = {
        action: 'terminal_register',
        terminalId: terminalId,
        storeId: storeId,
        wledIp: wledIp,
        wledMac: wledMac,
        status: 'online',
        timestamp: Date.now(),
        capabilities: ['light_on', 'light_off', 'pulse', 'status_report']
    };
    
    const topic = `${CONFIG.TOPIC_PREFIX}/${CONFIG.ENV}/${storeId}/light/heartbeat`;
    mqttClient.publish(topic, JSON.stringify(registration), { qos: 1 });
    console.log('[MQTT] 终端注册消息已发送');
}

// 发送心跳
function sendHeartbeat() {
    const heartbeat = {
        action: 'terminal_heartbeat',
        terminalId: terminalId,
        storeId: storeId,
        lightId: 'L001',
        status: 'online',
        wledMac: wledMac,
        timestamp: Date.now()
    };
    
    const topic = `${CONFIG.TOPIC_PREFIX}/${CONFIG.ENV}/${storeId}/light/heartbeat`;
    mqttClient.publish(topic, JSON.stringify(heartbeat), { qos: 1 });
}

// 上报执行结果
function reportExecution(action, success) {
    const report = {
        action: 'execution_report',
        terminalId: terminalId,
        storeId: storeId,
        originalAction: action,
        success: success,
        timestamp: Date.now()
    };
    
    const topic = `${CONFIG.TOPIC_PREFIX}/${CONFIG.ENV}/${storeId}/light/status`;
    mqttClient.publish(topic, JSON.stringify(report), { qos: 1 });
}

// 上报状态
async function reportStatus() {
    const status = await getWledStatus();
    
    const report = {
        action: 'status_report',
        terminalId: terminalId,
        storeId: storeId,
        lightId: 'L001',
        wledStatus: status,
        localState: lightState,
        timestamp: Date.now()
    };
    
    const topic = `${CONFIG.TOPIC_PREFIX}/${CONFIG.ENV}/${storeId}/light/status`;
    mqttClient.publish(topic, JSON.stringify(report), { qos: 1 });
    console.log('[MQTT] 状态已上报');
}

// ============ 主程序 ============

async function main() {
    // 解析命令行参数
    const args = process.argv.slice(2);
    storeId = args[0] || process.env.STORE_ID || 'ST001';
    wledIp = args[1] || process.env.WLED_IP || CONFIG.DEFAULT_WLED_IP;
    
    terminalId = `T_${storeId}_${Date.now()}`;
    
    console.log('╔═══════════════════════════════════════════╗');
    console.log('║    终端MQTT-WLED桥接服务                    ║');
    console.log('╠═══════════════════════════════════════════╣');
    console.log(`║  门店ID: ${storeId.padEnd(30)}║`);
    console.log(`║  WLED IP: ${wledIp.padEnd(29)}║`);
    console.log(`║  终端ID: ${terminalId.substring(0, 30).padEnd(30)}║`);
    console.log(`║  MQTT Broker: ${CONFIG.MQTT_BROKER.padEnd(22)}║`);
    console.log('╚═══════════════════════════════════════════╝');
    
    try {
        // 1. 获取WLED初始状态
        console.log('\n[启动] 获取WLED设备状态...');
        const wledStatus = await getWledStatus();
        if (wledStatus.error) {
            console.warn(`[警告] WLED设备连接失败: ${wledStatus.error}`);
            console.warn('[提示] 继续启动，WLED命令将会重试...');
        } else {
            console.log(`[WLED] 设备在线 - MAC: ${wledMac || '未知'}`);
        }
        
        // 2. 连接MQTT
        console.log('\n[启动] 连接MQTT Broker...');
        await connectMqtt();
        
        // 3. 启动心跳定时器
        setInterval(sendHeartbeat, CONFIG.HEARTBEAT_INTERVAL);
        console.log(`[启动] 心跳定时器已启动 (${CONFIG.HEARTBEAT_INTERVAL/1000}秒间隔)`);
        
        // 4. 启动状态上报定时器
        setInterval(reportStatus, CONFIG.STATUS_REPORT_INTERVAL);
        console.log(`[启动] 状态上报定时器已启动 (${CONFIG.STATUS_REPORT_INTERVAL/1000}秒间隔)`);
        
        console.log('\n✅ 桥接服务启动成功!');
        console.log('   等待MQTT命令...\n');
        
        // 初始心跳
        setTimeout(sendHeartbeat, 2000);
        
    } catch (error) {
        console.error('\n❌ 启动失败:', error.message);
        process.exit(1);
    }
}

// 优雅退出
process.on('SIGINT', () => {
    console.log('\n[退出] 正在关闭服务...');
    if (mqttClient) {
        mqttClient.end();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n[退出] 正在关闭服务...');
    if (mqttClient) {
        mqttClient.end();
    }
    process.exit(0);
});

// 启动
main();
