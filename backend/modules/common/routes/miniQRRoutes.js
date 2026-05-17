/**
 * 微信小程序码API路由
 * 用于生成门店专属的小程序码，实现微信小程序引流
 */

const express = require('express');
const router = express.Router();
const wechatMiniQRService = require('../../common/services/wechatMiniQRService');

/**
 * POST /api/mini-qr/generate
 * 生成小程序码
 * 
 * 请求体:
 * {
 *   type: 'order_pay' | 'store',
 *   orderId: string,
 *   storeId: string,
 *   amount: number
 * }
 */
router.post('/generate', async (req, res) => {
  try {
    const { type, orderId, storeId, amount } = req.body;

    // 检查配置
    if (!wechatMiniQRService.config.appId || !wechatMiniQRService.config.appSecret) {
      return res.status(500).json({
        success: false,
        error: '微信小程序配置未设置'
      });
    }

    let result;

    if (type === 'order_pay') {
      // 生成订单支付小程序码
      if (!orderId || !storeId) {
        return res.status(400).json({
          success: false,
          error: '缺少必要参数: orderId, storeId'
        });
      }
      result = await wechatMiniQRService.generateOrderPayQR(orderId, storeId, amount || 0);
    } else if (type === 'store') {
      // 生成门店小程序码
      if (!storeId) {
        return res.status(400).json({
          success: false,
          error: '缺少必要参数: storeId'
        });
      }
      result = await wechatMiniQRService.generateStoreQR(storeId);
    } else {
      return res.status(400).json({
        success: false,
        error: '无效的type参数'
      });
    }

    if (result.success) {
      res.json({
        success: true,
        data: {
          imageData: result.data.imageData,
          contentType: result.data.contentType,
          scene: result.data.scene
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || '生成失败'
      });
    }
  } catch (error) {
    console.error('[小程序码API] 生成失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '服务器错误'
    });
  }
});

/**
 * GET /api/mini-qr/config
 * 获取小程序码配置信息（用于调试）
 */
router.get('/config', (req, res) => {
  res.json({
    success: true,
    data: {
      appIdSet: !!wechatMiniQRService.config.appId,
      hasAppSecret: !!wechatMiniQRService.config.appSecret,
      defaultPage: wechatMiniQRService.config.defaultPage
    }
  });
});

module.exports = router;
