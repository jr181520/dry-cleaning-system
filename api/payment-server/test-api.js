/**
 * 支付API测试脚本
 * 用于测试所有支付功能和结算功能
 */

const http = require('http');

// 服务器地址
const BASE_URL = 'http://localhost:3001';

// 测试用户和门店ID
const TEST_USER_ID = 'test_user_001';
const TEST_STORE_ID = 'test_store_001';

/**
 * 发起HTTP请求
 */
function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve(result);
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * 等待指定时间
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 测试支付
 */
async function testPayment() {
  console.log('\n========================================');
  console.log('       支付API测试');
  console.log('========================================\n');

  const orderId = 'ORD' + Date.now();
  const amount = 99.00;

  // 测试余额支付
  console.log('1️⃣  测试余额支付...');
  try {
    const balanceResult = await request('POST', '/api/payment/create', {
      orderId: orderId + '_balance',
      amount: amount,
      subject: '干洗服务测试-余额支付',
      paymentMethod: 'balance',
      userId: TEST_USER_ID
    });
    console.log('结果:', JSON.stringify(balanceResult, null, 2));
  } catch (error) {
    console.error('余额支付测试失败:', error);
  }

  // 测试微信支付（仅测试接口，不实际调起支付）
  console.log('\n2️⃣  测试微信支付接口...');
  try {
    const wechatResult = await request('POST', '/api/payment/create', {
      orderId: orderId + '_wechat',
      amount: amount,
      subject: '干洗服务测试-微信支付',
      paymentMethod: 'wechat',
      openid: 'test_openid'
    });
    console.log('结果:', JSON.stringify(wechatResult, null, 2));
  } catch (error) {
    console.error('微信支付测试失败:', error);
  }

  // 测试支付宝支付（仅测试接口）
  console.log('\n3️⃣  测试支付宝支付接口...');
  try {
    const alipayResult = await request('POST', '/api/payment/create', {
      orderId: orderId + '_alipay',
      amount: amount,
      subject: '干洗服务测试-支付宝支付',
      paymentMethod: 'alipay',
      returnUrl: 'http://localhost:3000/payment/success'
    });
    console.log('结果:', JSON.stringify(alipayResult, null, 2));
  } catch (error) {
    console.error('支付宝支付测试失败:', error);
  }

  // 测试银联支付（仅测试接口）
  console.log('\n4️⃣  测试银联支付接口...');
  try {
    const unionpayResult = await request('POST', '/api/payment/create', {
      orderId: orderId + '_unionpay',
      amount: amount,
      subject: '干洗服务测试-银联支付',
      paymentMethod: 'unionpay'
    });
    console.log('结果:', JSON.stringify(unionpayResult, null, 2));
  } catch (error) {
    console.error('银联支付测试失败:', error);
  }

  console.log('\n========================================');
  console.log('       支付接口测试完成');
  console.log('========================================\n');
}

/**
 * 测试余额管理
 */
async function testBalance() {
  console.log('\n========================================');
  console.log('       余额管理测试');
  console.log('========================================\n');

  // 获取用户余额
  console.log('1️⃣  获取用户余额...');
  try {
    const balance = await request('GET', `/api/balance/${TEST_USER_ID}`);
    console.log('结果:', JSON.stringify(balance, null, 2));
  } catch (error) {
    console.error('获取余额失败:', error);
  }

  // 获取交易记录
  console.log('\n2️⃣  获取交易记录...');
  try {
    const transactions = await request('GET', `/api/balance/${TEST_USER_ID}/transactions?page=1&limit=10`);
    console.log('结果:', JSON.stringify(transactions, null, 2));
  } catch (error) {
    console.error('获取交易记录失败:', error);
  }

  // 余额充值
  console.log('\n3️⃣  余额充值测试...');
  try {
    const recharge = await request('POST', '/api/balance/recharge', {
      userId: TEST_USER_ID,
      amount: 1000.00,
      channel: 'wechat'
    });
    console.log('结果:', JSON.stringify(recharge, null, 2));
  } catch (error) {
    console.error('充值失败:', error);
  }

  // 再次查看余额
  console.log('\n4️⃣  再次获取用户余额...');
  try {
    const balance = await request('GET', `/api/balance/${TEST_USER_ID}`);
    console.log('结果:', JSON.stringify(balance, null, 2));
  } catch (error) {
    console.error('获取余额失败:', error);
  }

  console.log('\n========================================');
  console.log('       余额管理测试完成');
  console.log('========================================\n');
}

/**
 * 测试结算系统
 */
async function testSettlement() {
  console.log('\n========================================');
  console.log('       结算系统测试');
  console.log('========================================\n');

  // 获取门店结算信息
  console.log('1️⃣  获取门店结算信息...');
  try {
    const settlement = await request('GET', `/api/settlement/store/${TEST_STORE_ID}`);
    console.log('结果:', JSON.stringify(settlement, null, 2));
  } catch (error) {
    console.error('获取结算信息失败:', error);
  }

  // 获取结算记录
  console.log('\n2️⃣  获取结算记录...');
  try {
    const records = await request('GET', `/api/settlement/store/${TEST_STORE_ID}/records`);
    console.log('结果:', JSON.stringify(records, null, 2));
  } catch (error) {
    console.error('获取结算记录失败:', error);
  }

  // 发起结算
  console.log('\n3️⃣  发起结算...');
  try {
    const settle = await request('POST', `/api/settlement/store/${TEST_STORE_ID}/settle`, {
      settlementCycle: 7
    });
    console.log('结果:', JSON.stringify(settle, null, 2));
  } catch (error) {
    console.error('发起结算失败:', error);
  }

  // 门店提现
  console.log('\n4️⃣  门店提现测试...');
  try {
    const withdraw = await request('POST', `/api/settlement/store/${TEST_STORE_ID}/withdraw`, {
      amount: 100.00,
      bankAccount: '6222021234567890123'
    });
    console.log('结果:', JSON.stringify(withdraw, null, 2));
  } catch (error) {
    console.error('门店提现失败:', error);
  }

  // 生成财务报表
  console.log('\n5️⃣  生成财务报表...');
  try {
    const report = await request('POST', '/api/settlement/report', {
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      storeId: TEST_STORE_ID,
      type: 'summary'
    });
    console.log('结果:', JSON.stringify(report, null, 2));
  } catch (error) {
    console.error('生成报表失败:', error);
  }

  console.log('\n========================================');
  console.log('       结算系统测试完成');
  console.log('========================================\n');
}

/**
 * 测试健康检查
 */
async function testHealth() {
  console.log('\n========================================');
  console.log('       健康检查测试');
  console.log('========================================\n');

  try {
    const health = await request('GET', '/api/health');
    console.log('服务器状态:', JSON.stringify(health, null, 2));
  } catch (error) {
    console.error('健康检查失败:', error);
  }

  console.log('\n========================================\n');
}

/**
 * 主测试流程
 */
async function runAllTests() {
  console.log('\n🚀 开始测试支付网关API...\n');
  console.log(`测试服务器: ${BASE_URL}`);
  console.log(`测试用户ID: ${TEST_USER_ID}`);
  console.log(`测试门店ID: ${TEST_STORE_ID}`);

  // 等待服务器启动
  await sleep(1000);

  try {
    // 1. 健康检查
    await testHealth();

    // 2. 支付测试
    await testPayment();

    // 3. 余额管理测试
    await testBalance();

    // 4. 结算系统测试
    await testSettlement();

    console.log('\n✅ 所有测试完成！\n');
    console.log('========================================');
    console.log('       测试总结');
    console.log('========================================');
    console.log('✓ 支付接口测试完成');
    console.log('✓ 余额管理测试完成');
    console.log('✓ 结算系统测试完成');
    console.log('\n如果所有测试都成功，说明支付网关工作正常。');
    console.log('如果某些测试失败，请检查：');
    console.log('  1. 服务器是否启动 (npm start)');
    console.log('  2. API密钥是否配置正确');
    console.log('  3. 网络连接是否正常');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ 测试过程中出现错误:', error);
  }

  process.exit(0);
}

// 运行所有测试
runAllTests();
