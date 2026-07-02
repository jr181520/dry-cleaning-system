// 连锁企业管理平台API测试脚本
const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

// 测试函数
async function testChainAdminAPI() {
  console.log('开始测试连锁企业管理平台API...\n');
  
  // 1. 测试登录（使用模拟数据）
  console.log('1. 测试登录接口');
  try {
    const loginResponse = await axios.post(`${API_BASE}/auth/staff-login`, {
      username: 'admin',
      password: 'admin123'
    });
    console.log('登录成功:', loginResponse.data.success ? '✓' : '✗');
    if (loginResponse.data.success) {
      const token = loginResponse.data.token;
      const user = loginResponse.data.user;
      console.log('获取到token:', token ? '✓' : '✗');
      console.log('用户角色:', user?.roles?.join(', '));
      
      // 2. 测试连锁信息接口
      console.log('\n2. 测试连锁信息接口');
      try {
        const infoResponse = await axios.get(`${API_BASE}/chain-admin/info`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('获取连锁信息:', infoResponse.data.success ? '✓' : '✗');
        if (infoResponse.data.success) {
          console.log('连锁名称:', infoResponse.data.data?.name);
          console.log('连锁编号:', infoResponse.data.data?.chainNo);
        }
      } catch (error) {
        console.log('获取连锁信息失败:', error.message);
      }
      
      // 3. 测试结算概览接口
      console.log('\n3. 测试结算概览接口');
      try {
        const settlementResponse = await axios.get(`${API_BASE}/chain-admin/settlement/overview`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('获取结算概览:', settlementResponse.data.success ? '✓' : '✗');
        if (settlementResponse.data.success) {
          const overview = settlementResponse.data.data?.overview;
          console.log('待结算单数:', overview?.pendingCount);
          console.log('已完成结算数:', overview?.completedCount);
          console.log('总金额:', overview?.totalAmount);
        }
      } catch (error) {
        console.log('获取结算概览失败:', error.message);
      }
      
      // 4. 测试门店列表接口
      console.log('\n4. 测试门店列表接口');
      try {
        const storesResponse = await axios.get(`${API_BASE}/chain-admin/stores`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('获取门店列表:', storesResponse.data.success ? '✓' : '✗');
        if (storesResponse.data.success) {
          const stores = storesResponse.data.data?.list || [];
          console.log('门店数量:', stores.length);
          if (stores.length > 0) {
            console.log('第一个门店:', stores[0].name);
          }
        }
      } catch (error) {
        console.log('获取门店列表失败:', error.message);
      }
      
      // 5. 测试门店结算权限接口
      console.log('\n5. 测试门店结算权限接口');
      try {
        const settlementStoresResponse = await axios.get(`${API_BASE}/chain-admin/settlement/stores`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('获取门店结算权限:', settlementStoresResponse.data.success ? '✓' : '✗');
        if (settlementStoresResponse.data.success) {
          const stores = settlementStoresResponse.data.data || [];
          console.log('门店结算权限数量:', stores.length);
          if (stores.length > 0) {
            console.log('第一个门店结算比例:', (stores[0].settlementRatio * 100) + '%');
            console.log('终端结算状态:', stores[0].terminalSettlementEnabled ? '开启' : '关闭');
          }
        }
      } catch (error) {
        console.log('获取门店结算权限失败:', error.message);
      }
      
    }
  } catch (error) {
    console.log('登录失败:', error.message);
  }
  
  console.log('\n测试完成！');
}

// 运行测试
testChainAdminAPI().catch(console.error);