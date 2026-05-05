/**
 * 干洗店聚合配送系统 API
 * 基于 Express.js 的后端接口
 * 支持美团跑腿、京东秒送、顺丰跑腿三家聚合配送
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const aggregator = require('./aggregator');
const config = require('./config');

const app = express();
const PORT = config.server.port;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 模拟数据存储
let deliveries = [
  {
    id: 'D001',
    orderId: 'ORD-2025-001',
    customerName: '张三',
    customerPhone: '13800138001',
    pickupAddress: '北京市朝阳区建国路88号',
    dropoffAddress: '北京市朝阳区望京SOHO',
    status: 'pending',
    driverId: null,
    driverName: null,
    driverPhone: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// ==================== 聚合配送 API ====================

/**
 * 获取可用配送服务商列表
 */
app.get('/api/delivery/providers', (req, res) => {
  const providers = aggregator.getAvailableProviders();
  res.json({
    success: true,
    data: providers
  });
});

/**
 * 询价接口 - 查询多家服务商的配送价格
 * GET /api/delivery/query?pickupAddress=xxx&dropoffAddress=xxx&weight=1
 */
app.get('/api/delivery/query', async (req, res) => {
  const { pickupAddress, dropoffAddress, weight = 1, cityName = '北京', distance } = req.query;

  if (!pickupAddress || !dropoffAddress) {
    return res.json({
      success: false,
      message: '缺少必要参数：pickupAddress, dropoffAddress'
    });
  }

  try {
    const result = await aggregator.queryPrices({
      pickupAddress,
      dropoffAddress,
      weight: parseFloat(weight),
      cityName,
      distance
    });

    res.json(result);
  } catch (error) {
    res.json({
      success: false,
      message: '询价失败',
      error: error.message
    });
  }
});

/**
 * 创建配送订单
 * POST /api/delivery/create
 */
app.post('/api/delivery/create', async (req, res) => {
  const {
    pickupAddress,
    dropoffAddress,
    customerName,
    customerPhone,
    shopName,
    shopPhone,
    goodsDesc,
    weight = 1,
    orderId,
    cityName,
    provider // 可选：指定服务商
  } = req.body;

  // 参数验证
  if (!pickupAddress || !dropoffAddress || !customerName || !customerPhone) {
    return res.json({
      success: false,
      message: '缺少必要参数'
    });
  }

  try {
    const result = await aggregator.createOrder({
      pickupAddress,
      dropoffAddress,
      customerName,
      customerPhone,
      shopName,
      shopPhone,
      goodsDesc,
      weight: parseFloat(weight),
      orderId,
      cityName
    }, provider);

    if (result.success) {
      // 保存到本地记录
      const delivery = {
        id: result.platformOrderId,
        orderId: result.orderId,
        provider: result.provider,
        providerName: result.providerName,
        customerName,
        customerPhone,
        pickupAddress,
        dropoffAddress,
        status: result.status,
        price: result.price,
        platformOrderId: result.platformOrderId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      deliveries.push(delivery);
    }

    res.json(result);
  } catch (error) {
    res.json({
      success: false,
      message: '创建配送订单失败',
      error: error.message
    });
  }
});

/**
 * 查询配送订单状态
 * GET /api/delivery/:provider/:orderId
 */
app.get('/api/delivery/:provider/:orderId', async (req, res) => {
  const { provider, orderId } = req.params;

  try {
    const result = await aggregator.queryOrder(provider, orderId);
    res.json(result);
  } catch (error) {
    res.json({
      success: false,
      message: '查询订单状态失败',
      error: error.message
    });
  }
});

/**
 * 取消配送订单
 * POST /api/delivery/:provider/:orderId/cancel
 */
app.post('/api/delivery/:provider/:orderId/cancel', async (req, res) => {
  const { provider, orderId } = req.params;
  const { reason } = req.body;

  try {
    const result = await aggregator.cancelOrder(provider, orderId, reason);

    // 更新本地记录
    const index = deliveries.findIndex(d => d.platformOrderId === orderId);
    if (index !== -1) {
      deliveries[index].status = 'cancelled';
      deliveries[index].updatedAt = new Date().toISOString();
    }

    res.json(result);
  } catch (error) {
    res.json({
      success: false,
      message: '取消配送订单失败',
      error: error.message
    });
  }
});

// ==================== 原有 API 保持兼容 ====================

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    providers: aggregator.getAvailableProviders()
  });
});

// 获取所有配送订单
app.get('/api/deliveries', (req, res) => {
  res.json({
    success: true,
    data: deliveries
  });
});

// 获取单个配送订单
app.get('/api/deliveries/:id', (req, res) => {
  const { id } = req.params;
  const delivery = deliveries.find(d => d.id === id);

  if (delivery) {
    res.json({
      success: true,
      data: delivery
    });
  } else {
    res.json({
      success: false,
      message: '配送订单不存在'
    });
  }
});

// 创建新的配送订单（兼容旧接口）
app.post('/api/deliveries', (req, res) => {
  const { orderId, customerName, customerPhone, pickupAddress, dropoffAddress, provider } = req.body;

  if (!orderId || !customerName || !customerPhone || !pickupAddress || !dropoffAddress) {
    return res.json({
      success: false,
      message: '缺少必要参数'
    });
  }

  // 使用聚合配送创建订单
  aggregator.createOrder({
    pickupAddress,
    dropoffAddress,
    customerName,
    customerPhone,
    orderId,
    shopName: '干洗店'
  }, provider).then(result => {
    if (result.success) {
      const delivery = {
        id: result.platformOrderId,
        orderId,
        provider: result.provider,
        customerName,
        customerPhone,
        pickupAddress,
        dropoffAddress,
        status: result.status,
        price: result.price,
        platformOrderId: result.platformOrderId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      deliveries.push(delivery);
    }
    res.json(result);
  }).catch(error => {
    res.json({
      success: false,
      message: '创建配送订单失败',
      error: error.message
    });
  });
});

// 更新配送订单状态
app.put('/api/deliveries/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const deliveryIndex = deliveries.findIndex(d => d.id === id);

  if (deliveryIndex === -1) {
    return res.json({
      success: false,
      message: '配送订单不存在'
    });
  }

  deliveries[deliveryIndex].status = status;
  deliveries[deliveryIndex].updatedAt = new Date().toISOString();

  res.json({
    success: true,
    data: deliveries[deliveryIndex]
  });
});

// 取消配送（兼容旧接口）
app.post('/api/deliveries/:id/cancel', (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const deliveryIndex = deliveries.findIndex(d => d.id === id);

  if (deliveryIndex === -1) {
    return res.json({
      success: false,
      message: '配送订单不存在'
    });
  }

  const delivery = deliveries[deliveryIndex];

  // 如果有平台订单号，调用平台取消接口
  if (delivery.platformOrderId && delivery.provider) {
    aggregator.cancelOrder(delivery.provider, delivery.platformOrderId, reason)
      .then(result => {
        delivery.status = 'cancelled';
        delivery.updatedAt = new Date().toISOString();
        res.json(result);
      })
      .catch(error => {
        res.json({
          success: false,
          message: '取消失败',
          error: error.message
        });
      });
  } else {
    delivery.status = 'cancelled';
    delivery.updatedAt = new Date().toISOString();
    res.json({
      success: true,
      data: delivery
    });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  聚合配送API服务器已启动`);
  console.log(`  端口: http://localhost:${PORT}`);
  console.log(`========================================`);
  console.log(`\n可用配送服务商:`);
  aggregator.getAvailableProviders().forEach(p => {
    console.log(`  - ${p.displayName} (${p.name})`);
  });
  console.log(`\n接口列表:`);
  console.log(`  GET  /api/health                    - 健康检查`);
  console.log(`  GET  /api/delivery/providers        - 获取可用服务商`);
  console.log(`  GET  /api/delivery/query           - 询价接口`);
  console.log(`  POST /api/delivery/create          - 创建配送订单`);
  console.log(`  GET  /api/delivery/:provider/:id   - 查询订单状态`);
  console.log(`  POST /api/delivery/:provider/:id/cancel - 取消订单`);
  console.log(`\n兼容接口:`);
  console.log(`  GET  /api/deliveries               - 获取所有配送订单`);
  console.log(`  POST /api/deliveries               - 创建配送订单`);
  console.log(`  PUT  /api/deliveries/:id           - 更新订单状态`);
  console.log(`  POST /api/deliveries/:id/cancel    - 取消订单`);
  console.log(`========================================\n`);
});

module.exports = app;
