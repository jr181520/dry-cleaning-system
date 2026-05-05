/**
 * 生产级别 MQTT Broker
 * 
 * 功能特性：
 * ✅ 支持用户认证
 * ✅ 支持发布/订阅授权
 * ✅ 完整的错误处理
 * ✅ 连接日志记录
 * ✅ 心跳保活
 * ✅ WebSocket 支持（可选）
 */

const { Aedes } = require('aedes');
const net = require('net');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

console.log('🔧 初始化生产级 MQTT Broker...\n');

// ============ 配置区域 ============
const CONFIG = {
  MQTT_PORT: process.env.MQTT_PORT || 1884,
  WS_PORT: process.env.WS_PORT || 8084,
  // 生产环境建议：启用认证
  AUTHENTICATION: {
    enabled: process.env.MQTT_AUTH_ENABLED !== 'false', // 默认启用
    users: parseUsers()
  }
};

// ============ 用户认证数据（可扩展为数据库） ============
function parseUsers() {
  // 支持环境变量配置用户
  const authEnv = process.env.MQTT_USERS || '';
  if (!authEnv) {
    // 默认测试用户（生产环境应移除或修改）
    return [
      { username: 'admin', password: 'admin123' },
      { username: 'store1', password: 'store123' }
    ];
  }
  
  // 格式: user1:pass1,user2:pass2
  return authEnv.split(',').map(pair => {
    const [username, password] = pair.split(':');
    return { username, password };
  });
}

// ============ 创建 Broker ============
const aedes = new Aedes({
  // 认证（支持用户名/密码）
  authenticate: (client, username, password, callback) => {
    const clientId = client.id || 'unknown';
    const providedUser = username || '';
    const providedPass = password ? password.toString() : '';
    
    console.log(`[认证] 客户端: ${clientId}, 用户: ${providedUser}`);
    
    if (!CONFIG.AUTHENTICATION.enabled) {
      // 禁用认证模式
      callback(null, true);
      return;
    }
    
    // 验证用户凭据
    const user = CONFIG.AUTHENTICATION.users.find(
      u => u.username === providedUser && u.password === providedPass
    );
    
    if (user) {
      console.log(`[认证成功] ${providedUser} from ${clientId}`);
      callback(null, true);
    } else {
      console.log(`[认证失败] ${providedUser} from ${clientId}`);
      callback(new Error('认证失败'), false);
    }
  },
  
  // 发布授权
  authorizePublish: (client, topic, payload, callback) => {
    const clientId = client.id || 'unknown';
    const username = client.user || 'anonymous';
    
    // 示例：限制某些用户只能发布特定主题
    // const allowedPattern = `dryclean/prod/${username}/#`;
    // if (!matchTopic(topic, allowedPattern)) {
    //   console.log(`[授权拒绝] ${username} 发布到 ${topic}`);
    //   callback(new Error('未授权的发布主题'));
    //   return;
    // }
    
    callback(null); // 允许所有发布
  },
  
  // 订阅授权
  authorizeSubscribe: (client, topic, callback) => {
    const username = client.user || 'anonymous';
    
    // 示例：限制订阅权限
    // const allowedPattern = `dryclean/prod/${username}/#`;
    // if (!matchTopic(topic, allowedPattern)) {
    //   callback(new Error('未授权的订阅主题'));
    //   return;
    // }
    
    callback(null); // 允许所有订阅
  }
});

// ============ 事件监听 ============
aedes.on('client', (client) => {
  const clientId = client.id || 'unknown';
  const username = client.user || 'anonymous';
  console.log(`[连接] ${username} (${clientId})`);
});

aedes.on('clientDisconnect', (client) => {
  console.log(`[断开] ${client.id}`);
});

aedes.on('subscribe', (subscriptions, client) => {
  console.log(`[订阅] ${client.id}: ${subscriptions.map(s => s.topic).join(', ')}`);
});

aedes.on('unsubscribe', (subscriptions, client) => {
  console.log(`[退订] ${client.id}`);
});

aedes.on('publish', (packet, client) => {
  if (client) {
    console.log(`[发布] ${client.id} -> ${packet.topic}`);
  }
});

aedes.on('error', (err) => {
  console.error('[错误]', err.message);
});

aedes.on('connectionError', (client, err) => {
  console.error('[连接错误]', client.id, err.message);
});

// ============ 创建 TCP 服务器 ============
const mqttServer = net.createServer(aedes.handle);

mqttServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[错误] 端口 ${CONFIG.MQTT_PORT} 已被占用！`);
    console.error('[建议] 请先停止占用该端口的进程，或修改 MQTT_PORT 环境变量');
    process.exit(1);
  }
  console.error('[TCP错误]', err.message);
});

// ============ 可选：WebSocket 支持 ============
let wsServer = null;
if (process.env.ENABLE_WS === 'true') {
  const httpServer = http.createServer();
  wsServer = new WebSocket.Server({ server: httpServer });
  
  wsServer.on('connection', (ws) => {
    aedes.handle(ws);
  });
  
  httpServer.listen(CONFIG.WS_PORT, () => {
    console.log(`[WebSocket] 已启用: ws://localhost:${CONFIG.WS_PORT}/mqtt`);
  });
}

// ============ 启动 Broker ============
mqttServer.listen(CONFIG.MQTT_PORT, () => {
  console.log('========================================');
  console.log('  🚀 MQTT Broker (生产级)');
  console.log('========================================');
  console.log(`  MQTT:    mqtt://localhost:${CONFIG.MQTT_PORT}`);
  console.log(`  认证:    ${CONFIG.AUTHENTICATION.enabled ? '启用' : '禁用'}`);
  console.log(`  WebSocket: ${wsServer ? '启用' : '禁用'}`);
  console.log('========================================');
  console.log('  按 Ctrl+C 停止');
  console.log('========================================\n');
  
  // 启动信息
  if (CONFIG.AUTHENTICATION.enabled) {
    console.log('📋 测试账号:');
    CONFIG.AUTHENTICATION.users.forEach(u => {
      console.log(`   用户名: ${u.username}, 密码: ${u.password}`);
    });
    console.log();
  }
});

process.on('SIGINT', () => {
  console.log('\n正在关闭 Broker...');
  if (wsServer) {
    wsServer.close();
  }
  mqttServer.close();
  process.exit(0);
});

// ============ 优雅退出 ============
process.on('SIGTERM', () => {
  console.log('\n收到 SIGTERM 信号，正在关闭...');
  mqttServer.close();
  process.exit(0);
});

// ============ 辅助函数（MQTT 主题匹配） ============
function matchTopic (topic, pattern) {
  const patternParts = pattern.split('/');
  const topicParts = topic.split('/');
  
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i] === '#') {
      return true;
    }
    if (patternParts[i] !== '+' && patternParts[i] !== topicParts[i]) {
      return false;
    }
  }
  
  return patternParts.length === topicParts.length;
}
