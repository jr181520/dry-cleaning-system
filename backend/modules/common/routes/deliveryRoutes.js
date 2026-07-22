/**
 * 配送路由
 */

const express = require('express');
const router = express.Router();
const deliveryService = require('../services/deliveryService');
const deliveryProviders = require('../../../services/deliveryProviders');
const courierTracker = require('../../../services/courierTrackingSimulator');
const { authMiddleware, requireRoles } = require('../../common/middlewares/auth');

// 获取服务商接入状态（含REAL/MOCK模式标识）
router.get('/provider-status', (req, res) => {
  const statusList = deliveryProviders.getStatus();
  const availableProviders = deliveryService.getAvailableProviders();
  // 合并配置信息和模式状态
  const merged = availableProviders.map(ap => {
    const st = statusList.find(s => s.code === ap.code) || {};
    return { ...ap, ...st };
  });
  res.json({
    success: true,
    data: merged,
    activeTrackingCount: courierTracker.getActiveTasks().length
  });
});

// 获取支持的配送平台（含报价）
router.get('/providers', (req, res) => {
  const providers = deliveryService.getProviderList();
  res.json({
    success: true,
    data: providers
  });
});

// 一键获取所有服务商报价（含一对一和拼单两种模式）
router.post('/quotes', async (req, res) => {
  try {
    const { pickup, delivery, distance, serviceTotal, isNewUser } = req.body;
    
    const result = await deliveryService.getAllQuotes({
      pickup,
      delivery,
      distance,
      serviceTotal,
      isNewUser
    });

    res.json(result);
  } catch (error) {
    console.error('[配送] 获取报价列表失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取报价列表失败'
    });
  }
});

// 估算配送费用（兼容旧接口，支持deliveryType）
router.post('/estimate', async (req, res) => {
  try {
    const { provider, pickup, delivery, deliveryType, serviceTotal, isNewUser } = req.body;
    
    const result = await deliveryService.estimateFee({
      provider: provider || 'meituan',
      pickup,
      delivery,
      deliveryType,
      serviceTotal,
      isNewUser
    });

    res.json(result);
  } catch (error) {
    console.error('[配送] 估算费用失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '估算费用失败'
    });
  }
});

// 创建配送订单
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { orderId, provider, pickup, delivery } = req.body;
    
    if (!orderId || !pickup || !delivery) {
      return res.status(400).json({
        success: false,
        error: 'invalid_params',
        message: '缺少必要参数'
      });
    }

    const callbackUrl = `${req.protocol}://${req.get('host')}/api/delivery/callback`;
    
    const result = await deliveryService.createDelivery({
      orderId,
      provider: provider || 'meituan',
      pickup,
      delivery,
      callbackUrl
    });

    if (result.success) {
      // 启动跑腿配送跟踪模拟（模拟服务商回传骑手位置）
      try {
        const mongoose = require('mongoose');
        const Order = mongoose.model('Order');
        const order = await Order.findById(orderId);
        if (order && courierTracker.shouldStartSimulation(order)) {
          courierTracker.startSimulation(order);
        }
      } catch (trackErr) {
        console.error('[配送] 启动跟踪模拟失败:', trackErr.message);
      }
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('[配送] 创建订单失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '创建配送订单失败'
    });
  }
});

// 查询配送状态
router.get('/status/:deliveryId', authMiddleware, async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const { provider } = req.query;
    
    const result = await deliveryService.queryDelivery(deliveryId, provider || 'meituan');
    
    res.json(result);
  } catch (error) {
    console.error('[配送] 查询状态失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '查询配送状态失败'
    });
  }
});

// 取消配送
router.post('/cancel', authMiddleware, async (req, res) => {
  try {
    const { deliveryId, provider, reason } = req.body;
    
    const result = await deliveryService.cancelDelivery(deliveryId, provider, reason);
    
    res.json(result);
  } catch (error) {
    console.error('[配送] 取消失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '取消配送失败'
    });
  }
});

// 配送状态回调（由配送平台调用）
// 服务商回传的状态将驱动C端配送跟踪的状态流转
router.post('/callback', async (req, res) => {
  try {
    const { deliveryId, status, driverInfo, location, timestamp, description } = req.body;
    
    console.log(`[配送回调] 配送ID: ${deliveryId}, 状态: ${status}, 骑手: ${driverInfo?.name || '-'}`);
    
    // 根据服务商回传状态更新业务订单的courier字段和deliveryStatus
    const mongoose = require('mongoose');
    const Order = mongoose.model('Order');
    const courierTracker = require('../../../services/courierTrackingSimulator');
    const orderEventService = require('../../../services/orderEventService');
    
    // 服务商状态 → 系统courier状态映射
    const statusMapping = {
      'order_created':  { courierStatus: 'awaiting_store_outbound', label: '商家待出库', progress: 5 },
      'accepted':       { courierStatus: 'awaiting_store_outbound', label: '商家待出库', progress: 10 },
      'picking_up':     { courierStatus: 'picking', label: '骑手待取件', progress: 20 },
      'arrived_store':  { courierStatus: 'picking', label: '骑手已到店', progress: 30 },
      'picked_up':      { courierStatus: 'delivering', label: '配送中', progress: 50 },
      'delivering':     { courierStatus: 'delivering', label: '配送中', progress: 70 },
      'arrived':        { courierStatus: 'delivering', label: '即将送达', progress: 90 },
      'delivered':      { courierStatus: 'delivered', label: '已送达', progress: 100 },
      'cancelled':      { courierStatus: 'cancelled', label: '已取消', progress: 0 },
      'exception':      { courierStatus: 'exception', label: '异常', progress: -1 },
    };
    
    const mapping = statusMapping[status];
    if (!mapping) {
      console.log(`[配送回调] 未识别的服务商状态: ${status}，保持当前状态`);
      return res.json({ success: true, message: '状态未识别，已忽略' });
    }
    
    // 查找关联的业务订单
    let order = await Order.findOne({ 'courier.deliveryId': deliveryId });
    if (!order) {
      // 尝试通过orderId查找
      order = await Order.findById(deliveryId);
    }
    
    if (order) {
      // 更新courier字段（服务商回传数据为权威来源）
      order.courier = order.courier || {};
      order.courier.status = mapping.courierStatus;
      order.courier.progress = mapping.progress;
      
      if (driverInfo) {
        order.courier.name = driverInfo.name || order.courier.name;
        order.courier.phone = driverInfo.phone || order.courier.phone;
      }
      if (location) {
        order.courier.location = location;
      }
      
      // 更新deliveryStatus（同步）
      if (mapping.courierStatus !== 'exception') {
        order.deliveryStatus = mapping.courierStatus;
      }
      
      if (status === 'delivered') {
        order.courier.deliveredAt = new Date();
      }
      if (status === 'cancelled') {
        order.courier.cancelledAt = new Date();
        order.courier.cancelReason = description || '服务商取消';
      }
      
      order.courier.updatedAt = timestamp ? new Date(timestamp) : new Date();
      
      await order.save();
      
      // 通过MQTT推送给C端实时更新
      const orderId = order._id?.toString();
      courierTracker.publishCourierStatus(orderId, {
        provider: order.courier.provider || '',
        status: mapping.courierStatus,
        progress: mapping.progress,
        distance: location?.distance || (order.courier.distance || '—'),
        eta: location?.eta || (order.courier.eta || '—'),
        courierName: order.courier.name || '',
        courierPhone: order.courier.phone || '',
        updatedAt: order.courier.updatedAt
      });
      
      // 发布订单事件通知M端/Admin
      orderEventService.publishOrderEvent('courier_status_changed', {
        _id: order._id,
        orderId: orderId,
        orderNo: order.orderNo,
        storeId: order.storeId,
        categoryId: order.categoryId || 'cleaning',
        status: order.status,
        deliveryStatus: mapping.courierStatus,
        courier: order.courier,
        providerStatus: status,
        providerLabel: mapping.label
      }, { source: 'provider-callback' });
      
      console.log(`[配送回调] 订单 ${order.orderNo} courier状态更新: ${mapping.label} (${mapping.courierStatus})`);
    } else {
      console.warn(`[配送回调] 未找到对应订单 (deliveryId: ${deliveryId})`);
    }
    
    res.json({ success: true, mappedStatus: mapping.courierStatus });
  } catch (error) {
    console.error('[配送回调] 处理失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 启动跑腿配送跟踪模拟
router.post('/:orderId/start-tracking', async (req, res) => {
  try {
    const { orderId } = req.params;
    const mongoose = require('mongoose');
    const Order = mongoose.model('Order');
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    
    if (!courierTracker.shouldStartSimulation(order)) {
      // 如果已经在跟踪中，返回当前状态
      const activeTasks = courierTracker.getActiveTasks();
      const existing = activeTasks.find(t => t.orderId === orderId);
      return res.json({
        success: true,
        message: '已在跟踪中',
        data: existing || null
      });
    }
    
    courierTracker.startSimulation(order);
    res.json({ success: true, message: '配送跟踪已启动' });
  } catch (error) {
    console.error('[跟踪] 启动失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 查询跑腿跟踪活跃任务列表（调试用）
router.get('/tracking/active', (req, res) => {
  res.json({
    success: true,
    count: courierTracker.getActiveTasks().length,
    data: courierTracker.getActiveTasks()
  });
});

module.exports = router;
