/**
 * 干洗店取件系统 API
 * 基于 Express.js 的后端接口
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 模拟数据库
const db = {
  orders: [
    {
      id: 'ORD-2025-001',
      code: 'P000123456',
      storeId: 'ST001',
      customerName: '张三',
      customerPhone: '138****1234',
      items: [
        { id: '1', name: '西装', quantity: 1, price: 80 },
        { id: '2', name: '衬衫', quantity: 2, price: 60 }
      ],
      totalPrice: 200,
      status: 'ready',
      location: 'A1',
      createdAt: '2025-04-19T10:30:00Z',
      updatedAt: '2025-04-19T14:00:00Z'
    },
    {
      id: 'ORD-2025-002',
      code: 'P000234567',
      storeId: 'ST001',
      customerName: '李四',
      customerPhone: '139****5678',
      items: [
        { id: '3', name: '外套', quantity: 1, price: 120 }
      ],
      totalPrice: 120,
      status: 'processing',
      location: 'B2',
      createdAt: '2025-04-18T09:15:00Z',
      updatedAt: '2025-04-19T08:00:00Z'
    }
  ],
  pickupRecords: [],
  members: []
};

// 生成取件码
function generatePickupCode() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `P${timestamp.toString().slice(-6)}${random}`;
}

// ========== API 路由 ==========

// 首页 - 获取待取件订单
app.get('/api/orders/pending', (req, res) => {
  const pendingOrders = db.orders.filter(order => order.status === 'ready');
  res.json({
    success: true,
    data: pendingOrders.map(order => ({
      id: order.id,
      orderId: order.id,
      time: new Date(order.updatedAt).toLocaleString('zh-CN'),
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0)
    }))
  });
});

// 获取订单列表
app.get('/api/orders/list', (req, res) => {
  const { status, page = 1, pageSize = 10 } = req.query;
  
  let orders = [...db.orders];
  
  // 状态筛选
  if (status && status !== 'all') {
    orders = orders.filter(order => order.status === status);
  }
  
  // 分页
  const start = (page - 1) * pageSize;
  const end = start + parseInt(pageSize);
  orders = orders.slice(start, end);
  
  // 状态文本映射
  const statusMap = {
    pending: '待处理',
    processing: '处理中',
    ready: '待取件',
    completed: '已完成',
    cancelled: '已取消'
  };
  
  res.json({
    success: true,
    data: orders.map(order => ({
      id: order.id,
      storeName: '干洗店',
      status: order.status,
      statusText: statusMap[order.status] || order.status,
      items: order.items,
      totalCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      totalPrice: order.totalPrice,
      createdAt: new Date(order.createdAt).toLocaleString('zh-CN')
    }))
  });
});

// 验证取件码
app.post('/api/pickup/verify', (req, res) => {
  const { code } = req.body;
  
  if (!code) {
    return res.json({
      success: false,
      message: '取件码不能为空'
    });
  }
  
  const order = db.orders.find(o => o.code === code && o.status === 'ready');
  
  if (order) {
    res.json({
      success: true,
      message: '取件码验证成功',
      order: {
        id: order.id,
        code: order.code,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        location: order.location,
        items: order.items,
        totalPrice: order.totalPrice
      }
    });
  } else {
    res.json({
      success: false,
      message: '取件码无效或已过期'
    });
  }
});

// 确认取件
app.post('/api/pickup/confirm', (req, res) => {
  const { orderId, code } = req.body;
  
  const orderIndex = db.orders.findIndex(o => o.id === orderId);
  
  if (orderIndex === -1) {
    return res.json({
      success: false,
      message: '订单不存在'
    });
  }
  
  // 更新订单状态
  db.orders[orderIndex].status = 'completed';
  db.orders[orderIndex].updatedAt = new Date().toISOString();
  
  // 记录取件
  db.pickupRecords.push({
    id: Date.now().toString(),
    orderId: orderId,
    code: code,
    pickedAt: new Date().toISOString()
  });
  
  res.json({
    success: true,
    message: '取件成功'
  });
});

// 获取会员信息
app.get('/api/member/info', (req, res) => {
  // 模拟会员数据
  res.json({
    success: true,
    data: {
      name: '黄金会员',
      points: 5800,
      balance: 320.00,
      discount: '8.5折',
      expireDate: '2026-12-31'
    }
  });
});

// 微信登录
app.post('/api/auth/login', (req, res) => {
  const { code } = req.body;
  
  if (!code) {
    return res.json({
      success: false,
      message: '授权码不能为空'
    });
  }
  
  // 模拟微信登录
  res.json({
    success: true,
    openid: 'mock_openid_' + code,
    session_key: 'mock_session_key',
    token: 'mock_token_' + Date.now()
  });
});

// 生成取件码
app.post('/api/pickup/generate', (req, res) => {
  const { orderId } = req.body;
  
  const orderIndex = db.orders.findIndex(o => o.id === orderId);
  
  if (orderIndex === -1) {
    return res.json({
      success: false,
      message: '订单不存在'
    });
  }
  
  // 生成新的取件码
  const pickupCode = generatePickupCode();
  db.orders[orderIndex].code = pickupCode;
  db.orders[orderIndex].updatedAt = new Date().toISOString();
  
  res.json({
    success: true,
    code: pickupCode,
    qrData: JSON.stringify({
      type: 'pickup',
      code: pickupCode,
      storeId: 'ST001',
      timestamp: Date.now()
    })
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`干洗店取件系统 API 服务已启动: http://localhost:${PORT}`);
  console.log('可用接口:');
  console.log('  GET  /api/orders/pending - 获取待取件订单');
  console.log('  GET  /api/orders/list    - 获取订单列表');
  console.log('  POST /api/pickup/verify  - 验证取件码');
  console.log('  POST /api/pickup/confirm - 确认取件');
  console.log('  POST /api/pickup/generate - 生成取件码');
  console.log('  GET  /api/member/info    - 获取会员信息');
  console.log('  POST /api/auth/login     - 微信登录');
});

module.exports = app;
