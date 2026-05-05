/**
 * 订单-灯条绑定 API 路由
 * 处理订单与灯条的绑定、查询、解绑操作
 */

const express = require('express');
const router = express.Router();
const LightBinding = require('../../../models/LightBinding');
const lightService = require('../../../services/lightService');

// ============================================
// 激活灯条（订单取件时调用）
// POST /api/store/order-light/bind
// ============================================
router.post('/bind', async (req, res) => {
  try {
    const { orderId, storeId, lightId, color, bindingType, userId, remark } = req.body;
    
    // 参数校验
    if (!orderId || !storeId) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要参数：orderId, storeId' 
      });
    }
    
    // 检查是否已有活跃绑定
    const existingBinding = await LightBinding.findOne({ 
      orderId, 
      status: 'active' 
    });
    
    if (existingBinding) {
      return res.status(400).json({
        success: false,
        error: '该订单已有活跃的灯条绑定',
        data: existingBinding
      });
    }
    
    // 创建绑定记录
    const binding = new LightBinding({
      orderId,
      storeId,
      lightId: lightId || 'ALL',
      color: color || 'green',
      bindingType: bindingType || 'pickup',
      userId,
      remark,
      status: 'active'
    });
    
    await binding.save();
    
    // 发布MQTT命令点亮灯条
    const topic = `dryclean/prod/${storeId}/light`;
    const mqttMessage = {
      action: 'on',
      lightIds: lightId ? [lightId] : [],
      color: color || 'green',
      priority: bindingType === 'urgent' ? 'high' : 'normal',
      orderId, // 携带订单ID供终端识别
      timestamp: Date.now()
    };
    
    lightService.publish(topic, mqttMessage);
    
    console.log(`[灯条绑定] 激活 - 订单: ${orderId}, 门店: ${storeId}, 颜色: ${color || 'green'}`);
    
    res.json({
      success: true,
      data: {
        bindingId: binding._id,
        orderId,
        storeId,
        lightId: binding.lightId,
        status: 'active',
        mqttConnected: lightService.isConnected()
      }
    });
    
  } catch (error) {
    console.error('[灯条绑定] 激活失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 关闭灯条（取件完成时调用）
// POST /api/store/order-light/unbind
// ============================================
router.post('/unbind', async (req, res) => {
  try {
    const { orderId, storeId, lightId, reason } = req.body;
    
    if (!orderId) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要参数：orderId' 
      });
    }
    
    // 查找活跃绑定
    const binding = await LightBinding.findOne({ 
      orderId, 
      status: 'active' 
    });
    
    if (!binding) {
      return res.status(404).json({
        success: false,
        error: '未找到该订单的活跃灯条绑定'
      });
    }
    
    // 更新绑定状态
    binding.status = reason === 'cancelled' ? 'cancelled' : 'completed';
    binding.completedAt = new Date();
    if (reason) {
      binding.remark = binding.remark ? `${binding.remark}; ${reason}` : reason;
    }
    await binding.save();
    
    // 发布MQTT命令关闭灯条
    const targetStoreId = storeId || binding.storeId;
    const targetLightId = lightId || binding.lightId;
    const topic = `dryclean/prod/${targetStoreId}/light`;
    
    lightService.publish(topic, {
      action: targetLightId === 'ALL' ? 'all_off' : 'off',
      lightIds: targetLightId === 'ALL' ? [] : [targetLightId],
      orderId,
      timestamp: Date.now()
    });
    
    console.log(`[灯条绑定] 关闭 - 订单: ${orderId}, 门店: ${targetStoreId}, 原因: ${reason || '正常完成'}`);
    
    res.json({
      success: true,
      data: {
        bindingId: binding._id,
        orderId,
        status: binding.status,
        mqttConnected: lightService.isConnected()
      }
    });
    
  } catch (error) {
    console.error('[灯条绑定] 关闭失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 查询门店当前激活的灯条绑定
// GET /api/store/order-light/store/:storeId
// ============================================
router.get('/store/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;
    const bindings = await LightBinding.find({ 
      storeId, 
      status: 'active' 
    }).sort({ activatedAt: -1 });
    
    res.json({
      success: true,
      data: {
        storeId,
        activeCount: bindings.length,
        bindings
      }
    });
    
  } catch (error) {
    console.error('[灯条绑定] 查询失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 根据订单查询绑定状态
// GET /api/store/order-light/order/:orderId
// ============================================
router.get('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const binding = await LightBinding.findOne({ orderId })
      .sort({ activatedAt: -1 });
    
    if (!binding) {
      return res.json({
        success: true,
        data: { orderId, binding: null, message: '暂无绑定记录' }
      });
    }
    
    res.json({
      success: true,
      data: { orderId, binding }
    });
    
  } catch (error) {
    console.error('[灯条绑定] 查询失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 批量点亮（多个订单）
// POST /api/store/order-light/batch-bind
// ============================================
router.post('/batch-bind', async (req, res) => {
  try {
    const { orders, storeId, color } = req.body;
    
    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要参数：orders (数组)' 
      });
    }
    
    if (!storeId) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要参数：storeId' 
      });
    }
    
    const results = [];
    
    for (let i = 0; i < orders.length; i++) {
      const orderId = orders[i];
      
      // 依次点亮，每盏灯间隔500ms
      lightService.publish(`dryclean/prod/${storeId}/light`, {
        action: 'on',
        lightIds: [],
        color: color || 'green',
        priority: 'normal',
        orderId,
        position: i + 1,
        timestamp: Date.now()
      });
      
      // 创建绑定记录
      const binding = new LightBinding({
        orderId,
        storeId,
        lightId: 'ALL',
        color: color || 'green',
        bindingType: 'batch',
        status: 'active'
      });
      await binding.save();
      
      results.push({ orderId, bindingId: binding._id });
      
      // 等待500ms再点亮下一个
      if (i < orders.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`[灯条绑定] 批量激活 - 门店: ${storeId}, 订单数: ${orders.length}`);
    
    res.json({
      success: true,
      data: {
        storeId,
        totalOrders: orders.length,
        bindings: results,
        mqttConnected: lightService.isConnected()
      }
    });
    
  } catch (error) {
    console.error('[灯条绑定] 批量激活失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 紧急闪烁（用户点击"帮我找"）
// POST /api/store/order-light/urgent
// ============================================
router.post('/urgent', async (req, res) => {
  try {
    const { orderId, storeId } = req.body;
    
    if (!orderId || !storeId) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要参数：orderId, storeId' 
      });
    }
    
    // 发布闪烁命令
    const topic = `dryclean/prod/${storeId}/light`;
    
    // 先点亮
    lightService.publish(topic, {
      action: 'on',
      lightIds: [],
      color: 'red',
      priority: 'high',
      orderId,
      urgent: true,
      timestamp: Date.now()
    });
    
    // 2秒后关闭
    setTimeout(() => {
      lightService.publish(topic, {
        action: 'all_off',
        orderId,
        timestamp: Date.now()
      });
    }, 2000);
    
    console.log(`[灯条绑定] 紧急闪烁 - 订单: ${orderId}, 门店: ${storeId}`);
    
    res.json({
      success: true,
      data: {
        orderId,
        storeId,
        action: 'urgent_blink',
        mqttConnected: lightService.isConnected()
      }
    });
    
  } catch (error) {
    console.error('[灯条绑定] 紧急闪烁失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 关闭门店所有灯条
// POST /api/store/order-light/clear-store
// ============================================
router.post('/clear-store/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;
    
    // 将该门店所有激活的绑定设为完成
    const result = await LightBinding.updateMany(
      { storeId, status: 'active' },
      { 
        status: 'completed',
        completedAt: new Date(),
        remark: '批量清空'
      }
    );
    
    // 发布关闭命令
    lightService.publish(`dryclean/prod/${storeId}/light`, {
      action: 'all_off',
      clearedBy: 'system',
      timestamp: Date.now()
    });
    
    console.log(`[灯条绑定] 清空门店灯条 - 门店: ${storeId}, 关闭数量: ${result.modifiedCount}`);
    
    res.json({
      success: true,
      data: {
        storeId,
        clearedCount: result.modifiedCount,
        mqttConnected: lightService.isConnected()
      }
    });
    
  } catch (error) {
    console.error('[灯条绑定] 清空失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
