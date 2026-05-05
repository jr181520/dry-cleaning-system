const mqtt = require('mqtt');

console.log('🚀 MQTT 连接快速测试');
console.log('========================\n');

// 使用标准 mqtt 库连接
const clientId = 'test_' + Math.random().toString(16).substr(2, 8);

const options = {
  clientId: clientId,
  keepalive: 60,
  connectTimeout: 8000,
  clean: true
};

console.log('配置:', options);
console.log('\n正在连接...\n');

const client = mqtt.connect('mqtt://localhost:1884', options);

const timeout = setTimeout(() => {
  console.log('❌ 8秒超时');
  console.log('可能原因:');
  console.log('  1. Broker 未处理连接请求');
  console.log('  2. 防火墙阻止响应');
  console.log('  3. 连接参数问题');
  client.end();
  process.exit(1);
}, 8000);

client.on('connect', (connack) => {
  clearTimeout(timeout);
  console.log('✅ 连接成功！');
  console.log('connack:', connack);
  client.end();
  process.exit(0);
});

client.on('error', (err) => {
  clearTimeout(timeout);
  console.log('❌ 错误:', err.message);
  console.log('code:', err.code);
  client.end();
  process.exit(1);
});

client.on('offline', () => {
  console.log('⚠️ 离线');
});

client.on('close', () => {
  console.log('⚠️ 连接关闭');
});
