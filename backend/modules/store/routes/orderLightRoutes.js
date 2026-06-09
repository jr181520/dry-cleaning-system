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
    const { orderId, storeId, lightId, color, bindingType, userId, remark, itemIndex } = req.body;
    
    // 参数校验
    if (!orderId || !storeId) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要参数：orderId, storeId' 
      });
    }
    
    // 检查是否已有相同的活跃绑定（同一个订单 + 同一个物品索引 = 一个绑定）
    const filter = { orderId, status: 'active' };
    if (itemIndex !== undefined && itemIndex !== null) {
      // 如果指定了物品索引，则检查该物品是否已有绑定
      filter.itemIndex = itemIndex;
    }
    
    const existingBinding = await LightBinding.findOne(filter);
    
    if (existingBinding) {
      // 如果已有绑定，直接返回成功（幂等操作）
      console.log(`[灯条绑定] 物品 ${itemIndex} 已存在绑定，更新即可`);
    }
    
    // 创建绑定记录（如果不存在则创建，存在则更新）
    const bindingData = {
      orderId,
      storeId,
      lightId: lightId || 'ALL',
      color: color || 'green',
      bindingType: bindingType || 'pickup',
      userId,
      remark,
      status: 'active'
    };
    
    if (itemIndex !== undefined && itemIndex !== null) {
      bindingData.itemIndex = itemIndex;
    }
    
    let binding;
    if (existingBinding) {
      // 更新现有绑定
      Object.assign(existingBinding, bindingData);
      binding = await existingBinding.save();
    } else {
      // 创建新绑定
      binding = new LightBinding(bindingData);
      await binding.save();
    }
    
    // 发布MQTT命令点亮灯条
    const topic = `dryclean/prod/${storeId}/light`;
    const mqttMessage = {
      action: 'on',
      lightIds: lightId ? [lightId] : [],
      color: color || 'green',
      priority: bindingType === 'urgent' ? 'high' : 'normal',
      orderId,
      itemIndex: itemIndex,
      timestamp: Date.now()
    };
    
    lightService.publish(topic, mqttMessage);
    
    // 写入M端通知缓存（M端轮询查询）
    addLightNotification({
      storeId,
      orderId,
      itemIndex,
      itemName: req.body.itemName || null,
      customerName: req.body.customerName || null,
      color: color || 'green'
    });
    
    console.log(`[灯条绑定] 激活 - 订单: ${orderId}, 物品: ${itemIndex}, 门店: ${storeId}, 颜色: ${color || 'green'}`);
    
    res.json({
      success: true,
      data: {
        bindingId: binding._id,
        orderId,
        storeId,
        lightId: binding.lightId,
        itemIndex: itemIndex,
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
    const { orderId, storeId, lightId, reason, itemIndex } = req.body;
    
    if (!orderId) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要参数：orderId' 
      });
    }
    
    // 构建查询条件：支持按 orderId + itemIndex 精确定位
    const query = { orderId, status: 'active' };
    if (itemIndex !== undefined && itemIndex !== null) {
      query.itemIndex = itemIndex;
    }
    
    // 查找活跃绑定
    const binding = await LightBinding.findOne(query);
    
    if (!binding) {
      // 如果按 itemIndex 没找到，尝试不限制 itemIndex
      if (itemIndex !== undefined && itemIndex !== null) {
        const fallbackBinding = await LightBinding.findOne({ orderId, status: 'active' });
        if (!fallbackBinding) {
          return res.status(404).json({
            success: false,
            error: '未找到该订单的活跃灯条绑定'
          });
        }
        // 不存在精确 itemIndex 匹配时，使用兜底
        fallbackBinding.status = reason === 'cancelled' ? 'cancelled' : 'completed';
        fallbackBinding.completedAt = new Date();
        if (reason) {
          fallbackBinding.remark = fallbackBinding.remark ? `${fallbackBinding.remark}; ${reason}` : reason;
        }
        await fallbackBinding.save();
        
        // 发布MQTT命令关闭灯条
        const targetStoreId = storeId || fallbackBinding.storeId;
        const topic = `dryclean/prod/${targetStoreId}/light`;
        lightService.publish(topic, {
          action: 'off',
          lightIds: [fallbackBinding.lightId],
          orderId,
          timestamp: Date.now()
        });
        
        return res.json({
          success: true,
          data: {
            bindingId: fallbackBinding._id,
            orderId,
            itemIndex: fallbackBinding.itemIndex,
            status: fallbackBinding.status,
            mqttConnected: lightService.isConnected()
          }
        });
      }
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
    
    console.log(`[灯条绑定] 关闭 - 订单: ${orderId}, 物品: ${binding.itemIndex ?? '全部'}, 门店: ${targetStoreId}, 原因: ${reason || '正常完成'}`);
    
    res.json({
      success: true,
      data: {
        bindingId: binding._id,
        orderId,
        itemIndex: binding.itemIndex,
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
// 查询订单所有物品的灯条绑定（按物品级别）
// GET /api/store/order-light/order/:orderId/bindings
// ============================================
router.get('/order/:orderId/bindings', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // 查询该订单所有活跃绑定，按 itemIndex 排序
    const bindings = await LightBinding.find({ orderId })
      .sort({ itemIndex: 1, activatedAt: -1 });
    
    res.json({
      success: true,
      data: {
        orderId,
        totalBindings: bindings.length,
        activeCount: bindings.filter(b => b.status === 'active').length,
        completedCount: bindings.filter(b => b.status === 'completed').length,
        bindings: bindings.map(b => ({
          bindingId: b._id,
          orderId: b.orderId,
          storeId: b.storeId,
          lightId: b.lightId,
          itemIndex: b.itemIndex,
          color: b.color,
          status: b.status,
          bindingType: b.bindingType,
          activatedAt: b.activatedAt,
          completedAt: b.completedAt,
          remark: b.remark
        }))
      }
    });
    
  } catch (error) {
    console.error('[灯条绑定] 查询物品绑定失败:', error);
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
      
      // 写入M端通知缓存
      addLightNotification({
        storeId,
        orderId,
        itemIndex: null,
        itemName: null,
        customerName: null,
        color: color || 'green'
      });
      
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
    
    // 写入M端通知缓存（紧急闪烁也通知M端）
    addLightNotification({
      storeId,
      orderId,
      itemIndex: null,
      itemName: null,
      customerName: null,
      color: 'red'
    });
    
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

// ============================================
// M端通知缓存：灯条点亮后会写入，M端轮询查询
// ============================================
const pendingNotifications = new Map(); // storeId -> [{ notificationId, orderId, itemIndex, itemName, customerName, status, createdAt }]

// 通知有效期：60秒后自动清理
const NOTIFICATION_TTL = 60000;
setInterval(() => {
  const now = Date.now();
  pendingNotifications.forEach((notifications, storeId) => {
    const valid = notifications.filter(n => now - n.createdAt < NOTIFICATION_TTL);
    if (valid.length === 0) {
      pendingNotifications.delete(storeId);
    } else {
      pendingNotifications.set(storeId, valid);
    }
  });
}, 15000);

/**
 * 添加灯条通知到缓存（供 /bind 和 /batch-bind 内部调用）
 */
function addLightNotification({ storeId, orderId, itemIndex, itemName, customerName, color }) {
  if (!storeId || !orderId) return;
  
  if (!pendingNotifications.has(storeId)) {
    pendingNotifications.set(storeId, []);
  }
  
  const notifications = pendingNotifications.get(storeId);
  
  // 检查是否已有相同 orderId + itemIndex 的通知（去重）
  const exists = notifications.find(
    n => n.orderId === orderId && n.itemIndex === itemIndex
  );
  if (exists) {
    exists.createdAt = Date.now();
    exists.status = 'pending';
    return;
  }
  
  notifications.push({
    notificationId: `${orderId}_${itemIndex ?? Date.now()}`,
    orderId,
    storeId,
    itemIndex,
    itemName: itemName || '待取件物品',
    customerName: customerName || '客户',
    color: color || 'green',
    status: 'pending',
    createdAt: Date.now()
  });
}

// ============================================
// M端轮询：获取门店待处理灯条通知
// GET /api/store/order-light/pending-notifications/:storeId
// ============================================
router.get('/pending-notifications/:storeId', (req, res) => {
  const { storeId } = req.params;
  const notifications = pendingNotifications.get(storeId) || [];
  
  // 过滤过期的
  const now = Date.now();
  const valid = notifications.filter(n => now - n.createdAt < NOTIFICATION_TTL);
  pendingNotifications.set(storeId, valid);
  
  res.json({
    success: true,
    data: {
      storeId,
      count: valid.length,
      notifications: valid.map(n => ({
        notificationId: n.notificationId,
        orderId: n.orderId,
        itemIndex: n.itemIndex,
        itemName: n.itemName,
        customerName: n.customerName,
        color: n.color,
        status: n.status,
        createdAt: n.createdAt
      }))
    }
  });
});

// ============================================
// M端标记通知已处理
// POST /api/store/order-light/mark-read/:storeId
// Body: { notificationIds: [...] } 或 { orderId } 清除指定订单的所有通知
// ============================================
router.post('/mark-read/:storeId', (req, res) => {
  const { storeId } = req.params;
  const { notificationIds, orderId } = req.body;
  
  const notifications = pendingNotifications.get(storeId);
  if (!notifications || notifications.length === 0) {
    return res.json({ success: true, data: { cleared: 0 } });
  }
  
  let cleared = 0;
  
  if (orderId) {
    // 清除指定订单的所有通知
    const filtered = notifications.filter(n => n.orderId !== orderId);
    cleared = notifications.length - filtered.length;
    pendingNotifications.set(storeId, filtered);
  } else if (notificationIds && Array.isArray(notificationIds)) {
    // 清除指定通知
    const set = new Set(notificationIds);
    const filtered = notifications.filter(n => !set.has(n.notificationId));
    cleared = notifications.length - filtered.length;
    pendingNotifications.set(storeId, filtered);
  }
  
  res.json({ success: true, data: { cleared } });
});

module.exports = router;
