/**
 * 统一数据同步管理器 v2
 * 解决 C端、M端、管理端 的数据同步问题
 * 
 * 特性：
 * 1. 统一的 token 获取（支持多种 token 名称）
 * 2. 统一的数据存储键（三个端使用不同的键）
 * 3. 双向同步：服务器 ↔ 本地
 * 4. 操作后自动同步
 * 5. 跨端数据一致性
 */

const UnifiedSync = {
    // 配置
    config: {
        // API基础地址
        get apiBaseUrl() {
            return `http://localhost:3000/api`;
        },
        
        // 同步间隔（毫秒）
        syncInterval: 3000,
        
        // 定时器
        syncTimer: null,
        
        // 是否启用
        isEnabled: false,
        
        // 启用日志
        enableLog: true,
        
        // 上次同步时间
        lastSyncTime: null
    },
    
    // 端点配置
    endpoints: {
        c: {
            // C端用户订单
            storageKey: 'c_orders',
            backupKey: 'c_orders_backup',
            endpoint: '/cleaning/orders',
            getToken: () => localStorage.getItem('userToken') || localStorage.getItem('authToken'),
            getUserId: () => {
                const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
                return user.id || user.userId || null;
            }
        },
        m: {
            // M端门店订单
            storageKey: 'm_orders',
            backupKey: 'm_orders_backup',
            endpoint: '/cleaning/orders',
            getToken: () => localStorage.getItem('storeToken') || localStorage.getItem('authToken'),
            getStoreId: () => {
                const store = JSON.parse(localStorage.getItem('currentStore') || '{}');
                const storeUser = JSON.parse(localStorage.getItem('storeUser') || '{}');
                return store.storeId || storeUser.storeId || 'ST002';
            }
        },
        admin: {
            // 管理端所有订单
            storageKey: 'admin_orders',
            backupKey: 'admin_orders_backup',
            endpoint: '/cleaning/orders',
            getToken: () => localStorage.getItem('adminToken') || localStorage.getItem('adminAuthToken'),
            getUserId: () => null // 管理端不需要用户ID
        }
    },
    
    // 获取当前端类型
    getCurrentEndpoint() {
        const path = window.location.pathname.toLowerCase();
        if (path.includes('m-')) return 'm';
        if (path.includes('admin')) return 'admin';
        return 'c';
    },
    
    // 日志
    log(message, type = 'info') {
        if (!this.config.enableLog) return;
        const timestamp = new Date().toLocaleTimeString();
        const prefix = type === 'error' ? '❌' : type === 'warn' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
        console.log(`[统一同步 ${timestamp}] ${prefix} ${message}`);
    },
    
    // 启动同步
    start() {
        if (this.config.isEnabled) {
            this.log('同步已在运行中，跳过启动', 'warn');
            return;
        }
        
        const endpoint = this.getCurrentEndpoint();
        this.log(`启动统一同步，端类型: ${endpoint.toUpperCase()}`);
        
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
        this.log('统一同步已停止');
    },
    
    // 执行同步
    async sync() {
        try {
            const endpoint = this.endpoints[this.getCurrentEndpoint()];
            const token = endpoint.getToken();
            
            if (!token) {
                this.log('未登录，跳过同步', 'warn');
                return;
            }
            
            this.log('开始同步数据...');
            
            // 从服务器获取订单
            const serverOrders = await this.fetchFromServer(endpoint);
            
            if (serverOrders !== null) {
                // 合并到本地
                this.mergeToLocal(endpoint, serverOrders);
                this.config.lastSyncTime = new Date().toISOString();
                this.log(`同步完成，服务器订单: ${serverOrders.length} 条`);
                
                // 触发页面更新事件
                window.dispatchEvent(new CustomEvent('unifiedSyncComplete', {
                    detail: { count: serverOrders.length }
                }));
            }
        } catch (error) {
            this.log(`同步失败: ${error.message}`, 'error');
        }
    },
    
    // 从服务器获取订单
    async fetchFromServer(endpoint) {
        try {
            const token = endpoint.getToken();
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };
            
            this.log(`请求API: ${endpoint.endpoint}`);
            
            const response = await fetch(`${this.config.apiBaseUrl}${endpoint.endpoint}`, {
                method: 'GET',
                headers: headers,
                signal: AbortSignal.timeout(8000)
            });
            
            if (response.status === 401) {
                this.log('认证失败，请重新登录', 'error');
                return null;
            }
            
            if (!response.ok) {
                this.log(`API错误: ${response.status}`, 'warn');
                return null;
            }
            
            const result = await response.json();
            
            if (!result.success) {
                this.log(`API返回错误: ${result.error}`, 'warn');
                return null;
            }
            
            let orders = result.data?.list || result.data || [];
            
            // M端需要过滤本门店订单
            if (endpoint.getStoreId && endpoint.getStoreId()) {
                const storeId = endpoint.getStoreId();
                orders = orders.filter(o => 
                    o.storeId === storeId || 
                    o.store?.id === storeId
                );
                this.log(`过滤后本门店订单: ${orders.length} 条`);
            }
            
            return orders;
        } catch (error) {
            this.log(`获取服务器数据失败: ${error.message}`, 'error');
            return null;
        }
    },
    
    // 合并到本地存储
    mergeToLocal(endpoint, serverOrders) {
        if (!serverOrders || !Array.isArray(serverOrders)) return;
        
        const storageKey = endpoint.storageKey;
        const localOrders = JSON.parse(localStorage.getItem(storageKey) || '[]');
        
        // 创建本地订单ID映射
        const localOrderMap = new Map();
        localOrders.forEach(order => {
            const key = order.orderId || order.orderNo || order.id || order._id;
            localOrderMap.set(key, order);
        });
        
        // 合并：使用服务器最新数据，但保留本地特有字段
        const mergedOrders = [];
        const processedIds = new Set();
        
        serverOrders.forEach(serverOrder => {
            const serverId = serverOrder.orderNo || serverOrder._id;
            const localOrder = localOrderMap.get(serverId);
            
            if (localOrder) {
                // 本地存在，合并数据（服务器优先，除了本地特有状态）
                mergedOrders.push({
                    ...localOrder,
                    ...this.formatOrder(serverOrder),
                    // 保留本地特有字段
                    _localUpdated: localOrder._localUpdated,
                    _syncedFrom: 'server'
                });
            } else {
                // 服务器有，本地没有，添加
                mergedOrders.push({
                    ...this.formatOrder(serverOrder),
                    _syncedFrom: 'server'
                });
            }
            processedIds.add(serverId);
        });
        
        // 按创建时间排序（最新的在前）
        mergedOrders.sort((a, b) => {
            const timeA = new Date(a.createdAt || a.createTime || 0);
            const timeB = new Date(b.createdAt || b.createTime || 0);
            return timeB - timeA;
        });
        
        // 保存到本地
        localStorage.setItem(storageKey, JSON.stringify(mergedOrders));
        
        // 同时备份
        localStorage.setItem(endpoint.backupKey, JSON.stringify({
            orders: mergedOrders,
            updatedAt: new Date().toISOString()
        }));
        
        this.log(`合并完成，本地订单: ${mergedOrders.length} 条`);
    },
    
    // 格式化订单数据
    formatOrder(serverOrder) {
        return {
            // 支持多种ID格式
            orderId: serverOrder.orderNo || serverOrder._id,
            id: serverOrder._id,
            _id: serverOrder._id,
            orderNo: serverOrder.orderNo || serverOrder._id,
            
            // 服务项目
            items: serverOrder.items || [],
            services: (serverOrder.items || []).map(item => ({
                name: item.name || '服务',
                icon: '📦',
                price: item.price || 0
            })),
            
            // 门店信息
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
            
            // 金额
            fees: {
                total: serverOrder.amounts?.total || serverOrder.total || 0,
                serviceFee: serverOrder.amounts?.subtotal || 0,
                deliveryFee: serverOrder.amounts?.deliveryFee || 0,
                discount: serverOrder.amounts?.discount || 0
            },
            total: serverOrder.amounts?.total || serverOrder.total || 0,
            
            // 状态
            status: serverOrder.status,
            deliveryStatus: serverOrder.status,
            paymentStatus: serverOrder.payment?.status || serverOrder.payStatus || 'pending',
            
            // 时间
            createdAt: serverOrder.createdAt,
            createTime: new Date(serverOrder.createdAt).toLocaleString(),
            
            // 联系方式
            contact: serverOrder.delivery ? {
                name: serverOrder.delivery.contactName,
                phone: serverOrder.delivery.contactPhone,
                address: serverOrder.delivery.address
            } : {}
        };
    },
    
    // 手动同步
    manualSync() {
        this.log('手动触发同步...');
        return this.sync();
    },
    
    // 获取本地订单（带同步状态）
    getLocalOrders() {
        const endpoint = this.endpoints[this.getCurrentEndpoint()];
        const orders = JSON.parse(localStorage.getItem(endpoint.storageKey) || '[]');
        
        // 检查同步状态
        const backup = localStorage.getItem(endpoint.backupKey);
        let syncStatus = 'unknown';
        let lastUpdate = null;
        
        if (backup) {
            try {
                const backupData = JSON.parse(backup);
                lastUpdate = backupData.updatedAt;
                const backupTime = new Date(backupData.updatedAt);
                const now = new Date();
                const diff = (now - backupTime) / 1000; // 秒
                
                if (diff < 60) syncStatus = '刚刚同步';
                else if (diff < 300) syncStatus = `${Math.floor(diff / 60)}分钟前同步`;
                else syncStatus = '数据可能过期';
            } catch (e) {}
        }
        
        return {
            orders,
            count: orders.length,
            syncStatus,
            lastUpdate,
            lastSyncTime: this.config.lastSyncTime
        };
    },
    
    // 清除本地数据并重新同步
    async clearAndSync() {
        const endpoint = this.endpoints[this.getCurrentEndpoint()];
        
        this.log('清除本地数据...');
        localStorage.removeItem(endpoint.storageKey);
        localStorage.removeItem(endpoint.backupKey);
        
        this.log('重新同步...');
        await this.sync();
        
        return this.getLocalOrders();
    },
    
    // 获取同步状态
    getStatus() {
        return {
            isEnabled: this.config.isEnabled,
            currentEndpoint: this.getCurrentEndpoint(),
            syncInterval: this.config.syncInterval,
            lastSyncTime: this.config.lastSyncTime,
            localOrders: this.getLocalOrders()
        };
    }
};

// 监听页面可见性变化
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && UnifiedSync.config.isEnabled) {
        UnifiedSync.log('页面重新可见，执行同步...');
        UnifiedSync.sync();
    }
});

// 监听登录状态变化
window.addEventListener('storage', (e) => {
    if (e.key === 'userToken' || e.key === 'authToken' || 
        e.key === 'storeToken' || e.key === 'adminToken') {
        UnifiedSync.log('登录状态变化，重新同步...');
        if (UnifiedSync.config.isEnabled) {
            UnifiedSync.sync();
        }
    }
});

// 监听页面加载完成
window.addEventListener('load', () => {
    console.log('[统一同步] UnifiedSync 已加载，可通过 window.UnifiedSync 访问');
});

console.log('[统一同步] 模块已加载');
