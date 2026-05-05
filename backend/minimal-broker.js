const { Aedes } = require('aedes');
const net = require('net');

console.log('🔧 启动极简 MQTT Broker（无认证）...\n');

// 创建极简 Aedes 实例 - 不设置任何选项
const aedes = new Aedes();

// 添加基本日志
aedes.on('client', (client) => {
  console.log(`[+] 客户端连接: ${client.id}`);
});

aedes.on('clientDisconnect', (client) => {
  console.log(`[-] 客户端断开: ${client.id}`);
});

aedes.on('subscribe', (subscriptions, client) => {
  console.log(`[订阅] ${client.id}: ${subscriptions.map(s => s.topic).join(', ')}`);
});

aedes.on('publish', (packet, client) => {
  if (client) {
    console.log(`[消息] ${client.id} -> ${packet.topic}`);
  }
});

aedes.on('error', (err) => {
  console.error('[错误]', err.message);
});

aedes.on('connectionError', (client, err) => {
  console.error('[连接错误]', err.message);
});

// 创建 TCP 服务器
const mqttServer = net.createServer(aedes.handle);

mqttServer.on('error', (err) => {
  console.error('[TCP错误]', err.message);
});

const PORT = 1884;

mqttServer.listen(PORT, () => {
  console.log('========================================');
  console.log('  ✅ MQTT Broker 已启动！');
  console.log('========================================');
  console.log(`  端口:   ${PORT}`);
  console.log(`  地址:   mqtt://localhost:${PORT}`);
  console.log('========================================');
  console.log('  等待连接...\n');
});

process.on('SIGINT', () => {
  console.log('\n正在关闭...');
  mqttServer.close();
  process.exit(0);
});
