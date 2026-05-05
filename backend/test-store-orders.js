const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/admin/store/ST002/pending-orders',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('状态码:', res.statusCode);
    try {
      const result = JSON.parse(data);
      console.log('API响应:', JSON.stringify(result, null, 2));
    } catch (e) {
      console.log('响应数据:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('请求错误:', e.message);
});

req.end();
