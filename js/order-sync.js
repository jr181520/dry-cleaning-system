/**
 * 数据同步管理器
 * 用于解决前端localStorage与后端数据库的数据同步问题
 * 
 * 使用方法：
 * 1. 在需要同步的页面引入此模块
 * 2. 调用 OrderSyncManager.start() 启动同步
 * 3. 调用 OrderSyncManager.stop() 停止同步
 */

const OrderSyncManager = {
    // 配置
    config: {
        // API基础地址 - 根据环境自动选择
        get apiBaseUrl() {
            // 检查当前页面使用的端口，默认3000（后端API端口）
            const currentPort = window.location.port || '3000';
            return `http://localhost:${currentPort}/api`;
        },
        
        // 同步间隔（毫秒）- 默认5秒
        syncInterval: 5000,
        
        // 定时器
        syncTimer: null,
        
        // 是否启用
        isEnabled: false,
        
        // 同步日志
        enableLog: true
    },
    
    // 日志方法
    log(message, type = 'info') {
        if (!this.config.enableLog) return;
        const timestamp = new Date().toLocaleTimeString();
        const prefix = type === 'error' ? '❌' : type === 'warn' ? '⚠️' : 'ℹ️';
        console.log(`[同步 ${timestamp}] ${prefix} ${message}`);
    },
    
    // 启动同步
    start() {
        if (this.config.isEnabled) {
            this.log('同步已在运行中，跳过启动', 'warn');
            return;
        }
        
        this.log('启动订单数据同步...');
        this.config.isEnabled = true;
        
        // 立即执行一次同步
        this.sync();
        
        // 设置定时同步
        this.config.syncTimer = setInterval(() => {
            this.sync();
        }, this.config.syncInterval);
        
        this.log(`同步已启动，间隔: ${this.config.syncInterval / 1000}秒`);
    },
    
    // 停止同步
    stop() {
        if (this.config.syncTimer) {
            clearInterval(this.config.syncTimer);
            this.config.syncTimer = null;
        }
        this.config.isEnabled = false;
        this.log('订单数据同步已停止');
    },
    
    // 执行同步
    async sync() {
        try {
            this.log('开始同步订单数据...');
            
            // 1. 从服务器获取最新订单
            const serverOrders = await this.fetchServerOrders();
            
            if (serverOrders) {
                // 2. 合并到本地
                this.mergeOrders(serverOrders);
            }
            
            // 3. 上传本地未同步的订单（如果需要）
            // await this.uploadLocalOrders();
            
            this.log('同步完成');
        } catch (error) {
            this.log(`同步失败: ${error.message}`, 'error');
        }
    },
    
    // 从服务器获取订单
    async fetchServerOrders() {
        try {
            // 确定使用哪个API端点和认证方式
            let endpoint, authHeader;
            
            if (window.location.pathname.includes('m-index')) {
                // M端页面：获取门店订单
                // 从localStorage获取当前门店ID
                const currentStore = JSON.parse(localStorage.getItem('currentStore') || '{}');
                const storeUser = JSON.parse(localStorage.getItem('storeUser') || '{}');
                const myStoreId = currentStore.storeId || storeUser.storeId || 'ST002';
                
                // M端使用门店订单API（直接按storeId过滤，无需客户端再过滤）
                endpoint = `/cleaning/store/${myStoreId}/orders`;
                const storeToken = localStorage.getItem('storeToken') || localStorage.getItem('authToken');
                authHeader = storeToken ? `Bearer ${storeToken}` : '';
                
                this.log(`M端同步，门店ID: ${myStoreId}`);
            } else if (window.location.pathname.includes('admin')) {
                // 管理员页面：获取所有订单
                endpoint = '/cleaning/orders';
                const adminToken = localStorage.getItem('adminToken') || localStorage.getItem('adminAuthToken');
                authHeader = adminToken ? `Bearer ${adminToken}` : '';
            } else if (window.location.pathname.includes('index')) {
                // 门店管理端（index.html）：按门店ID获取订单
                const currentStore = JSON.parse(localStorage.getItem('currentStore') || '{}');
                const storeUser = JSON.parse(localStorage.getItem('storeUser') || '{}');
                const myStoreId = currentStore.storeId || storeUser.storeId || 'ST001';
                endpoint = `/cleaning/store/${myStoreId}/orders`;
                const storeToken = localStorage.getItem('storeToken') || localStorage.getItem('authToken');
                authHeader = storeToken ? `Bearer ${storeToken}` : '';
                this.log(`门店管理端同步，门店ID: ${myStoreId}`);
            } else {
                // C端页面：获取用户订单
                // 必须要有用户标识才能查询（否则会触发安全兜底，浪费请求）
                const openid = localStorage.getItem('userOpenid');
                const userId = openid || localStorage.getItem('userId');
                const phone = localStorage.getItem('userPhone');
                
                if (!userId && !phone) {
                    this.log('C端无用户标识，跳过同步', 'debug');
                    return null;
                }
                
                let endpointUrl = '/cleaning/orders';
                const params = [];
                if (userId) params.push(`userId=${encodeURIComponent(userId)}`);
                if (phone) params.push(`phone=${encodeURIComponent(phone)}`);
                if (params.length > 0) endpointUrl += '?' + params.join('&');
                
                endpoint = endpointUrl;
                const userToken = localStorage.getItem('userToken') || localStorage.getItem('authToken');
                authHeader = userToken ? `Bearer ${userToken}` : '';
            }
            
            // 构建请求头
            const headers = { 'Content-Type': 'application/json' };
            if (authHeader) {
                headers['Authorization'] = authHeader;
            }
            
            this.log(`尝试从 ${endpoint} 获取订单...`);
            
            const response = await fetch(`${this.config.apiBaseUrl}${endpoint}`, {
                method: 'GET',
                headers: headers,
                signal: AbortSignal.timeout(5000)
            });
            
            if (response.ok) {
                const result = await response.json();
                let orders = result.data?.list || result.data || [];
                
                // M端需要过滤只显示本门店的订单
                if (window.location.pathname.includes('m-index')) {
                    const currentStore = JSON.parse(localStorage.getItem('currentStore') || '{}');
                    const storeUser = JSON.parse(localStorage.getItem('storeUser') || '{}');
                    const myStoreId = currentStore.storeId || storeUser.storeId || 'ST002';
                    orders = orders.filter(o => 
                        o.storeId === myStoreId || 
                        o.store?.id === myStoreId
                    );
                    this.log(`过滤后本门店订单: ${orders.length} 条`);
                }
                
                this.log(`从 ${endpoint} 获取到 ${orders.length} 条订单`);
                return orders;
            } else if (response.status === 401) {
                this.log('认证失败（401），跳过此次同步', 'warn');
                return null;
            } else {
                this.log(`API请求失败: ${response.status}`, 'warn');
                return null;
            }
        } catch (error) {
            this.log(`获取服务器订单失败: ${error.message}`, 'error');
            return null;
        }
    },
    
    // 合并订单到本地存储
    mergeOrders(serverOrders) {
        if (!serverOrders || !Array.isArray(serverOrders)) return;
        
        // 确定使用哪个本地存储键
        let storageKey;
        if (window.location.pathname.includes('m-index')) {
            storageKey = 'store_orders';
        } else if (window.location.pathname.includes('admin')) {
            storageKey = 'all_orders';
        } else {
            storageKey = 'orders';
        }
        
        const localOrders = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const localOrderIds = new Set(localOrders.map(o => o.orderId || o._id));
        
        // 添加服务器订单中本地没有的
        let addedCount = 0;
        serverOrders.forEach(serverOrder => {
            const orderId = serverOrder.orderNo || serverOrder._id;
            if (!localOrderIds.has(orderId)) {
                // 转换为前端格式
                const formattedOrder = this.formatOrderFromServer(serverOrder);
                localOrders.unshift(formattedOrder);
                addedCount++;
            }
        });
        
        if (addedCount > 0) {
            localStorage.setItem(storageKey, JSON.stringify(localOrders));
            this.log(`合并了 ${addedCount} 条新订单到本地`, 'warn');
            
            // 触发自定义事件，通知页面更新
            window.dispatchEvent(new CustomEvent('ordersSynced', { 
                detail: { count: addedCount } 
            }));
        }
    },
    
    // 格式化服务器订单为前端格式
    formatOrderFromServer(serverOrder) {
        // 计算订单总金额 - 优先从amounts.total获取
        let orderTotal = 0;
        if (serverOrder.amounts?.total) {
            orderTotal = serverOrder.amounts.total;
        } else if (serverOrder.fees?.total) {
            orderTotal = serverOrder.fees.total;
        } else if (serverOrder.totalPrice) {
            orderTotal = serverOrder.totalPrice;
        } else if (serverOrder.total) {
            orderTotal = serverOrder.total;
        } else if (serverOrder.amount) {
            orderTotal = serverOrder.amount;
        } else if (serverOrder.items && serverOrder.items.length > 0) {
            // 如果没有总金额字段，则从items计算
            orderTotal = serverOrder.items.reduce((sum, item) => {
                return sum + (item.subtotal || item.price * (item.quantity || 1) || 0);
            }, 0);
        }
        
        return {
            orderId: serverOrder.orderNo || serverOrder._id,
            id: serverOrder.orderNo || serverOrder._id,
            orderNo: serverOrder.orderNo || serverOrder._id,
            customerName: serverOrder.customerName || serverOrder.contact?.name || '客户',
            customerPhone: serverOrder.customerPhone || serverOrder.contact?.phone || '',
            items: serverOrder.items || [],
            store: serverOrder.store ? {
                id: serverOrder.storeId,
                name: serverOrder.store.name || serverOrder.storeName || '服务网点',
                address: serverOrder.store.address || serverOrder.storeAddress || '',
                phone: serverOrder.store.phone || '',
                city: serverOrder.store.city || '',
                district: serverOrder.store.district || '',
                location: serverOrder.store.location || null,
                specialty: serverOrder.store.specialty || ''
            } : {
                id: serverOrder.storeId,
                name: serverOrder.storeName || '服务网点',
                address: serverOrder.storeAddress || '',
                location: null
            },
            storeId: serverOrder.storeId,
            storeName: serverOrder.store?.name || serverOrder.storeName || '',
            storeAddress: serverOrder.store?.address || serverOrder.storeAddress || '',
            // 金额字段 - 确保所有可能的字段名都被设置
            amounts: serverOrder.amounts || null,
            total: orderTotal,
            totalPrice: orderTotal,
            amount: orderTotal,
            status: this.normalizeStatus(serverOrder.status),
            paymentStatus: serverOrder.paymentStatus || serverOrder.payStatus || 'pending',
            createdAt: serverOrder.createdAt || serverOrder.createTime,
            createTime: serverOrder.createTime || new Date(serverOrder.createdAt).toLocaleString(),
            source: 'server_sync'
        };
    },
    
    // 标准化订单状态
    normalizeStatus(status) {
        const statusMap = {
            'pending': 'pending',
            'paid': 'paid',
            'received': 'received',
            'cleaning': 'cleaning',
            'cleaned': 'cleaned',
            'ready': 'ready',
            'delivering': 'delivering',
            'delivering_back': 'delivering_back',
            'completed': 'completed',
            'cancelled': 'cancelled',
            'created': 'pending',
            'processing': 'processing',
            'finished': 'completed',
            'courier_waiting': 'ready',
            'courier_picked_up': 'delivering',
            'courier_delivering': 'delivering',
            'customer_received': 'completed',
            'customer_picked_up': 'completed',
            'awaiting_store_outbound': 'awaiting_store_outbound',
            'store_outbound': 'store_outbound'
        };
        return statusMap[status?.toLowerCase()] || status || 'pending';
    },
    
    // 手动触发同步
    manualSync() {
        this.log('手动触发同步...');
        this.sync();
    },
    
    // 获取同步状态
    getStatus() {
        return {
            isEnabled: this.config.isEnabled,
            syncInterval: this.config.syncInterval,
            lastSync: this.config.lastSyncTime || '从未同步'
        };
    }
};

// ⚠️ 自动启动已禁用 — 改用 MQTT WebSocket 实时推送
// 如果特定页面需要轮询，请在页面内显式调用 OrderSyncManager.start()
// document.addEventListener('DOMContentLoaded', () => {
//     OrderSyncManager.start();
//     console.log('[同步] 已自动启动订单数据同步');
// });

// 监听页面可见性变化，在页面重新可见时同步
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && OrderSyncManager.config.isEnabled) {
        OrderSyncManager.log('页面重新可见，执行同步...');
        OrderSyncManager.sync();
    }
});
