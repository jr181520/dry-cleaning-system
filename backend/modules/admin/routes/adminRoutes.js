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

// 获取门店所有订单（M端使用）
router.get('/store/:storeId/orders', async (req, res) => {
  try {
    const { page, pageSize, status } = req.query;
    const result = await adminService.getStoreOrders(req.params.storeId, {
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 50,
      status
    });
    res.json(result);
  } catch (error) {
    console.error('[管理员] 获取门店订单失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取门店订单失败'
    });
  }
});

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

// ============================================
// 会员管理
// ============================================

// 获取所有用户会员信息列表
router.get('/members', async (req, res) => {
  try {
    const { page, pageSize, keyword, level } = req.query;
    const result = await adminService.getMembers({
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20,
      keyword,
      level
    });
    res.json(result);
  } catch (error) {
    console.error('[管理员] 获取会员列表失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取会员列表失败'
    });
  }
});

// 获取单个用户会员详情
router.get('/members/:userId', async (req, res) => {
  try {
    const result = await adminService.getMemberDetail(req.params.userId);
    res.json(result);
  } catch (error) {
    console.error('[管理员] 获取会员详情失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取会员详情失败'
    });
  }
});

// ============================================
// 多品类业务管理
// ============================================

// 获取所有启用的业务品类
router.get('/business/categories', (req, res) => {
  res.json({
    success: true,
    data: adminService.getBusinessCategories()
  });
});

// 获取品类的业务统计概览
router.get('/business/:category/stats', async (req, res) => {
  try {
    const result = await adminService.getCategoryStats(req.params.category);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取品类的订单列表
router.get('/business/:category/orders', async (req, res) => {
  try {
    const { page, pageSize, status, startDate, endDate, keyword } = req.query;
    const result = await adminService.getCategoryOrders(req.params.category, {
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20,
      status, startDate, endDate, keyword
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取品类的客户列表
router.get('/business/:category/customers', async (req, res) => {
  try {
    const { page, pageSize, keyword } = req.query;
    const result = await adminService.getCategoryCustomers(req.params.category, {
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20,
      keyword
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取品类的会员列表
router.get('/business/:category/members', async (req, res) => {
  try {
    const { page, pageSize, level, keyword } = req.query;
    const result = await adminService.getCategoryMembers(req.params.category, {
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20,
      level, keyword
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 数据完整性校验
// ============================================

// 全量数据完整性检查
router.get('/data-integrity', async (req, res) => {
  try {
    const result = await adminService.checkDataIntegrity();
    res.json(result);
  } catch (error) {
    console.error('[管理员] 数据完整性检查失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '数据完整性检查失败'
    });
  }
});

// 数据导出（全量数据JSON）
router.get('/data-export', async (req, res) => {
  try {
    const { type } = req.query; // users, orders, stores, all
    const result = await adminService.exportData(type || 'all');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="dryclean-${type || 'all'}-${Date.now()}.json"`);
    res.json(result);
  } catch (error) {
    console.error('[管理员] 数据导出失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '数据导出失败'
    });
  }
});

// ============================================
// 连锁企业管理
// ============================================

// 创建连锁企业
router.post('/chains', authMiddleware, requireRoles('admin'), async (req, res) => {
  try {
    const result = await adminService.createChain(req.body, req.user.id);
    res.json(result);
  } catch (error) {
    console.error('[连锁管理] 创建失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取连锁企业列表
router.get('/chains', authMiddleware, requireRoles('admin', 'chain_admin'), async (req, res) => {
  try {
    const { page, pageSize, keyword, status } = req.query;
    const result = await adminService.getChains({
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20,
      keyword, status,
      // chain_admin只能看自己的连锁
      adminId: req.user.roles.includes('chain_admin') && !req.user.roles.includes('admin') ? req.user.id : undefined
    });
    res.json(result);
  } catch (error) {
    console.error('[连锁管理] 获取列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取连锁企业详情
router.get('/chains/:chainId', authMiddleware, requireRoles('admin', 'chain_admin'), async (req, res) => {
  try {
    const result = await adminService.getChainDetail(req.params.chainId);
    res.json(result);
  } catch (error) {
    console.error('[连锁管理] 获取详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新连锁企业信息
router.put('/chains/:chainId', authMiddleware, requireRoles('admin'), async (req, res) => {
  try {
    const result = await adminService.updateChain(req.params.chainId, req.body);
    res.json(result);
  } catch (error) {
    console.error('[连锁管理] 更新失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除连锁企业
router.delete('/chains/:chainId', authMiddleware, requireRoles('admin'), async (req, res) => {
  try {
    const result = await adminService.deleteChain(req.params.chainId);
    res.json(result);
  } catch (error) {
    console.error('[连锁管理] 删除失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 门店加入连锁
router.post('/chains/:chainId/stores/:storeId', authMiddleware, requireRoles('admin'), async (req, res) => {
  try {
    const result = await adminService.setStoreToChain(req.params.storeId, req.params.chainId);
    res.json(result);
  } catch (error) {
    console.error('[连锁管理] 门店加入失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 门店移出连锁
router.delete('/chains/:chainId/stores/:storeId', authMiddleware, requireRoles('admin'), async (req, res) => {
  try {
    const result = await adminService.removeStoreFromChain(req.params.storeId);
    res.json(result);
  } catch (error) {
    console.error('[连锁管理] 门店移出失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 连锁仪表盘
router.get('/chains/:chainId/dashboard', authMiddleware, requireRoles('admin', 'chain_admin'), async (req, res) => {
  try {
    const result = await adminService.getChainDashboard(req.params.chainId);
    res.json(result);
  } catch (error) {
    console.error('[连锁管理] 仪表盘失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 连锁订单列表
router.get('/chains/:chainId/orders', authMiddleware, requireRoles('admin', 'chain_admin'), async (req, res) => {
  try {
    const { page, pageSize, keyword, status, storeId, startDate, endDate } = req.query;
    const result = await adminService.getChainOrders(req.params.chainId, {
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20,
      keyword, status, storeId, startDate, endDate
    });
    res.json(result);
  } catch (error) {
    console.error('[连锁管理] 获取订单失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取未关联连锁的门店列表
router.get('/unchained-stores', authMiddleware, requireRoles('admin'), async (req, res) => {
  try {
    const result = await adminService.getUnchainedStores();
    res.json(result);
  } catch (error) {
    console.error('[连锁管理] 获取未关联门店失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 资金管理
// ============================================

// 资金概览
router.get('/chains/:chainId/finance/overview', authMiddleware, requireRoles('admin', 'chain_admin'), async (req, res) => {
  try {
    const result = await adminService.getChainFinanceOverview(req.params.chainId);
    res.json(result);
  } catch (error) {
    console.error('[资金管理] 概览失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 资金流水记录
router.get('/chains/:chainId/finance/records', authMiddleware, requireRoles('admin', 'chain_admin'), async (req, res) => {
  try {
    const { page, pageSize, type, startDate, endDate } = req.query;
    const result = await adminService.getChainFinanceRecords(req.params.chainId, {
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 10,
      type, startDate, endDate
    });
    res.json(result);
  } catch (error) {
    console.error('[资金管理] 流水记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 门店资金统计
router.get('/chains/:chainId/finance/stores', authMiddleware, requireRoles('admin', 'chain_admin'), async (req, res) => {
  try {
    const result = await adminService.getChainStoreFinance(req.params.chainId);
    res.json(result);
  } catch (error) {
    console.error('[资金管理] 门店资金失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 资金趋势
router.get('/chains/:chainId/finance/trend', authMiddleware, requireRoles('admin', 'chain_admin'), async (req, res) => {
  try {
    const result = await adminService.getChainFinanceTrend(req.params.chainId);
    res.json(result);
  } catch (error) {
    console.error('[资金管理] 趋势失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 结算中心
// ============================================

// 结算概览
router.get('/chains/:chainId/settlement/overview', authMiddleware, requireRoles('admin', 'chain_admin'), async (req, res) => {
  try {
    const result = await adminService.getChainSettlementOverview(req.params.chainId);
    res.json(result);
  } catch (error) {
    console.error('[结算中心] 概览失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 结算单列表
router.get('/chains/:chainId/settlements', authMiddleware, requireRoles('admin', 'chain_admin'), async (req, res) => {
  try {
    const { page, pageSize, status } = req.query;
    const result = await adminService.getChainSettlements(req.params.chainId, {
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 10,
      status
    });
    res.json(result);
  } catch (error) {
    console.error('[结算中心] 列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建结算单
router.post('/chains/:chainId/settlements/create', authMiddleware, requireRoles('admin', 'chain_admin'), async (req, res) => {
  try {
    const { period, storeId, ratio, remark } = req.body;
    const result = await adminService.createChainSettlement(req.params.chainId, {
      period, storeId, ratio, remark
    }, req.user);
    res.json(result);
  } catch (error) {
    console.error('[结算中心] 创建失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 门店结算权限管理
// ============================================

// 获取门店结算权限列表
router.get('/chains/:chainId/settlement/stores', authMiddleware, requireRoles('admin', 'chain_admin'), async (req, res) => {
  try {
    const result = await adminService.getSettlementStores(req.params.chainId);
    res.json(result);
  } catch (error) {
    console.error('[结算权限] 获取门店列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新门店结算权限
router.put('/chains/:chainId/settlement/stores/:storeId', authMiddleware, requireRoles('admin', 'chain_admin'), async (req, res) => {
  try {
    const { storeType, terminalSettlementEnabled, settlementRatio } = req.body;
    const result = await adminService.updateStoreSettlementConfig(
      req.params.chainId, 
      req.params.storeId, 
      { storeType, terminalSettlementEnabled, settlementRatio }
    );
    res.json(result);
  } catch (error) {
    console.error('[结算权限] 更新门店配置失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 批量更新门店结算权限
router.post('/chains/:chainId/settlement/stores/batch-update', authMiddleware, requireRoles('admin', 'chain_admin'), async (req, res) => {
  try {
    const { storeIds, storeType, terminalSettlementEnabled, settlementRatio } = req.body;
    const result = await adminService.batchUpdateStoreSettlementConfig(
      req.params.chainId, 
      storeIds, 
      { storeType, terminalSettlementEnabled, settlementRatio }
    );
    res.json(result);
  } catch (error) {
    console.error('[结算权限] 批量更新门店配置失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
