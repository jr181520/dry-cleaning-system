/**
 * 测试订单API返回的门店信息
 */
const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/cleaning/orders?page=1&pageSize=10',
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    }
};

console.log('正在测试订单API...\n');

const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const result = JSON.parse(data);
            console.log('=== API返回数据 ===\n');
            
            if (result.success && result.data && result.data.list) {
                console.log(`订单总数: ${result.data.total}`);
                console.log(`返回订单数: ${result.data.list.length}\n`);
                
                if (result.data.list.length > 0) {
                    const firstOrder = result.data.list[0];
                    console.log('=== 第一个订单的门店信息 ===');
                    console.log('orderNo:', firstOrder.orderNo);
                    console.log('storeId:', firstOrder.storeId);
                    console.log('storeName:', firstOrder.storeName);
                    console.log('storeAddress:', firstOrder.storeAddress);
                    console.log('store对象:', JSON.stringify(firstOrder.store, null, 2));
                }
            } else {
                console.log('API返回格式:', data);
            }
        } catch (e) {
            console.error('解析失败:', e.message);
            console.log('原始数据:', data);
        }
    });
});

req.on('error', (e) => {
    console.error('请求错误:', e.message);
    console.log('\n请确保服务器已启动在 localhost:3000');
});

req.end();
