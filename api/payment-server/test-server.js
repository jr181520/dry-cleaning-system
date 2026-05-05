/**
 * 支付网关测试服务器
 * 使用模拟数据，不需要真实API密钥
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const config = require('./test-config'); // 使用测试配置

const app = express();
const PORT = config.server.port;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 记录所有支付订单（模拟数据库）
const paymentOrders = new Map();

// 模拟数据库
const mockDB = {
  users: new Map([
    ['test_user_001', { balance: 10000, frozenBalance: 0 }],
    ['test_user_002', { balance: 5000, frozenBalance: 0 }]
  ]),
  stores: new Map([
    ['test_store_001', { balance: 50000, frozenBalance: 0, pendingSettlement: 10000 }],
    ['test_store_002', { balance: 30000, frozenBalance: 0, pendingSettlement: 8000 }]
  ]),
  transactions: []
};

// ==================== 模拟支付模块 ====================

/**
 * 模拟微信支付
 */
async function mockWechatPay(orderId, amount) {
  console.log(`[微信支付-模拟] 订单: ${orderId}, 金额: ${amount}元`);
  
  // 模拟支付延迟
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // 生成模拟支付参数
  return {
    success: true,
    data: {
      prepayId: 'wx' + Date.now() + 'mockprepayid',
      payment: {
        timeStamp: Date.now().toString(),
        nonceStr: 'mock_nonce_str_' + Date.now(),
        package: 'prepay_id=wx' + Date.now() + 'mockprepayid',
        signType: 'MD5',
        paySign: 'mock_paysign_' + Date.now()
      },
      transactionId: 'wx' + Date.now() + 'transactionid',
      tradeState: 'SUCCESS'
    }
  };
}

/**
 * 模拟余额支付
 */
async function mockBalancePay(userId, orderId, amount) {
  console.log(`[余额支付-模拟] 用户: ${userId}, 订单: ${orderId}, 金额: ${amount}元`);
  
  const user = mockDB.users.get(userId);
  if (!user) {
    return { success: false, error: '用户不存在' };
  }
  
  if (user.balance < amount) {
    return { success: false, error: '余额不足', availableBalance: user.balance };
  }
  
  // 扣除余额
  user.balance -= amount;
  
  // 记录交易
  mockDB.transactions.push({
    type: 'expense',
    userId,
    orderId,
    amount,
    balance: user.balance,
    timestamp: new Date().toISOString()
  });
  
  return {
    success: true,
    data: {
      orderId,
      amount,
      balance: user.balance,
      transactionId: 'bal' + Date.now()
    }
  };
}

/**
 * 模拟支付宝支付
 */
async function mockAlipay(orderId, amount) {
  console.log(`[支付宝-模拟] 订单: ${orderId}, 金额: ${amount}元`);
  
  // 生成模拟支付宝支付链接
  const payUrl = `https://openapi.alipay.com/mock/alipay?orderId=${orderId}&amount=${amount}`;
  
  return {
    success: true,
    data: {
      orderId,
      payUrl,
      qrCode: `https://qr.alipay.com/mock/${orderId}`,
      transactionId: 'ali' + Date.now()
    }
  };
}

/**
 * 模拟银联支付
 */
async function mockUnionpay(orderId, amount) {
  console.log(`[银联支付-模拟] 订单: ${orderId}, 金额: ${amount}元`);
  
  // 生成模拟银联支付链接
  const payUrl = `https://gateway.95516.com/mock/unionpay?orderId=${orderId}&amount=${amount}`;
  
  return {
    success: true,
    data: {
      orderId,
      payUrl,
      transactionId: 'up' + Date.now()
    }
  };
}

// ==================== API 接口 ====================

/**
 * 创建支付订单
 * POST /api/payment/create
 */
app.post('/api/payment/create', async (req, res) => {
  const { orderId, amount, paymentMethod, userId, openid } = req.body;

  console.log('\n========================================');
  console.log(`[支付请求] 订单: ${orderId}`);
  console.log(`[支付方式] ${paymentMethod}`);
  console.log(`[支付金额] ¥${amount}`);
  console.log('========================================\n');

  try {
    let result;

    switch (paymentMethod) {
      case 'wechat':
        result = await mockWechatPay(orderId, amount);
        break;

      case 'balance':
        if (!userId) {
          return res.json({ success: false, error: '缺少用户ID' });
        }
        result = await mockBalancePay(userId, orderId, amount);
        break;

      case 'alipay':
        result = await mockAlipay(orderId, amount);
        break;

      case 'unionpay':
        result = await mockUnionpay(orderId, amount);
        break;

      default:
        return res.json({ success: false, error: '不支持的支付方式' });
    }

    // 记录订单
    if (result.success) {
      paymentOrders.set(orderId, {
        orderId,
        amount,
        paymentMethod,
        userId,
        status: 'paid',
        result: result.data,
        createdAt: new Date().toISOString(),
        paidAt: new Date().toISOString()
      });

      // 模拟记录到结算系统
      const storeId = 'test_store_001';
      const platformFee = amount * config.platform.serviceFeeRate;
      const storeAmount = amount - platformFee;
      
      const store = mockDB.stores.get(storeId);
      if (store) {
        store.pendingSettlement += storeAmount;
        
        // 模拟交易记录
        mockDB.transactions.push({
          type: 'settlement_pending',
          storeId,
          orderId,
          amount: storeAmount,
          platformFee,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`✅ 支付成功！订单: ${orderId}`);
    }

    res.json(result);
  } catch (error) {
    console.error('❌ 支付失败:', error);
    res.json({ success: false, error: error.message });
  }
});

/**
 * 查询支付状态
 * GET /api/payment/query/:orderId
 */
app.get('/api/payment/query/:orderId', (req, res) => {
  const { orderId } = req.params;
  const order = paymentOrders.get(orderId);

  if (!order) {
    return res.json({
      success: false,
      error: '订单不存在'
    });
  }

  res.json({
    success: true,
    data: {
      orderId: order.orderId,
      amount: order.amount,
      paymentMethod: order.paymentMethod,
      status: order.status,
      transactionId: order.result?.transactionId,
      paidAt: order.paidAt
    }
  });
});

/**
 * 获取用户余额
 * GET /api/balance/:userId
 */
app.get('/api/balance/:userId', (req, res) => {
  const { userId } = req.params;
  const user = mockDB.users.get(userId);

  if (!user) {
    return res.json({
      success: false,
      error: '用户不存在'
    });
  }

  res.json({
    success: true,
    data: {
      userId,
      balance: user.balance,
      frozenBalance: user.frozenBalance
    }
  });
});

/**
 * 余额充值
 * POST /api/balance/recharge
 */
app.post('/api/balance/recharge', (req, res) => {
  const { userId, amount } = req.body;

  const user = mockDB.users.get(userId);
  if (!user) {
    return res.json({ success: false, error: '用户不存在' });
  }

  user.balance += amount;

  // 记录交易
  mockDB.transactions.push({
    type: 'recharge',
    userId,
    amount,
    balance: user.balance,
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    data: {
      userId,
      amount,
      newBalance: user.balance,
      transactionId: 'rch' + Date.now()
    }
  });
});

/**
 * 获取门店结算信息
 * GET /api/settlement/store/:storeId
 */
app.get('/api/settlement/store/:storeId', (req, res) => {
  const { storeId } = req.params;
  const store = mockDB.stores.get(storeId);

  if (!store) {
    return res.json({
      success: false,
      error: '门店不存在'
    });
  }

  res.json({
    success: true,
    data: {
      storeId,
      availableBalance: store.balance,
      frozenBalance: store.frozenBalance,
      pendingSettlement: store.pendingSettlement,
      totalAssets: store.balance + store.pendingSettlement
    }
  });
});

/**
 * 门店提现
 * POST /api/settlement/store/:storeId/withdraw
 */
app.post('/api/settlement/store/:storeId/withdraw', (req, res) => {
  const { storeId } = req.params;
  const { amount, bankAccount } = req.body;

  const store = mockDB.stores.get(storeId);
  if (!store) {
    return res.json({ success: false, error: '门店不存在' });
  }

  if (store.balance < amount) {
    return res.json({ success: false, error: '余额不足' });
  }

  if (amount < config.platform.minWithdrawAmount) {
    return res.json({ 
      success: false, 
      error: `最低提现金额为${config.platform.minWithdrawAmount}元` 
    });
  }

  // 冻结金额
  store.balance -= amount;
  store.frozenBalance += amount;

  // 记录提现
  mockDB.transactions.push({
    type: 'withdraw_pending',
    storeId,
    amount,
    bankAccount,
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    data: {
      withdrawId: 'wd' + Date.now(),
      storeId,
      amount,
      bankAccount: bankAccount.slice(0, 4) + '****' + bankAccount.slice(-4),
      status: 'pending',
      estimatedArrival: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }
  });
});

/**
 * 健康检查
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: 'test',
    timestamp: new Date().toISOString(),
    services: {
      wechat: 'mock',
      alipay: 'mock',
      unionpay: 'mock',
      balance: 'enabled'
    },
    stats: {
      totalOrders: paymentOrders.size,
      totalUsers: mockDB.users.size,
      totalStores: mockDB.stores.size
    }
  });
});

/**
 * 获取测试数据统计
 * GET /api/test/stats
 */
app.get('/api/test/stats', (req, res) => {
  res.json({
    success: true,
    data: {
      paymentOrders: Array.from(paymentOrders.entries()).map(([id, order]) => ({
        orderId: order.orderId,
        amount: order.amount,
        paymentMethod: order.paymentMethod,
        status: order.status
      })),
      userBalances: Array.from(mockDB.users.entries()).map(([id, user]) => ({
        userId: id,
        balance: user.balance
      })),
      storeBalances: Array.from(mockDB.stores.entries()).map(([id, store]) => ({
        storeId: id,
        balance: store.balance,
        pendingSettlement: store.pendingSettlement
      })),
      recentTransactions: mockDB.transactions.slice(-10)
    }
  });
});

// ==================== 启动服务器 ====================

app.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║      支付网关测试服务器 (模拟模式)           ║');
  console.log('╠════════════════════════════════════════════╣');
  console.log(`║  🚀 服务地址: http://localhost:${PORT}         ║`);
  console.log('║  📋 测试模式: 已启用 (无需API密钥)           ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('\n支持的支付方式:');
  console.log('  💬 微信支付 (模拟)');
  console.log('  💰 余额支付 (模拟)');
  console.log('  💙 支付宝 (模拟)');
  console.log('  💳 银联支付 (模拟)');
  console.log('\nAPI接口:');
  console.log('  POST   /api/payment/create     - 创建支付订单');
  console.log('  GET    /api/payment/query/:id  - 查询支付状态');
  console.log('  GET    /api/balance/:userId    - 获取用户余额');
  console.log('  POST   /api/balance/recharge   - 余额充值');
  console.log('  GET    /api/settlement/store/:id - 获取门店结算');
  console.log('  POST   /api/settlement/store/:id/withdraw - 提现');
  console.log('  GET    /api/health             - 健康检查');
  console.log('  GET    /api/test/stats         - 测试数据统计');
  console.log('\n测试账号:');
  console.log('  用户ID: test_user_001 (余额: ¥10000)');
  console.log('  用户ID: test_user_002 (余额: ¥5000)');
  console.log('  门店ID: test_store_001');
  console.log('  门店ID: test_store_002');
  console.log('\n========================================\n');
  console.log('💡 开始测试支付功能！\n');
});

module.exports = app;
