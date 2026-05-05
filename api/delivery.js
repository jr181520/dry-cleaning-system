// 模拟跑腿服务API
const deliveryAPI = {
    // 生成跑腿订单
    createOrder: function(orderData) {
        // 模拟API调用延迟
        return new Promise((resolve) => {
            setTimeout(() => {
                const deliveryOrderId = 'DEL-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
                resolve({
                    success: true,
                    data: {
                        deliveryOrderId: deliveryOrderId,
                        status: 'pending',
                        estimatedPickupTime: new Date(Date.now() + 30 * 60000).toISOString(), // 30分钟后
                        estimatedDeliveryTime: new Date(Date.now() + 90 * 60000).toISOString() // 90分钟后
                    },
                    message: '跑腿订单创建成功'
                });
            }, 1000);
        });
    },
    
    // 查询跑腿订单状态
    getOrderStatus: function(deliveryOrderId) {
        // 模拟API调用延迟
        return new Promise((resolve) => {
            setTimeout(() => {
                // 模拟不同的订单状态
                const statuses = ['pending', 'assigned', 'picked_up', 'delivered'];
                const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
                
                resolve({
                    success: true,
                    data: {
                        deliveryOrderId: deliveryOrderId,
                        status: randomStatus,
                        statusText: {
                            'pending': '等待接单',
                            'assigned': '已分配骑手',
                            'picked_up': '已取件',
                            'delivered': '已送达'
                        }[randomStatus],
                        riderInfo: randomStatus !== 'pending' ? {
                            name: '骑手' + Math.floor(Math.random() * 1000),
                            phone: '138****' + Math.floor(Math.random() * 10000),
                            rating: (4 + Math.random()).toFixed(1)
                        } : null,
                        updatedAt: new Date().toISOString()
                    },
                    message: '查询成功'
                });
            }, 800);
        });
    },
    
    // 取消跑腿订单
    cancelOrder: function(deliveryOrderId) {
        // 模拟API调用延迟
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: true,
                    data: {
                        deliveryOrderId: deliveryOrderId,
                        status: 'cancelled'
                    },
                    message: '跑腿订单取消成功'
                });
            }, 600);
        });
    }
};

// 导出API
if (typeof module !== 'undefined' && module.exports) {
    module.exports = deliveryAPI;
} else if (typeof window !== 'undefined') {
    window.deliveryAPI = deliveryAPI;
}
