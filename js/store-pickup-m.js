/**
 * M端门店自提订单处理模块
 * 
 * 功能：
 * 1. 显示待取件订单列表
 * 2. 处理C端灯条请求
 * 3. 扫码出库/手动出库
 * 4. 物品级出库管理
 * 5. 灯条控制
 */

const StorePickupManagerM = {
    // 初始化
    init() {
        // 监听C端灯条请求
        window.addEventListener('storePickupRequested', (e) => {
            this.handleCustomerArrival(e.detail);
        });
        
        // 定期检查灯条请求
        setInterval(() => this.checkPendingLightRequests(), 5000);
    },
    
    // 检查待处理的灯条请求
    checkPendingLightRequests() {
        const requestStr = localStorage.getItem('store_light_request');
        if (!requestStr) return;
        
        try {
            const request = JSON.parse(requestStr);
            const currentStore = JSON.parse(localStorage.getItem('currentStore') || '{}');
            const storeId = currentStore.storeId || 'ST002';
            
            // 检查是否是当前门店的请求，且在30秒内
            if (request.storeId === storeId && (Date.now() - request.timestamp) < 30000) {
                this.handleCustomerArrival(request);
            }
        } catch (e) {
            console.warn('检查灯条请求失败:', e);
        }
    },
    
    // 处理顾客到店请求
    handleCustomerArrival(request) {
        const result = StorePickupManager.handleLightRequest(request);
        
        if (result.success) {
            // 显示通知
            this.showNotification(`📢 新取件请求！订单号: ${request.orderId}`, 'success');
            
            // 刷新待取件订单列表
            if (typeof refreshPickupOrders === 'function') {
                refreshPickupOrders();
            }
            
            // 刷新灯条绑定
            if (typeof refreshLightBindings === 'function') {
                refreshLightBindings();
            }
        }
    },
    
    // 显示通知
    showNotification(message, type = 'info') {
        const colors = {
            success: 'bg-green-500',
            warning: 'bg-yellow-500',
            error: 'bg-red-500',
            info: 'bg-blue-500'
        };
        
        const toast = document.createElement('div');
        toast.className = `fixed top-20 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-all transform translate-x-full`;
        toast.innerHTML = `<i class="fa fa-bell mr-2"></i>${message}`;
        document.body.appendChild(toast);
        
        // 动画显示
        setTimeout(() => {
            toast.classList.remove('translate-x-full');
        }, 100);
        
        // 3秒后移除
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },
    
    // 加载待取件订单
    loadPickupOrders() {
        const currentStore = JSON.parse(localStorage.getItem('currentStore') || '{}');
        const storeId = currentStore.storeId || 'ST002';
        
        const orders = StorePickupManager.getStorePendingOrders(storeId);
        
        const container = document.getElementById('pickup-orders-list');
        if (!container) return;
        
        if (orders.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <i class="fa fa-inbox text-6xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">暂无待取件订单</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = orders.map(order => this.renderPickupOrderCard(order)).join('');
    },
    
    // 渲染待取件订单卡片
    renderPickupOrderCard(order) {
        const pendingItems = (order.items || []).filter(item => item.itemStatus !== 'checked_out');
        const checkedOutItems = (order.items || []).filter(item => item.itemStatus === 'checked_out');
        
        const isReady = order.status === 'ready';
        const hasLightRequest = this.hasActiveLightRequest(order.orderId);
        
        return `
            <div class="bg-white rounded-xl shadow-card border border-gray-200 mb-4 overflow-hidden ${hasLightRequest ? 'border-l-4 border-l-yellow-400' : ''}">
                <!-- 头部 -->
                <div class="p-4 border-b border-gray-100">
                    <div class="flex items-start justify-between mb-3">
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <span class="font-bold text-gray-800">${order.orderId}</span>
                                ${hasLightRequest ? `
                                    <span class="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs animate-pulse">
                                        <i class="fa fa-bell"></i> 新请求
                                    </span>
                                ` : ''}
                            </div>
                            <p class="text-sm text-gray-500">
                                ${order.customerName || order.contact?.name || '客户'}: 
                                ${order.customerPhone || order.contact?.phone || '无'}
                            </p>
                        </div>
                        <div class="text-right">
                            <p class="text-xl font-bold text-red-500">¥${order.fees?.total || order.total || 0}</p>
                            <p class="text-xs text-gray-400">${order.deliveryMethod === 'pickup' ? '门店自提' : '配送'}</p>
                        </div>
                    </div>
                    
                    <!-- 进度 -->
                    <div class="flex items-center gap-2 text-sm">
                        <span class="text-gray-600">
                            物品: ${pendingItems.length}件待出库 / ${checkedOutItems.length}件已出库
                        </span>
                    </div>
                </div>
                
                <!-- 物品列表 -->
                <div class="p-4 space-y-2">
                    ${(order.items || []).map((item, index) => `
                        <div class="flex items-center justify-between p-3 rounded-lg ${item.itemStatus === 'checked_out' ? 'bg-green-50' : 'bg-gray-50'}">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                                    ${item.itemStatus === 'checked_out' ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'}">
                                    ${item.itemStatus === 'checked_out' ? '✓' : index + 1}
                                </div>
                                <div>
                                    <p class="font-medium text-gray-800">${item.name || item.serviceName}</p>
                                    <p class="text-xs text-gray-500">× ${item.quantity || 1}</p>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-2">
                                ${item.itemStatus !== 'checked_out' ? `
                                    <button onclick="StorePickupManagerM.checkoutItem('${order.orderId}', ${index})"
                                        class="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs hover:bg-blue-600 transition">
                                        <i class="fa fa-check"></i> 出库
                                    </button>
                                ` : `
                                    <span class="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs">
                                        <i class="fa fa-check-circle"></i> 已出库
                                    </span>
                                `}
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <!-- 底部操作 -->
                <div class="p-4 bg-gray-50 border-t border-gray-100">
                    <div class="flex items-center gap-2">
                        ${isReady ? `
                            <button onclick="StorePickupManagerM.confirmPickupComplete('${order.orderId}')"
                                class="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition">
                                <i class="fa fa-check-circle mr-1"></i> 完成取件
                            </button>
                        ` : `
                            <button onclick="StorePickupManagerM.activateLights('${order.orderId}')"
                                class="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition">
                                <i class="fa fa-lightbulb-o mr-1"></i> 激活灯条
                            </button>
                        `}
                        
                        <button onclick="StorePickupManagerM.scanCheckout('${order.orderId}')"
                            class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition">
                            <i class="fa fa-qrcode"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    },
    
    // 检查是否有活跃的灯条请求
    hasActiveLightRequest(orderId) {
        const lightBindings = JSON.parse(localStorage.getItem('light_bindings') || '[]');
        return lightBindings.some(b => b.orderId === orderId && b.status === 'on');
    },
    
    // 激活灯条
    activateLights(orderId) {
        const storeOrders = JSON.parse(localStorage.getItem('store_orders') || '[]');
        const orderIndex = storeOrders.findIndex(o => o.orderId === orderId);
        
        if (orderIndex === -1) {
            this.showNotification('订单不存在', 'error');
            return;
        }
        
        const order = storeOrders[orderIndex];
        
        // 更新订单状态
        order.status = 'ready';
        order.readyAt = new Date().toISOString();
        
        // 创建灯条绑定
        const lightBindings = [];
        (order.items || []).forEach((item, index) => {
            if (item.itemStatus !== 'checked_out') {
                lightBindings.push({
                    orderId: order.orderId,
                    itemIndex: index,
                    itemName: item.name || item.serviceName,
                    lightId: `LIGHT_${order.orderId}_${index}`,
                    status: 'on',
                    activatedAt: new Date().toISOString()
                });
            }
        });
        
        // 保存灯条绑定
        localStorage.setItem('light_bindings', JSON.stringify(lightBindings));
        
        // 更新订单
        storeOrders[orderIndex] = order;
        localStorage.setItem('store_orders', JSON.stringify(storeOrders));
        
        // 同步到C端
        StorePickupManager.syncOrderToCustomer(order);
        
        this.showNotification(`已激活 ${lightBindings.length} 个灯条`, 'success');
        
        // 刷新列表
        this.loadPickupOrders();
        
        // 刷新灯条绑定
        if (typeof refreshLightBindings === 'function') {
            refreshLightBindings();
        }
    },
    
    // 物品出库
    checkoutItem(orderId, itemIndex) {
        const result = StorePickupManager.checkoutItem(orderId, itemIndex);
        
        if (result.success) {
            this.showNotification(
                result.allCheckedOut ? '✅ 所有物品已出库，等待用户确认取件' : '✅ 物品已出库',
                'success'
            );
            
            // 刷新列表
            this.loadPickupOrders();
            
            // 刷新灯条绑定
            if (typeof refreshLightBindings === 'function') {
                refreshLightBindings();
            }
        } else {
            this.showNotification(result.message, 'error');
        }
    },
    
    // 扫码出库
    scanCheckout(orderId) {
        // 模拟扫码
        const barcode = prompt('请扫描物品条码（模拟输入）：');
        
        if (!barcode) return;
        
        // 查找对应物品
        const storeOrders = JSON.parse(localStorage.getItem('store_orders') || '[]');
        const order = storeOrders.find(o => o.orderId === orderId);
        
        if (!order) {
            this.showNotification('订单不存在', 'error');
            return;
        }
        
        // 查找未出库的物品（这里简化处理，实际应该根据条码匹配）
        const pendingItemIndex = order.items.findIndex(
            item => item.itemStatus !== 'checked_out'
        );
        
        if (pendingItemIndex > -1) {
            this.checkoutItem(orderId, pendingItemIndex);
        } else {
            this.showNotification('所有物品已出库', 'warning');
        }
    },
    
    // 确认取件完成
    confirmPickupComplete(orderId) {
        if (!confirm('确认用户已完成取件？')) return;
        
        const storeOrders = JSON.parse(localStorage.getItem('store_orders') || '[]');
        const orderIndex = storeOrders.findIndex(o => o.orderId === orderId);
        
        if (orderIndex === -1) {
            this.showNotification('订单不存在', 'error');
            return;
        }
        
        const order = storeOrders[orderIndex];
        
        // 验证是否所有物品都已出库
        const pendingItems = (order.items || []).filter(
            item => item.itemStatus !== 'checked_out'
        );
        
        if (pendingItems.length > 0) {
            this.showNotification(`还有 ${pendingItems.length} 件物品未出库`, 'warning');
            return;
        }
        
        // 更新订单状态
        order.status = 'completed';
        order.pickedUpAt = new Date().toISOString();
        
        // 保存订单
        storeOrders[orderIndex] = order;
        localStorage.setItem('store_orders', JSON.stringify(storeOrders));
        
        // 同步到C端
        StorePickupManager.syncPickupCompleteToStore(order);
        
        this.showNotification('取件已完成！', 'success');
        
        // 清除灯条绑定
        const lightBindings = JSON.parse(localStorage.getItem('light_bindings') || '[]');
        const filtered = lightBindings.filter(b => b.orderId !== orderId);
        localStorage.setItem('light_bindings', JSON.stringify(filtered));
        
        // 刷新列表
        this.loadPickupOrders();
        
        // 刷新灯条绑定
        if (typeof refreshLightBindings === 'function') {
            refreshLightBindings();
        }
    },
    
    // 一键出库所有物品
    checkoutAllItems(orderId) {
        if (!confirm('确认出库所有物品？')) return;
        
        const storeOrders = JSON.parse(localStorage.getItem('store_orders') || '[]');
        const order = storeOrders.find(o => o.orderId === orderId);
        
        if (!order) {
            this.showNotification('订单不存在', 'error');
            return;
        }
        
        const pendingItems = (order.items || []).filter(
            item => item.itemStatus !== 'checked_out'
        );
        
        // 逐个出库
        pendingItems.forEach((item, index) => {
            const itemIndex = order.items.indexOf(item);
            StorePickupManager.checkoutItem(orderId, itemIndex);
        });
        
        this.showNotification('所有物品已出库', 'success');
        
        // 刷新列表
        this.loadPickupOrders();
    }
};

// 页面初始化时自动启动
document.addEventListener('DOMContentLoaded', () => {
    StorePickupManagerM.init();
});

// 全局函数：刷新待取件订单
function refreshPickupOrders() {
    if (typeof StorePickupManagerM !== 'undefined') {
        StorePickupManagerM.loadPickupOrders();
    }
}

// 全局函数：刷新灯条绑定
function refreshLightBindings() {
    // 如果有灯条系统页面，可以调用刷新函数
    const lightBindings = JSON.parse(localStorage.getItem('light_bindings') || '[]');
    console.log('当前灯条绑定:', lightBindings);
}
