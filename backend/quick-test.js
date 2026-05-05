const mqtt = require('mqtt');

console.log('快速测试 MQTT 连接...');

const client = mqtt.connect('mqtt://localhost:1884', {
  clientId: 'quicktest_' + Date.now(),
  timeout: 2000
});

setTimeout(() => {
  if (client.connected) {
    console.log('✅ 连接成功！');
    client.end();
    process.exit(0);
  } else {
    console.log('❌ 连接超时');
    client.end();
    process.exit(1);
  }
}, 2000);

client.on('connect', () => {
  console.log('✅ 已连接！');
});

client.on('error', (err) => {
  console.log('❌ 错误:', err.message);
  process.exit(1);
});
