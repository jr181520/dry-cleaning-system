console.log('🔍 MQTT 连接诊断测试');
console.log('========================\n');

const mqtt = require('mqtt');
const os = require('os');

// 生成唯一的客户端ID
const clientId = `debug_${os.hostname()}_${Date.now()}_${Math.random().toString(16).substr(2, 6)}`;

console.log(`📋 配置信息:`);
console.log(`   Broker: mqtt://localhost:1884`);
console.log(`   ClientID: ${clientId}`);
console.log(`   Keepalive: 60秒`);
console.log(`   连接超时: 10秒\n`);

// 连接选项
const options = {
  clientId: clientId,
  keepalive: 60,
  connectTimeout: 10000,  // 10秒连接超时
  clean: true,            // 清除会话
  reconnectPeriod: 0     // 禁用自动重连，手动控制
};

console.log('⏳ 正在连接...\n');

const client = mqtt.connect('mqtt://localhost:1884', options);

client.on('connect', function(connack) {
  console.log('✅ 连接成功！');
  console.log('📦 CONNACK 响应:', connack);
  console.log('   - 返回码:', connack.returnCode);
  console.log('   - 会话存在:', connack.sessionPresent);
  
  // 测试订阅
  console.log('\n📡 测试订阅...');
  client.subscribe('test/topic', { qos: 0 }, function(err, granted) {
    if (err) {
      console.log('❌ 订阅失败:', err.message);
    } else {
      console.log('✅ 订阅成功');
      console.log('   权限:', granted);
    }
    
    // 测试发布
    console.log('\n📤 测试发布消息...');
    client.publish('test/topic', 'Hello from diagnostic', { qos: 0 }, function(err) {
      if (err) {
        console.log('❌ 发布失败:', err.message);
      } else {
        console.log('✅ 发布成功');
      }
      
      console.log('\n🔌 关闭连接...');
      client.end();
      console.log('✅ 测试完成！');
      process.exit(0);
    });
  });
});

client.on('error', function(err) {
  console.log('❌ 连接错误:');
  console.log('   - 错误类型:', err.constructor.name);
  console.log('   - 错误消息:', err.message);
  console.log('   - 错误代码:', err.code);
  console.log('   - 系统错误:', err.syscall);
  
  if (err.message.includes('timeout')) {
    console.log('\n💡 可能的原因:');
    console.log('   1. MQTT Broker 未正确启动');
    console.log('   2. 防火墙阻止了连接');
    console.log('   3. 端口配置错误');
    console.log('   4. Broker 负载过高');
  }
  
  client.end();
  process.exit(1);
});

client.on('offline', function() {
  console.log('⚠️ 连接离线');
});

client.on('reconnect', function() {
  console.log('🔄 正在重连...');
});

client.on('close', function() {
  console.log('⚠️ 连接已关闭');
});

// 10秒超时
setTimeout(function() {
  console.log('\n❌ 连接超时（10秒）');
  console.log('💡 诊断建议:');
  console.log('   1. 检查 MQTT Broker 是否运行: netstat -ano | findstr ":1884"');
  console.log('   2. 查看 Broker 日志输出');
  console.log('   3. 尝试使用 WebSocket 连接');
  console.log('   4. 检查防火墙设置');
  client.end();
  process.exit(1);
}, 10000);
