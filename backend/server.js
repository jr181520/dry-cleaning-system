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
const deliveryRouter = require('./modules/common/routes/deliveryRoutes');
const adminRouter = require('./modules/admin/routes/adminRoutes');
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

// 租赁模块（V3）
app.use('/api/rental', rentalRouter);

// 支付模块
app.use('/api/payments', paymentRouter);

// 微信小程序码模块
app.use('/api/mini-qr', miniQRRouter);

// 配送模块
app.use('/api/delivery', deliveryRouter);

// 管理员后台
app.use('/api/admin', adminRouter);

// 门店端公共API（无需认证）
const publicRouter = require('./modules/store/routes/publicRoutes');
app.use('/api/store', publicRouter);

// 订单-灯条绑定API
const orderLightRouter = require('./modules/store/routes/orderLightRoutes');
app.use('/api/store/order-light', orderLightRouter);

// C端取件API
const pickupRouter = require('./modules/store/routes/pickupRoutes');
app.use('/api/store/pickup', pickupRouter);

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
    const wechatPay = require('./api/payment-server/wechat-pay');
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
    
    // 优雅关闭
    const shutdown = async (signal) => {
      console.log(`\n[${signal}] 正在关闭服务...`);
      server.close(async () => {
        await closeDatabase();
        console.log('[关闭] 服务已关闭');
        process.exit(0);
      });
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
  } catch (error) {
    console.error('[启动] 服务启动失败:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
