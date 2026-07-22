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
    
    // 统一用户标识：优先使用openid，其次使用userId
    const userId = req.body.openid || req.body.userId || req.user?.id || 'guest_' + Date.now();
    
    const result = await orderService.createOrder({
      ...req.body,
      userId: userId  // 统一使用userId存储
    });
    
    console.log('[创建订单] 成功:', result.orderNo, '用户ID:', userId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[创建订单] 失败:', error.message, error.stack);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 获取订单列表
 * GET /api/cleaning/orders
 * 支持通过JWT token或查询参数识别用户，实现跨平台数据同步
 */
router.get('/orders', optionalAuth, async (req, res) => {
  try {
    const { page, pageSize, status, storeId, userId, openid, phone } = req.query;
    
    // 用户识别优先级：JWT token用户 > 查询参数userId > 查询参数openid > 查询参数phone
    let queryUserId = userId || openid || null;
    
    // 如果JWT中有用户信息，优先使用（包括openid用于跨平台匹配）
    if (req.user?.id) {
      queryUserId = req.user.id;
    }
    
    // 支持通过手机号查询关联订单
    if (!queryUserId && phone) {
      queryUserId = phone;
    }
    
    const result = await orderService.getOrders({
      userId: queryUserId,
      roles: req.user?.roles || (queryUserId || phone ? ['customer'] : []), // 有用户标识才给客户角色
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20,
      status,
      storeId,
      customerPhone: phone || null  // 支持按手机号跨平台查询
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[订单列表] 查询失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 根据订单号/订单编号搜索订单（门店端手动搜索用）
 * GET /api/cleaning/orders/search/:keyword?storeId=ST001
 * 必须定义在 /orders/:id 之前，避免 :keyword 被 :id 捕获
 */
router.get('/orders/search/:keyword', async (req, res) => {
  try {
    const { keyword } = req.params;
    const { storeId } = req.query;
    const mongoose = require('mongoose');
    const Order = mongoose.models.Order;
    if (!Order) {
      return res.json({ success: true, data: { found: false, message: '订单模型不可用' } });
    }

    const filter = {
      $or: [
        { orderNo: keyword },
        { _id: mongoose.Types.ObjectId.isValid(keyword) ? new mongoose.Types.ObjectId(keyword) : null }
      ].filter(c => c._id !== null || c.orderNo)
    };
    if (storeId) filter.storeId = storeId;

    const order = await Order.findOne(filter);
    if (!order) {
      return res.json({ success: true, data: { found: false, message: '未找到该订单' } });
    }

    res.json({
      success: true,
      data: {
        found: true,
        orderId: order._id.toString(),
        orderNo: order.orderNo,
        storeId: order.storeId,
        status: order.status,
        items: order.items.map((item, idx) => ({
          index: idx,
          name: item.name,
          barcode: item.barcode,
          status: item.status,
          itemType: item.itemType,
          price: item.price
        })),
        customer: {
          name: order.customerName || order.contactName || '',
          phone: order.customerPhone || order.contactPhone || ''
        },
        amounts: order.amounts,
        delivery: order.delivery,
        createdAt: order.createdAt
      }
    });
  } catch (error) {
    console.error('[订单搜索] 错误:', error);
    res.status(500).json({ success: false, error: error.message });
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
router.post('/orders/:id/cancel', optionalAuth, async (req, res) => {
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
 * 删除订单记录（软删除）
 * POST /api/cleaning/orders/:id/delete
 */
router.post('/orders/:id/delete', optionalAuth, async (req, res) => {
  try {
    const result = await orderService.deleteOrder(req.params.id, {
      userId: req.query.userId || req.user?.id,
      roles: req.user?.roles
    });
    res.json({ success: true, data: { orderId: result._id, orderNo: result.orderNo, status: result.status, isDeleted: result.isDeleted } });
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
        deliveryMethod: order.deliveryMethod,          // courier | store_pickup
        deliveryType: order.delivery?.type,             // pickup | delivery（配送方向）
        selectedProvider: order.selectedProvider,        // 已选跑腿服务商
        courier: order.courier ? {                      // 骑手状态（跑腿配送的核心数据）
          provider: order.courier.provider,
          name: order.courier.name,
          phone: order.courier.phone,
          status: order.courier.status,                 // awaiting_store_outbound | picking | delivering | delivered
          progress: order.courier.progress,
          distance: order.courier.distance,
          eta: order.courier.eta,
          assignedAt: order.courier.assignedAt
        } : null,
        deliveryStatus: order.deliveryStatus,
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
    const { status, note, items } = req.body;
    
    // 更新订单状态（含物品数据）
    const order = await orderService.updateOrderStatus(req.params.id, {
      status,
      note,
      items,
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

/**
 * 店面配置同步（服务类别/价格/促销）
 * POST /api/cleaning/store-config
 * GET  /api/cleaning/store-config/:storeId
 */
router.post('/store-config', async (req, res) => {
  try {
    const { storeId, categories, services, promotions, updatedAt } = req.body;
    if (!storeId) return res.status(400).json({ success: false, error: '缺少storeId' });
    // 存储到文件（简单持久化，后续可升级为数据库）
    const fs = require('fs');
    const path = require('path');
    const configDir = path.join(__dirname, '..', '..', 'data', 'store-configs');
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    const configPath = path.join(configDir, storeId + '.json');
    fs.writeFileSync(configPath, JSON.stringify({
      storeId, categories, services, promotions, updatedAt,
      savedAt: new Date().toISOString()
    }, null, 2));
    res.json({ success: true, message: '配置已保存' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/store-config/:storeId', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(__dirname, '..', '..', 'data', 'store-configs', req.params.storeId + '.json');
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      res.json({ success: true, data });
    } else {
      res.json({ success: true, data: null });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取门店针对用户已选服务的实时报价（含促销折扣计算）
 * POST /api/cleaning/stores/pricing
 * Body: { selectedServices: [{name, icon, ...}] }
 * 返回每家门店匹配的服务价格 + 折扣信息，与 C端 StoreConfig 逻辑一致
 */
router.post('/stores/pricing', async (req, res) => {
  try {
    const { selectedServices, categoryId } = req.body;
    if (!selectedServices || !Array.isArray(selectedServices) || selectedServices.length === 0) {
      return res.json({ success: true, data: [], message: '未选择服务' });
    }

    const fs = require('fs');
    const path = require('path');
    const configDir = path.join(__dirname, '..', '..', 'data', 'store-configs');

    // 加载门店配置的函数
    function loadStoreConfig(storeId) {
      try {
        const configPath = path.join(configDir, storeId + '.json');
        if (fs.existsSync(configPath)) {
          return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
      } catch (e) { /* ignore */ }
      return null;
    }

    // 计算促销折扣（与 StoreConfig.calculatePromotionDiscount 逻辑一致）
    function calculatePromotionDiscount(promotions, subtotal, deliveryMethod, isFirstOrder) {
      var totalDiscount = 0;
      var appliedPromos = [];

      (promotions || []).filter(function(p) { return p.enabled !== false; }).forEach(function(promo) {
        if (promo.type === 'discount') {
          if (promo.condition === 'pickup' && deliveryMethod === 'pickup') {
            var d = Math.round(subtotal * promo.discountPercent / 100);
            totalDiscount += d;
            appliedPromos.push({ name: promo.name, amount: d });
          } else if (promo.condition === 'first_order' && isFirstOrder) {
            var d2 = Math.round(subtotal * promo.discountPercent / 100);
            totalDiscount += d2;
            appliedPromos.push({ name: promo.name, amount: d2 });
          } else if (!promo.condition) {
            var d3 = Math.round(subtotal * promo.discountPercent / 100);
            totalDiscount += d3;
            appliedPromos.push({ name: promo.name, amount: d3 });
          }
        } else if (promo.type === 'full_reduce') {
          if (subtotal >= promo.threshold) {
            totalDiscount += promo.reduce;
            appliedPromos.push({ name: promo.name, amount: promo.reduce });
          }
        }
      });

      return { totalDiscount: totalDiscount, appliedPromos: appliedPromos };
    }

    // 获取所有活跃门店（按品类过滤）
    const storeResult = await storeService.getStores({ page: 1, pageSize: 50, businessCategory: categoryId || 'cleaning' });
    const stores = storeResult.list || [];

    // 默认服务价格表（当门店无配置时兜底）
    var defaultServicePrices = {
      '西装干洗': 50, '衬衫清洗': 30, '羽绒服清洗': 80,
      '运动鞋清洗': 40, '皮鞋护理': 45, '皮包护理': 100,
      '床单被罩': 60, '沙发清洗': 120
    };

    var pricingList = stores.map(function(store) {
      var storeId = store.storeNo || store._id;
      var config = loadStoreConfig(storeId);

      // 获取门店服务价格映射
      var svcMap = {};
      if (config && config.services) {
        config.services.filter(function(s) { return s.enabled !== false; }).forEach(function(s) {
          svcMap[s.name] = s.price;
        });
      }
      // 兜底：使用默认价格表
      if (Object.keys(svcMap).length === 0) {
        svcMap = defaultServicePrices;
      }

      // 匹配用户已选服务
      var totalServicePrice = 0;
      var matchedItems = [];
      var matchCount = 0;

      selectedServices.forEach(function(selSvc) {
        var price = svcMap[selSvc.name] || selSvc.price || 0;
        totalServicePrice += price;
        matchCount++;
        matchedItems.push({
          name: selSvc.name,
          price: price,
          icon: selSvc.icon || '📦'
        });
      });

      // 计算促销折扣（门店级别，取通用/无条件促销）
      var promotionResult = { totalDiscount: 0, appliedPromos: [] };
      if (config && config.promotions) {
        // 仅计算无条件促销（不区分取送方式，门店列表阶段统一展示）
        promotionResult = calculatePromotionDiscount(
          config.promotions, totalServicePrice, 'pickup', false
        );
      }

      return {
        storeId: storeId,
        serviceTotal: totalServicePrice,
        discount: promotionResult.totalDiscount,
        finalPrice: Math.max(0, totalServicePrice - promotionResult.totalDiscount),
        matchedItems: matchedItems,
        matchCount: matchCount,
        appliedPromos: promotionResult.appliedPromos
      };
    });

    res.json({ success: true, data: pricingList, message: '报价计算完成' });
  } catch (error) {
    console.error('[门店报价] 计算失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取服务列表（小程序用）
 * GET /api/cleaning/services
 */
router.get('/services', async (req, res) => {
  try {
    // 返回标准干洗服务列表
    const services = [
      {
        id: 1,
        icon: '👔',
        name: '西装干洗',
        price: 88,
        desc: '含熨烫，3-5天取件',
        category: '正装',
        serviceType: 'dry_clean'
      },
      {
        id: 2,
        icon: '👕',
        name: '衬衫清洗',
        price: 25,
        desc: '含熨烫，2-3天取件',
        category: '日常装',
        serviceType: 'wash_iron'
      },
      {
        id: 3,
        icon: '🧥',
        name: '羽绒服清洗',
        price: 68,
        desc: '专业清洗，5-7天取件',
        category: '冬季装',
        serviceType: 'down_clean'
      },
      {
        id: 4,
        icon: '👖',
        name: '裤子清洗',
        price: 35,
        desc: '含熨烫，2-3天取件',
        category: '日常装',
        serviceType: 'wash_iron'
      },
      {
        id: 5,
        icon: '👗',
        name: '连衣裙清洗',
        price: 58,
        desc: '专业护理，3-5天取件',
        category: '礼服',
        serviceType: 'dry_clean'
      },
      {
        id: 6,
        icon: '👟',
        name: '鞋子清洗',
        price: 45,
        desc: '深度清洁，3-5天取件',
        category: '配件',
        serviceType: 'shoe_clean'
      },
      {
        id: 7,
        icon: '🧣',
        name: '围巾/帽子',
        price: 20,
        desc: '轻柔清洗，2-3天取件',
        category: '配件',
        serviceType: 'accessory_clean'
      },
      {
        id: 8,
        icon: '🛏️',
        name: '床上用品',
        price: 98,
        desc: '大件清洗，5-7天取件',
        category: '家纺',
        serviceType: 'bedding_clean'
      }
    ];
    
    res.json({ 
      success: true, 
      data: services,
      message: '获取成功' 
    });
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

const storeService = require('./services/storeService');

/**
 * 获取门店列表（小程序用）
 * GET /api/cleaning/stores
 */
router.get('/stores', async (req, res) => {
  try {
    const categoryId = req.query.categoryId || req.query.businessCategory || null;
    const storeParams = { page: 1, pageSize: 50 };
    if (categoryId) storeParams.businessCategory = categoryId;
    const result = await storeService.getStores(storeParams);
    const stores = result.list || [];

    // 加载门店配置（服务/促销信息）
    const fs = require('fs');
    const path = require('path');
    const configDir = path.join(__dirname, '..', '..', 'data', 'store-configs');
    
    function loadStoreConfig(storeId) {
      try {
        const configPath = path.join(configDir, storeId + '.json');
        if (fs.existsSync(configPath)) {
          return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
      } catch (e) { /* ignore */ }
      return null;
    }
    
    const storeList = stores.map(store => {
      const storeId = store.storeNo;
      const config = loadStoreConfig(storeId);
      
      // 从配置读取真实的服务和促销数据
      var services = config ? (config.services || []) : [];
      var enabledSvcs = services.filter(function(s) { return s.enabled !== false; });
      var enabledPromos = config ? (config.promotions || []).filter(function(p) { return p.enabled !== false; }) : [];
      var minPrice = enabledSvcs.length > 0 ? Math.min.apply(null, enabledSvcs.map(function(s) { return s.price; })) : 20;
      var hasPromotion = enabledPromos.length > 0;
      var promoDesc = hasPromotion ? enabledPromos.map(function(p) { return p.name; }).join('、') : '';
      
      return {
        storeId: storeId,
        id: storeId,
        name: store.name,
        storeName: store.name,
        address: store.address || '',
        location: store.address || '',
        phone: store.phone || '',
        contactPhone: store.phone || '',
        hours: store.businessHours || '09:00-21:00',
        businessHours: store.businessHours || '09:00-21:00',
        businessCategory: store.businessCategory || 'cleaning',
        status: store.status === 'active' ? 'online' : 'offline',
        isOnline: store.status === 'active',
        rating: store.rating || 4.5,
        hasPromotion: hasPromotion,
        isRecommended: store.isRecommended || false,
        promotionDesc: promoDesc,
        serviceCount: enabledSvcs.length,
        minPrice: minPrice,
        startingPrice: minPrice,
        distance: 0,
        deliveryFee: 10
      };
    });
    
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

/**
 * 获取门店所有订单（M端使用，无需admin权限）
 * GET /api/cleaning/store/:storeId/orders
 * storeId 支持逗号分隔多ID: /store/ST001,ST002/orders
 * 可选查询参数: categoryId, status
 */
router.get('/store/:storeId/orders', async (req, res) => {
  try {
    const { storeId } = req.params;
    const { page = 1, pageSize = 50, status, categoryId } = req.query;

    const mongoose = require('mongoose');
    const Order = mongoose.models.Order;
    if (!Order) {
      return res.json({ success: true, data: { list: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 } } });
    }

    // 支持逗号分隔的多 storeId
    const rawIds = storeId.split(',').map(s => s.trim()).filter(Boolean);
    
    // 解析ObjectId格式的storeId -> 对应的storeNo
    const resolvedIds = new Set(rawIds);
    const Store = mongoose.models.Store;
    if (Store) {
      for (const id of rawIds) {
        if (mongoose.Types.ObjectId.isValid(id)) {
          try {
            const store = await Store.findById(id).select('storeNo').lean();
            if (store && store.storeNo) {
              resolvedIds.add(store.storeNo);
            }
          } catch(e) {}
        }
      }
    }
    
    const storeIds = [...resolvedIds];
    const filter = storeIds.length > 1
      ? { storeId: { $in: storeIds } }
      : { storeId: storeIds[0] };

    if (status) filter.status = status;
    if (categoryId) filter.categoryId = categoryId;

    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip((parseInt(page) - 1) * parseInt(pageSize)).limit(parseInt(pageSize)),
      Order.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        list: orders,
        pagination: { page: parseInt(page), pageSize: parseInt(pageSize), total, totalPages: Math.ceil(total / parseInt(pageSize)) }
      }
    });
  } catch (error) {
    console.error('[门店订单] 获取失败:', error);
    res.status(500).json({ success: false, error: 'server_error', message: '获取门店订单失败' });
  }
});

/**
 * 获取商家关联的所有门店列表
 * GET /api/cleaning/merchant/stores?storeId=ST002
 * 根据门店的 ownerId 查找同一商家管理的所有门店
 * 如果 ownerId 未设置，则回退返回所有活跃门店
 */
router.get('/merchant/stores', async (req, res) => {
  try {
    const { storeId } = req.query;
    const Store = require('mongoose').models.Store;
    if (!Store) {
      return res.json({ success: true, data: [] });
    }

    let stores = [];

    if (storeId) {
      // 查找当前门店：先按 storeNo 查，再按 _id 查（兼容ObjectId格式的storeId）
      let currentStore = await Store.findOne({ storeNo: storeId }).lean();
      if (!currentStore) {
        try {
          const mongoose = require('mongoose');
          if (mongoose.Types.ObjectId.isValid(storeId)) {
            currentStore = await Store.findById(storeId).lean();
          }
        } catch(e) {}
      }

      if (currentStore && currentStore.ownerId) {
        // 查找同一 owner 的所有门店
        stores = await Store.find({
          ownerId: currentStore.ownerId,
          status: 'active'
        }).select('storeNo name businessCategory address phone status').lean();
      }

      // 如果 ownerId 未设置或未匹配到多个门店，仅返回当前门店（数据隔离）
      if (stores.length <= 1 && currentStore) {
        stores = [currentStore];
      }
    } else {
      // 无 storeId 参数时返回空数组（不应发生）
      stores = [];
    }

    // 格式化返回数据（同时包含storeNo和_id，确保前端能匹配订单中的storeId）
    const result = stores.map(s => ({
      storeId: s.storeNo || s._id.toString(),
      _id: s._id.toString(),
      storeNo: s.storeNo,
      name: s.name,
      businessCategory: s.businessCategory || 'cleaning',
      address: s.address,
      phone: s.phone
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[商家门店] 获取失败:', error);
    res.status(500).json({ success: false, error: 'server_error', message: '获取商家门店列表失败' });
  }
});

/**
 * 根据物品条码搜索订单（门店端扫码出库用）
 * GET /api/cleaning/items/barcode/:barcode?storeId=ST001
 * 返回: 匹配的物品所在订单及物品详情
 */
router.get('/items/barcode/:barcode', async (req, res) => {
  try {
    const { barcode } = req.params;
    const { storeId } = req.query;
    const mongoose = require('mongoose');
    const Order = mongoose.models.Order;
    if (!Order) {
      return res.json({ success: true, data: { found: false, message: '订单模型不可用' } });
    }

    const filter = {};
    if (storeId) filter.storeId = storeId;

    // 使用聚合管道在嵌套items数组中搜索barcode
    const orders = await Order.aggregate([
      { $match: filter },
      { $unwind: '$items' },
      { $match: { 'items.barcode': barcode } },
      { $limit: 5 }
    ]);

    if (orders.length === 0) {
      return res.json({ success: true, data: { found: false, message: '未找到匹配的物品' } });
    }

    // 返回第一个匹配结果（条码应唯一）
    const result = orders[0];
    res.json({
      success: true,
      data: {
        found: true,
        orderId: result._id.toString(),
        orderNo: result.orderNo,
        storeId: result.storeId,
        status: result.status,
        item: {
          index: result.items._index || 0,
          name: result.items.name,
          barcode: result.items.barcode,
          status: result.items.status,
          itemType: result.items.itemType,
          price: result.items.price
        },
        customer: {
          name: result.customerName || result.contactName,
          phone: result.customerPhone || result.contactPhone
        }
      }
    });
  } catch (error) {
    console.error('[条码搜索] 错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 全局搜索（跨订单/客户/物品）
// ============================================

/**
 * 全局搜索
 * GET /api/cleaning/search?keyword=xxx&storeId=xxx&type=all|order|customer|item
 */
router.get('/search', async (req, res) => {
  try {
    const { keyword, storeId, type = 'all' } = req.query;
    
    if (!keyword || keyword.trim().length === 0) {
      return res.json({ success: true, data: { orders: [], customers: [], items: [] } });
    }
    
    const mongoose = require('mongoose');
    const Order = mongoose.models.Order;
    const User = mongoose.models.User;
    
    const trimmed = keyword.trim();
    // 安全转义正则特殊字符
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const keywordRegex = new RegExp(escaped, 'i');
    const results = { orders: [], customers: [], items: [] };
    
    // ===== 搜索订单（orderNo / 客户名 / 客户电话 / 物品名 / 条码） =====
    if (type === 'all' || type === 'order') {
      const orderFilter = {
        $or: [
          { orderNo: keywordRegex },
          { 'delivery.contactName': keywordRegex },
          { 'delivery.contactPhone': keywordRegex },
          { 'items.name': keywordRegex },
          { 'items.barcode': trimmed }
        ]
      };
      if (storeId) orderFilter.storeId = storeId;
      
      try {
        const orders = await Order.find(orderFilter)
          .sort({ createdAt: -1 })
          .limit(15)
          .lean();
        
        results.orders = orders.map(o => ({
          _id: o._id,
          orderId: o._id.toString(),
          orderNo: o.orderNo,
          status: o.status,
          storeId: o.storeId,
          customerName: o.customerName || o.delivery?.contactName || '',
          customerPhone: o.customerPhone || o.delivery?.contactPhone || '',
          itemCount: (o.items || []).length,
          totalAmount: o.amounts?.total || 0,
          createdAt: o.createdAt
        }));
      } catch (e) {
        console.warn('[全局搜索] 订单搜索失败:', e.message);
      }
    }
    
    // ===== 搜索客户（姓名 / 电话） =====
    if ((type === 'all' || type === 'customer') && User) {
      try {
        const users = await User.find({
          roles: 'customer',
          $or: [
            { phone: keywordRegex },
            { 'profile.name': keywordRegex }
          ]
        })
          .limit(10)
          .lean();
        
        results.customers = users.map(u => ({
          _id: u._id,
          userId: u._id.toString(),
          name: u.profile?.name || '',
          phone: u.phone || '',
          avatar: u.profile?.avatar || ''
        }));
      } catch (e) {
        console.warn('[全局搜索] 客户搜索失败:', e.message);
      }
    }
    
    // ===== 搜索物品（从订单中按名称/条码查找） =====
    if (type === 'all' || type === 'item') {
      try {
        const itemFilter = {
          $or: [
            { 'items.name': keywordRegex },
            { 'items.barcode': trimmed }
          ]
        };
        if (storeId) itemFilter.storeId = storeId;
        
        const itemOrders = await Order.find(itemFilter)
          .sort({ createdAt: -1 })
          .limit(10)
          .lean();
        
        itemOrders.forEach(order => {
          (order.items || []).forEach(item => {
            const matchName = keywordRegex.test(item.name || '');
            const matchBarcode = item.barcode === trimmed;
            if (matchName || matchBarcode) {
              results.items.push({
                orderId: order._id.toString(),
                orderNo: order.orderNo,
                name: item.name,
                barcode: item.barcode,
                status: item.status,
                customerName: order.customerName || order.delivery?.contactName || ''
              });
            }
          });
        });
        results.items = results.items.slice(0, 15);
      } catch (e) {
        console.warn('[全局搜索] 物品搜索失败:', e.message);
      }
    }
    
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('[全局搜索] 错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 🧠 智慧大脑推荐系统
// 平台统计所有入驻门店对应服务的费用，提供综合推荐/附近推荐/价优推荐
// ============================================

/**
 * 门店智能推荐
 * POST /api/cleaning/stores/recommend
 * Body: { categoryId, serviceIds, boardingDetail?, lat?, lng? }
 * 返回: { comprehensive: [], nearby: [], bestPrice: [] }
 */
router.post('/stores/recommend', async (req, res) => {
  try {
    const { categoryId, serviceIds, boardingDetail, lat, lng } = req.body;
    
    if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
      return res.json({ success: true, data: { comprehensive: [], nearby: [], bestPrice: [] }, message: '未选择服务' });
    }

    const fs = require('fs');
    const path = require('path');
    const configDir = path.join(__dirname, '..', '..', 'data', 'store-configs');
    const categoryService = require('../common/services/categoryService');

    // 获取品类服务定义（获取系统默认价格作为兜底）
    const cat = categoryService.getCategory(categoryId || 'cleaning');
    const catServices = cat ? cat.services : [];

    // 获取所有活跃门店（按品类过滤）
    const storeResult = await storeService.getStores({ page: 1, pageSize: 100, businessCategory: categoryId || 'cleaning' });
    const stores = storeResult.list || [];

    function loadStoreConfig(storeId) {
      try {
        const configPath = path.join(configDir, storeId + '.json');
        if (fs.existsSync(configPath)) {
          return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
      } catch (e) { /* ignore */ }
      return null;
    }

    // 计算促销折扣
    function calcDiscount(promotions, subtotal) {
      let totalDiscount = 0;
      let appliedPromos = [];
      (promotions || []).filter(p => p.enabled !== false).forEach(promo => {
        if (promo.type === 'discount' && (!promo.condition || promo.condition === 'pickup')) {
          const d = Math.round(subtotal * promo.discountPercent / 100);
          totalDiscount += d;
          appliedPromos.push({ name: promo.name, amount: d });
        } else if (promo.type === 'full_reduce' && subtotal >= promo.threshold) {
          totalDiscount += promo.reduce;
          appliedPromos.push({ name: promo.name, amount: promo.reduce });
        }
      });
      return { totalDiscount, appliedPromos };
    }

    // 为每个门店计算报价
    const storePricingList = stores.map(store => {
      const storeId = store.storeNo || String(store._id);
      const config = loadStoreConfig(storeId);

      // 构建门店服务价格映射
      const svcMap = {};
      if (config && config.services) {
        config.services.filter(s => s.enabled !== false).forEach(s => {
          svcMap[s.name] = s.price;
        });
      }

      let totalPrice = 0;
      const matchedServices = [];
      let allMatched = true;

      // 计算每个选中服务的价格
      serviceIds.forEach(svcId => {
        // 从品类服务中找到服务定义
        const catSvc = catServices.find(s => s.id === svcId);
        if (!catSvc) { allMatched = false; return; }

        // 处理寄养服务
        if (svcId === 'boarding' && boardingDetail) {
          const cfg = (config && config.boardingConfig) ? config.boardingConfig : null;
          const defaultBoarding = {
            small_dog: 30, medium_dog: 50, large_dog: 80, cat: 40, foodPerDay: 15
          };
          const bCfg = cfg || defaultBoarding;
          const petPrice = bCfg[boardingDetail.petType] || defaultBoarding[boardingDetail.petType] || 30;
          const foodPrice = boardingDetail.foodOption === 'store' ? (bCfg.foodPerDay || 15) : 0;
          const boardingTotal = (petPrice + foodPrice) * boardingDetail.days;

          totalPrice += boardingTotal;
          matchedServices.push({
            serviceId: svcId,
            name: catSvc.name,
            icon: catSvc.icon,
            price: boardingTotal,
            isBoarding: true,
            boardingDetail: {
              petType: boardingDetail.petType,
              petName: boardingDetail.petName,
              days: boardingDetail.days,
              foodOption: boardingDetail.foodOption,
              petPricePerDay: petPrice,
              foodPricePerDay: foodPrice
            }
          });
        } else {
          // 普通服务：门店价格 > 系统默认价
          const price = svcMap[catSvc.name] || catSvc.price || 0;
          totalPrice += price;
          matchedServices.push({
            serviceId: svcId,
            name: catSvc.name,
            icon: catSvc.icon,
            price: price,
            isBoarding: false
          });
        }
      });

      if (!allMatched && matchedServices.length === 0) return null;

      // 计算折扣
      const promoResult = config && config.promotions ? calcDiscount(config.promotions, totalPrice) : { totalDiscount: 0, appliedPromos: [] };
      const finalPrice = Math.max(0, totalPrice - promoResult.totalDiscount);

      // 计算距离（如果提供了用户位置）
      let distance = 0;
      if (lat && lng && store.location && store.location.coordinates) {
        const R = 6371;
        const dLat = (store.location.coordinates[1] - lat) * Math.PI / 180;
        const dLng = (store.location.coordinates[0] - lng) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(lat*Math.PI/180) * Math.cos(store.location.coordinates[1]*Math.PI/180) * Math.sin(dLng/2)**2;
        distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      }

      return {
        storeId: storeId,
        storeName: store.name,
        address: store.address || '',
        phone: store.phone || '',
        rating: store.rating || 4.5,
        isOnline: store.status === 'active',
        isRecommended: store.isRecommended || false,
        hasPromotion: promoResult.appliedPromos.length > 0,
        promotions: promoResult.appliedPromos,
        distance: Math.round(distance * 10) / 10,
        matchedServices: matchedServices,
        serviceTotal: totalPrice,
        discount: promoResult.totalDiscount,
        finalPrice: finalPrice,
        boardingConfig: config ? config.boardingConfig : null
      };
    }).filter(Boolean);

    // 综合推荐算法：多维度加权评分
    const maxPrice = Math.max(...storePricingList.map(s => s.finalPrice), 1);
    const maxDistance = Math.max(...storePricingList.map(s => s.distance), 1);

    const scored = storePricingList.map(s => ({
      ...s,
      _score: (s.rating / 5) * 0.4
        + (1 - s.finalPrice / maxPrice) * 0.3
        + (1 - s.distance / maxDistance) * 0.2
        + (s.isRecommended ? 0.1 : 0)
        + (s.hasPromotion ? 0.05 : 0)
    }));

    const comprehensive = [...scored].sort((a, b) => b._score - a._score).map(({_score, ...s}) => s);
    const nearby = [...storePricingList].sort((a, b) => a.distance - b.distance);
    const bestPrice = [...storePricingList].sort((a, b) => a.finalPrice - b.finalPrice);

    res.json({
      success: true,
      data: { comprehensive, nearby, bestPrice },
      message: '推荐计算完成'
    });
  } catch (error) {
    console.error('[智慧推荐] 错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取门店寄养配置
 * GET /api/cleaning/boarding/config/:storeId
 * 返回: { small_dog: 30, medium_dog: 50, large_dog: 80, cat: 40, foodPerDay: 15 }
 */
router.get('/boarding/config/:storeId', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(__dirname, '..', '..', 'data', 'store-configs', req.params.storeId + '.json');

    const defaultBoarding = {
      small_dog: 30, medium_dog: 50, large_dog: 80, cat: 40, foodPerDay: 15
    };

    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      res.json({
        success: true,
        data: config.boardingConfig || defaultBoarding
      });
    } else {
      res.json({
        success: true,
        data: defaultBoarding,
        message: '门店无自定义配置，使用系统默认'
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取系统默认寄养配置（未选门店时使用）
 * GET /api/cleaning/boarding/defaults
 */
router.get('/boarding/defaults', async (req, res) => {
  res.json({
    success: true,
    data: {
      small_dog:  { name: '小型犬', icon: '🐕',  basePrice: 30 },
      medium_dog: { name: '中型犬', icon: '🐕‍🦺', basePrice: 50 },
      large_dog:  { name: '大型犬', icon: '🐩',  basePrice: 80 },
      cat:        { name: '猫咪',   icon: '🐱',  basePrice: 40 },
      foodPerDay: 15
    }
  });
});

/**
 * 历史订单品类修正（一次性工具接口）
 * POST /api/cleaning/fix-category-data
 * 根据 storeId 反查门店 businessCategory，修正错误的 categoryId
 */
router.post('/fix-category-data', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const Order = mongoose.models.Order;
    const Store = mongoose.models.Store;
    if (!Order || !Store) {
      return res.json({ success: false, message: '模型不可用' });
    }

    // 获取所有活跃门店的 storeNo -> businessCategory 映射
    const stores = await Store.find({ status: 'active' }).select('storeNo businessCategory').lean();
    const storeCategoryMap = {};
    stores.forEach(s => {
      storeCategoryMap[s.storeNo] = s.businessCategory || 'cleaning';
    });

    // 查找 categoryId 为 cleaning（默认值）的订单
    const suspectOrders = await Order.find({
      $or: [
        { categoryId: 'cleaning' },
        { categoryId: { $exists: false } }
      ]
    }).select('_id storeId categoryId').lean();

    let fixedCount = 0;
    const bulkOps = [];

    suspectOrders.forEach(order => {
      const actualCategory = storeCategoryMap[order.storeId];
      if (actualCategory && actualCategory !== 'cleaning') {
        bulkOps.push({
          updateOne: {
            filter: { _id: order._id },
            update: { $set: { categoryId: actualCategory, orderType: 'service' } }
          }
        });
        fixedCount++;
      }
    });

    if (bulkOps.length > 0) {
      await Order.bulkWrite(bulkOps);
    }

    console.log(`[品类修正] 扫描${suspectOrders.length}条订单，修正${fixedCount}条`);
    res.json({
      success: true,
      data: {
        scanned: suspectOrders.length,
        fixed: fixedCount,
        storeCategoryMap
      }
    });
  } catch (error) {
    console.error('[品类修正] 失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
