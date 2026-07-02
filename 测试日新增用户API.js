/**
 * 测试日新增用户API
 * 验证admin和chain-admin的仪表盘API是否返回正确的日新增用户数据
 */

async function testDashboardAPI() {
    console.log('=== 测试日新增用户API ===');
    
    // 模拟一个管理员token（实际使用时需要真实登录）
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFkbWluX3VzZXIiLCJyb2xlcyI6WyJhZG1pbiJdLCJpYXQiOjE3MzAyODQwMDB9.test-token';
    
    try {
        // 测试admin仪表盘API
        console.log('1. 测试admin仪表盘API...');
        const adminResponse = await fetch('http://localhost:3000/api/admin/dashboard', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (adminResponse.ok) {
            const adminData = await adminResponse.json();
            console.log('✅ admin API响应成功');
            console.log('   总用户数:', adminData.data?.overview?.totalUsers || 0);
            console.log('   日新增用户:', adminData.data?.overview?.todayNewUsers || 0);
            console.log('   本周新增:', adminData.data?.overview?.weekNewUsers || 0);
            console.log('   本月新增:', adminData.data?.overview?.monthNewUsers || 0);
        } else {
            console.log('❌ admin API响应失败:', adminResponse.status);
        }
        
        // 测试chain-admin仪表盘API
        console.log('\n2. 测试chain-admin仪表盘API...');
        const chainResponse = await fetch('http://localhost:3000/api/chain-admin/dashboard', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (chainResponse.ok) {
            const chainData = await chainResponse.json();
            console.log('✅ chain-admin API响应成功');
            console.log('   总用户数:', chainData.data?.stats?.totalUsers || 0);
            console.log('   日新增用户:', chainData.data?.stats?.todayNewUsers || 0);
            console.log('   本周新增:', chainData.data?.stats?.weekNewUsers || 0);
            console.log('   本月新增:', chainData.data?.stats?.monthNewUsers || 0);
        } else {
            console.log('❌ chain-admin API响应失败:', chainResponse.status);
        }
        
        console.log('\n=== API测试完成 ===');
        console.log('注意事项:');
        console.log('1. 确保后端服务正在运行 (npm start)');
        console.log('2. 确保数据库连接正常');
        console.log('3. 使用有效的管理员token');
        
    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error.message);
        console.log('\n可能的原因:');
        console.log('1. 后端服务未启动 - 请运行 "npm start"');
        console.log('2. 网络连接问题 - 检查localhost:3000是否可达');
        console.log('3. 端口被占用 - 检查3000端口是否被其他应用占用');
    }
}

// 执行测试
testDashboardAPI();