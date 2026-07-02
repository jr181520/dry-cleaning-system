/**
 * 统一数据同步管理器 (DataSyncManager)
 * 
 * 为 C端H5 和 小程序 提供一致的数据同步机制。
 * 后端 (/api/sync/all) 是唯一权威数据源。
 * 
 * 使用方法：
 * ```html
 * <script src="js/data-sync.js"></script>
 * <script>
 *   // 监听数据更新
 *   window.addEventListener('datasync:user', e => updateUI(e.detail));
 *   window.addEventListener('datasync:orders', e => refreshOrders(e.detail));
 * </script>
 * ```
 */

const DataSyncManager = {
  config: {
    // API基础地址
    get apiBaseUrl() {
      const port = window.location.port || '3000';
      return `http://${window.location.hostname}:${port}/api`;
    },
    
    // 同步间隔（毫秒）
    syncInterval: 15000,
    
    // 定时器
    syncTimer: null,
    
    // 是否已启动
    isRunning: false,
    
    // 最后同步时间
    lastSyncTime: null,
    
    // 同步的数据类型
    syncTypes: 'user,orders,member,delivery',
    
    // 日志开关
    verbose: true
  },
  
  /**
   * 日志输出
   */
  log(msg, level) {
    if (!this.config.verbose && level !== 'error') return;
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '🔄';
    console.log(`[DataSync ${new Date().toLocaleTimeString()}] ${prefix} ${msg}`);
  },
  
  /**
   * 获取认证 Token（按优先级尝试所有可能的存储键）
   */
  getAuthToken() {
    return localStorage.getItem('userToken')
      || localStorage.getItem('authToken')
      || localStorage.getItem('storeToken')
      || localStorage.getItem('adminToken')
      || '';
  },
  
  /**
   * 获取用户ID（尝试所有可能的存储键）
   */
  getUserId() {
    try {
      const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      return userInfo._id || userInfo.id || userInfo.openid || '';
    } catch (e) { return ''; }
  },
  
  /**
   * 启动同步
   */
  start(types) {
    if (this.config.isRunning) {
      this.log('同步已在运行中', 'warn');
      return;
    }
    
    if (types) this.config.syncTypes = types;
    
    this.log(`启动数据同步 (间隔${this.config.syncInterval / 1000}s, 类型:${this.config.syncTypes})`);
    this.config.isRunning = true;
    
    // 立即执行一次
    this.syncAll();
    
    // 定时同步
    this.config.syncTimer = setInterval(() => this.syncAll(), this.config.syncInterval);
  },
  
  /**
   * 停止同步
   */
  stop() {
    if (this.config.syncTimer) {
      clearInterval(this.config.syncTimer);
      this.config.syncTimer = null;
    }
    this.config.isRunning = false;
    this.log('同步已停止');
  },
  
  /**
   * 执行全量同步
   */
  async syncAll() {
    const token = this.getAuthToken();
    if (!token) {
      this.log('无认证令牌，跳过同步', 'warn');
      return;
    }
    
    try {
      const url = `${this.config.apiBaseUrl}/sync/all?types=${this.config.syncTypes}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(8000)
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          this.log('认证过期，停止同步', 'warn');
          this.stop();
        } else {
          this.log(`API请求失败: ${response.status}`, 'warn');
        }
        return;
      }
      
      const result = await response.json();
      
      if (!result.success) {
        this.log(`同步失败: ${result.error}`, 'error');
        return;
      }
      
      const data = result.data;
      let syncedItems = [];
      
      // 1. 同步用户资料
      if (data.user) {
        this._mergeUserProfile(data.user);
        syncedItems.push('用户');
      }
      
      // 2. 同步会员信息
      if (data.member) {
        localStorage.setItem('memberInfo', JSON.stringify(data.member));
        window.dispatchEvent(new CustomEvent('datasync:member', { detail: data.member }));
        syncedItems.push('会员');
      }
      
      // 3. 同步订单数据
      if (data.orders) {
        this._mergeOrders(data.orders);
        syncedItems.push('订单');
      }
      
      // 4. 同步配送信息
      if (data.delivery && (data.delivery.defaultAddress || data.delivery.savedInfo)) {
        const deliveryData = data.delivery.savedInfo || data.delivery.defaultAddress;
        if (deliveryData) {
          localStorage.setItem('userDeliveryInfo', JSON.stringify(deliveryData));
          window.dispatchEvent(new CustomEvent('datasync:delivery', { detail: deliveryData }));
          syncedItems.push('配送');
        }
      }
      
      this.config.lastSyncTime = new Date().toISOString();
      
      if (syncedItems.length > 0) {
        this.log(`同步完成: ${syncedItems.join('、')}`);
      }
    } catch (error) {
      // 静默失败（网络问题正常）
      if (error.name !== 'AbortError' && error.name !== 'TimeoutError') {
        this.log(`同步异常: ${error.message}`, 'error');
      }
    }
  },
  
  /**
   * 合并用户资料到本地存储
   */
  _mergeUserProfile(serverUser) {
    const storedInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    
    const merged = {
      ...storedInfo,
      name: serverUser.name || storedInfo.name || '',
      avatar: serverUser.avatar || storedInfo.avatar || '',
      phone: serverUser.phone || storedInfo.phone || '',
      gender: serverUser.gender !== undefined ? serverUser.gender : storedInfo.gender,
      birthday: serverUser.birthday || storedInfo.birthday || '',
      _id: serverUser._id || storedInfo._id || '',
      openid: serverUser.openid || storedInfo.openid || '',
      creditScore: serverUser.creditScore !== undefined ? serverUser.creditScore : storedInfo.creditScore,
      userNo: serverUser.userNo || storedInfo.userNo || ''
    };
    
    localStorage.setItem('userInfo', JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent('datasync:user', { detail: merged }));
  },
  
  /**
   * 合并订单到本地存储（智能 diff，后端数据为权威）
   */
  _mergeOrders(serverOrders) {
    if (!Array.isArray(serverOrders)) return;
    
    // 确定存储键
    let storageKey = 'orders';
    if (window.location.pathname.includes('m-index')) {
      storageKey = 'store_orders';
    } else if (window.location.pathname.includes('admin')) {
      storageKey = 'all_orders';
    }
    
    const localOrders = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    // 用 Map 去重合并（以后端数据为准）
    const orderMap = new Map();
    
    // 先放后端数据（权威）
    serverOrders.forEach(order => {
      const id = order.orderNo || order._id;
      if (id) orderMap.set(id, this._formatOrder(order));
    });
    
    // 再放本地独有的（后端没有的，可能是刚创建的或纯本地mock的）
    localOrders.forEach(order => {
      const id = order.orderId || order.orderNo || order._id;
      if (id && !orderMap.has(id)) {
        orderMap.set(id, order);
      }
    });
    
    const merged = Array.from(orderMap.values());
    localStorage.setItem(storageKey, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent('datasync:orders', { detail: merged }));
  },
  
  /**
   * 格式化订单为前端统一格式
   */
  _formatOrder(serverOrder) {
    let orderTotal = 0;
    if (serverOrder.amounts?.total) orderTotal = serverOrder.amounts.total;
    else if (serverOrder.fees?.total) orderTotal = serverOrder.fees.total;
    else if (serverOrder.totalPrice) orderTotal = serverOrder.totalPrice;
    else if (serverOrder.total) orderTotal = serverOrder.total;
    else if (serverOrder.amount) orderTotal = serverOrder.amount;
    
    return {
      orderId: serverOrder.orderNo || serverOrder._id,
      orderNo: serverOrder.orderNo || serverOrder._id,
      _id: serverOrder._id,
      status: serverOrder.status || 'pending',
      paymentStatus: serverOrder.paymentStatus || 'pending',
      items: serverOrder.items || [],
      total: orderTotal,
      totalPrice: orderTotal,
      amount: orderTotal,
      storeId: serverOrder.storeId || '',
      storeName: serverOrder.storeName || '',
      storeAddress: serverOrder.storeAddress || '',
      customerName: serverOrder.customerName || serverOrder.contact?.name || '',
      customerPhone: serverOrder.customerPhone || serverOrder.contact?.phone || '',
      createTime: new Date(serverOrder.createdAt).toLocaleString('zh-CN'),
      createdAt: serverOrder.createdAt,
      updatedAt: serverOrder.updatedAt,
      source: 'server_api'
    };
  },
  
  /**
   * 手动触发一次同步
   */
  manualSync() {
    return this.syncAll();
  },
  
  /**
   * 获取同步状态
   */
  getStatus() {
    return {
      isRunning: this.config.isRunning,
      lastSync: this.config.lastSyncTime || '未同步',
      interval: this.config.syncInterval,
      types: this.config.syncTypes
    };
  }
};

// ========== 自动启动逻辑 ==========

// 页面加载后自动启动同步
document.addEventListener('DOMContentLoaded', () => {
  DataSyncManager.log('自动启动统一数据同步');
  DataSyncManager.start();
});

// 页面从 bfcache 恢复时重新同步
window.addEventListener('pageshow', (e) => {
  if (e.persisted) {
    DataSyncManager.log('bfcache恢复，重新同步');
    DataSyncManager.manualSync();
  }
});

// 切换回标签页时同步
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    DataSyncManager.log('切回标签页，执行同步');
    DataSyncManager.manualSync();
  }
});

// 监听 storage 事件（其他标签页修改了 localStorage）
window.addEventListener('storage', (e) => {
  // 如果其他标签修改了用户信息或订单，触发同步
  if (e.key === 'userInfo' || e.key === 'orders' || e.key === 'store_orders') {
    DataSyncManager.log(`检测到 ${e.key} 跨标签变更，触发同步`);
    DataSyncManager.manualSync();
  }
});

// ========== 兼容旧版 OrderSyncManager ==========
// 保留旧接口，但转发到 DataSyncManager
window.OrderSyncManager = {
  start: () => DataSyncManager.start('orders'),
  stop: () => DataSyncManager.stop(),
  manualSync: () => DataSyncManager.manualSync(),
  getStatus: () => DataSyncManager.getStatus(),
  log: (msg, level) => DataSyncManager.log(msg, level)
};
