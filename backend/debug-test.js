console.log('开始测试...');

try {
  const mqtt = require('mqtt');
  console.log('MQTT 模块已加载');
  console.log('尝试连接到 mqtt://localhost:1884...');
  
  const client = mqtt.connect('mqtt://localhost:1884');
  console.log('Client 对象已创建');
  
  client.on('connect', function() {
    console.log('✅ MQTT 连接成功！');
    client.end();
    process.exit(0);
  });
  
  client.on('error', function(err) {
    console.error('❌ MQTT 连接错误:', err.message);
    client.end();
    process.exit(1);
  });
  
  client.on('offline', function() {
    console.log('⚠️ 连接离线');
  });
  
  setTimeout(function() {
    console.log('❌ 3秒超时，连接失败');
    client.end();
    process.exit(1);
  }, 3000);
  
} catch (e) {
  console.error('❌ 捕获到异常:', e.message);
  process.exit(1);
}
