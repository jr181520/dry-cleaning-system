const mqtt = require('mqtt');

console.log('尝试连接...');

const client = mqtt.connect('mqtt://localhost:1884', {
  clientId: 'test_' + Math.random().toString(16).substr(2, 8),
  keepalive: 60,
  timeout: 5000,
  clean: true
});

client.on('connect', () => {
  console.log('MQTT 连接成功！');
  client.end();
  process.exit(0);
});

client.on('error', (err) => {
  console.error('错误:', err.message);
  process.exit(1);
});

client.on('offline', () => {
  console.log('离线');
});

setTimeout(() => {
  console.log('5秒超时');
  client.end();
  process.exit(1);
}, 5000);
