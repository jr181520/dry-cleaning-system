/**
 * 数据同步平台系统
 * 用于C端用户页面与微信小程序之间的数据同步
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3002;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 模拟数据库
let syncData = {
  users: [
    {
      id: 'U001',
      openId: 'o123456789',
      name: '张三',
      phone: '13800138001',
      address: '北京市朝阳区建国路88号',
      memberLevel: 'gold',
      points: 1200,
      createdAt: new Date().toISOString()
    },
    {
      id: 'U002',
      openId: 'o987654321',
      name: '李四',
      phone: '13900139001',
      address: '上海市浦东新区陆家嘴',
      memberLevel: 'silver',
      points: 800,
      createdAt: new Date().toISOString()
    }
  ],
  orders: [
    {
      id: 'ORD-2025-001',
      userId: 'U001',
      items: [
        { id: 'I001', name: '西装', quantity: 1, price: 50 },
        { id: 'I002', name: '衬衫', quantity: 2, price: 30 }
      ],
      totalAmount: 110,
      status: 'completed', // pending, processing, completed, cancelled
      pickupCode: 'P000123456',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'ORD-2025-002',
      userId: 'U002',
      items: [
        { id: 'I003', name: '羽绒服', quantity: 1, price: 80 },
        { id: 'I004', name: '毛衣', quantity: 1, price: 40 }
      ],
      totalAmount: 120,
      status: 'processing',
      pickupCode: 'P000234567',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  deliveries: [
    {
      id: 'D001',
      orderId: 'ORD-2025-001',
      userId: 'U001',
      status: 'delivered',
      driverId: 'DR001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]
};

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 获取用户信息
app.get('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const user = syncData.users.find(u => u.id === id || u.openId === id);
  
  if (user) {
    res.json({
      success: true,
      data: user
    });
  } else {
    res.json({
      success: false,
      message: '用户不存在'
    });
  }
});

// 获取用户订单
app.get('/api/users/:id/orders', (req, res) => {
  const { id } = req.params;
  const orders = syncData.orders.filter(o => o.userId === id);
  
  res.json({
    success: true,
    data: orders
  });
});

// 获取订单详情
app.get('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const order = syncData.orders.find(o => o.id === id);
  
  if (order) {
    res.json({
      success: true,
      data: order
    });
  } else {
    res.json({
      success: false,
      message: '订单不存在'
    });
  }
});

// 创建新订单
app.post('/api/orders', (req, res) => {
  const { userId, items, totalAmount } = req.body;
  
  if (!userId || !items || !totalAmount) {
    return res.json({
      success: false,
      message: '缺少必要参数'
    });
  }
  
  const newOrder = {
    id: 'ORD-' + new Date().getFullYear() + '-' + String(syncData.orders.length + 1).padStart(3, '0'),
    userId,
    items,
    totalAmount,
    status: 'pending',
    pickupCode: 'P' + Date.now().toString().slice(-10),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  syncData.orders.push(newOrder);
  
  res.json({
    success: true,
    data: newOrder
  });
});

// 更新订单状态
app.put('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  const orderIndex = syncData.orders.findIndex(o => o.id === id);
  
  if (orderIndex === -1) {
    return res.json({
      success: false,
      message: '订单不存在'
    });
  }
  
  syncData.orders[orderIndex].status = status;
  syncData.orders[orderIndex].updatedAt = new Date().toISOString();
  
  res.json({
    success: true,
    data: syncData.orders[orderIndex]
  });
});

// 获取配送信息
app.get('/api/orders/:id/delivery', (req, res) => {
  const { id } = req.params;
  const delivery = syncData.deliveries.find(d => d.orderId === id);
  
  if (delivery) {
    res.json({
      success: true,
      data: delivery
    });
  } else {
    res.json({
      success: false,
      message: '配送信息不存在'
    });
  }
});

// 创建配送订单
app.post('/api/deliveries', (req, res) => {
  const { orderId, userId, status, driverId } = req.body;
  
  if (!orderId || !userId) {
    return res.json({
      success: false,
      message: '缺少必要参数'
    });
  }
  
  const newDelivery = {
    id: 'D' + Date.now().toString().slice(-6),
    orderId,
    userId,
    status: status || 'pending',
    driverId: driverId || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  syncData.deliveries.push(newDelivery);
  
  res.json({
    success: true,
    data: newDelivery
  });
});

// 更新配送状态
app.put('/api/deliveries/:id', (req, res) => {
  const { id } = req.params;
  const { status, driverId } = req.body;
  
  const deliveryIndex = syncData.deliveries.findIndex(d => d.id === id);
  
  if (deliveryIndex === -1) {
    return res.json({
      success: false,
      message: '配送订单不存在'
    });
  }
  
  syncData.deliveries[deliveryIndex].status = status;
  
  if (driverId) {
    syncData.deliveries[deliveryIndex].driverId = driverId;
  }
  
  syncData.deliveries[deliveryIndex].updatedAt = new Date().toISOString();
  
  res.json({
    success: true,
    data: syncData.deliveries[deliveryIndex]
  });
});

// 同步数据到微信小程序
app.post('/api/sync/wechat', (req, res) => {
  const { openId, dataType } = req.body;
  
  if (!openId) {
    return res.json({
      success: false,
      message: '缺少openId参数'
    });
  }
  
  const user = syncData.users.find(u => u.openId === openId);
  
  if (!user) {
    return res.json({
      success: false,
      message: '用户不存在'
    });
  }
  
  let syncResult = {};
  
  if (!dataType || dataType === 'all') {
    syncResult = {
      user,
      orders: syncData.orders.filter(o => o.userId === user.id),
      deliveries: syncData.deliveries.filter(d => d.userId === user.id)
    };
  } else if (dataType === 'orders') {
    syncResult = {
      orders: syncData.orders.filter(o => o.userId === user.id)
    };
  } else if (dataType === 'deliveries') {
    syncResult = {
      deliveries: syncData.deliveries.filter(d => d.userId === user.id)
    };
  }
  
  res.json({
    success: true,
    data: syncResult
  });
});

// 同步数据到C端用户页面
app.post('/api/sync/c端', (req, res) => {
  const { userId, dataType } = req.body;
  
  if (!userId) {
    return res.json({
      success: false,
      message: '缺少userId参数'
    });
  }
  
  const user = syncData.users.find(u => u.id === userId);
  
  if (!user) {
    return res.json({
      success: false,
      message: '用户不存在'
    });
  }
  
  let syncResult = {};
  
  if (!dataType || dataType === 'all') {
    syncResult = {
      user,
      orders: syncData.orders.filter(o => o.userId === user.id),
      deliveries: syncData.deliveries.filter(d => d.userId === user.id)
    };
  } else if (dataType === 'orders') {
    syncResult = {
      orders: syncData.orders.filter(o => o.userId === user.id)
    };
  } else if (dataType === 'deliveries') {
    syncResult = {
      deliveries: syncData.deliveries.filter(d => d.userId === user.id)
    };
  }
  
  res.json({
    success: true,
    data: syncResult
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`数据同步平台系统运行在 http://localhost:${PORT}`);
  console.log('接口列表:');
  console.log('  GET  /api/health              - 健康检查');
  console.log('  GET  /api/users/:id           - 获取用户信息');
  console.log('  GET  /api/users/:id/orders    - 获取用户订单');
  console.log('  GET  /api/orders/:id          - 获取订单详情');
  console.log('  POST /api/orders              - 创建新订单');
  console.log('  PUT  /api/orders/:id          - 更新订单状态');
  console.log('  GET  /api/orders/:id/delivery - 获取配送信息');
  console.log('  POST /api/deliveries          - 创建配送订单');
  console.log('  PUT  /api/deliveries/:id      - 更新配送状态');
  console.log('  POST /api/sync/wechat         - 同步数据到微信小程序');
  console.log('  POST /api/sync/c端            - 同步数据到C端用户页面');
});

module.exports = app;