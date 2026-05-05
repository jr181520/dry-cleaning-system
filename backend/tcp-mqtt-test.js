const net = require('net');
const mqtt = require('mqtt');

console.log('🔍 步骤1: 测试 TCP 端口连接...');

const socket = net.createConnection(1884, 'localhost');

// 设置超时
socket.setTimeout(3000);

socket.on('connect', () => {
  console.log('✅ TCP 连接成功！');
  
  // 发送 MQTT CONNECT 报文
  const connectPacket = Buffer.from([
    0x10,  // 固定头: CONNECT
    0x12,  // 剩余长度
    0x00, 0x04,  // 协议名长度
    0x4D, 0x51, 0x54, 0x54,  // 协议名 "MQTT" (十六进制)
    0x04,  // 协议级别 4 (MQTT 3.1.1)
    0x02,  // 连接标志 (clean session)
    0x00, 0x3C,  // keepalive 60秒
    0x00, 0x09,  // 客户端ID长度
    0x74, 0x65, 0x73, 0x74, 0x5F, 0x63, 0x6C, 0x69, 0x65,  // "test_clie"
    0x6E,  // "n" 结尾
  ]);
  
  console.log('📤 步骤2: 发送 MQTT CONNECT 报文...');
  console.log('   报文:', connectPacket.toString('hex'));
  socket.write(connectPacket);
});

socket.on('data', (data) => {
  console.log('📥 步骤3: 收到响应:', data.toString('hex'));
  
  // 解析 CONNACK
  if (data[0] === 0x20) {  // CONNACK 报文类型
    const returnCode = data[2];
    if (returnCode === 0) {
      console.log('✅ MQTT CONNACK: 连接被接受！');
    } else {
      console.log('❌ MQTT CONNACK: 连接被拒绝，返回码:', returnCode);
    }
  }
  
  socket.end();
  process.exit(0);
});

socket.on('timeout', () => {
  console.log('❌ TCP 连接超时 - Broker 可能没有响应');
  console.log('💡 建议: 检查 Broker 日志');
  socket.destroy();
  process.exit(1);
});

socket.on('error', (err) => {
  console.log('❌ TCP 错误:', err.message);
  process.exit(1);
});
