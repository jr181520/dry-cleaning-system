/**
 * 聚合跑腿服务API配置
 * 预留接口，用于对接美团跑腿、京东快递、顺丰速运等聚合配送平台
 */

const DeliveryAPI = {
    // API基础配置
    config: {
        baseUrl: 'https://api.drycleaning-system.com',
        timeout: 10000,
        retryCount: 3
    },

    // 跑腿服务商列表
    providers: [
        {
            id: 'meituan',
            name: '美团跑腿',
            icon: '🛵',
            estimatedTime: '30-45分钟',
            baseFee: 12,
            actualFee: 9,
            rating: 4.9,
            hasDiscount: true,
            discountInfo: '新用户首单立减3元',
            apiEndpoint: '/api/delivery/meituan',
            status: 'active'
        },
        {
            id: 'jd',
            name: '京东秒送',
            icon: '🚚',
            estimatedTime: '35-50分钟',
            baseFee: 15,
            actualFee: 15,
            rating: 4.8,
            hasDiscount: false,
            discountInfo: '',
            apiEndpoint: '/api/delivery/jd',
            status: 'active'
        },
        {
            id: 'sf',
            name: '顺丰跑腿',
            icon: '✈️',
            estimatedTime: '40-60分钟',
            baseFee: 18,
            actualFee: 13,
            rating: 4.9,
            hasDiscount: true,
            discountInfo: '满50元减5元',
            apiEndpoint: '/api/delivery/sf',
            status: 'active'
        }
    ],

    /**
     * 查询可用配送服务商
     * @param {Object} params - 查询参数
     * @param {string} params.pickupAddress - 取件地址
     * @param {string} params.deliveryAddress - 送件地址
     * @param {number} params.weight - 物品重量（kg）
     * @returns {Promise<Object>} - 返回可用服务商列表
     */
    async queryProviders(params) {
        try {
            // 预留API接口
            // const response = await fetch(`${this.config.baseUrl}/api/delivery/query`, {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //         'Authorization': 'Bearer ' + localStorage.getItem('token')
            //     },
            //     body: JSON.stringify(params),
            //     timeout: this.config.timeout
            // });
            
            // 模拟返回数据
            await new Promise(resolve => setTimeout(resolve, 500));
            
            return {
                success: true,
                providers: this.providers,
                message: '查询成功'
            };
        } catch (error) {
            console.error('查询配送服务商失败:', error);
            return {
                success: false,
                providers: this.providers,
                message: '使用默认服务商'
            };
        }
    },

    /**
     * 创建配送订单
     * @param {Object} order - 配送订单信息
     * @param {string} order.providerId - 服务商ID
     * @param {string} order.pickupAddress - 取件地址
     * @param {string} order.deliveryAddress - 送件地址
     * @param {string} order.pickupTime - 取件时间
     * @param {string} order.remark - 备注
     * @returns {Promise<Object>} - 返回创建结果
     */
    async createOrder(order) {
        try {
            const provider = this.providers.find(p => p.id === order.providerId);
            
            // 预留API接口
            // const response = await fetch(`${this.config.baseUrl}${provider.apiEndpoint}/create`, {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //         'Authorization': 'Bearer ' + localStorage.getItem('token')
            //     },
            //     body: JSON.stringify({
            //         ...order,
            //         userId: localStorage.getItem('userId'),
            //         orderSource: 'dry_cleaning_app'
            //     })
            // });
            
            // 模拟创建订单
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            return {
                success: true,
                deliveryOrderId: 'DEL-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                status: 'pending',
                provider: provider,
                estimatedArrival: this.calculateEstimatedTime(provider),
                actualFee: provider.discountFee
            };
        } catch (error) {
            console.error('创建配送订单失败:', error);
            return {
                success: false,
                message: '配送订单创建失败，请重试'
            };
        }
    },

    /**
     * 取消配送订单
     * @param {string} deliveryOrderId - 配送订单ID
     * @returns {Promise<Object>} - 返回取消结果
     */
    async cancelOrder(deliveryOrderId) {
        try {
            // 预留API接口
            // const response = await fetch(`${this.config.baseUrl}/api/delivery/cancel`, {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //         'Authorization': 'Bearer ' + localStorage.getItem('token')
            //     },
            //     body: JSON.stringify({ deliveryOrderId })
            // });
            
            // 模拟取消
            await new Promise(resolve => setTimeout(resolve, 500));
            
            return {
                success: true,
                message: '配送订单已取消'
            };
        } catch (error) {
            console.error('取消配送订单失败:', error);
            return {
                success: false,
                message: '取消失败，请重试'
            };
        }
    },

    /**
     * 查询配送状态
     * @param {string} deliveryOrderId - 配送订单ID
     * @returns {Promise<Object>} - 返回配送状态
     */
    async queryStatus(deliveryOrderId) {
        try {
            // 预留API接口
            // const response = await fetch(`${this.config.baseUrl}/api/delivery/status/${deliveryOrderId}`);
            
            // 模拟查询
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const statuses = ['pending', 'assigned', 'picked', 'delivering', 'completed'];
            const currentStatus = statuses[Math.floor(Math.random() * statuses.length)];
            
            return {
                success: true,
                status: currentStatus,
                statusText: this.getStatusText(currentStatus),
                rider: {
                    name: '张师傅',
                    phone: '138****8888'
                },
                location: {
                    lat: 39.908,
                    lng: 116.397
                }
            };
        } catch (error) {
            console.error('查询配送状态失败:', error);
            return {
                success: false,
                message: '查询失败'
            };
        }
    },

    /**
     * 计算预计到达时间
     * @param {Object} provider - 服务商信息
     * @returns {string} - 预计到达时间
     */
    calculateEstimatedTime(provider) {
        const now = new Date();
        const [min, max] = provider.estimatedTime.match(/\d+/g).map(Number);
        const minutes = Math.floor((min + max) / 2);
        now.setMinutes(now.getMinutes() + minutes);
        return now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    },

    /**
     * 获取状态文本
     * @param {string} status - 状态码
     * @returns {string} - 状态文本
     */
    getStatusText(status) {
        const statusMap = {
            'pending': '待接单',
            'assigned': '已接单',
            'picked': '已取件',
            'delivering': '配送中',
            'completed': '已完成',
            'cancelled': '已取消'
        };
        return statusMap[status] || '未知状态';
    },

    /**
     * 获取服务商信息
     * @param {string} providerId - 服务商ID
     * @returns {Object|null} - 服务商信息
     */
    getProvider(providerId) {
        return this.providers.find(p => p.id === providerId) || null;
    },

    /**
     * 计算配送费用
     * @param {string} providerId - 服务商ID
     * @param {Object} params - 费用参数
     * @returns {number} - 配送费用
     */
    calculateFee(providerId, params = {}) {
        const provider = this.getProvider(providerId);
        if (!provider) return 0;

        // 基础费用（如果有折扣则使用实际费用）
        let fee = provider.actualFee || provider.baseFee;

        // 距离附加费（预留）
        if (params.distance && params.distance > 5) {
            fee += Math.ceil((params.distance - 5) * 2);
        }

        // 重量附加费（预留）
        if (params.weight && params.weight > 3) {
            fee += Math.ceil((params.weight - 3) * 3);
        }

        return fee;
    }
};

// 导出到全局
window.DeliveryAPI = DeliveryAPI;
