const { Aedes } = require('aedes');
const net = require('net');
const http = require('http');
const WebSocket = require('ws');

const aedes = new Aedes();
const httpServer = http.createServer();
const wsServer = new WebSocket.Server({ server: httpServer });

wsServer.on('connection', (ws) => {
  aedes.handle(ws);
});

const mqttServer = net.createServer(aedes.handle);

const MQTT_PORT = 1884;
const WS_PORT = 8084;

aedes.on('client', (client) => {
  console.log(`[连接] ${client.id}`);
});

aedes.on('publish', (packet, client) => {
  if (client) {
    console.log(`[发布] ${packet.topic}`);
  }
});

aedes.on('error', (err) => {
  console.error('[Aedes] 错误:', err.message);
});

// 不指定地址，让系统自动选择
mqttServer.listen(MQTT_PORT, () => {
  const addr = mqttServer.address();
  console.log('========================================');
  console.log('  MQTT Broker 已启动');
  console.log('========================================');
  console.log(`  监听地址: ${addr.address}:${addr.port}`);
  console.log(`  MQTT:      mqtt://localhost:${MQTT_PORT}`);
  console.log('========================================');
  console.log('  按 Ctrl+C 停止');
  console.log('========================================');
});

httpServer.listen(WS_PORT, () => {
  console.log('  WebSocket 已就绪');
});

mqttServer.on('error', (err) => {
  console.error('[TCP] 错误:', err.message);
});

process.on('SIGINT', () => {
  console.log('\n正在关闭...');
  mqttServer.close();
  httpServer.close();
  process.exit(0);
});
