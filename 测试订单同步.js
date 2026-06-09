// 测试脚本：验证C端与小程序订单同步
// 使用方法：在浏览器控制台（F12）中粘贴运行

const API_BASE = 'http://localhost:3000/api';
const TEST_OPENID = 'oSyncTest_' + Date.now();

console.log('========== 订单同步测试 ==========');
console.log('测试OpenID:', TEST_OPENID);
console.log('');

// 1. 测试登录（使用固定openid）
async function testLogin(openid) {
    const response = await fetch(`${API_BASE}/auth/wechat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            openid: openid,
            nickname: '同步测试用户',
            sex: 1,
            platform: 'wechat_sync_test'
        })
    });
    const result = await response.json();
    return result;
}

// 2. 创建测试订单
async function testCreateOrder(openid, token) {
    const response = await fetch(`${API_BASE}/cleaning/orders`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
            userId: openid,
            storeId: 'ST001',
            items: [
                { name: '西装干洗', price: 88, quantity: 1, serviceType: 'dry_clean' }
            ],
            deliveryMethod: 'pickup',
            delivery: {
                type: 'pickup',
                contactName: '测试用户',
                contactPhone: '13800001001'
            },
            amounts: {
                subtotal: 88,
                discount: 0,
                deliveryFee: 0,
                total: 88
            }
        })
    });
    const result = await response.json();
    return result;
}

// 3. 查询订单
async function testQueryOrders(openid, token) {
    const response = await fetch(`${API_BASE}/cleaning/orders?userId=${encodeURIComponent(openid)}`, {
        headers: {
            'Authorization': 'Bearer ' + token
        }
    });
    const result = await response.json();
    return result;
}

// 执行测试
async function runTest() {
    console.log('步骤1: 测试登录...');
    const loginResult = await testLogin(TEST_OPENID);
    
    if (loginResult.success) {
        console.log('✓ 登录成功');
        console.log('  Token:', loginResult.data.token);
        console.log('  UserID:', loginResult.data.openid);
        
        // 保存到localStorage（C端会使用）
        localStorage.setItem('userToken', loginResult.data.token);
        localStorage.setItem('userOpenid', loginResult.data.openid);
        console.log('✓ 已保存登录信息到localStorage');
        
        console.log('');
        console.log('步骤2: 创建测试订单...');
        const orderResult = await testCreateOrder(TEST_OPENID, loginResult.data.token);
        
        if (orderResult.success) {
            console.log('✓ 订单创建成功');
            console.log('  订单号:', orderResult.data?.orderNo);
            console.log('  订单ID:', orderResult.data?._id);
            
            console.log('');
            console.log('步骤3: 查询订单...');
            const queryResult = await testQueryOrders(TEST_OPENID, loginResult.data.token);
            
            if (queryResult.success) {
                console.log('✓ 订单查询成功');
                console.log('  订单数量:', queryResult.data?.list?.length || 0);
                console.log('  订单列表:', queryResult.data?.list);
                
                console.log('');
                console.log('========== 测试完成 ==========');
                console.log('✅ 数据同步正常！');
                console.log('');
                console.log('下一步：');
                console.log('1. 打开 c-orders.html 页面');
                console.log('2. 你应该能看到刚才创建的测试订单');
                console.log('3. 订单来源显示为 "同步测试用户"');
                
                return true;
            } else {
                console.log('✗ 订单查询失败:', queryResult.error);
            }
        } else {
            console.log('✗ 订单创建失败:', orderResult.error);
        }
    } else {
        console.log('✗ 登录失败:', loginResult.error);
    }
    
    console.log('');
    console.log('========== 测试失败 ==========');
    return false;
}

runTest();
