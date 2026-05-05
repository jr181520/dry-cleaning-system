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
            // 检查当前页面使用的端口
            const currentPort = window.location.port;
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
            // 尝试多个API端点
            const endpoints = [
                '/cleaning/orders',
                '/admin/orders',
                '/orders'
            ];
            
            for (const endpoint of endpoints) {
                try {
                    const response = await fetch(`${this.config.apiBaseUrl}${endpoint}`, {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' },
                        // 超时处理
                        signal: AbortSignal.timeout(3000)
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        this.log(`从 ${endpoint} 获取到 ${result.data?.length || 0} 条订单`);
                        return result.data || result;
                    }
                } catch (e) {
                    // 继续尝试下一个端点
                    continue;
                }
            }
            
            return null;
        } catch (error) {
            this.log(`获取服务器订单失败: ${error.message}`, 'error');
            return null;
        }
    },
    
    // 合并订单到本地存储
    mergeOrders(serverOrders) {
        if (!serverOrders || !Array.isArray(serverOrders)) return;
        
        // 确定使用哪个本地存储键
        const storageKey = window.location.pathname.includes('m-index') ? 
            'store_orders' : 'orders';
        
        const localOrders = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const localOrderIds = new Set(localOrders.map(o => o.orderId || o._id));
        
        // 添加服务器订单中本地没有的
        let addedCount = 0;
        serverOrders.forEach(serverOrder => {
            const orderId = serverOrder.orderId || serverOrder._id;
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
        return {
            orderId: serverOrder.orderNo || serverOrder._id,
            id: serverOrder.orderNo || serverOrder._id,
            orderNo: serverOrder.orderNo || serverOrder._id,
            customerName: serverOrder.customerName || serverOrder.contact?.name || '客户',
            customerPhone: serverOrder.customerPhone || serverOrder.contact?.phone || '',
            items: serverOrder.items || [],
            store: serverOrder.store || { name: '系统分配' },
            storeId: serverOrder.storeId,
            storeName: serverOrder.store?.name || '系统分配',
            total: serverOrder.total || serverOrder.amount || 0,
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
            'completed': 'completed',
            'cancelled': 'cancelled',
            'created': 'pending',
            'processing': 'processing',
            'finished': 'completed'
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

// 自动启动（可选）- 如果页面需要自动同步，取消下面注释
// document.addEventListener('DOMContentLoaded', () => {
//     OrderSyncManager.start();
// });

// 监听页面可见性变化，在页面重新可见时同步
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && OrderSyncManager.config.isEnabled) {
        OrderSyncManager.log('页面重新可见，执行同步...');
        OrderSyncManager.sync();
    }
});
