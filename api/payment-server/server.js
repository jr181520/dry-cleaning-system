/**
 * 支付网关服务器
 * 支持微信支付、支付宝、银联支付、账户余额
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const wechatPay = require('./wechat-pay');
const alipay = require('./alipay');
const unionpay = require('./unionpay');
const balance = require('./balance');
const posApi = require('./pos-api');
const memberCardRoutes = require('./member-card-routes');
const config = require('./config');

const app = express();
const PORT = config.server.port;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 静态文件服务 - 支持访问HTML页面
app.use(express.static(path.join(__dirname, '../../')));

// 注册路由
app.use('/api/pos', posApi);
app.use('/api/member-card', memberCardRoutes);

// 记录所有支付订单（模拟数据库）
const paymentOrders = new Map();

// ==================== 统一支付接口 ====================

/**
 * 统一支付入口
 * POST /api/payment/create
 */
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

  // 参数验证
  if (!orderId || !amount || !paymentMethod) {
    return res.json({
      success: false,
      error: '缺少必要参数'
    });
  }

  try {
    let result;

    switch (paymentMethod) {
      case 'wechat':
        // 微信支付
        result = await wechatPay.createOrder({
          orderId,
          amount,
          description: subject || body || '干洗服务',
          openid,
          clientIp,
          tradeType: openid ? 'JSAPI' : 'NATIVE' // 小程序用JSAPI
        });
        
        if (result.success && result.data.prepayId) {
          // 生成小程序调起支付的参数
          const payParams = wechatPay.generateAppPayParams(result.data.prepayId);
          result.data.payParams = payParams;
        }
        break;

      case 'alipay':
        // 支付宝网页支付
        result = await alipay.createWebPayOrder({
          orderId,
          amount,
          subject: subject || '干洗服务',
          body,
          returnUrl: returnUrl || `${config.server.host}/payment/alipay/return`
        });
        break;

      case 'unionpay':
        // 银联网关支付
        result = await unionpay.createGatewayPayOrder({
          orderId,
          amount,
          subject: subject || '干洗服务',
          returnUrl: returnUrl || `${config.server.host}/payment/unionpay/return`
        });
        break;

      case 'balance':
        // 余额支付
        if (!userId) {
          return res.json({
            success: false,
            error: '缺少用户ID'
          });
        }
        
        // 验证余额
        const balanceCheck = await balance.getUserBalance(userId);
        if (!balanceCheck.success) {
          return res.json({
            success: false,
            error: balanceCheck.error
          });
        }
        
        if (balanceCheck.data.balance < amount) {
          return res.json({
            success: false,
            error: '余额不足',
            availableBalance: balanceCheck.data.balance,
            requiredAmount: amount
          });
        }
        
        // 扣除余额
        result = await balance.deductBalance(
          userId,
          amount,
          orderId,
          subject || '干洗服务'
        );
        
        if (result.success) {
          result.data.paymentMethod = 'balance';
        }
        break;

      default:
        return res.json({
          success: false,
          error: '不支持的支付方式'
        });
    }

    // 记录订单
    if (result.success) {
      paymentOrders.set(orderId, {
        orderId,
        amount,
        paymentMethod,
        userId,
        status: 'pending',
        result: result.data,
        createdAt: new Date().toISOString()
      });
    }

    res.json(result);
  } catch (error) {
    console.error('支付创建失败:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 查询支付状态
 * GET /api/payment/query/:orderId
 */
app.get('/api/payment/query/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const order = paymentOrders.get(orderId);

  if (!order) {
    return res.json({
      success: false,
      error: '订单不存在'
    });
  }

  try {
    let result;

    switch (order.paymentMethod) {
      case 'wechat':
        result = await wechatPay.queryOrder(order.result.transactionId, orderId);
        break;

      case 'alipay':
        result = await alipay.queryOrder(orderId);
        break;

      case 'unionpay':
        result = await unionpay.queryOrder(orderId);
        break;

      case 'balance':
        // 余额支付直接查询本地记录
        return res.json({
          success: true,
          data: {
            orderId: orderId,
            status: 'success',
            amount: order.amount,
            paymentMethod: 'balance',
            paidAt: order.createdAt
          }
        });

      default:
        return res.json({
          success: false,
          error: '不支持的支付方式'
        });
    }

    // 更新订单状态
    if (result.success && result.data.tradeState === 'SUCCESS') {
      order.status = 'paid';
      order.paidAt = new Date().toISOString();
    }

    res.json(result);
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 关闭订单
 * POST /api/payment/close/:orderId
 */
app.post('/api/payment/close/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const order = paymentOrders.get(orderId);

  if (!order) {
    return res.json({
      success: false,
      error: '订单不存在'
    });
  }

  if (order.status !== 'pending') {
    return res.json({
      success: false,
      error: '订单已支付或已关闭'
    });
  }

  try {
    let result;

    switch (order.paymentMethod) {
      case 'wechat':
        result = await wechatPay.closeOrder(orderId);
        break;

      case 'alipay':
        result = await alipay.closeOrder(orderId);
        break;

      case 'unionpay':
        result = { success: true }; // 银联由后台处理
        break;

      case 'balance':
        // 余额支付直接取消
        result = { success: true };
        break;

      default:
        return res.json({
          success: false,
          error: '不支持的支付方式'
        });
    }

    if (result.success) {
      order.status = 'closed';
      order.closedAt = new Date().toISOString();
    }

    res.json(result);
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 微信支付回调 ====================

/**
 * 微信支付回调
 * POST /api/payment/wechat/notify
 */
app.post('/api/payment/wechat/notify', async (req, res) => {
  try {
    const xml = req.body;
    
    // 验证签名
    if (!wechatPay.verifyNotifySign(xml)) {
      return res.send('<xml><return_code>FAIL</return_code><return_msg>签名验证失败</return_msg></xml>');
    }

    const { out_trade_no, transaction_id, total_fee, cash_fee } = xml;
    const order = paymentOrders.get(out_trade_no);

    if (!order) {
      return res.send('<xml><return_code>FAIL</return_code><return_msg>订单不存在</return_msg></xml>');
    }

    if (xml.return_code === 'SUCCESS' && xml.result_code === 'SUCCESS') {
      // 支付成功
      order.status = 'paid';
      order.transactionId = transaction_id;
      order.paidAt = new Date().toISOString();

      // 记录到结算系统
      await balance.recordOrderPayment({
        orderId: out_trade_no,
        storeId: order.storeId || 'store_001',
        totalAmount: parseInt(total_fee) / 100,
        deliveryFee: order.deliveryFee || 0
      });

      console.log(`订单${out_trade_no}支付成功`);
    }

    res.send('<xml><return_code>SUCCESS</return_code><return_msg>OK</return_msg></xml>');
  } catch (error) {
    console.error('微信回调处理失败:', error);
    res.send('<xml><return_code>FAIL</return_code><return_msg>处理失败</return_msg></xml>');
  }
});

/**
 * 微信H5支付回调
 */
app.post('/api/payment/wechat/h5notify', async (req, res) => {
  // 同上
  app.handle.call(app, req, res);
});

// ==================== 支付宝回调 ====================

/**
 * 支付宝回调
 * POST /api/payment/alipay/notify
 */
app.post('/api/payment/alipay/notify', async (req, res) => {
  try {
    const postData = req.body;
    
    // 验证签名
    if (!alipay.verifyNotifySign(postData)) {
      return res.json({ success: false, message: '签名验证失败' });
    }

    const { out_trade_no, trade_no, total_amount, trade_status } = postData;
    const order = paymentOrders.get(out_trade_no);

    if (!order) {
      return res.json({ success: false, message: '订单不存在' });
    }

    // 支付成功
    if (trade_status === 'TRADE_SUCCESS' || trade_status === 'TRADE_FINISHED') {
      order.status = 'paid';
      order.transactionId = trade_no;
      order.paidAt = new Date().toISOString();

      await balance.recordOrderPayment({
        orderId: out_trade_no,
        storeId: order.storeId || 'store_001',
        totalAmount: parseFloat(total_amount)
      });

      console.log(`订单${out_trade_no}支付成功`);
    }

    res.json({ success: true, message: 'success' });
  } catch (error) {
    console.error('支付宝回调处理失败:', error);
    res.json({ success: false, message: error.message });
  }
});

/**
 * 支付宝返回页面
 */
app.get('/payment/alipay/return', (req, res) => {
  // 重定向到前端页面
  res.redirect('/#/pages/order/success/index' + (req.query.out_trade_no ? `?orderId=${req.query.out_trade_no}` : ''));
});

// ==================== 银联回调 ====================

/**
 * 银联回调
 */
app.post('/api/payment/unionpay/notify', async (req, res) => {
  try {
    const postData = req.body;
    
    if (!unionpay.verifyNotifySign(postData)) {
      return res.send('FAIL');
    }

    const { orderId, txnAmt, respCode } = postData;
    const order = paymentOrders.get(orderId);

    if (!order) {
      return res.send('FAIL');
    }

    // 支付成功
    if (respCode === '00') {
      order.status = 'paid';
      order.paidAt = new Date().toISOString();

      await balance.recordOrderPayment({
        orderId: orderId,
        storeId: order.storeId || 'store_001',
        totalAmount: parseInt(txnAmt) / 100
      });

      console.log(`订单${orderId}支付成功`);
    }

    res.send('ok');
  } catch (error) {
    console.error('银联回调处理失败:', error);
    res.send('FAIL');
  }
});

/**
 * 银联返回页面
 */
app.get('/payment/unionpay/return', (req, res) => {
  res.redirect('/#/pages/order/success/index' + (req.query.orderId ? `?orderId=${req.query.orderId}` : ''));
});

// ==================== 账户余额接口 ====================

/**
 * 获取用户余额
 * GET /api/balance/:userId
 */
app.get('/api/balance/:userId', async (req, res) => {
  const result = await balance.getUserBalance(req.params.userId);
  res.json(result);
});

/**
 * 获取用户交易记录
 * GET /api/balance/:userId/transactions
 */
app.get('/api/balance/:userId/transactions', async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const result = await balance.getUserTransactions(
    req.params.userId,
    parseInt(page),
    parseInt(limit)
  );
  res.json(result);
});

/**
 * 余额充值
 * POST /api/balance/recharge
 */
app.post('/api/balance/recharge', async (req, res) => {
  const { userId, amount, channel = 'wechat' } = req.body;
  
  if (!userId || !amount) {
    return res.json({ success: false, error: '缺少必要参数' });
  }

  if (amount <= 0) {
    return res.json({ success: false, error: '充值金额必须大于0' });
  }

  // 创建充值订单
  const rechargeOrderId = `RCH${Date.now()}`;
  
  // 模拟充值流程（实际应该先创建支付订单）
  const result = await balance.addBalance(userId, amount, channel);
  res.json(result);
});

// ==================== 门店结算接口 ====================

/**
 * 获取门店账户信息
 * GET /api/settlement/store/:storeId
 */
app.get('/api/settlement/store/:storeId', async (req, res) => {
  const result = await balance.getStoreBalance(req.params.storeId);
  res.json(result);
});

/**
 * 获取门店结算记录
 * GET /api/settlement/store/:storeId/records
 */
app.get('/api/settlement/store/:storeId/records', async (req, res) => {
  const { status, startDate, endDate } = req.query;
  const result = await balance.getStoreSettlements(req.params.storeId, {
    status,
    startDate,
    endDate
  });
  res.json(result);
});

/**
 * 发起结算（将待结算金额转入可用余额）
 * POST /api/settlement/store/:storeId/settle
 */
app.post('/api/settlement/store/:storeId/settle', async (req, res) => {
  const { settlementCycle = 7 } = req.body;
  const result = await balance.settleToStore(
    req.params.storeId,
    parseInt(settlementCycle)
  );
  res.json(result);
});

/**
 * 门店提现
 * POST /api/settlement/store/:storeId/withdraw
 */
app.post('/api/settlement/store/:storeId/withdraw', async (req, res) => {
  const { amount, bankAccount } = req.body;
  
  if (!amount || !bankAccount) {
    return res.json({ success: false, error: '缺少必要参数' });
  }

  const result = await balance.storeWithdraw(
    req.params.storeId,
    parseFloat(amount),
    bankAccount
  );
  res.json(result);
});

/**
 * 生成财务报表
 * POST /api/settlement/report
 */
app.post('/api/settlement/report', async (req, res) => {
  const { startDate, endDate, storeId, type } = req.body;
  const result = await balance.generateReport({
    startDate,
    endDate,
    storeId,
    type
  });
  res.json(result);
});

// ==================== 健康检查 ====================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      wechat: config.wechat.enabled,
      alipay: config.alipay.enabled,
      unionpay: config.unionpay.enabled
    }
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log('\n========================================');
  console.log('  支付网关服务器已启动');
  console.log(`  端口: http://localhost:${PORT}`);
  console.log('========================================');
  console.log('\n支持的支付方式:');
  console.log('  🚗 微信支付 (wechat)');
  console.log('  📱 支付宝 (alipay)');
  console.log('  💳 银联支付 (unionpay)');
  console.log('  💰 账户余额 (balance)');
  console.log('  🏪 POS支付 (pos)');
  console.log('  💳 会员卡 (member-card)');
  console.log('\nAPI接口:');
  console.log('  POST /api/payment/create      - 创建支付订单');
  console.log('  GET  /api/payment/query/:id   - 查询支付状态');
  console.log('  POST /api/payment/close/:id   - 关闭订单');
  console.log('  GET  /api/balance/:userId     - 获取用户余额');
  console.log('  POST /api/balance/recharge    - 余额充值');
  console.log('  GET  /api/settlement/store/:id - 门店结算信息');
  console.log('  POST /api/pos/create          - POS订单创建');
  console.log('  POST /api/pos/scan            - POS扫码支付');
  console.log('  POST /api/pos/cash            - POS现金支付');
  console.log('  POST /api/pos/card            - POS会员卡支付');
  console.log('  POST /api/member-card/create  - 创建会员卡');
  console.log('  POST /api/member-card/recharge - 会员卡充值');
  console.log('========================================\n');
})

module.exports = app;
