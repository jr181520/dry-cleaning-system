const net = require('net');

const client = new net.Socket();

client.connect(1884, '127.0.0.1', () => {
  console.log('TCP 连接成功！');
  // 发送 MQTT CONNECT 包
  const buffer = Buffer.from([
    0x10, 0x10, // MQTT CONNECT 包 (固定头 + 可变头 + payload)
    0x00, 0x04, // 协议名长度
    0x4D, 0x51, 0x49, 0x73, // "MQIS"
    0x03,       // 协议级别 3.1.1
    0x02,       // Connect Flags
    0x00, 0x3C, // Keep Alive 60s
    0x00, 0x07, // Client ID 长度
    0x74, 0x65, 0x73, 0x74, 0x63, 0x6C, 0x69, // "testcli"
  ]);
  client.write(buffer);
  client.end();
});

client.on('data', (data) => {
  console.log('收到数据:', data.toString('hex'));
});

client.on('close', () => {
  console.log('连接关闭');
  process.exit(0);
});

client.on('error', (err) => {
  console.error('错误:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('超时');
  client.destroy();
  process.exit(1);
}, 3000);
