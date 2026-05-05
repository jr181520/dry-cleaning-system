/**
 * 前端静态文件服务器 - 带API代理
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const http = require('http');

const app = express();
const PORT = process.env.FRONTEND_PORT || 8080;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

// 启用 CORS
app.use(cors({
  origin: '*',
  credentials: true
}));

// JSON解析
app.use(express.json());

// API代理 - 将 /api 请求转发到后端
app.use('/api', (req, res) => {
  const targetPath = '/api' + req.url;
  const url = BACKEND_URL + targetPath;
  console.log(`[代理] ${req.method} ${req.url} -> ${url}`);
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: targetPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: 'localhost:3000',
      origin: 'http://localhost:8080'
    }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode);
    proxyRes.headers['access-control-allow-origin'] = '*';
    Object.entries(proxyRes.headers).forEach(([key, value]) => {
      if (key !== 'transfer-encoding') {
        res.setHeader(key, value);
      }
    });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (error) => {
    console.error('[代理错误]', error);
    res.status(502).json({ success: false, error: '后端服务不可用' });
  });

  req.pipe(proxyReq);
});

// 静态文件服务
const staticPath = path.join(__dirname, '..');
app.use(express.static(staticPath));

// 首页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(staticPath, 'c-index.html'));
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║          干洗系统前端服务已启动                            ║
╠════════════════════════════════════════════════════════════╣
║  前端地址: http://localhost:${PORT}                              ║
║  后端地址: ${BACKEND_URL}                                  ║
║  API代理:  /api -> ${BACKEND_URL}/api                     ║
╠════════════════════════════════════════════════════════════╣
║  可用页面:                                              ║
║    - http://localhost:${PORT}/c-index.html (C端首页)           ║
║    - http://localhost:${PORT}/c-login.html (C端登录)           ║
║    - http://localhost:${PORT}/c-order.html (C端下单)           ║
║    - http://localhost:${PORT}/admin.html (管理后台)            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
