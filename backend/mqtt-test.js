const mqtt = require('mqtt');

console.log('=== MQTT 连接测试 ===');
console.log('目标: mqtt://localhost:1884');
console.log('');

const client = mqtt.connect('mqtt://localhost:1884', {
  clientId: 'test_' + Date.now(),
  keepalive: 10,
  timeout: 5000
});

const timeout = setTimeout(() => {
  console.log('❌ 5秒超时，连接失败');
  client.end();
  process.exit(1);
}, 5000);

client.on('connect', () => {
  clearTimeout(timeout);
  console.log('✅ MQTT 连接成功！');
  console.log('客户端ID:', client.options.clientId);
  
  // 测试订阅
  client.subscribe('test/topic', (err) => {
    if (err) {
      console.log('❌ 订阅失败:', err.message);
    } else {
      console.log('✅ 订阅成功');
    }
    
    // 测试发布
    client.publish('test/topic', 'Hello MQTT', (err) => {
      if (err) {
        console.log('❌ 发布失败:', err.message);
      } else {
        console.log('✅ 发布成功');
      }
      
      console.log('');
      console.log('=== 测试完成 ===');
      client.end();
      process.exit(0);
    });
  });
});

client.on('error', (err) => {
  clearTimeout(timeout);
  console.log('❌ 连接错误:', err.message);
  console.log('错误代码:', err.code);
  process.exit(1);
});

client.on('offline', () => {
  console.log('⚠️ 连接离线');
});
