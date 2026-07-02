/**
 * 测试资金管理和结算中心API
 * 使用方法：node 测试资金管理API.js
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api/v1';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // 替换为实际的token
const CHAIN_ID = 'CH123456'; // 替换为实际的连锁ID

const headers = {
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json'
};

async function testFinanceAPI() {
  console.log('=== 测试资金管理API ===\n');
  
  try {
    // 1. 测试资金概览
    console.log('1. 测试资金概览API...');
    const overviewRes = await axios.get(`${API_BASE}/admin/chains/${CHAIN_ID}/finance/overview`, { headers });
    console.log('资金概览结果:', JSON.stringify(overviewRes.data, null, 2));
    
    // 2. 测试资金流水记录
    console.log('\n2. 测试资金流水记录API...');
    const recordsRes = await axios.get(`${API_BASE}/admin/chains/${CHAIN_ID}/finance/records`, { 
      headers,
      params: { page: 1, pageSize: 5 }
    });
    console.log('资金流水记录结果:', JSON.stringify(recordsRes.data, null, 2));
    
    // 3. 测试门店资金统计
    console.log('\n3. 测试门店资金统计API...');
    const storesRes = await axios.get(`${API_BASE}/admin/chains/${CHAIN_ID}/finance/stores`, { headers });
    console.log('门店资金统计结果:', JSON.stringify(storesRes.data, null, 2));
    
    // 4. 测试资金趋势
    console.log('\n4. 测试资金趋势API...');
    const trendRes = await axios.get(`${API_BASE}/admin/chains/${CHAIN_ID}/finance/trend`, { headers });
    console.log('资金趋势结果:', JSON.stringify(trendRes.data, null, 2));
    
    // 5. 测试结算概览
    console.log('\n5. 测试结算概览API...');
    const settlementOverviewRes = await axios.get(`${API_BASE}/admin/chains/${CHAIN_ID}/settlement/overview`, { headers });
    console.log('结算概览结果:', JSON.stringify(settlementOverviewRes.data, null, 2));
    
    // 6. 测试结算单列表
    console.log('\n6. 测试结算单列表API...');
    const settlementsRes = await axios.get(`${API_BASE}/admin/chains/${CHAIN_ID}/settlements`, { 
      headers,
      params: { page: 1, pageSize: 5 }
    });
    console.log('结算单列表结果:', JSON.stringify(settlementsRes.data, null, 2));
    
    console.log('\n=== 所有API测试完成 ===');
    
  } catch (error) {
    console.error('API测试失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

// 如果没有提供token和chainId，显示使用说明
if (!AUTH_TOKEN || AUTH_TOKEN.includes('...')) {
  console.log(`
使用说明：
1. 请先获取有效的认证token
2. 替换脚本中的AUTH_TOKEN和CHAIN_ID
3. 运行: node 测试资金管理API.js

获取token的方法：
- 登录系统后，从localStorage获取auth_token
- 或者使用管理员账号登录API

当前配置：
API_BASE: ${API_BASE}
AUTH_TOKEN: ${AUTH_TOKEN ? '已设置（需要替换）' : '未设置'}
CHAIN_ID: ${CHAIN_ID}
  `);
} else {
  testFinanceAPI();
}