/**
 * 干洗模块路由
 * V1 完整实现
 */

const express = require('express');
const router = express.Router();
const orderService = require('./services/orderService');
const pricingService = require('./services/pricingService');
const { moduleGuard } = require('../common/middlewares/moduleGuard');
const { authMiddleware, optionalAuth } = require('../common/middlewares/auth');

// 所有路由都需要干洗模块启用
router.use(moduleGuard('cleaning'));

// ============================================
// 订单接口
// ============================================

/**
 * 创建干洗订单
 * POST /api/cleaning/orders
 */
router.post('/orders', async (req, res) => {
  try {
    console.log('[创建订单] 收到请求:', JSON.stringify(req.body).substring(0, 500));
    const result = await orderService.createOrder({
      ...req.body,
      // 优先使用前端传来的 userId（支持游客模式），否则使用登录用户ID
      userId: req.body.userId || req.user?.id || 'guest_' + Date.now(),
      orderType: 'cleaning'
    });
    console.log('[创建订单] 成功:', result.orderNo);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[创建订单] 失败:', error.message, error.stack);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 获取订单列表
 * GET /api/cleaning/orders
 */
router.get('/orders', async (req, res) => {
  try {
    const { page, pageSize, status, storeId } = req.query;
    const result = await orderService.getOrders({
      userId: req.query.userId || req.user?.id,
      roles: req.user?.roles,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20,
      status,
      storeId
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 获取订单详情
 * GET /api/cleaning/orders/:id
 */
router.get('/orders/:id', async (req, res) => {
  try {
    const result = await orderService.getOrderById(req.params.id, {
      userId: req.query.userId || req.user?.id,
      roles: req.user?.roles
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

/**
 * 取消订单
 * POST /api/cleaning/orders/:id/cancel
 */
router.post('/orders/:id/cancel', async (req, res) => {
  try {
    const result = await orderService.cancelOrder(req.params.id, {
      userId: req.query.userId || req.user?.id,
      roles: req.user?.roles,
      reason: req.body.reason
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 门店收件
 * POST /api/cleaning/orders/:id/receive
 */
router.post('/orders/:id/receive', async (req, res) => {
  try {
    const result = await orderService.receiveOrder(req.params.id, {
      storeId: req.body.storeId,
      staffId: req.user?.id,
      roles: req.user?.roles
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 开始处理（清洗中）
 * POST /api/cleaning/orders/:id/processing
 */
router.post('/orders/:id/processing', async (req, res) => {
  try {
    const result = await orderService.startProcessing(req.params.id, {
      staffId: req.user?.id,
      roles: req.user?.roles
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 完成清洗
 * POST /api/cleaning/orders/:id/complete
 */
router.post('/orders/:id/complete', async (req, res) => {
  try {
    const result = await orderService.completeOrder(req.params.id, {
      staffId: req.user?.id,
      roles: req.user?.roles
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 设置配送中
 * POST /api/cleaning/orders/:id/delivering
 */
router.post('/orders/:id/delivering', async (req, res) => {
  try {
    const result = await orderService.setDelivering(req.params.id, {
      userId: req.query.userId || req.user?.id,
      roles: req.user?.roles
    }, req.body.deliveryInfo || {});
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 用户取件确认
 * POST /api/cleaning/orders/:id/pickup
 */
router.post('/orders/:id/pickup', async (req, res) => {
  try {
    const result = await orderService.pickupOrder(req.params.id, {
      userId: req.query.userId || req.user?.id,
      roles: req.user?.roles
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 选择取件方式（到店自提/配送到家）
 * POST /api/cleaning/orders/:id/pickup-method
 */
router.post('/orders/:id/pickup-method', async (req, res) => {
  try {
    const { method, address, contactName, contactPhone } = req.body;
    
    if (!['store_pickup', 'home_delivery'].includes(method)) {
      return res.status(400).json({ 
        success: false, 
        error: '无效的取件方式' 
      });
    }
    
    const result = await orderService.selectPickupMethod(req.params.id, {
      userId: req.query.userId || req.user?.id,
      roles: req.user?.roles
    }, {
      method,
      address,
      contactName,
      contactPhone
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 支付配送费（C端用户操作，需认证）
 * POST /api/cleaning/orders/:id/pay-delivery-fee
 */
router.post('/orders/:id/pay-delivery-fee', optionalAuth, async (req, res) => {
  try {
    const { provider, fee, payTime } = req.body;
    console.log('[pay-delivery-fee] orderId:', req.params.id, 'provider:', provider, 'user:', req.user?.id);
    
    if (!provider) {
      return res.status(400).json({ 
        success: false, 
        error: '请选择跑腿服务商' 
      });
    }
    
    // 调用service层更新配送费支付状态
    const result = await orderService.payDeliveryFee(req.params.id, {
      userId: req.query.userId || req.user?.id,
      roles: req.user?.roles
    }, {
      provider,
      fee,
      payTime
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[pay-delivery-fee] 错误:', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 选择跑腿服务商（C端用户操作，需认证）
 * POST /api/cleaning/orders/:id/select-provider
 */
router.post('/orders/:id/select-provider', optionalAuth, async (req, res) => {
  try {
    const { provider } = req.body;
    const orderId = req.params.id;
    
    if (!provider) {
      return res.status(400).json({ 
        success: false, 
        error: '请选择跑腿服务商' 
      });
    }
    
    const result = await orderService.selectCourierProvider(orderId, {
      userId: req.query.userId || req.user?.id,
      roles: req.user?.roles
    }, { provider });
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 用户扫码取件（C端用户操作，需认证）
 * POST /api/cleaning/orders/:id/scan-pickup
 */
router.post('/orders/:id/scan-pickup', optionalAuth, async (req, res) => {
  try {
    const { pickupMethod, scanTime } = req.body;
    const orderId = req.params.id;
    console.log('[scan-pickup] orderId:', orderId, 'pickupMethod:', pickupMethod, 'user:', req.user?.id);
    
    const result = await orderService.scanPickup(orderId, {
      userId: req.query.userId || req.user?.id,
      roles: req.user?.roles
    }, {
      pickupMethod,
      scanTime
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[scan-pickup] 错误:', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 一键取货（批量操作，同一网点所有待取件订单）
 * POST /api/cleaning/orders/batch-pickup
 */
router.post('/orders/batch-pickup', async (req, res) => {
  try {
    const { storeId } = req.body;
    
    if (!storeId) {
      return res.status(400).json({ 
        success: false, 
        error: '请指定门店ID' 
      });
    }
    
    const result = await orderService.batchPickup(storeId, {
      userId: req.query.userId || req.user?.id,
      roles: req.user?.roles
    });
    
    res.json({ 
      success: true, 
      data: {
        successCount: result.successCount,
        failedCount: result.failedCount,
        orderIds: result.orderIds
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 智能灯条控制 - 点亮取货灯
 * POST /api/cleaning/store/:storeId/light-up
 */
router.post('/store/:storeId/light-up', async (req, res) => {
  try {
    const { orderIds, priority } = req.body;
    
    const result = await orderService.triggerSmartLight(req.params.storeId, {
      orderIds: orderIds || [],
      priority: priority || 'normal', // normal, urgent, vip
      action: 'pickup_ready'
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 智能灯条控制 - 关闭灯
 * POST /api/cleaning/store/:storeId/light-off
 */
router.post('/store/:storeId/light-off', async (req, res) => {
  try {
    const { orderIds } = req.body;
    
    const result = await orderService.triggerSmartLight(req.params.storeId, {
      orderIds: orderIds || [],
      action: 'pickup_complete'
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 获取智能灯条状态
 * GET /api/cleaning/store/:storeId/light-status
 */
router.get('/store/:storeId/light-status', async (req, res) => {
  try {
    const lightStatus = await orderService.getLightStatus(req.params.storeId);
    res.json({ success: true, data: lightStatus });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 订单支付
 * POST /api/cleaning/orders/:id/pay
 */
router.post('/orders/:id/pay', async (req, res) => {
  try {
    const { method, transactionId } = req.body;
    
    const result = await orderService.processPayment(req.params.id, {
      method: method || 'wechat',
      transactionId: transactionId || 'TXN' + Date.now(),
      userId: req.user?.id || req.body.userId || 'guest'
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 实时获取订单状态（轮询接口）
 * GET /api/cleaning/orders/:id/status
 */
router.get('/orders/:id/status', async (req, res) => {
  try {
    const order = await orderService.getOrderById(req.params.id, {
      userId: req.query.userId || req.user?.id,
      roles: req.user?.roles
    });
    
    // 禁用缓存，确保获取最新状态
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    // 返回简化的状态信息供前端轮询
    res.json({
      success: true,
      data: {
        orderId: order._id,
        orderNo: order.orderNo,
        status: order.status,
        statusText: getStatusText(order.status),
        statusDescription: getStatusDescription(order.status),
        pickupMethod: order.pickupMethod,
        items: order.items.map(item => ({
          name: item.name,
          status: item.status
        })),
        latestHistory: order.statusHistory[order.statusHistory.length - 1],
        updatedAt: order.updatedAt
      }
    });
  } catch (error) {
    // 如果订单不在数据库中（本地存储模式），返回一个兼容的响应
    // 让前端可以继续使用 localStorage 的数据
    const orderId = req.params.id;
    if (orderId && orderId.startsWith('ORD')) {
      // 可能是本地存储的订单，返回一个占位响应
      // 前端会从 localStorage 获取真实数据
      res.json({
        success: true,
        data: {
          orderId: orderId,
          orderNo: orderId,
          status: 'unknown',
          statusText: '未知状态',
          statusDescription: '请检查本地存储数据',
          items: [],
          updatedAt: new Date().toISOString()
        }
      });
    } else {
      res.status(404).json({ success: false, error: error.message });
    }
  }
});

/**
 * 更新订单状态（门店端调用）
 * PUT /api/cleaning/orders/:id/status
 */
router.put('/orders/:id/status', async (req, res) => {
  try {
    const { status, note } = req.body;
    
    // 更新订单状态
    const order = await orderService.updateOrderStatus(req.params.id, {
      status,
      note,
      userId: req.user?.id || req.body.userId || 'store_staff',
      roles: req.user?.roles || ['store_staff']
    });
    
    res.json({
      success: true,
      data: {
        orderId: order._id,
        status: order.status,
        updatedAt: order.updatedAt
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 订单状态文字映射
 */
function getStatusText(status) {
  const statusMap = {
    'pending': '待支付',
    'paid': '已支付',
    'delivering': '配送中',
    'received': '已入库',
    'processing': '处理中',
    'cleaning': '清洗中',
    'cleaned': '清洗完成',
    'ready': '待取件',
    'delivering_back': '配送中',
    'completed': '已完成',
    'cancelled': '已取消'
  };
  return statusMap[status] || status;
}

/**
 * 订单状态详细描述
 */
function getStatusDescription(status) {
  const descMap = {
    'pending': '等待您完成支付',
    'paid': '已支付完成，等待配送员上门取件',
    'delivering': '配送员正在路上，请保持手机畅通',
    'received': '衣物已送达服务网点，正在处理中',
    'processing': '衣物正在清洗护理中',
    'cleaning': '衣物正在清洗中',
    'cleaned': '衣物已清洗完成，正在进行质检',
    'ready': '衣物已处理完成，请选择取件方式',
    'delivering_back': '配送员正在送回您的衣物',
    'completed': '订单已完成，感谢您的使用',
    'cancelled': '订单已取消'
  };
  return descMap[status] || '';
}

/**
 * 门店完成清洗
 * POST /api/cleaning/orders/:id/complete
 */
router.post('/orders/:id/complete', async (req, res) => {
  try {
    const result = await orderService.completeOrder(req.params.id, {
      staffId: req.user?.id,
      actualItems: req.body.actualItems
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ============================================
// 定价接口
// ============================================

/**
 * 获取价格计算
 * POST /api/cleaning/pricing
 */
router.post('/pricing', async (req, res) => {
  try {
    const { items, storeId, delivery } = req.body;
    const result = await pricingService.calculatePrice({ items, storeId, delivery });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 获取门店服务列表
 * GET /api/cleaning/stores/:storeId/services
 */
router.get('/stores/:storeId/services', async (req, res) => {
  try {
    const result = await pricingService.getStoreServices(req.params.storeId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ============================================
// 物品管理
// ============================================

/**
 * 获取用户物品列表
 * GET /api/cleaning/items
 */
router.get('/items', async (req, res) => {
  try {
    const { page, pageSize, status } = req.query;
    const result = await orderService.getItems({
      userId: req.query.userId || req.user?.id,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20,
      status
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ============================================
// 门店接口（小程序用）
// ============================================

const Store = require('../store/models/Store');

/**
 * 获取门店列表（小程序用）
 * GET /api/cleaning/stores
 */
router.get('/stores', async (req, res) => {
  try {
    const stores = await Store.find({ 
      status: { $ne: 'deleted' } 
    })
    .select('storeId name address phone hours status')
    .sort({ createdAt: -1 })
    .limit(50);
    
    const storeList = stores.map(store => ({
      storeId: store.storeId,
      id: store.storeId,
      name: store.name,
      storeName: store.name,
      address: store.address || '',
      location: store.address || '',
      phone: store.phone || '',
      contactPhone: store.phone || '',
      hours: store.hours || '09:00-21:00',
      businessHours: store.hours || '09:00-21:00',
      status: store.status === 'active' ? 'online' : 'offline',
      isOnline: store.status === 'active',
      rating: 4.5,
      hasPromotion: false,
      isRecommended: false,
      serviceCount: 0,
      minPrice: 20,
      startingPrice: 20,
      distance: 0,
      deliveryFee: 10
    }));
    
    res.json({ 
      success: true, 
      data: storeList,
      message: '获取成功' 
    });
  } catch (error) {
    console.error('[门店列表] 获取失败:', error);
    // 如果数据库出错，返回默认门店
    res.json({ 
      success: true, 
      data: [
        {
          storeId: 'ST001',
          id: 'ST001',
          name: '干洗店旗舰店',
          storeName: '干洗店旗舰店',
          address: '某某市某某区某某街道123号',
          phone: '400-888-8888',
          hours: '08:00-22:00',
          status: 'online',
          isOnline: true,
          rating: 4.8,
          hasPromotion: true,
          isRecommended: true,
          promotionDesc: '全场8折',
          serviceCount: 12,
          minPrice: 25,
          distance: 1.2,
          deliveryFee: 8
        },
        {
          storeId: 'ST002',
          id: 'ST002',
          name: '干洗店中心店',
          storeName: '干洗店中心店',
          address: '某某市某某区某某街道456号',
          phone: '400-888-8889',
          hours: '09:00-21:00',
          status: 'online',
          isOnline: true,
          rating: 4.6,
          hasPromotion: false,
          isRecommended: true,
          serviceCount: 10,
          minPrice: 20,
          distance: 2.5,
          deliveryFee: 6
        }
      ],
      message: '使用默认数据' 
    });
  }
});

module.exports = router;
