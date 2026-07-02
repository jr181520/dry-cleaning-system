/**
 * 门店自提完整流程
 * 
 * 流程说明：
 * 1. 用户选择"门店自提"下单 → 订单状态: awaiting_store_confirm
 * 2. 用户到店扫描店铺二维码 → C端展示"取件"按钮
 * 3. 用户点击"到店取件" → 触发灯条请求 → M端灯条亮起
 * 4. 店员根据灯条拣货、打包
 * 5. 店员操作"扫码出库/手动出库" → 每个物品出库对应灯条熄灭
 * 6. 所有物品出库完成 → 订单自动变为 ready → C端收到通知
 * 7. 用户确认取件 → 订单变为 completed
 */

// 门店自提相关配置
const STORE_PICKUP_CONFIG = {
    // 订单状态
    STATUS: {
        // 初始状态（支付后）
        PENDING: 'awaiting_store_confirm',      // 待门店确认
        // 物品备好
        READY: 'ready',                         // 物品已备好
        // 最终状态
        COMPLETED: 'completed'                  // 已完成
    },
    
    // 物品状态
    ITEM_STATUS: {
        PENDING: 'pending',      // 待处理
        PICKED: 'picked',        // 已拣货
        CHECKED_OUT: 'checked_out' // 已出库
    },
    
    // 灯条状态
    LIGHT_STATUS: {
        OFF: 'off',              // 熄灭
        ON: 'on',                // 亮起
        PULSE: 'pulse'           // 闪烁
    },
    
    // localStorage 键名
    STORAGE_KEYS: {
        LIGHT_REQUEST: 'store_light_request',           // 灯条请求
        PENDING_PICKUP_ORDERS: 'pending_pickup_orders', // 待取件订单
        LIGHT_BINDINGS: 'light_bindings',               // 灯条绑定关系
        STORE_PICKUP_CONFIG: 'store_pickup_config'      // 配置信息
    }
};

/**
 * 门店自提状态管理器
 */
const StorePickupManager = {
    
    /**
     * 获取当前用户的待取件订单
     */
    getPendingPickupOrders() {
        const orders = JSON.parse(localStorage.getItem('orders') || '[]');
        return orders.filter(order => 
            order.deliveryMethod === 'pickup' && 
            ['awaiting_store_confirm', 'ready'].includes(order.status)
        );
    },
    
    /**
     * 获取指定门店的待取件订单（M端用）
     */
    getStorePendingOrders(storeId) {
        const storeOrders = JSON.parse(localStorage.getItem('store_orders') || '[]');
        const allOrders = JSON.parse(localStorage.getItem('orders') || '[]');
        // 合并所有订单来源并去重
        const allOrdersMap = {};
        [...storeOrders, ...allOrders].forEach(function(o) {
            const key = o.orderId || o.id;
            if (key && !allOrdersMap[key]) {
                allOrdersMap[key] = o;
            }
        });
        const mergedOrders = Object.values(allOrdersMap);
        return mergedOrders.filter(order => 
            order.deliveryMethod === 'pickup' &&
            ['awaiting_store_confirm', 'ready'].includes(order.status) &&
            // 按当前门店过滤: 只展示本门店订单
            (order.storeId === storeId || !order.storeId)
        ).map(order => ({
            ...order,
            // 添加物品未出库数量
            pendingItemsCount: (order.items || []).filter(item => 
                item.itemStatus !== 'checked_out'
            ).length,
            // 添加已出库数量
            checkedOutItemsCount: (order.items || []).filter(item => 
                item.itemStatus === 'checked_out'
            ).length
        }));
    },
    
    /**
     * 用户触发到店取件请求（发送灯条请求）
     */
    requestStorePickup(orderId, storeId) {
        const lightRequest = {
            type: 'customer_arrival',
            orderId: orderId,
            storeId: storeId,
            timestamp: Date.now(),
            customerId: localStorage.getItem('userId'),
            status: 'pending'
        };
        
        localStorage.setItem(
            STORE_PICKUP_CONFIG.STORAGE_KEYS.LIGHT_REQUEST,
            JSON.stringify(lightRequest)
        );
        
        // 同时保存到待取件订单列表
        const pendingOrders = JSON.parse(
            localStorage.getItem(STORE_PICKUP_CONFIG.STORAGE_KEYS.PENDING_PICKUP_ORDERS) || '[]'
        );
        
        if (!pendingOrders.includes(orderId)) {
            pendingOrders.push(orderId);
            localStorage.setItem(
                STORE_PICKUP_CONFIG.STORAGE_KEYS.PENDING_PICKUP_ORDERS,
                JSON.stringify(pendingOrders)
            );
        }
        
        // 触发自定义事件通知M端
        window.dispatchEvent(new CustomEvent('storePickupRequested', {
            detail: lightRequest
        }));
        
        return lightRequest;
    },
    
    /**
     * 用户请求点亮单个物品的灯条
     */
    requestLightForItem(orderId, itemIndex) {
        // 获取订单信息
        const orders = JSON.parse(localStorage.getItem('orders') || '[]');
        const order = orders.find(o => o.orderId === orderId);
        
        if (!order) {
            return { success: false, message: '订单不存在' };
        }
        
        // 获取物品信息
        const item = order.items?.[itemIndex];
        if (!item) {
            return { success: false, message: '物品不存在' };
        }
        
        // 检查物品是否已出库
        if (item.itemStatus === 'checked_out') {
            return { success: false, message: '该物品已出库，无需点亮灯条' };
        }
        
        // 创建灯条请求
        const lightRequest = {
            type: 'single_item_light',
            orderId: orderId,
            itemIndex: itemIndex,
            itemName: item.name,
            storeId: order.storeId,
            timestamp: Date.now(),
            customerId: localStorage.getItem('userId'),
            status: 'pending'
        };
        
        // 保存灯条请求
        localStorage.setItem(
            `light_request_${orderId}_${itemIndex}`,
            JSON.stringify(lightRequest)
        );
        
        // 同时保存到待取件订单列表
        const pendingOrders = JSON.parse(
            localStorage.getItem(STORE_PICKUP_CONFIG.STORAGE_KEYS.PENDING_PICKUP_ORDERS) || '[]'
        );
        
        if (!pendingOrders.includes(orderId)) {
            pendingOrders.push(orderId);
            localStorage.setItem(
                STORE_PICKUP_CONFIG.STORAGE_KEYS.PENDING_PICKUP_ORDERS,
                JSON.stringify(pendingOrders)
            );
        }
        
        // 触发自定义事件通知M端
        window.dispatchEvent(new CustomEvent('storePickupRequested', {
            detail: lightRequest
        }));
        
        return {
            success: true,
            message: `已请求点亮"${item.name}"的灯条`,
            itemName: item.name,
            lightRequest: lightRequest
        };
    },
    
    /**
     * 获取指定物品的灯条请求状态
     */
    getItemLightStatus(orderId, itemIndex) {
        const lightRequest = localStorage.getItem(`light_request_${orderId}_${itemIndex}`);
        if (!lightRequest) {
            return { active: false };
        }
        
        try {
            const request = JSON.parse(lightRequest);
            const isExpired = (Date.now() - request.timestamp) > 60000;
            
            return {
                active: !isExpired && request.status !== 'completed',
                request: request,
                expired: isExpired
            };
        } catch (e) {
            return { active: false };
        }
    },
    
    /**
     * 更新物品灯条状态（C端本地状态）
     */
    updateItemLightStatus(orderId, itemIndex, status) {
        const orders = JSON.parse(localStorage.getItem('orders') || '[]');
        const orderIndex = orders.findIndex(o => o.orderId === orderId);
        
        if (orderIndex === -1) {
            return false;
        }
        
        if (!orders[orderIndex].items) {
            orders[orderIndex].items = [];
        }
        
        if (!orders[orderIndex].items[itemIndex]) {
            return false;
        }
        
        orders[orderIndex].items[itemIndex].lightStatus = status;
        localStorage.setItem('orders', JSON.stringify(orders));
        
        return true;
    },
    
    /**
     * M端处理灯条请求
     */
    handleLightRequest(request) {
        if (!request || (Date.now() - request.timestamp) > 60000) {
            return { success: false, message: '请求已过期' };
        }
        
        // 获取订单信息
        const storeOrders = JSON.parse(localStorage.getItem('store_orders') || '[]');
        const order = storeOrders.find(o => o.orderId === request.orderId);
        
        if (!order) {
            return { success: false, message: '订单不存在' };
        }
        
        // 更新订单状态为 ready（物品已备好）
        order.status = 'ready';
        order.readyAt = new Date().toISOString();
        
        // 为每个物品设置灯条绑定
        const lightBindings = [];
        (order.items || []).forEach((item, index) => {
            if (item.itemStatus !== 'checked_out') {
                lightBindings.push({
                    orderId: order.orderId,
                    itemIndex: index,
                    itemName: item.name,
                    lightId: `LIGHT_${order.orderId}_${index}`,
                    status: STORE_PICKUP_CONFIG.LIGHT_STATUS.ON
                });
            }
        });
        
        // 保存灯条绑定关系
        localStorage.setItem(
            STORE_PICKUP_CONFIG.STORAGE_KEYS.LIGHT_BINDINGS,
            JSON.stringify(lightBindings)
        );
        
        // 更新订单到本地存储
        const orderIndex = storeOrders.findIndex(o => o.orderId === order.orderId);
        if (orderIndex > -1) {
            storeOrders[orderIndex] = order;
            localStorage.setItem('store_orders', JSON.stringify(storeOrders));
        }
        
        // 同步到C端订单
        this.syncOrderToCustomer(order);
        
        return {
            success: true,
            message: '灯条已亮起，请根据指示拣货',
            order: order,
            lightBindings: lightBindings
        };
    },
    
    /**
     * 物品出库
     */
    checkoutItem(orderId, itemIndex) {
        const storeOrders = JSON.parse(localStorage.getItem('store_orders') || '[]');
        const orderIndex = storeOrders.findIndex(o => o.orderId === orderId);
        
        if (orderIndex === -1) {
            return { success: false, message: '订单不存在' };
        }
        
        const order = storeOrders[orderIndex];
        
        // 更新物品状态
        if (order.items && order.items[itemIndex]) {
            order.items[itemIndex].itemStatus = 'checked_out';
            order.items[itemIndex].checkedOutAt = new Date().toISOString();
        }
        
        // 更新灯条绑定 - 熄灭对应灯条
        const lightBindings = JSON.parse(
            localStorage.getItem(STORE_PICKUP_CONFIG.STORAGE_KEYS.LIGHT_BINDINGS) || '[]'
        );
        const bindingIndex = lightBindings.findIndex(
            b => b.orderId === orderId && b.itemIndex === itemIndex
        );
        if (bindingIndex > -1) {
            lightBindings[bindingIndex].status = STORE_PICKUP_CONFIG.LIGHT_STATUS.OFF;
            localStorage.setItem(
                STORE_PICKUP_CONFIG.STORAGE_KEYS.LIGHT_BINDINGS,
                JSON.stringify(lightBindings)
            );
        }
        
        // 检查是否所有物品都已出库
        const allCheckedOut = (order.items || []).every(
            item => item.itemStatus === 'checked_out'
        );
        
        if (allCheckedOut) {
            // 所有物品出库完成，订单变为 ready 状态
            order.status = 'ready';
            order.allCheckedOutAt = new Date().toISOString();
            
            // 触发C端通知
            this.syncOrderToCustomer(order);
            
            // 触发取件完成事件
            window.dispatchEvent(new CustomEvent('allItemsCheckedOut', {
                detail: { orderId: orderId }
            }));
        } else {
            // 部分出库，更新订单
            const checkedOutCount = (order.items || []).filter(
                item => item.itemStatus === 'checked_out'
            ).length;
            
            // 仍然同步状态到C端
            this.syncOrderToCustomer(order);
        }
        
        // 保存更新后的订单
        storeOrders[orderIndex] = order;
        localStorage.setItem('store_orders', JSON.stringify(storeOrders));
        
        // 同步到后端API
        this._syncCheckoutToBackend(orderId, itemIndex, order, allCheckedOut);
        
        return {
            success: true,
            allCheckedOut: allCheckedOut,
            order: order
        };
    },
    
    /**
     * 同步出库状态到后端API
     */
    _syncCheckoutToBackend(orderId, itemIndex, order, allCheckedOut) {
        try {
            const currentStore = JSON.parse(localStorage.getItem('currentStore') || '{}');
            const storeId = currentStore.storeId || order.storeId || 'ST002';
            
            // 1. 关闭灯条绑定
            fetch('http://localhost:3000/api/store/order-light/unbind', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: orderId,
                    storeId: storeId,
                    itemIndex: itemIndex,
                    reason: 'item_checked_out'
                })
            }).catch(err => console.warn('[store-pickup] 关闭灯条绑定失败:', err));
            
            // 2. 更新后端订单物品状态
            const updatedItems = (order.items || []).map(oi => ({
                ...oi,
                status: oi.itemStatus === 'checked_out' ? 'ready' : (oi.status || 'pending')
            }));
            
            fetch(`http://localhost:3000/api/cleaning/orders/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
                body: JSON.stringify({
                    status: allCheckedOut ? 'completed' : 'ready',
                    items: updatedItems,
                    note: allCheckedOut ? '所有物品已出库' : '物品出库中',
                    userId: 'store_staff'
                })
            }).catch(err => console.warn('[store-pickup] 更新订单状态失败:', err));
            
        } catch (err) {
            console.warn('[store-pickup] 后端同步失败:', err.message);
        }
    },
    
    /**
     * 同步订单状态到C端
     */
    syncOrderToCustomer(order) {
        const orders = JSON.parse(localStorage.getItem('orders') || '[]');
        const orderIndex = orders.findIndex(o => o.orderId === order.orderId);
        
        if (orderIndex > -1) {
            orders[orderIndex] = {
                ...orders[orderIndex],
                ...order,
                // 确保C端需要的字段
                status: order.status,
                readyAt: order.readyAt,
                allCheckedOutAt: order.allCheckedOutAt
            };
            localStorage.setItem('orders', JSON.stringify(orders));
            
            // 触发C端状态更新事件
            window.dispatchEvent(new CustomEvent('orderStatusUpdated', {
                detail: { orderId: order.orderId, status: order.status }
            }));
        }
    },
    
    /**
     * 用户确认取件
     */
    confirmPickup(orderId) {
        const orders = JSON.parse(localStorage.getItem('orders') || '[]');
        const orderIndex = orders.findIndex(o => o.orderId === orderId);
        
        if (orderIndex === -1) {
            return { success: false, message: '订单不存在' };
        }
        
        const order = orders[orderIndex];
        
        // 验证订单状态
        if (order.status !== 'ready') {
            return { 
                success: false, 
                message: '订单尚未准备好，请稍后再试' 
            };
        }
        
        // 更新订单状态为已完成
        order.status = 'completed';
        order.pickedUpAt = new Date().toISOString();
        
        // 保存更新
        orders[orderIndex] = order;
        localStorage.setItem('orders', JSON.stringify(orders));
        
        // 同步到M端
        this.syncPickupCompleteToStore(order);
        
        // 触发完成事件
        window.dispatchEvent(new CustomEvent('pickupCompleted', {
            detail: { orderId: orderId }
        }));
        
        return { success: true, order: order };
    },
    
    /**
     * 同步取件完成到门店
     */
    syncPickupCompleteToStore(order) {
        const storeOrders = JSON.parse(localStorage.getItem('store_orders') || '[]');
        const orderIndex = storeOrders.findIndex(o => o.orderId === order.orderId);
        
        if (orderIndex > -1) {
            storeOrders[orderIndex] = {
                ...storeOrders[orderIndex],
                ...order,
                status: 'completed'
            };
            localStorage.setItem('store_orders', JSON.stringify(storeOrders));
        }
    },
    
    /**
     * 获取灯条状态
     */
    getLightBindings(orderId) {
        const lightBindings = JSON.parse(
            localStorage.getItem(STORE_PICKUP_CONFIG.STORAGE_KEYS.LIGHT_BINDINGS) || '[]'
        );
        
        if (orderId) {
            return lightBindings.filter(b => b.orderId === orderId);
        }
        
        return lightBindings;
    },
    
    /**
     * 清除灯条请求
     */
    clearLightRequest() {
        localStorage.removeItem(STORE_PICKUP_CONFIG.STORAGE_KEYS.LIGHT_REQUEST);
    }
};

// 导出到全局
window.StorePickupManager = StorePickupManager;
window.STORE_PICKUP_CONFIG = STORE_PICKUP_CONFIG;
