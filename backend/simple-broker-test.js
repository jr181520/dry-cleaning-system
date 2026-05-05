const { Aedes } = require('aedes');
const net = require('net');
const http = require('http');
const WebSocket = require('ws');

console.log('🔧 创建简单 MQTT Broker...');

const aedes = new Aedes({
  // 禁用认证（测试用）
  authenticate: (client, username, password, callback) => {
    console.log(`[认证] 客户端: ${client.id}, 用户名: ${username}`);
    callback(null, true);
  },
  
  // 授权发布/订阅
  authorizePublish: (client, topic, payload, callback) => {
    console.log(`[发布授权] ${client.id} -> ${topic}`);
    callback(null);
  },
  
  authorizeSubscribe: (client, topic, callback) => {
    console.log(`[订阅授权] ${client.id} -> ${topic}`);
    callback(null);
  }
});

// 事件监听
aedes.on('client', (client) => {
  console.log(`[客户端连接] ${client.id}`);
});

aedes.on('clientDisconnect', (client) => {
  console.log(`[客户端断开] ${client.id}`);
});

aedes.on('subscribe', (subscriptions, client) => {
  console.log(`[订阅] ${client.id}: ${subscriptions.map(s => s.topic).join(', ')}`);
});

aedes.on('unsubscribe', (subscriptions, client) => {
  console.log(`[取消订阅] ${client.id}`);
});

aedes.on('publish', (packet, client) => {
  if (client) {
    console.log(`[消息] ${client.id} -> ${packet.topic}: ${packet.payload.toString()}`);
  }
});

aedes.on('error', (err) => {
  console.error('[Aedes错误]', err);
});

// 创建 TCP 服务器
const mqttServer = net.createServer(aedes.handle);

mqttServer.on('error', (err) => {
  console.error('[TCP服务器错误]', err);
});

const PORT = 1884;

mqttServer.listen(PORT, () => {
  console.log(`\n✅ MQTT Broker 已启动！`);
  console.log(`📡 监听端口: ${PORT}`);
  console.log(`🔗 连接地址: mqtt://localhost:${PORT}`);
  console.log(`\n等待客户端连接...\n`);
});

process.on('SIGINT', () => {
  console.log('\n正在关闭 Broker...');
  mqttServer.close();
  process.exit(0);
});
