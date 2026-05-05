/**
 * 配送路由
 */

const express = require('express');
const router = express.Router();
const deliveryService = require('../services/deliveryService');
const { authMiddleware, requireRoles } = require('../../common/middlewares/auth');

// 获取支持的配送平台
router.get('/providers', (req, res) => {
  const providers = deliveryService.getAvailableProviders();
  res.json({
    success: true,
    data: providers
  });
});

// 估算配送费用
router.post('/estimate', async (req, res) => {
  try {
    const { provider, pickup, delivery } = req.body;
    
    const result = await deliveryService.estimateFee({
      provider: provider || 'meituan',
      pickup,
      delivery
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
router.post('/callback', async (req, res) => {
  try {
    const { deliveryId, status, driverInfo, location } = req.body;
    
    console.log(`[配送回调] 配送ID: ${deliveryId}, 状态: ${status}`);
    
    // 根据状态更新业务订单
    const Order = require('../../cleaning/services/orderService');
    
    switch (status) {
      case 'picking_up':
        // 骑手正在取货
        break;
      case 'picked_up':
        // 已取货
        await Order.updateDeliveryStatus(deliveryId, {
          status: 'picked_up',
          driverName: driverInfo?.name,
          driverPhone: driverInfo?.phone
        });
        break;
      case 'delivering':
        // 配送中
        await Order.updateDeliveryStatus(deliveryId, {
          status: 'delivering',
          currentLocation: location
        });
        break;
      case 'delivered':
        // 已送达
        await Order.updateDeliveryStatus(deliveryId, {
          status: 'delivered',
          deliveredAt: new Date()
        });
        break;
      case 'cancelled':
        // 已取消
        await Order.updateDeliveryStatus(deliveryId, {
          status: 'cancelled'
        });
        break;
      default:
        console.log(`[配送回调] 未知状态: ${status}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[配送回调] 处理失败:', error);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
