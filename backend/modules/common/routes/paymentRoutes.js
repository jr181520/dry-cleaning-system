/**
 * 支付路由
 * 提供统一的支付接口
 */

const express = require('express');
const router = express.Router();
const wechatPayService = require('../services/wechatPayService');
const paymentService = require('../services/paymentService');
const { authMiddleware } = require('../../common/middlewares/auth');

// 创建支付订单
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { orderId, orderType, amount, method, openid } = req.body;
    
    // 获取订单信息
    const Order = require('../../cleaning/services/orderService');
    const order = await Order.getById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'order_not_found',
        message: '订单不存在'
      });
    }

    // 根据支付方式创建支付
    let result;
    const description = `${orderType === 'cleaning' ? '干洗服务' : '订单'}支付`;
    const notifyUrl = `${req.protocol}://${req.get('host')}/api/payments/wechat/callback`;

    switch (method) {
      case 'wechat_jsapi':
        result = await wechatPayService.createJsapiOrder({
          orderId,
          amount,
          description,
          openid,
          notifyUrl
        });
        break;
      case 'wechat_app':
        result = await wechatPayService.createAppOrder({
          orderId,
          amount,
          description,
          notifyUrl
        });
        break;
      case 'wechat_h5':
        result = await wechatPayService.createH5Order({
          orderId,
          amount,
          description,
          notifyUrl
        });
        break;
      case 'balance':
        // 余额支付直接成功
        result = await paymentService.createPayment({
          orderId,
          amount,
          method: 'balance',
          orderType
        });
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'invalid_payment_method',
          message: '不支持的支付方式'
        });
    }

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'payment_create_failed',
        message: result.error
      });
    }
  } catch (error) {
    console.error('[支付] 创建支付失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '支付创建失败'
    });
  }
});

// 查询支付状态
router.get('/query/:orderId', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const result = await wechatPayService.queryOrderByOutTradeNo(orderId);
    
    res.json({
      success: result.success,
      data: result.data || null
    });
  } catch (error) {
    console.error('[支付] 查询失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '查询失败'
    });
  }
});

// 微信支付回调
router.post('/wechat/callback', async (req, res) => {
  try {
    const headers = req.headers;
    let body = '';
    
    // 如果是流式数据
    if (Buffer.isBuffer(req.body)) {
      body = req.body.toString();
    } else if (typeof req.body === 'object') {
      body = JSON.stringify(req.body);
    } else {
      body = req.body;
    }

    // 验证签名
    if (!wechatPayService.verifyCallback(headers, body)) {
      return res.status(400).json({ code: 'FAIL', message: '签名验证失败' });
    }

    const data = JSON.parse(body);
    const result = wechatPayService.decryptCallback(data.resource.ciphertext);

    if (result) {
      const { out_trade_no, transaction_id, trade_state, total, payer } = result;
      
      console.log(`[微信支付回调] 订单号: ${out_trade_no}, 状态: ${trade_state}`);

      if (trade_state === 'SUCCESS') {
        // 更新订单支付状态
        const Order = require('../../cleaning/services/orderService');
        await Order.updatePaymentStatus(out_trade_no, {
          status: 'paid',
          transactionId: transaction_id,
          paidAt: new Date(),
          method: 'wechat',
          amount: total / 100
        });

        // 发送支付成功通知
        await wechatPayService.sendPaymentNotify(out_trade_no, payer?.openid, total / 100);
      }

      res.json({ code: 'SUCCESS', message: '成功' });
    } else {
      res.status(400).json({ code: 'FAIL', message: '解密失败' });
    }
  } catch (error) {
    console.error('[微信支付回调] 处理失败:', error);
    res.status(500).json({ code: 'FAIL', message: '处理失败' });
  }
});

// 申请退款
router.post('/refund', authMiddleware, async (req, res) => {
  try {
    const { orderId, transactionId, amount, reason } = req.body;
    
    const result = await wechatPayService.refund({
      transactionId,
      refundId: 'ref' + Date.now(),
      amount,
      reason
    });

    if (result.success) {
      // 更新订单退款状态
      const Order = require('../../cleaning/services/orderService');
      await Order.updatePaymentStatus(orderId, {
        status: 'refunded',
        refundedAt: new Date()
      });

      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'refund_failed',
        message: result.error
      });
    }
  } catch (error) {
    console.error('[退款] 申请失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '退款申请失败'
    });
  }
});

module.exports = router;
