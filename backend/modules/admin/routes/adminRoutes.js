/**
 * 管理员路由
 * 提供系统管理接口
 */

const express = require('express');
const router = express.Router();
const adminService = require('../services/adminService');
const { authMiddleware, requireRoles } = require('../../common/middlewares/auth');
const MODULE_CONFIG = require('../../../config/modules');

// 所有路由需要管理员权限
router.use(authMiddleware);
router.use(requireRoles('admin'));

// ============================================
// 仪表盘
// ============================================

// 获取仪表盘数据
router.get('/dashboard', async (req, res) => {
  try {
    const result = await adminService.getDashboard();
    res.json(result);
  } catch (error) {
    console.error('[管理员] 仪表盘接口失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取仪表盘数据失败'
    });
  }
});

// ============================================
// 用户管理
// ============================================

// 获取用户列表
router.get('/users', async (req, res) => {
  try {
    const { page, pageSize, keyword, role, status } = req.query;
    const result = await adminService.getUsers({
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20,
      keyword,
      role,
      status
    });
    res.json(result);
  } catch (error) {
    console.error('[管理员] 获取用户列表失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取用户列表失败'
    });
  }
});

// 获取用户详情
router.get('/users/:id', async (req, res) => {
  try {
    const result = await adminService.getUserById(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('[管理员] 获取用户详情失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取用户详情失败'
    });
  }
});

// 更新用户状态
router.put('/users/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const result = await adminService.updateUserStatus(req.params.id, status);
    res.json(result);
  } catch (error) {
    console.error('[管理员] 更新用户状态失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '更新用户状态失败'
    });
  }
});

// ============================================
// 门店管理
// ============================================

// 获取门店列表
router.get('/stores', async (req, res) => {
  try {
    const { page, pageSize, keyword, status } = req.query;
    const result = await adminService.getStores({
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20,
      keyword,
      status
    });
    res.json(result);
  } catch (error) {
    console.error('[管理员] 获取门店列表失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取门店列表失败'
    });
  }
});

// 更新门店状态
router.put('/stores/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const result = await adminService.updateStoreStatus(req.params.id, status);
    res.json(result);
  } catch (error) {
    console.error('[管理员] 更新门店状态失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '更新门店状态失败'
    });
  }
});

// 创建门店
router.post('/stores', async (req, res) => {
  try {
    // 开发模式：使用adminService直接创建门店（避免ownerId验证问题）
    if (process.env.NODE_ENV !== 'production') {
      const result = await adminService.createStore(req.body);
      res.json({ success: true, data: result, message: '门店创建成功' });
      return;
    }
    
    // 生产模式：使用storeService创建门店
    const storeService = require('../../cleaning/services/storeService');
    const store = await storeService.createStore(req.user.id, req.body);
    res.json({ success: true, data: store, message: '门店创建成功' });
  } catch (error) {
    console.error('[管理员] 创建门店失败:', error);
    res.status(400).json({
      success: false,
      error: 'server_error',
      message: error.message || '创建门店失败'
    });
  }
});

// 批量导入门店
router.post('/stores/import', async (req, res) => {
  try {
    const { stores } = req.body;
    
    if (!stores || !Array.isArray(stores) || stores.length === 0) {
      res.status(400).json({
        success: false,
        error: 'invalid_data',
        message: '请提供有效的门店数据数组'
      });
      return;
    }

    if (stores.length > 100) {
      res.status(400).json({
        success: false,
        error: 'too_many_records',
        message: '单次导入最多支持100条门店数据'
      });
      return;
    }

    // 开发模式：使用adminService直接导入
    if (process.env.NODE_ENV !== 'production') {
      const result = await adminService.importStores(stores);
      res.json({
        success: true,
        data: result.data,
        message: `批量导入完成：成功${result.data.success}条，失败${result.data.failed}条`
      });
      return;
    }
    
    // 生产模式：使用adminService导入
    const result = await adminService.importStores(stores);
    res.json({
      success: true,
      data: result.data,
      message: `批量导入完成：成功${result.data.success}条，失败${result.data.failed}条`
    });
  } catch (error) {
    console.error('[管理员] 批量导入门店失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: error.message || '批量导入门店失败'
    });
  }
});

// 更新门店信息
router.put('/stores/:id', async (req, res) => {
  try {
    const storeService = require('../../cleaning/services/storeService');
    const store = await storeService.updateStore(req.params.id, req.user.id, req.body);
    res.json({ success: true, data: store, message: '门店更新成功' });
  } catch (error) {
    console.error('[管理员] 更新门店失败:', error);
    res.status(400).json({
      success: false,
      error: 'server_error',
      message: error.message || '更新门店失败'
    });
  }
});

// 获取门店详情
router.get('/stores/:id', async (req, res) => {
  try {
    const storeService = require('../../cleaning/services/storeService');
    const store = await storeService.getStoreById(req.params.id);
    res.json({ success: true, data: store });
  } catch (error) {
    console.error('[管理员] 获取门店详情失败:', error);
    res.status(404).json({
      success: false,
      error: 'server_error',
      message: error.message || '获取门店详情失败'
    });
  }
});

// ============================================
// 门店入驻申请管理
// ============================================

// 获取申请列表
router.get('/store-applications', async (req, res) => {
  try {
    const { status, keyword } = req.query;
    const result = await adminService.getStoreApplications({ status, keyword });
    res.json(result);
  } catch (error) {
    console.error('[管理员] 获取申请列表失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取申请列表失败'
    });
  }
});

// 创建申请
router.post('/store-applications', async (req, res) => {
  try {
    const result = await adminService.createStoreApplication(req.body);
    res.json({ success: true, data: result, message: '申请提交成功' });
  } catch (error) {
    console.error('[管理员] 创建申请失败:', error);
    res.status(400).json({
      success: false,
      error: 'server_error',
      message: error.message || '创建申请失败'
    });
  }
});

// 更新申请状态
router.put('/store-applications/:id', async (req, res) => {
  try {
    const result = await adminService.updateStoreApplication(req.params.id, req.body);
    res.json({ success: true, data: result, message: '申请更新成功' });
  } catch (error) {
    console.error('[管理员] 更新申请失败:', error);
    res.status(400).json({
      success: false,
      error: 'server_error',
      message: error.message || '更新申请失败'
    });
  }
});

// 获取申请详情
router.get('/store-applications/:id', async (req, res) => {
  try {
    const result = await adminService.getStoreApplicationById(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[管理员] 获取申请详情失败:', error);
    res.status(404).json({
      success: false,
      error: 'server_error',
      message: '获取申请详情失败'
    });
  }
});

// BD通信消息
router.post('/store-applications/:id/messages', async (req, res) => {
  try {
    const result = await adminService.addApplicationMessage(req.params.id, req.body);
    res.json({ success: true, data: result, message: '消息已发送' });
  } catch (error) {
    console.error('[管理员] 发送消息失败:', error);
    res.status(400).json({
      success: false,
      error: 'server_error',
      message: '发送消息失败'
    });
  }
});

// 获取BD通信消息
router.get('/store-applications/:id/messages', async (req, res) => {
  try {
    const result = await adminService.getApplicationMessages(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[管理员] 获取消息失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取消息失败'
    });
  }
});

// ============================================
// 订单管理
// ============================================

// 获取订单列表
router.get('/orders', async (req, res) => {
  try {
    const { page, pageSize, keyword, status, orderType, startDate, endDate } = req.query;
    const result = await adminService.getOrders({
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20,
      keyword,
      status,
      orderType,
      startDate,
      endDate
    });
    res.json(result);
  } catch (error) {
    console.error('[管理员] 获取订单列表失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取订单列表失败'
    });
  }
});

// 获取订单详情
router.get('/orders/:id', async (req, res) => {
  try {
    const result = await adminService.getOrderById(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('[管理员] 获取订单详情失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取订单详情失败'
    });
  }
});

// ============================================
// 模块管理
// ============================================

// 获取模块配置
router.get('/modules', (req, res) => {
  res.json({
    success: true,
    data: MODULE_CONFIG
  });
});

// 更新模块配置
router.put('/modules/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { enabled, message } = req.body;

    if (!MODULE_CONFIG.modules[name]) {
      return res.status(404).json({
        success: false,
        error: 'module_not_found',
        message: '模块不存在'
      });
    }

    // 注意：实际生产环境应该写入配置文件或数据库
    // 这里只是演示，实际不会生效
    MODULE_CONFIG.modules[name].enabled = enabled;
    if (message !== undefined) {
      MODULE_CONFIG.modules[name].message = message;
    }

    res.json({
      success: true,
      data: MODULE_CONFIG.modules[name],
      message: '模块配置已更新（演示模式，重启服务后生效）'
    });
  } catch (error) {
    console.error('[管理员] 更新模块配置失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '更新模块配置失败'
    });
  }
});

// ============================================
// 管理员账户管理
// ============================================

// 创建管理员
router.post('/admins', async (req, res) => {
  try {
    const { phone, password, name } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        error: 'invalid_params',
        message: '手机号和密码不能为空'
      });
    }

    const result = await adminService.createAdmin({ phone, password, name });
    res.json(result);
  } catch (error) {
    console.error('[管理员] 创建管理员失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '创建管理员失败'
    });
  }
});

// ============================================
// 系统设置
// ============================================

// 获取系统配置
router.get('/settings', (req, res) => {
  res.json({
    success: true,
    data: {
      version: MODULE_CONFIG.VERSION,
      modules: Object.keys(MODULE_CONFIG.modules),
      features: Object.keys(MODULE_CONFIG.features),
      payment: {
        platformRatio: MODULE_CONFIG.payment.receivers.platform.ratio,
        storeRatio: MODULE_CONFIG.payment.receivers.store.ratio
      }
    }
  });
});

// 更新系统配置
router.put('/settings', async (req, res) => {
  try {
    const { platformRatio } = req.body;

    // 实际生产环境应该写入配置文件
    if (platformRatio !== undefined) {
      MODULE_CONFIG.payment.receivers.platform.ratio = platformRatio;
      MODULE_CONFIG.payment.receivers.store.ratio = 1 - platformRatio;
    }

    res.json({
      success: true,
      data: MODULE_CONFIG.payment,
      message: '系统配置已更新（演示模式，重启服务后生效）'
    });
  } catch (error) {
    console.error('[管理员] 更新系统配置失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '更新系统配置失败'
    });
  }
});

// ============================================
// 一键取货管理
// ============================================

// 获取门店待取件订单列表
router.get('/store/:storeId/pending-orders', async (req, res) => {
  try {
    const result = await adminService.getStorePendingOrders(req.params.storeId);
    res.json(result);
  } catch (error) {
    console.error('[管理员] 获取待取件订单失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取待取件订单失败'
    });
  }
});

// 一键取货（批量完成）
router.post('/store/:storeId/batch-pickup', async (req, res) => {
  try {
    const result = await adminService.batchPickupOrders(req.params.storeId, req.user);
    res.json(result);
  } catch (error) {
    console.error('[管理员] 一键取货失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '一键取货失败'
    });
  }
});

// ============================================
// 智能灯条管理
// ============================================

// 获取智能灯条状态
router.get('/store/:storeId/light-status', async (req, res) => {
  try {
    const result = await adminService.getLightStatus(req.params.storeId);
    res.json(result);
  } catch (error) {
    console.error('[管理员] 获取灯条状态失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取灯条状态失败'
    });
  }
});

// 点亮取货灯
router.post('/store/:storeId/light-up', async (req, res) => {
  try {
    const { orderIds, priority } = req.body;
    const result = await adminService.triggerLightUp(req.params.storeId, {
      orderIds,
      priority,
      action: 'pickup_ready'
    });
    res.json(result);
  } catch (error) {
    console.error('[管理员] 点亮灯条失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '点亮灯条失败'
    });
  }
});

// 关闭取货灯
router.post('/store/:storeId/light-off', async (req, res) => {
  try {
    const { orderIds } = req.body;
    const result = await adminService.triggerLightOff(req.params.storeId, {
      orderIds,
      action: 'pickup_complete'
    });
    res.json(result);
  } catch (error) {
    console.error('[管理员] 关闭灯条失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '关闭灯条失败'
    });
  }
});

// 全部关闭灯条（营业结束）
router.post('/store/:storeId/light-all-off', async (req, res) => {
  try {
    const result = await adminService.triggerAllLightOff(req.params.storeId);
    res.json(result);
  } catch (error) {
    console.error('[管理员] 关闭全部灯条失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '关闭全部灯条失败'
    });
  }
});

// ============================================
// 前端兼容路由（lights路径适配）
// ============================================

// 点亮单个灯条
router.post('/lights/:storeId/turn-on', async (req, res) => {
  try {
    const result = await adminService.triggerLightUp(req.params.storeId, {
      orderIds: req.body.lightId ? [req.body.lightId] : [],
      priority: req.body.priority || 'normal'
    });
    res.json(result);
  } catch (error) {
    console.error('[管理员] 点亮灯条失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 关闭单个灯条
router.post('/lights/:storeId/turn-off', async (req, res) => {
  try {
    const result = await adminService.triggerLightOff(req.params.storeId, {
      orderIds: req.body.lightId ? [req.body.lightId] : []
    });
    res.json(result);
  } catch (error) {
    console.error('[管理员] 关闭灯条失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 点亮全部灯条
router.post('/lights/:storeId/turn-on-all', async (req, res) => {
  try {
    const result = await adminService.triggerLightUp(req.params.storeId, {
      orderIds: [],
      priority: 'high'
    });
    res.json(result);
  } catch (error) {
    console.error('[管理员] 点亮全部灯条失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 关闭全部灯条
router.post('/lights/:storeId/turn-off-all', async (req, res) => {
  try {
    const result = await adminService.triggerAllLightOff(req.params.storeId);
    res.json(result);
  } catch (error) {
    console.error('[管理员] 关闭全部灯条失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取门店 MQTT 连接配置
router.get('/store/:storeId/mqtt-config', async (req, res) => {
  try {
    const result = await adminService.getStoreMqttConfig(req.params.storeId);
    res.json(result);
  } catch (error) {
    console.error('[管理员] 获取MQTT配置失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取MQTT配置失败'
    });
  }
});

// 检查门店灯条连接状态
router.get('/store/:storeId/light-connection', async (req, res) => {
  try {
    const result = await adminService.checkLightConnection(req.params.storeId);
    res.json(result);
  } catch (error) {
    console.error('[管理员] 检查灯条连接失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '检查灯条连接失败'
    });
  }
});

// 获取终端列表（所有在线终端）
router.get('/terminals', async (req, res) => {
  try {
    const lightService = require('../../../services/lightService');
    const terminals = lightService.getTerminals();
    res.json({
      success: true,
      data: terminals
    });
  } catch (error) {
    console.error('[管理员] 获取终端列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取门店终端灯条状态
router.get('/store/:storeId/terminal-lights', async (req, res) => {
  try {
    const lightService = require('../../../services/lightService');
    const lights = lightService.getStoreLights(req.params.storeId);
    res.json({
      success: true,
      data: {
        storeId: req.params.storeId,
        lights,
        online: lights.length > 0
      }
    });
  } catch (error) {
    console.error('[管理员] 获取门店终端失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 配送管理
// ============================================

// 获取配送订单列表
router.get('/delivery/orders', async (req, res) => {
  try {
    const { status, storeId } = req.query;
    const result = await adminService.getDeliveryOrders({ status, storeId });
    res.json(result);
  } catch (error) {
    console.error('[管理员] 获取配送订单失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取配送订单失败'
    });
  }
});

// 创建配送订单
router.post('/delivery/create', async (req, res) => {
  try {
    const { orderId, storeId, address, contactName, contactPhone } = req.body;
    const result = await adminService.createDeliveryOrder({
      orderId,
      storeId,
      address,
      contactName,
      contactPhone
    }, req.user);
    res.json(result);
  } catch (error) {
    console.error('[管理员] 创建配送订单失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '创建配送订单失败'
    });
  }
});

module.exports = router;
