/**
 * 支付功能测试脚本
 * 测试所有支付方式和结算功能
 */

const http = require('http');

// 测试配置
const BASE_URL = 'http://localhost:3002';
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
 * 打印分隔线
 */
function printLine() {
  console.log('\n' + '='.repeat(60));
}

/**
 * 打印标题
 */
function printTitle(title) {
  printLine();
  console.log('  ' + title);
  printLine();
}

/**
 * 打印成功
 */
function printSuccess(message) {
  console.log('  ✅ ' + message);
}

/**
 * 打印失败
 */
function printError(message) {
  console.log('  ❌ ' + message);
}

/**
 * 打印信息
 */
function printInfo(message) {
  console.log('  ℹ️  ' + message);
}

/**
 * 等待指定时间
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 测试1: 健康检查
 */
async function testHealthCheck() {
  printTitle('测试 1: 健康检查');
  
  try {
    const res = await request('GET', '/api/health');
    
    if (res.status === 'ok') {
      printSuccess('服务器运行正常');
      printInfo(`运行模式: ${res.mode}`);
      printInfo(`支付服务: ${JSON.stringify(res.services)}`);
      printInfo(`统计数据: 总订单=${res.stats.totalOrders}, 用户=${res.stats.totalUsers}, 门店=${res.stats.totalStores}`);
      return true;
    } else {
      printError('服务器状态异常');
      return false;
    }
  } catch (error) {
    printError('无法连接到服务器: ' + error.message);
    printInfo('请确保服务器已启动: node test-server.js');
    return false;
  }
}

/**
 * 测试2: 查看测试数据
 */
async function testViewData() {
  printTitle('测试 2: 查看测试数据');
  
  try {
    const res = await request('GET', '/api/test/stats');
    
    if (res.success) {
      printSuccess('获取测试数据成功');
      
      console.log('\n  用户余额:');
      res.data.userBalances.forEach(user => {
        console.log(`    - ${user.userId}: ¥${user.balance}`);
      });
      
      console.log('\n  门店余额:');
      res.data.storeBalances.forEach(store => {
        console.log(`    - ${store.storeId}: 可用=¥${store.balance}, 待结算=¥${store.pendingSettlement}`);
      });
      
      return true;
    } else {
      printError('获取测试数据失败');
      return false;
    }
  } catch (error) {
    printError('获取测试数据失败: ' + error.message);
    return false;
  }
}

/**
 * 测试3: 余额充值
 */
async function testBalanceRecharge() {
  printTitle('测试 3: 余额充值');
  
  try {
    // 充值前查看余额
    const beforeRes = await request('GET', `/api/balance/${TEST_USER_ID}`);
    const beforeBalance = beforeRes.data?.balance || 0;
    printInfo(`充值前余额: ¥${beforeBalance}`);
    
    // 执行充值
    const rechargeAmount = 1000;
    printInfo(`充值金额: ¥${rechargeAmount}`);
    
    const res = await request('POST', '/api/balance/recharge', {
      userId: TEST_USER_ID,
      amount: rechargeAmount
    });
    
    if (res.success) {
      printSuccess('充值成功');
      printInfo(`充值后余额: ¥${res.data.newBalance}`);
      return true;
    } else {
      printError('充值失败: ' + res.error);
      return false;
    }
  } catch (error) {
    printError('充值失败: ' + error.message);
    return false;
  }
}

/**
 * 测试4: 微信支付
 */
async function testWechatPay() {
  printTitle('测试 4: 微信支付');
  
  const orderId = 'WX_TEST_' + Date.now();
  const amount = 99.00;
  
  printInfo(`订单号: ${orderId}`);
  printInfo(`订单金额: ¥${amount}`);
  
  try {
    const res = await request('POST', '/api/payment/create', {
      orderId,
      amount,
      paymentMethod: 'wechat',
      userId: TEST_USER_ID,
      openid: 'test_openid_123456'
    });
    
    if (res.success) {
      printSuccess('微信支付创建成功');
      printInfo(`预支付ID: ${res.data.prepayId}`);
      printInfo(`支付参数已生成 (模拟)`);
      
      // 模拟支付成功
      await sleep(500);
      const queryRes = await request('GET', `/api/payment/query/${orderId}`);
      
      if (queryRes.success && queryRes.data.status === 'paid') {
        printSuccess('支付状态查询成功: 已支付');
        printInfo(`交易流水号: ${queryRes.data.transactionId}`);
        return true;
      } else {
        printError('支付状态查询失败');
        return false;
      }
    } else {
      printError('微信支付创建失败: ' + res.error);
      return false;
    }
  } catch (error) {
    printError('微信支付失败: ' + error.message);
    return false;
  }
}

/**
 * 测试5: 余额支付
 */
async function testBalancePay() {
  printTitle('测试 5: 余额支付');
  
  const orderId = 'BAL_TEST_' + Date.now();
  const amount = 50.00;
  
  // 查看充值前余额
  const beforeRes = await request('GET', `/api/balance/${TEST_USER_ID}`);
  const beforeBalance = beforeRes.data?.balance || 0;
  
  printInfo(`订单号: ${orderId}`);
  printInfo(`订单金额: ¥${amount}`);
  printInfo(`当前余额: ¥${beforeBalance}`);
  
  try {
    const res = await request('POST', '/api/payment/create', {
      orderId,
      amount,
      paymentMethod: 'balance',
      userId: TEST_USER_ID
    });
    
    if (res.success) {
      printSuccess('余额支付成功');
      printInfo(`扣除金额: ¥${amount}`);
      printInfo(`交易流水号: ${res.data.transactionId}`);
      
      // 查看充值后余额
      const afterRes = await request('GET', `/api/balance/${TEST_USER_ID}`);
      const afterBalance = afterRes.data?.balance || 0;
      printInfo(`支付后余额: ¥${afterBalance}`);
      
      return true;
    } else {
      printError('余额支付失败: ' + res.error);
      return false;
    }
  } catch (error) {
    printError('余额支付失败: ' + error.message);
    return false;
  }
}

/**
 * 测试6: 支付宝支付
 */
async function testAlipay() {
  printTitle('测试 6: 支付宝支付');
  
  const orderId = 'ALI_TEST_' + Date.now();
  const amount = 88.00;
  
  printInfo(`订单号: ${orderId}`);
  printInfo(`订单金额: ¥${amount}`);
  
  try {
    const res = await request('POST', '/api/payment/create', {
      orderId,
      amount,
      paymentMethod: 'alipay',
      userId: TEST_USER_ID
    });
    
    if (res.success) {
      printSuccess('支付宝支付创建成功');
      printInfo(`支付链接: ${res.data.payUrl}`);
      printInfo(`二维码: ${res.data.qrCode}`);
      printInfo(`交易流水号: ${res.data.transactionId}`);
      return true;
    } else {
      printError('支付宝支付创建失败: ' + res.error);
      return false;
    }
  } catch (error) {
    printError('支付宝支付失败: ' + error.message);
    return false;
  }
}

/**
 * 测试7: 银联支付
 */
async function testUnionpay() {
  printTitle('测试 7: 银联支付');
  
  const orderId = 'UP_TEST_' + Date.now();
  const amount = 66.00;
  
  printInfo(`订单号: ${orderId}`);
  printInfo(`订单金额: ¥${amount}`);
  
  try {
    const res = await request('POST', '/api/payment/create', {
      orderId,
      amount,
      paymentMethod: 'unionpay',
      userId: TEST_USER_ID
    });
    
    if (res.success) {
      printSuccess('银联支付创建成功');
      printInfo(`支付链接: ${res.data.payUrl}`);
      printInfo(`交易流水号: ${res.data.transactionId}`);
      return true;
    } else {
      printError('银联支付创建失败: ' + res.error);
      return false;
    }
  } catch (error) {
    printError('银联支付失败: ' + error.message);
    return false;
  }
}

/**
 * 测试8: 门店结算查询
 */
async function testSettlementQuery() {
  printTitle('测试 8: 门店结算查询');
  
  try {
    const res = await request('GET', `/api/settlement/store/${TEST_STORE_ID}`);
    
    if (res.success) {
      printSuccess('获取门店结算信息成功');
      console.log('\n  门店账户信息:');
      console.log(`    - 门店ID: ${res.data.storeId}`);
      console.log(`    - 可用余额: ¥${res.data.availableBalance}`);
      console.log(`    - 冻结金额: ¥${res.data.frozenBalance}`);
      console.log(`    - 待结算金额: ¥${res.data.pendingSettlement}`);
      console.log(`    - 总资产: ¥${res.data.totalAssets}`);
      return true;
    } else {
      printError('获取门店结算信息失败: ' + res.error);
      return false;
    }
  } catch (error) {
    printError('查询失败: ' + error.message);
    return false;
  }
}

/**
 * 测试9: 门店提现
 */
async function testStoreWithdraw() {
  printTitle('测试 9: 门店提现');
  
  const withdrawAmount = 500;
  
  // 先查看余额
  const balanceRes = await request('GET', `/api/settlement/store/${TEST_STORE_ID}`);
  const availableBalance = balanceRes.data?.availableBalance || 0;
  
  printInfo(`当前可用余额: ¥${availableBalance}`);
  printInfo(`申请提现金额: ¥${withdrawAmount}`);
  
  if (availableBalance < withdrawAmount) {
    printInfo(`余额不足，跳过提现测试`);
    return true;
  }
  
  try {
    const res = await request('POST', `/api/settlement/store/${TEST_STORE_ID}/withdraw`, {
      amount: withdrawAmount,
      bankAccount: '6222021234567890123'
    });
    
    if (res.success) {
      printSuccess('提现申请成功');
      printInfo(`提现ID: ${res.data.withdrawId}`);
      printInfo(`提现金额: ¥${res.data.amount}`);
      printInfo(`银行卡: ${res.data.bankAccount}`);
      printInfo(`预计到账: ${new Date(res.data.estimatedArrival).toLocaleString()}`);
      printInfo(`状态: ${res.data.status}`);
      return true;
    } else {
      printError('提现申请失败: ' + res.error);
      return false;
    }
  } catch (error) {
    printError('提现失败: ' + error.message);
    return false;
  }
}

/**
 * 测试10: 批量支付测试
 */
async function testBatchPayment() {
  printTitle('测试 10: 批量支付测试');
  
  const paymentMethods = ['wechat', 'balance', 'alipay', 'unionpay'];
  let successCount = 0;
  
  printInfo(`开始批量支付测试，共 ${paymentMethods.length} 种支付方式\n`);
  
  for (const method of paymentMethods) {
    const orderId = `BATCH_${method.toUpperCase()}_${Date.now()}`;
    
    try {
      const res = await request('POST', '/api/payment/create', {
        orderId,
        amount: 10.00,
        paymentMethod: method,
        userId: TEST_USER_ID
      });
      
      if (res.success) {
        printSuccess(`${method} 支付成功`);
        successCount++;
      } else {
        printError(`${method} 支付失败`);
      }
    } catch (error) {
      printError(`${method} 支付异常`);
    }
    
    await sleep(200); // 避免请求过快
  }
  
  printInfo(`\n批量支付测试完成: ${successCount}/${paymentMethods.length} 成功`);
  return successCount === paymentMethods.length;
}

/**
 * 主测试流程
 */
async function runTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║          干洗系统支付功能测试                           ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`\n测试服务器: ${BASE_URL}`);
  console.log(`测试时间: ${new Date().toLocaleString()}`);
  
  // 等待服务器启动
  await sleep(1000);
  
  const results = [];
  
  // 执行测试
  results.push({ name: '健康检查', success: await testHealthCheck() });
  await sleep(500);
  
  results.push({ name: '查看测试数据', success: await testViewData() });
  await sleep(500);
  
  results.push({ name: '余额充值', success: await testBalanceRecharge() });
  await sleep(500);
  
  results.push({ name: '微信支付', success: await testWechatPay() });
  await sleep(500);
  
  results.push({ name: '余额支付', success: await testBalancePay() });
  await sleep(500);
  
  results.push({ name: '支付宝支付', success: await testAlipay() });
  await sleep(500);
  
  results.push({ name: '银联支付', success: await testUnionpay() });
  await sleep(500);
  
  results.push({ name: '门店结算查询', success: await testSettlementQuery() });
  await sleep(500);
  
  results.push({ name: '门店提现', success: await testStoreWithdraw() });
  await sleep(500);
  
  results.push({ name: '批量支付测试', success: await testBatchPayment() });
  
  // 输出测试结果
  printLine();
  console.log('\n  📊 测试结果汇总');
  printLine();
  
  let totalSuccess = 0;
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`  ${index + 1}. ${status} ${result.name}`);
    if (result.success) totalSuccess++;
  });
  
  printLine();
  console.log(`\n  🎯 通过率: ${totalSuccess}/${results.length} (${((totalSuccess/results.length)*100).toFixed(0)}%)`);
  
  if (totalSuccess === results.length) {
    console.log('\n  🎉 所有测试通过！支付系统运行正常！\n');
  } else {
    console.log('\n  ⚠️  部分测试失败，请检查相关功能\n');
  }
  
  printLine();
  console.log('\n  📝 后续操作:');
  console.log('     1. 查看所有订单: GET /api/test/stats');
  console.log('     2. 查看用户余额: GET /api/balance/test_user_001');
  console.log('     3. 查看门店结算: GET /api/settlement/store/test_store_001');
  console.log('     4. 停止服务器: Ctrl+C');
  printLine();
  console.log('\n');
  
  process.exit(0);
}

// 运行所有测试
runTests().catch(error => {
  console.error('\n❌ 测试执行失败:', error);
  console.error('\n请确保:');
  console.error('  1. 服务器已启动: node test-server.js');
  console.error('  2. 端口 3002 未被占用');
  console.error('  3. 网络连接正常\n');
  process.exit(1);
});
