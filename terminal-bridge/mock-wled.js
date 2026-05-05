/**
 * 模拟WLED设备
 * 
 * 功能：
 * 1. 模拟WLED HTTP API响应
 * 2. 监听MQTT命令，显示灯条状态
 * 3. 测试整个系统链路
 * 
 * 使用方法：
 *   node mock-wled.js [port]
 *   例: node mock-wled.js 8081
 */

const mqtt = require('mqtt');
const http = require('http');
const url = require('url');

// ============ 配置 ============
const CONFIG = {
    HTTP_PORT: process.argv[2] || 8081,  // 模拟WLED HTTP端口
    MQTT_BROKER: 'mqtt://localhost:1883',
    MQTT_TOPIC: 'dryclean/prod/+/+/light',
    STORE_ID: 'ST001'
};

// 模拟WLED状态
const wledState = {
    state: {
        on: false,
        bri: 0,
        seg: [{
            col: [[0, 0, 0]],
            fx: 0
        }]
    },
    info: {
        ver: '0.14.0',
        mac: 'AABBCCDDEEFF',
        ip: '192.168.1.101'
    },
    effects: ['Solid', 'Blink', 'Breathe', 'Wipe', 'Random Colors'],
    palettes: ['Default', 'Random']
};

// 颜色效果
const effectNames = ['Solid', 'Blink', 'Breathe', 'Wipe', 'Random Colors', 'Sweep', 'Dynamic', 'Rainbow', 'Fire'];
const colorNames = {
    '#ff0000': '红色',
    '#00ff00': '绿色',
    '#0000ff': '蓝色',
    '#ffff00': '黄色',
    '#ff00ff': '紫色',
    '#00ffff': '青色',
    '#ffffff': '白色',
    '#ff5500': '橙色'
};

// ============ HTTP服务器（模拟WLED） ============
const httpServer = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    
    // 设置CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // GET /json - 获取状态
    if (req.method === 'GET' && parsedUrl.pathname === '/json') {
        console.log(`[模拟WLED] GET /json - 返回当前状态`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(wledState));
        return;
    }
    
    // POST /json/state - 设置状态
    if (req.method === 'POST' && parsedUrl.pathname === '/json/state') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const cmd = JSON.parse(body);
                console.log(`[模拟WLED] POST /json/state - 收到命令:`, cmd);
                
                // 更新模拟状态
                if (cmd.on !== undefined) {
                    wledState.state.on = cmd.on;
                    wledState.state.bri = cmd.bri || (cmd.on ? 255 : 0);
                }
                
                if (cmd.seg && cmd.seg[0]) {
                    if (cmd.seg[0].col) {
                        wledState.state.seg[0].col = cmd.seg[0].col;
                    }
                    if (cmd.seg[0].fx !== undefined) {
                        wledState.state.seg[0].fx = cmd.seg[0].fx;
                    }
                }
                
                // 显示状态变化
                const isOn = wledState.state.on ? '开启' : '关闭';
                const rgb = wledState.state.seg[0].col[0];
                const hex = `#${rgb.map(v => v.toString(16).padStart(2, '0')).join('')}`;
                const colorName = colorNames[hex.toLowerCase()] || hex;
                const effect = effectNames[wledState.state.seg[0].fx] || 'Unknown';
                
                console.log(`[模拟WLED] 状态: ${isOn}, 颜色: ${colorName} (${hex}), 效果: ${effect}`);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(wledState));
            } catch (e) {
                console.error('[模拟WLED] 解析命令失败:', e.message);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }
    
    // 404
    res.writeHead(404);
    res.end('Not Found');
});

// ============ MQTT客户端 ============
let mqttClient = null;
let lastCommand = null;

function connectMqtt() {
    return new Promise((resolve, reject) => {
        console.log(`[MQTT] 正在连接 ${CONFIG.MQTT_BROKER}...`);
        
        mqttClient = mqtt.connect(CONFIG.MQTT_BROKER, {
            clientId: 'mock_wled_' + Date.now(),
            keepalive: 60
        });
        
        mqttClient.on('connect', () => {
            console.log(`[MQTT] 连接成功!`);
            console.log(`[MQTT] 订阅主题: ${CONFIG.MQTT_TOPIC}`);
            
            mqttClient.subscribe(CONFIG.MQTT_TOPIC, { qos: 1 }, (err) => {
                if (err) {
                    console.error('[MQTT] 订阅失败:', err);
                    reject(err);
                } else {
                    console.log('[MQTT] 订阅成功!');
                    resolve(true);
                }
            });
        });
        
        mqttClient.on('message', (topic, message) => {
            try {
                const cmd = JSON.parse(message.toString());
                console.log(`\n[MQTT] 收到命令 [${topic}]:`);
                console.log(`       ${JSON.stringify(cmd, null, 2).split('\n').join('\n       ')}`);
                
                lastCommand = cmd;
                
                // 根据命令更新模拟WLED状态
                handleCommand(cmd);
                
                // 发送状态报告
                reportStatus();
                
            } catch (e) {
                console.log(`[MQTT] 收到消息: ${message.toString()}`);
            }
        });
        
        mqttClient.on('error', (err) => {
            console.error('[MQTT] 错误:', err.message);
            reject(err);
        });
        
        mqttClient.on('offline', () => {
            console.log('[MQTT] 连接离线');
        });
    });
}

// 处理MQTT命令
function handleCommand(cmd) {
    const topic = CONFIG.MQTT_TOPIC.replace('+', CONFIG.STORE_ID);
    
    switch (cmd.action) {
        case 'on':
            console.log(`[模拟WLED] 开灯命令 - 颜色: ${cmd.color || 'green'}, 灯条: ${cmd.lightIds?.join(', ') || 'all'}`);
            wledState.state.on = true;
            wledState.state.bri = 255;
            wledState.state.seg[0].col = [[0, 255, 0]]; // 绿色
            if (cmd.color === 'red') wledState.state.seg[0].col = [[255, 0, 0]];
            if (cmd.color === 'blue') wledState.state.seg[0].col = [[0, 0, 255]];
            if (cmd.color === 'yellow') wledState.state.seg[0].col = [[255, 255, 0]];
            break;
            
        case 'off':
            console.log(`[模拟WLED] 关灯命令 - 灯条: ${cmd.lightIds?.join(', ') || 'all'}`);
            wledState.state.on = false;
            wledState.state.bri = 0;
            break;
            
        case 'all_off':
            console.log(`[模拟WLED] 全关命令`);
            wledState.state.on = false;
            wledState.state.bri = 0;
            break;
            
        case 'pulse':
        case 'blink':
            console.log(`[模拟WLED] 闪烁命令 - 颜色: ${cmd.color || 'red'}`);
            wledState.state.on = true;
            wledState.state.seg[0].fx = 1; // Blink效果
            if (cmd.color === 'green') wledState.state.seg[0].col = [[0, 255, 0]];
            if (cmd.color === 'red') wledState.state.seg[0].col = [[255, 0, 0]];
            break;
            
        default:
            console.log(`[模拟WLED] 未知命令: ${cmd.action}`);
    }
}

// 上报状态
function reportStatus() {
    const statusTopic = `dryclean/prod/${CONFIG.STORE_ID}/light/status`;
    const heartbeatTopic = `dryclean/prod/${CONFIG.STORE_ID}/light/heartbeat`;
    
    const status = {
        action: 'status_report',
        storeId: CONFIG.STORE_ID,
        lightId: 'L001',
        wledStatus: { ...wledState },
        timestamp: Date.now()
    };
    
    const heartbeat = {
        action: 'terminal_heartbeat',
        terminalId: 'mock_wled_001',
        storeId: CONFIG.STORE_ID,
        lightId: 'L001',
        status: 'online',
        wledMac: wledState.info.mac,
        timestamp: Date.now()
    };
    
    mqttClient.publish(statusTopic, JSON.stringify(status), { qos: 1 });
    mqttClient.publish(heartbeatTopic, JSON.stringify(heartbeat), { qos: 1 });
    console.log(`[MQTT] 状态已上报: ${statusTopic}`);
}

// ============ 主程序 ============
async function main() {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║          模拟WLED设备 + MQTT监听                         ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log(`║  HTTP端口: ${CONFIG.HTTP_PORT}                                        ║`);
    console.log(`║  MQTT: ${CONFIG.MQTT_BROKER}                              ║`);
    console.log(`║  订阅: ${CONFIG.MQTT_TOPIC}                               ║`);
    console.log(`║  门店: ${CONFIG.STORE_ID}                                          ║`);
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log('║                                                           ║');
    console.log('║  等待MQTT命令...                                          ║');
    console.log('║  可通过以下方式测试:                                       ║');
    console.log('║  1. admin.html 点亮灯条按钮                               ║');
    console.log('║  2. index.html 激活灯条按钮                               ║');
    console.log('║  3. API调用: POST /api/admin/lights/ST001/turn-on-all     ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
    
    // 启动HTTP服务器
    httpServer.listen(CONFIG.HTTP_PORT, () => {
        console.log(`[模拟WLED] HTTP服务已启动: http://localhost:${CONFIG.HTTP_PORT}`);
        console.log(`[模拟WLED] 可通过 http://localhost:${CONFIG.HTTP_PORT}/json 查看状态`);
    });
    
    // 连接MQTT
    try {
        await connectMqtt();
        
        // 初始状态上报
        setTimeout(reportStatus, 2000);
        
        // 定时心跳（60秒间隔，避免日志刷屏）
        setInterval(reportStatus, 60000);
        
        console.log('[就绪] 等待命令...\n');
        
    } catch (error) {
        console.error('[错误] MQTT连接失败:', error.message);
        console.log('[提示] 请确保MQTT Broker正在运行');
    }
}

// 优雅退出
process.on('SIGINT', () => {
    console.log('\n[退出] 正在关闭服务...');
    if (mqttClient) mqttClient.end();
    httpServer.close();
    process.exit(0);
});

// 启动
main();
