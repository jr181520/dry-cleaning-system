/**
 * 后端入口文件
 * 模块化架构
 */

// 加载环境变量（指定 .env 文件位置）
const path = require('path');
require('dotenv').config({ 
  path: path.resolve(__dirname, '.env') 
});

// 调试：打印环境变量
console.log('[dotenv] WX_MINI_APP_ID:', process.env.WX_MINI_APP_ID ? '已设置' : '未设置');

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { initDatabase, closeDatabase } = require('./config');

// 导入各模块路由
const cleaningRouter = require('./modules/cleaning/routes');
const recycleRouter = require('./modules/recycle/routes');
const rentalRouter = require('./modules/rental/routes');
const authRouter = require('./modules/common/routes/authRoutes');
const storeRouter = require('./modules/cleaning/routes/storeRoutes');
const paymentRouter = require('./modules/common/routes/paymentRoutes');
const categoryRouter = require('./modules/common/routes/categoryRoutes');
const deliveryRouter = require('./modules/common/routes/deliveryRoutes');
const adminRouter = require('./modules/admin/routes/adminRoutes');
const priceRouter = require('./modules/admin/routes/priceRoutes');
const miniQRRouter = require('./modules/common/routes/miniQRRoutes');
const { getEnabledModules, getModuleConfig } = require('./modules/common/middlewares/moduleGuard');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static(path.join(__dirname, '..')));

// Favicon（避免 404）
app.get('/favicon.ico', (req, res) => {
  res.type('image/svg+xml');
  res.send('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#3b82f6"/><text x="50" y="72" font-size="65" text-anchor="middle">👕</text></svg>');
});

// ============================================
// 系统接口（无需模块守卫）
// ============================================

/**
 * 获取系统模块状态
 * GET /api/system/modules
 */
app.get('/api/system/modules', (req, res) => {
  const enabledModules = getEnabledModules();
  res.json({
    success: true,
    data: {
      version: require('./config/modules').VERSION,
      modules: require('./config/modules').modules,
      features: require('./config/modules').features,
      enabledModules
    }
  });
});

/**
 * 获取单个模块配置
 * GET /api/system/modules/:name
 */
app.get('/api/system/modules/:name', (req, res) => {
  const config = getModuleConfig(req.params.name);
  if (!config) {
    return res.status(404).json({ success: false, error: '模块不存在' });
  }
  res.json({ success: true, data: config });
});

/**
 * 健康检查
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// 业务模块接口
// ============================================

// 认证模块
app.use('/api/auth', authRouter);

// 门店管理
app.use('/api/stores', storeRouter);

// 干洗模块
app.use('/api/cleaning', cleaningRouter);

// 回收模块（V2）
app.use('/api/recycle', recycleRouter);

// 租赁模块
app.use('/api/rental', rentalRouter);

// 多品类公共API
app.use('/api/categories', categoryRouter);

// 支付模块
app.use('/api/payments', paymentRouter);

// 微信小程序码模块
app.use('/api/mini-qr', miniQRRouter);

// 配送模块
app.use('/api/delivery', deliveryRouter);

// 会员信息模块
const memberRouter = require('./modules/member/routes/memberRoutes');
app.use('/api/member', memberRouter);

// 管理员后台
app.use('/api/admin', adminRouter);

// 连锁后台（连锁管理员专用）
const chainAdminRouter = require('./modules/admin/routes/chainAdminRoutes');
app.use('/api/chain-admin', chainAdminRouter);

// 门店价格管理（门店/管理员可访问）
app.use('/api/store/prices', priceRouter);

// 门店端公共API（无需认证）
const publicRouter = require('./modules/store/routes/publicRoutes');
app.use('/api/store', publicRouter);

// 订单-灯条绑定API
const orderLightRouter = require('./modules/store/routes/orderLightRoutes');
app.use('/api/store/order-light', orderLightRouter);

// C端取件API
const pickupRouter = require('./modules/store/routes/pickupRoutes');
app.use('/api/store/pickup', pickupRouter);

// 统一数据同步API（跨平台数据一致性）
const syncRouter = require('./modules/common/routes/syncRoutes');
app.use('/api/sync', syncRouter);

// ============================================
// C端客服工单API
// ============================================
const adminService = require('./modules/admin/services/adminService');

app.post('/api/service-tickets/submit', async (req, res) => {
  try {
    const result = await adminService.submitTicketFromC(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/service-tickets/my', async (req, res) => {
  try {
    const { customerId } = req.query;
    if (!customerId) return res.status(400).json({ success: false, error: '缺少customerId' });
    const result = await adminService.getMyTickets(customerId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/service-tickets/detail/:id', async (req, res) => {
  try {
    const result = await adminService.getTicketById(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 门店入驻申请公共API（商家提交申请，无需认证）
// ============================================

// 商家提交入驻申请（公开接口，无需admin认证）
app.post('/api/store-applications/submit', async (req, res) => {
  try {
    const result = await adminService.createStoreApplication(req.body);
    console.log('[入驻申请] 新申请提交:', req.body.storeName, req.body.applicationId);
    res.json(result);
  } catch (error) {
    console.error('[入驻申请] 提交失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 查询申请状态（公开接口，商家自助查询）
app.get('/api/store-applications/status', async (req, res) => {
  try {
    const { phone, applicationId } = req.query;
    if (!phone && !applicationId) {
      return res.status(400).json({ success: false, error: '请提供手机号或申请编号' });
    }
    const result = await adminService.getApplicationStatus({ phone, applicationId });
    res.json(result);
  } catch (error) {
    console.error('[入驻申请] 查询状态失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 通知中心API（Admin端轮询获取实时通知）
// ============================================
const notificationHubService = require('./services/notificationHubService');
const crossSyncService = require('./services/crossSyncService');
const messageService = require('./services/messageService');

// 获取门店通知列表
app.get('/api/admin/notifications/:storeId', (req, res) => {
  try {
    const { storeId } = req.params;
    const { limit, since } = req.query;
    const result = notificationHubService.getNotifications(
      storeId,
      limit ? parseInt(limit) : 20,
      since ? parseInt(since) : 0
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[通知中心] 查询失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取所有门店通知（汇总）
app.get('/api/admin/notifications', (req, res) => {
  try {
    const { limit, since } = req.query;
    const result = notificationHubService.getNotifications(
      'ALL',
      limit ? parseInt(limit) : 30,
      since ? parseInt(since) : 0
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[通知中心] 查询所有通知失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 标记通知为已读
app.post('/api/admin/notifications/:storeId/mark-read', (req, res) => {
  try {
    const { storeId } = req.params;
    const { notificationIds } = req.body;
    if (!notificationIds || !Array.isArray(notificationIds)) {
      return res.status(400).json({ success: false, error: '缺少 notificationIds 参数' });
    }
    const result = notificationHubService.markAsRead(storeId, notificationIds);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[通知中心] 标记已读失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 通知摘要 — Admin铃铛轮询用
 * GET /api/admin/notification-summary
 * 返回: { pendingApplications, openTickets, urgentTickets, unreadMessages, recentNotifications }
 */
app.get('/api/admin/notification-summary', async (req, res) => {
  try {
    // 1. 待审批门店申请数
    let pendingApplications = 0;
    try {
      const apps = await adminService.getStoreApplications({ status: 'pending' });
      if (apps && apps.success && apps.data) {
        pendingApplications = Array.isArray(apps.data) ? apps.data.length : 0;
      }
    } catch (e) { /* ignore */ }

    // 2. 客服工单统计
    let openTickets = 0, urgentTickets = 0;
    try {
      const ticketStats = await adminService.getTicketStats();
      if (ticketStats && ticketStats.success && ticketStats.data) {
        openTickets = ticketStats.data.open || 0;
        urgentTickets = ticketStats.data.urgentCount || 0;
      }
    } catch (e) { /* ignore */ }

    // 3. 未读消息数
    let unreadMessages = 0;
    try {
      const msgs = messageService.getMessages({ storeId: 'ALL', limit: 200 });
      unreadMessages = msgs.unreadCount || 0;
    } catch (e) { /* ignore */ }

    // 4. 最近通知（NotificationHub）
    let recentNotifications = [];
    try {
      const hubData = notificationHubService.getNotifications('ALL', 10, 0);
      recentNotifications = (hubData || []).slice(0, 8).map(n => ({
        id: n.id,
        type: n.type || n.event || 'system',
        title: n.title || n.event || '系统通知',
        message: n.message || '',
        priority: n.priority || 'normal',
        time: n.createdAt || n.time || Date.now(),
        read: n.read || false,
        orderNo: n.orderNo || null,
        storeId: n.storeId || null
      }));
    } catch (e) { /* ignore */ }

    const totalUnread = pendingApplications + openTickets + urgentTickets + unreadMessages;

    res.json({
      success: true,
      data: {
        pendingApplications,
        openTickets,
        urgentTickets,
        unreadMessages,
        totalUnread,
        recentNotifications
      }
    });
  } catch (error) {
    console.error('[通知摘要] 查询失败:', error);
    res.json({ success: true, data: { pendingApplications: 0, openTickets: 0, urgentTickets: 0, unreadMessages: 0, totalUnread: 0, recentNotifications: [] } });
  }
});

// ============================================
// 跨系统数据同步API（index ↔ m-index 双向同步）
// ============================================

// 获取同步状态（各前端可轮询检测对方是否在线）
app.get('/api/sync/status', (req, res) => {
  try {
    const status = crossSyncService.getSyncStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('[跨端同步] 获取状态失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 注册客户端（页面加载时调用，告知后端自己在线的身份）
app.post('/api/sync/register', (req, res) => {
  try {
    const { clientId, clientType, storeId, userAgent } = req.body;
    if (!clientId || !clientType) {
      return res.status(400).json({ success: false, error: '缺少 clientId 或 clientType' });
    }
    crossSyncService.registerClient(clientId, { type: clientType, storeId, userAgent });
    res.json({ success: true, data: { registered: true } });
  } catch (error) {
    console.error('[跨端同步] 注册失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新心跳（前端定期发送）
app.post('/api/sync/heartbeat', (req, res) => {
  try {
    const { clientId } = req.body;
    if (!clientId) {
      return res.status(400).json({ success: false, error: '缺少 clientId' });
    }
    crossSyncService.updateHeartbeat(clientId);
    res.json({ success: true, serverTime: Date.now() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 注销客户端（页面关闭时调用）
app.post('/api/sync/unregister', (req, res) => {
  try {
    const { clientId } = req.body;
    if (!clientId) {
      return res.status(400).json({ success: false, error: '缺少 clientId' });
    }
    crossSyncService.unregisterClient(clientId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取操作历史（用于同步检查）
app.get('/api/sync/operations', (req, res) => {
  try {
    const { source, limit, since } = req.query;
    const ops = crossSyncService.getOperations(
      source || null,
      limit ? parseInt(limit) : 50,
      since ? parseInt(since) : 0
    );
    res.json({ success: true, data: { operations: ops, total: ops.length } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 前端操作通知（index/m-index执行操作后通知后端，后端广播给另一端）
app.post('/api/sync/notify-operation', (req, res) => {
  try {
    const { source, clientId, operation } = req.body;
    if (!source || !operation) {
      return res.status(400).json({ success: false, error: '缺少 source 或 operation' });
    }
    const record = crossSyncService.recordOperation(source, {
      ...operation,
      clientId
    });
    res.json({ success: true, data: { syncId: record.id } });
  } catch (error) {
    console.error('[跨端同步] 通知操作失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 消息中心API（客户消息 + 账户通讯）
// ============================================

// 获取消息线程列表（消息中心左侧列表）
app.get('/api/messages/threads', (req, res) => {
  try {
    const { storeId } = req.query;
    const result = messageService.getThreads(storeId || 'ALL');
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[消息中心] 获取线程列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取消息列表
app.get('/api/messages', (req, res) => {
  try {
    const { storeId, type, threadId, limit, since } = req.query;
    const result = messageService.getMessages({
      storeId: storeId || 'ALL',
      type: type || null,
      threadId: threadId || null,
      limit: limit ? parseInt(limit) : 50,
      since: since ? parseInt(since) : 0
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[消息中心] 获取消息失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取未读消息数
app.get('/api/messages/unread-count', (req, res) => {
  try {
    const { storeId } = req.query;
    const result = messageService.getMessages({
      storeId: storeId || 'ALL',
      limit: 200
    });
    res.json({ success: true, data: { count: result.unreadCount } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 发送消息（Admin/Store 之间的通讯）
app.post('/api/messages', (req, res) => {
  try {
    const { threadId, fromType, fromId, fromName, toType, toId, type, subject, content, orderNo, storeId } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, error: '消息内容不能为空' });
    }
    const msg = messageService.addMessage({
      threadId: threadId || `direct_${Date.now()}`,
      fromType: fromType || 'admin',
      fromId: fromId || '',
      fromName: fromName || '管理员',
      toType: toType || 'store',
      toId: toId || '',
      type: type || 'direct_message',
      subject: subject || '',
      content,
      orderNo: orderNo || null,
      storeId: storeId || null
    });
    res.json({ success: true, data: msg });
  } catch (error) {
    console.error('[消息中心] 发送消息失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 标记消息为已读
app.post('/api/messages/read', (req, res) => {
  try {
    const { messageIds, threadId } = req.body;
    let result;
    if (threadId) {
      result = messageService.markThreadAsRead(threadId);
    } else if (messageIds && Array.isArray(messageIds)) {
      result = messageService.markAsRead(messageIds);
    } else {
      return res.status(400).json({ success: false, error: '需要 messageIds 或 threadId' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[消息中心] 标记已读失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 合并支付系统API（从api/payment-server迁移）
// ============================================

// 加载支付系统模块
const wechatPay = require('../api/payment-server/wechat-pay');
const alipay = require('../api/payment-server/alipay');
const unionpay = require('../api/payment-server/unionpay');
const balance = require('../api/payment-server/balance');
const posApi = require('../api/payment-server/pos-api');
const memberCardRoutes = require('../api/payment-server/member-card-routes');

// 注册支付系统路由
app.use('/api/pos', posApi);
app.use('/api/member-card', memberCardRoutes);

// 统一支付接口 - POST /api/payment/create
app.post('/api/payment/create', async (req, res) => {
  const {
    orderId,
    amount,
    subject,
    body,
    paymentMethod,
    userId,
    openid,
    returnUrl,
    clientIp
  } = req.body;

  if (!orderId || !amount || !paymentMethod) {
    return res.json({ success: false, error: '缺少必要参数' });
  }

  try {
    let result;
    const config = require('../api/payment-server/config');

    switch (paymentMethod) {
      case 'wechat':
        result = await wechatPay.createOrder({
          orderId,
          amount,
          description: subject || body || '干洗服务',
          openid,
          clientIp,
          tradeType: openid ? 'JSAPI' : 'NATIVE'
        });
        if (result.success && result.data?.prepayId) {
          const payParams = wechatPay.generateAppPayParams(result.data.prepayId);
          result.data.payParams = payParams;
        }
        break;

      case 'alipay':
        result = await alipay.createWebPayOrder({
          orderId,
          amount,
          subject: subject || '干洗服务',
          body,
          returnUrl: returnUrl || `${config.server.host}/payment/alipay/return`
        });
        break;

      case 'unionpay':
        result = await unionpay.createGatewayPayOrder({
          orderId,
          amount,
          subject: subject || '干洗服务',
          returnUrl: returnUrl || `${config.server.host}/payment/unionpay/return`
        });
        break;

      case 'balance':
        result = await balance.createPayment({
          userId,
          orderId,
          amount,
          paymentMethod: 'balance'
        });
        break;

      default:
        return res.json({ success: false, error: '不支持的支付方式' });
    }

    res.json(result);
  } catch (error) {
    console.error('[支付] 创建支付失败:', error);
    res.json({ success: false, error: error.message });
  }
});

// 支付查询接口 - GET /api/payment/query/:orderId
app.get('/api/payment/query/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    // 实现支付查询逻辑
    res.json({ success: true, data: { orderId, status: 'pending' } });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// 支付回调接口 - POST /api/payment/callback
app.post('/api/payment/callback', async (req, res) => {
  console.log('[支付回调]', req.body);
  res.json({ success: true });
});

// 会员余额查询 - GET /api/balance/:userId
app.get('/api/balance/:userId', async (req, res) => {
  try {
    const result = await balance.getUserBalance(req.params.userId);
    res.json(result);
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// 会员余额充值 - POST /api/balance/recharge
app.post('/api/balance/recharge', async (req, res) => {
  try {
    const { userId, amount, method } = req.body;
    const result = await balance.addBalance(userId, amount, method);
    res.json(result);
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// ============================================
// 微信小程序订单接口
// ============================================

// 待取件订单 - GET /api/orders/pending
const orderService = require('./modules/cleaning/services/orderService');
app.get('/api/orders/pending', async (req, res) => {
  try {
    const { userId } = req.query;
    const result = await orderService.getPendingPickupOrders(userId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[订单] 获取待取件订单失败:', error);
    res.json({ success: false, error: error.message });
  }
});

// 微信支付统一下单 - POST /api/payment/wechat/unified
app.post('/api/payment/wechat/unified', async (req, res) => {
  try {
    const { orderId, amount, openid, subject } = req.body;
    
    // 检查是否配置了微信支付
    const config = require('../api/payment-server/config');
    const isWechatPayConfigured = config.wechat.miniapp.mchId && config.wechat.miniapp.apiKey;
    
    // 如果未配置微信支付，使用模拟支付
    if (!isWechatPayConfigured || process.env.USE_MOCK_PAYMENT === 'true') {
      console.log('[模拟支付] 微信支付未配置，使用模拟支付');
      
      // 更新订单状态为已支付
      try {
        const orderService = require('./modules/cleaning/services/orderService');
        const mockTransactionId = 'MOCK_' + Date.now();
        await orderService.payOrder(orderId, { userId: openid }, {
          method: 'mock_wechat',
          transactionId: mockTransactionId
        });
        console.log('[模拟支付] 订单支付成功:', orderId);
      } catch (e) {
        console.error('[模拟支付] 更新订单状态失败:', e.message);
      }
      
      return res.json({
        success: true,
        mock: true,
        data: {
          orderId,
          mockPayment: true,
          message: '模拟支付成功（开发环境）'
        }
      });
    }
    
    const wechatPay = require('../api/payment-server/wechat-pay');
    const result = await wechatPay.createOrder({
      orderId,
      amount,
      description: subject || '干洗服务',
      openid,
      tradeType: 'JSAPI'
    });
    if (result.success && result.data?.prepayId) {
      const payParams = wechatPay.generateAppPayParams(result.data.prepayId);
      result.data.payParams = payParams;
    }
    res.json(result);
  } catch (error) {
    console.error('[微信支付] 创建订单失败:', error);
    res.json({ success: false, error: error.message });
  }
});

// ============================================
// 统一错误处理
// ============================================

app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: err.message || '服务器内部错误'
  });
});

// ============================================
// 启动服务器
// ============================================

async function startServer() {
  try {
    // 初始化数据库
    console.log('[启动] 正在初始化数据库...');
    await initDatabase();
    console.log('[启动] 数据库初始化完成');
    
    // 初始化 MQTT 服务（灯条系统）
    try {
      const lightService = require('./services/lightService');
      lightService.connect().then(() => {
        console.log('[MQTT] 后端 MQTT 客户端已连接');
      }).catch((err) => {
        console.log('[MQTT] 警告: 无法连接到 MQTT Broker:', err.message);
      });
    } catch (e) {
      console.log('[MQTT] 警告: 灯条服务未安装，MQTT 功能不可用');
    }
    
    // 启动 HTTP 服务
    const server = app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║          干洗系统后端服务已启动                            ║
╠════════════════════════════════════════════════════════════╣
║  端口: ${PORT}                                                ║
║  环境: ${process.env.NODE_ENV || 'development'}                                ║
║  数据库: ${require('./config/database').type.toUpperCase()}                                          ║
╠════════════════════════════════════════════════════════════╣
║  已启用模块:                                              ║
${getEnabledModules().map(m => `║    ✓ ${m.name} (${m.nameEn})`).join('\n')}
║                                                            ║
║  待开放模块:                                               ║
${Object.entries(require('./config/modules').modules)
  .filter(([_, m]) => !m.enabled)
  .map(([key, m]) => `║    ○ ${m.name} - ${m.message || '开发中'}`).join('\n')}
╚════════════════════════════════════════════════════════════╝
      `);
    });
    
    // 注册 server error 事件处理器，防止端口冲突等异常直接崩溃进程
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[启动] ❌ 端口 ${PORT} 已被占用，请先关闭占用该端口的进程`);
        console.error(`[启动] 使用命令查看: netstat -ano | findstr :${PORT}`);
      } else {
        console.error('[启动] ❌ 服务器错误:', err.message);
      }
      process.exit(1);
    });
    
    // 优雅关闭
    const shutdown = async (signal) => {
      console.log(`\n[${signal}] 正在关闭服务...`);
      // 停止租赁逾期检查定时任务
      try {
        const rentalCron = require('./modules/rental/services/rentalCronService');
        rentalCron.stopOverdueCheck();
      } catch(e) { /* 忽略 */ }
      server.close(async () => {
        await closeDatabase();
        console.log('[关闭] 服务已关闭');
        process.exit(0);
      });
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // 全局未捕获异常处理器，防止未预料的异常直接崩溃
    process.on('uncaughtException', (err) => {
      console.error('[进程] 未捕获异常:', err.message);
      console.error(err.stack);
      // 严重错误，优雅退出
      try { server.close(); } catch (e) {}
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[进程] 未处理的Promise拒绝:', reason?.message || reason);
      // 不退出进程，只记录日志，保持服务运行
    });

    // 启动租赁逾期检查定时任务
    try {
      const rentalCron = require('./modules/rental/services/rentalCronService');
      rentalCron.startOverdueCheck();
    } catch(e) {
      console.log('[租赁] 逾期检查服务未启动:', e.message);
    }
    
  } catch (error) {
    console.error('[启动] 服务启动失败:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
