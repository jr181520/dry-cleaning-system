/**
 * 聚合配送API测试脚本
 * 使用方法：node test-api.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';

// 模拟请求
function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    
    req.on('error', reject);
    
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function testHealthCheck() {
  console.log('\n📡 测试健康检查...');
  const result = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/health',
    method: 'GET'
  });
  console.log('✅ 健康检查成功');
  console.log('可用服务商:', result.providers);
  return result;
}

async function testGetProviders() {
  console.log('\n📋 获取可用服务商列表...');
  const result = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/delivery/providers',
    method: 'GET'
  });
  console.log('✅ 服务商列表:', result.data);
  return result;
}

async function testQueryPrice() {
  console.log('\n💰 测试询价接口...');
  const params = new URLSearchParams({
    pickupAddress: '北京市朝阳区建国路88号',
    dropoffAddress: '北京市海淀区中关村大街1号',
    weight: 1,
    cityName: '北京'
  });
  
  const result = await request({
    hostname: 'localhost',
    port: 3001,
    path: `/api/delivery/query?${params}`,
    method: 'GET'
  });
  
  console.log('✅ 询价成功！');
  console.log('报价结果:');
  result.quotes.forEach((quote, i) => {
    console.log(`  ${i + 1}. ${quote.providerName}: ¥${quote.price} (预计${quote.estimateTime}分钟)`);
  });
  
  if (result.recommended) {
    console.log(`\n⭐ 推荐: ${result.recommended.providerName}`);
  }
  
  return result;
}

async function testCreateOrder() {
  console.log('\n📦 测试创建配送订单...');
  const orderData = {
    pickupAddress: '北京市朝阳区建国路88号',
    dropoffAddress: '北京市海淀区中关村大街1号',
    customerName: '张三',
    customerPhone: '13800138001',
    shopName: '干洗店',
    shopPhone: '010-12345678',
    goodsDesc: '西装一套',
    weight: 1,
    orderId: `ORD-${Date.now()}`,
    cityName: '北京'
  };
  
  const result = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/delivery/create',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }, orderData);
  
  console.log('✅ 订单创建成功！');
  console.log('订单信息:', result);
  
  return result;
}

async function testQueryOrder(provider, orderId) {
  console.log(`\n🔍 查询订单状态: ${provider}/${orderId}...`);
  const result = await request({
    hostname: 'localhost',
    port: 3001,
    path: `/api/delivery/${provider}/${orderId}`,
    method: 'GET'
  });
  
  console.log('✅ 查询成功！');
  console.log('订单状态:', result);
  
  return result;
}

async function runAllTests() {
  console.log('='.repeat(50));
  console.log('🧪 聚合配送API测试');
  console.log('='.repeat(50));
  
  try {
    await testHealthCheck();
    await testGetProviders();
    await testQueryPrice();
    
    // 创建订单测试
    const orderResult = await testCreateOrder();
    if (orderResult.success && orderResult.platformOrderId) {
      await testQueryOrder(orderResult.provider, orderResult.platformOrderId);
      
      // 取消订单测试
      console.log('\n❌ 测试取消订单...');
      const cancelResult = await request({
        hostname: 'localhost',
        port: 3001,
        path: `/api/delivery/${orderResult.provider}/${orderResult.platformOrderId}/cancel`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }, { reason: '测试取消' });
      console.log('✅ 取消成功！', cancelResult);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 所有测试完成！');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.log('\n💡 请确保API服务器已启动: npm start');
  }
}

// 运行测试
runAllTests();
