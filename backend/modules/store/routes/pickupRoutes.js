/**
 * C端取件API - 灯条绑定与取件流程
 * 支持两种取件模式：到店自取、跑腿配送
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const LightBinding = require('../../../models/LightBinding');

// 引用现有模型
const { ENUMS } = require('../../common/models');

// ============================================
// 模式1: 到店扫码取件
// 用户到店扫门店二维码，获取所有待取件订单，一键点亮灯条
// ============================================

/**
 * 获取门店待取件订单列表
 * GET /api/store/pickup/store/:storeId/pending
 */
router.get('/store/:storeId/pending', async (req, res) => {
  try {
    const { storeId } = req.params;
    const db = mongoose.connection.db;
    
    // 查询该门店所有待取件订单
    const orders = await db.collection('orders').find({
      storeId: storeId,
      status: 'in_progress',
      'delivery.type': 'pickup',
      'cleaning.storeCompletedAt': { $exists: true, $ne: null }
    }).sort({ 'cleaning.storeCompletedAt': -1 }).toArray();
    
    // 获取每个订单的灯条绑定状态
    const result = await Promise.all(orders.map(async (order) => {
      const binding = await LightBinding.findOne({ 
        orderId: order.orderNo, 
        status: 'active' 
      });
      
      return {
        orderId: order.id,
        orderNo: order.orderNo,
        items: order.items.map(item => ({
          name: item.name,
          pickupCode: item.pickupCode,
          quantity: item.quantity
        })),
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        totalAmount: order.amounts.total,
        storeCompletedAt: order.cleaning?.storeCompletedAt,
        lightBinding: binding ? {
          bindingId: binding._id,
          lightId: binding.lightId,
          color: binding.color,
          activatedAt: binding.activatedAt
        } : null,
        canPickup: !binding // 无活跃绑定才能取件
      };
    }));
    
    res.json({
      success: true,
      data: {
        storeId,
        totalOrders: result.length,
        totalItems: result.reduce((sum, o) => sum + o.itemCount, 0),
        orders: result
      }
    });
    
  } catch (error) {
    console.error('[取件] 查询待取件订单失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 到店扫码 - 一键点亮所有待取件订单的灯条
 * POST /api/store/pickup/store/:storeId/activate-all
 */
router.post('/store/:storeId/activate-all', async (req, res) => {
  try {
    const { storeId } = req.params;
    const { userId, orderIds } = req.body;
    const lightService = require('../../../services/lightService');
    const db = mongoose.connection.db;
    
    // 获取待取件订单
    let query = {
      storeId: storeId,
      status: 'in_progress',
      'delivery.type': 'pickup'
    };
    
    // 如果指定了特定订单ID
    if (orderIds && orderIds.length > 0) {
      query.id = { $in: orderIds };
    }
    
    const orders = await db.collection('orders').find(query).toArray();
    
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        error: '没有待取件的订单'
      });
    }
    
    const results = [];
    
    for (const order of orders) {
      // 检查是否已有活跃绑定
      const existingBinding = await LightBinding.findOne({
        orderId: order.orderNo,
        status: 'active'
      });
      
      if (existingBinding) {
        results.push({
          orderNo: order.orderNo,
          status: 'already_active',
          message: '该订单灯条已激活'
        });
        continue;
      }
      
      // 创建灯条绑定记录
      const binding = new LightBinding({
        orderId: order.orderNo,
        storeId,
        lightId: 'ALL',
        color: 'green',
        bindingType: 'pickup',
        userId,
        status: 'active'
      });
      await binding.save();
      
      results.push({
        orderNo: order.orderNo,
        bindingId: binding._id,
        status: 'activated',
        itemCount: order.items.length
      });
    }
    
    // 发布MQTT命令 - 点亮灯条（绿色）
    const topic = `dryclean/prod/${storeId}/light`;
    lightService.publish(topic, {
      action: 'on',
      lightIds: [],
      color: 'green',
      priority: 'normal',
      mode: 'pickup',
      orderCount: results.filter(r => r.status === 'activated').length,
      timestamp: Date.now()
    });
    
    console.log(`[取件] 到店扫码激活 - 门店: ${storeId}, 订单数: ${results.filter(r => r.status === 'activated').length}`);
    
    res.json({
      success: true,
      data: {
        storeId,
        mode: 'store_pickup',
        activatedCount: results.filter(r => r.status === 'activated').length,
        alreadyActiveCount: results.filter(r => r.status === 'already_active').length,
        results,
        mqttConnected: lightService.isConnected()
      }
    });
    
  } catch (error) {
    console.error('[取件] 到店扫码激活失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 用户到达，提示店员准备
 * POST /api/store/pickup/store/:storeId/arrive
 */
router.post('/store/:storeId/arrive', async (req, res) => {
  try {
    const { storeId } = req.params;
    const { userId, orderNo } = req.body;
    const lightService = require('../../../services/lightService');
    
    // 短促闪烁提示店员
    const topic = `dryclean/prod/${storeId}/light`;
    
    // 先点亮黄色
    lightService.publish(topic, {
      action: 'on',
      lightIds: [],
      color: 'yellow',
      priority: 'normal',
      mode: 'customer_arrive',
      orderNo,
      timestamp: Date.now()
    });
    
    // 1秒后关闭
    setTimeout(() => {
      lightService.publish(topic, {
        action: 'all_off',
        timestamp: Date.now()
      });
    }, 1000);
    
    console.log(`[取件] 用户到达提醒 - 门店: ${storeId}, 订单: ${orderNo}`);
    
    res.json({
      success: true,
      data: {
        storeId,
        message: '已通知店员准备',
        mqttConnected: lightService.isConnected()
      }
    });
    
  } catch (error) {
    console.error('[取件] 用户到达提醒失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 模式2: 跑腿配送模式
// 用户选择配送，勾选订单，点亮灯条准备货物，进入配送流程
// ============================================

/**
 * 创建配送订单，同时点亮灯条
 * POST /api/store/pickup/delivery/create
 */
router.post('/delivery/create', async (req, res) => {
  try {
    const { storeId, orderIds, deliveryAddress, userId } = req.body;
    const lightService = require('../../../services/lightService');
    const db = mongoose.connection.db;
    
    if (!orderIds || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请选择要配送的订单'
      });
    }
    
    // 获取订单信息
    const orders = await db.collection('orders').find({
      id: { $in: orderIds }
    }).toArray();
    
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        error: '未找到相关订单'
      });
    }
    
    // 检查订单是否可配送
    for (const order of orders) {
      if (order.status !== 'in_progress') {
        return res.status(400).json({
          success: false,
          error: `订单 ${order.orderNo} 状态不可配送`
        });
      }
    }
    
    // 创建配送单
    const deliveryId = 'DEL' + Date.now();
    const deliveryOrder = {
      _id: new mongoose.Types.ObjectId(),
      id: deliveryId,
      orderIds: orderIds,
      storeId,
      userId,
      status: 'preparing', // preparing-备货中
      deliveryAddress,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.collection('delivery_orders').insertOne(deliveryOrder);
    
    // 为每个订单创建灯条绑定
    const bindingResults = [];
    for (const order of orders) {
      const binding = new LightBinding({
        orderId: order.orderNo,
        storeId,
        lightId: 'ALL',
        color: 'blue', // 蓝色表示配送准备中
        bindingType: 'batch',
        userId,
        remark: `配送单: ${deliveryId}`,
        status: 'active'
      });
      await binding.save();
      
      bindingResults.push({
        orderNo: order.orderNo,
        bindingId: binding._id
      });
    }
    
    // 点亮灯条（蓝色）- 表示配送准备
    const topic = `dryclean/prod/${storeId}/light`;
    lightService.publish(topic, {
      action: 'on',
      lightIds: [],
      color: 'blue',
      priority: 'normal',
      mode: 'delivery_preparing',
      deliveryId,
      orderCount: orders.length,
      timestamp: Date.now()
    });
    
    console.log(`[取件] 配送模式激活 - 门店: ${storeId}, 配送单: ${deliveryId}, 订单数: ${orders.length}`);
    
    res.json({
      success: true,
      data: {
        deliveryId,
        storeId,
        mode: 'delivery',
        itemCount: orders.reduce((sum, o) => sum + o.items.length, 0),
        bindings: bindingResults,
        status: 'preparing',
        mqttConnected: lightService.isConnected()
      }
    });
    
  } catch (error) {
    console.error('[取件] 创建配送订单失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 骑手到达门店取货
 * POST /api/store/pickup/delivery/:deliveryId/courier-arrive
 */
router.post('/delivery/:deliveryId/courier-arrive', async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const { courierId, courierName } = req.body;
    const lightService = require('../../../services/lightService');
    const db = mongoose.connection.db;
    
    // 更新配送单状态
    await db.collection('delivery_orders').updateOne(
      { id: deliveryId },
      { 
        $set: { 
          status: 'courier_arrived',
          courierId,
          courierName,
          courierArrivedAt: new Date(),
          updatedAt: new Date()
        }
      }
    );
    
    // 获取配送单信息以获取storeId
    const delivery = await db.collection('delivery_orders').findOne({ id: deliveryId });
    
    if (!delivery) {
      return res.status(404).json({
        success: false,
        error: '配送单不存在'
      });
    }
    
    // 灯条闪烁提示店员货物已交接
    const topic = `dryclean/prod/${delivery.storeId}/light`;
    lightService.publish(topic, {
      action: 'blink',
      lightIds: [],
      color: 'green',
      priority: 'normal',
      mode: 'courier_pickup',
      deliveryId,
      timestamp: Date.now()
    });
    
    console.log(`[取件] 骑手到达 - 配送单: ${deliveryId}`);
    
    res.json({
      success: true,
      data: {
        deliveryId,
        status: 'courier_arrived',
        message: '骑手已到达，请取货'
      }
    });
    
  } catch (error) {
    console.error('[取件] 骑手到达确认失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 配送完成
 * POST /api/store/pickup/delivery/:deliveryId/complete
 */
router.post('/delivery/:deliveryId/complete', async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const { courierId } = req.body;
    const lightService = require('../../../services/lightService');
    const db = mongoose.connection.db;
    
    // 获取配送单
    const delivery = await db.collection('delivery_orders').findOne({ id: deliveryId });
    
    if (!delivery) {
      return res.status(404).json({
        success: false,
        error: '配送单不存在'
      });
    }
    
    // 更新配送单状态
    await db.collection('delivery_orders').updateOne(
      { id: deliveryId },
      { 
        $set: { 
          status: 'delivered',
          courierId,
          deliveredAt: new Date(),
          updatedAt: new Date()
        }
      }
    );
    
    // 更新关联订单状态
    for (const orderId of delivery.orderIds) {
      await db.collection('orders').updateOne(
        { id: orderId },
        { 
          $set: { 
            status: 'completed',
            'delivery.deliveryAddress': delivery.deliveryAddress,
            'delivery.actualTime': new Date(),
            updatedAt: new Date()
          },
          $push: {
            statusHistory: {
              status: 'completed',
              time: new Date(),
              actorId: courierId,
              actorType: 'courier',
              note: '配送完成'
            }
          }
        }
      );
      
      // 关闭订单的灯条绑定
      await LightBinding.updateOne(
        { orderId: orderId, status: 'active' },
        { 
          $set: { 
            status: 'completed',
            completedAt: new Date()
          }
        }
      );
    }
    
    // 关闭灯条
    const topic = `dryclean/prod/${delivery.storeId}/light`;
    lightService.publish(topic, {
      action: 'all_off',
      mode: 'delivery_complete',
      deliveryId,
      timestamp: Date.now()
    });
    
    console.log(`[取件] 配送完成 - 配送单: ${deliveryId}`);
    
    res.json({
      success: true,
      data: {
        deliveryId,
        status: 'delivered',
        orderCount: delivery.orderIds.length
      }
    });
    
  } catch (error) {
    console.error('[取件] 配送完成确认失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 验证取件码
// POST /api/store/pickup/verify
// ============================================

/**
 * 验证取件码
 * POST /api/store/pickup/verify
 */
router.post('/verify', async (req, res) => {
  try {
    const { code, orderId } = req.body;
    const db = mongoose.connection.db;
    
    let order = null;
    
    // 优先用 orderId 查找
    if (orderId) {
      order = await db.collection('orders').findOne({ 
        $or: [
          { _id: mongoose.Types.ObjectId.isValid(orderId) ? new mongoose.Types.ObjectId(orderId) : null },
          { id: orderId },
          { orderNo: orderId }
        ].filter(c => c._id !== null || c.id !== null)
      });
      // 如果 ObjectId 无效，只按 id 和 orderNo 查
      if (!order) {
        order = await db.collection('orders').findOne({ 
          $or: [{ id: orderId }, { orderNo: orderId }]
        });
      }
    }
    
    // 用取件码查找
    if (!order && code) {
      order = await db.collection('orders').findOne({ 
        $or: [
          { pickupCode: code },
          { orderNo: code },
          { id: code }
        ]
      });
    }
    
    if (!order) {
      return res.json({
        success: false,
        message: '未找到匹配的订单，请检查取件码是否正确'
      });
    }
    
    // 检查订单状态
    const validStatuses = ['ready', 'in_progress', 'cleaned', 'paid'];
    if (!validStatuses.includes(order.status)) {
      return res.json({
        success: false,
        message: `订单当前状态为"${order.status}"，无法取件`
      });
    }
    
    // 查询灯条绑定状态
    const binding = await LightBinding.findOne({ 
      orderId: order.orderNo, 
      status: 'active' 
    });
    
    // 构建响应
    const itemCount = order.items ? order.items.reduce((sum, item) => sum + (item.quantity || 1), 0) : 0;
    
    res.json({
      success: true,
      message: binding ? '取件码验证成功，灯条已激活' : '取件码验证成功',
      data: {
        _id: order._id,
        id: order._id || order.id,
        orderNo: order.orderNo,
        storeId: order.storeId,
        status: order.status,
        items: order.items || [],
        itemCount,
        totalAmount: order.amounts?.total || 0,
        contactName: order.contactName || '客户',
        contactPhone: order.contactPhone || '',
        pickupCode: order.pickupCode || order.orderNo,
        lightBinding: binding ? {
          bindingId: binding._id,
          lightId: binding.lightId,
          color: binding.color
        } : null
      }
    });
    
  } catch (error) {
    console.error('[取件] 验证取件码失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 店员确认取货（通用）
// 不管哪种取件方式，都需要店员手动确认取货
// ============================================

/**
 * 店员确认取货 - 关闭灯条
 * POST /api/store/pickup/confirm-pickup
 */
router.post('/confirm-pickup', async (req, res) => {
  try {
    const { orderNo, storeId, staffId, pickupType, remark } = req.body;
    const lightService = require('../../../services/lightService');
    const db = mongoose.connection.db;
    
    if (!orderNo || !storeId) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：orderNo, storeId'
      });
    }
    
    // 获取订单
    const order = await db.collection('orders').findOne({ orderNo });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: '订单不存在'
      });
    }
    
    // 关闭灯条绑定
    const binding = await LightBinding.findOneAndUpdate(
      { orderId: orderNo, status: 'active' },
      { 
        $set: { 
          status: 'completed',
          completedAt: new Date(),
          remark: remark || `店员${staffId || 'unknown'}确认取货`
        }
      },
      { new: true }
    );
    
    // 发布MQTT关闭命令
    const topic = `dryclean/prod/${storeId}/light`;
    lightService.publish(topic, {
      action: 'all_off',
      orderNo,
      pickupType,
      confirmedBy: staffId,
      timestamp: Date.now()
    });
    
    // 更新订单状态
    await db.collection('orders').updateOne(
      { orderNo },
      { 
        $set: { 
          status: 'completed',
          updatedAt: new Date()
        },
        $push: {
          statusHistory: {
            status: 'completed',
            time: new Date(),
            actorId: staffId,
            actorType: 'store_staff',
            note: pickupType === 'store_pickup' ? '到店取货完成' : '店员确认取货'
          }
        }
      }
    );
    
    console.log(`[取件] 店员确认取货 - 订单: ${orderNo}, 方式: ${pickupType || '未知'}`);
    
    res.json({
      success: true,
      data: {
        orderNo,
        pickupType: pickupType || 'unknown',
        lightBinding: binding ? { bindingId: binding._id } : null,
        completedAt: new Date()
      }
    });
    
  } catch (error) {
    console.error('[取件] 店员确认取货失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取门店当前待处理取件（灯条激活的订单）
 * GET /api/store/pickup/store/:storeId/active
 */
router.get('/store/:storeId/active', async (req, res) => {
  try {
    const { storeId } = req.params;
    
    // 获取该门店所有活跃的灯条绑定
    const bindings = await LightBinding.find({
      storeId,
      status: 'active'
    }).sort({ activatedAt: -1 });
    
    // 关联订单信息
    const db = mongoose.connection.db;
    const result = await Promise.all(bindings.map(async (binding) => {
      const order = await db.collection('orders').findOne({ orderNo: binding.orderId });
      
      return {
        bindingId: binding._id,
        orderNo: binding.orderId,
        bindingType: binding.bindingType,
        color: binding.color,
        activatedAt: binding.activatedAt,
        waitingTime: Math.round((Date.now() - new Date(binding.activatedAt).getTime()) / 60000),
        order: order ? {
          itemCount: order.items.length,
          totalAmount: order.amounts.total,
          deliveryType: order.delivery?.type
        } : null
      };
    }));
    
    res.json({
      success: true,
      data: {
        storeId,
        activeCount: result.length,
        bindings: result
      }
    });
    
  } catch (error) {
    console.error('[取件] 查询活跃取件失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
