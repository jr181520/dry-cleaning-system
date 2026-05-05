const net = require('net');

console.log('=== TCP 连接测试 ===');
console.log('测试端口: 1884 (MQTT)');
console.log('');

// 测试 TCP 连接
const socket = net.createConnection(1884, 'localhost', () => {
  console.log('✅ TCP 连接成功！');
  console.log('端口 1884 正在响应');
  
  // 发送 MQTT CONNECT 握手包
  const mqttConnect = Buffer.from([
    0x10, 0x10,  // MQTT CONNECT 报文 (固定头)
    0x00, 0x04,  // 协议名长度
    0x4D, 0x51, 0x49, 0x73,  // "MQIs"
    0x73,        // 协议级别 (3.1.1)
    0x02,        // 连接标志
    0x00, 0x3C,  // 保活时间 60秒
    0x00, 0x08,  // 客户端ID长度
    0x74, 0x65, 0x73, 0x74, 0x5F, 0x63, 0x6C, 0x69  // "test_cli"
  ]);
  
  socket.write(mqttConnect);
  console.log('已发送 MQTT CONNECT 握手包');
  
  socket.on('data', (data) => {
    console.log('收到响应:', data);
    if (data[0] === 0x20 && data[1] >= 2) {
      const returnCode = data[3];
      if (returnCode === 0) {
        console.log('✅ MQTT 连接被接受！');
      } else {
        console.log('❌ MQTT 连接被拒绝，返回码:', returnCode);
      }
    }
    
    socket.end();
    process.exit(0);
  });
  
  socket.on('error', (err) => {
    console.log('❌ Socket 错误:', err.message);
    process.exit(1);
  });
  
  setTimeout(() => {
    console.log('❌ 5秒超时');
    socket.end();
    process.exit(1);
  }, 5000);
});

socket.on('error', (err) => {
  console.log('❌ 无法连接到端口 1884');
  console.log('错误:', err.message);
  console.log('');
  console.log('提示: MQTT Broker 可能未启动');
  console.log('请运行: node backend/start-mqtt-broker.js');
  process.exit(1);
});
