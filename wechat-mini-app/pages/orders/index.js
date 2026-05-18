const app = getApp();

Page({
  data: {
    currentTab: 'all',
    orders: [],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 10
  },

  onLoad(options) {
    // 如果有type参数，设置当前Tab
    if (options.type) {
      this.setData({
        currentTab: options.type
      });
    }
    
    // 如果有id参数，查看指定订单
    if (options.id) {
      this.onViewOrder({ currentTarget: { dataset: { id: options.id } } });
      return;
    }
    
    this.loadOrders();
  },

  onShow() {
    // 每次显示页面时刷新数据
    if (this.data.orders.length > 0) {
      this.loadOrders(true);
    }
  },

  onPullDownRefresh() {
    this.loadOrders(true);
    wx.stopPullDownRefresh();
  },

  // 切换Tab
  onSwitchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      currentTab: tab,
      orders: [],
      page: 1,
      hasMore: true
    });
    this.loadOrders();
  },

  // 加载订单
  async loadOrders(refresh = false) {
    if (this.data.loading) return;
    
    this.setData({ loading: true });
    
    try {
      // 获取用户信息（优先使用openid或userId）
      const userInfo = app.globalData.userInfo;
      const userId = userInfo?.openid || userInfo?.id || userInfo?.userId || '';
      
      console.log('[订单列表] 用户ID:', userId, '用户信息:', userInfo);
      
      // 调用后端API获取订单列表，传递userId参数
      const result = await app.request('/cleaning/orders', {
        userId: userId,  // 关键：传递userId以获取该用户的订单
        status: this.data.currentTab === 'all' ? '' : this.data.currentTab,
        page: refresh ? 1 : this.data.page,
        pageSize: this.data.pageSize
      }, 'GET');
      
      if (result.success && result.data) {
        // API返回格式: {success: true, data: {list: [...]}} 或 {success: true, data: [...]}
        // 兼容处理：result.data 可能是数组或 {list: [...]} 对象
        const orderList = Array.isArray(result.data) ? result.data : (result.data.list || []);
        
        // 转换订单数据格式
        const orders = orderList.map(order => ({
          id: order._id || order.orderId || order.id,
          orderId: order._id || order.orderId || order.id,
          orderNo: order.orderNo || order.orderId || order.id,
          storeName: order.storeName || order.store?.name || order.storeId || '干洗店',
          storeId: order.storeId || order.store?.storeId || '',
          status: order.status || 'pending',
          statusText: this.getStatusText(order.status),
          items: order.items || [],
          totalCount: order.items ? order.items.reduce((sum, item) => sum + (item.quantity || 1), 0) : 0,
          totalPrice: order.amounts?.total || order.totalAmount || order.totalPrice || 0,
          createdAt: order.createdAt || order.createTime || new Date().toISOString(),
          pickupCode: order.pickupCode || '',
          deliveryType: order.delivery?.type || order.deliveryType || 'pickup'
        }));
        
        // 只有在有真实订单时才更新，避免覆盖已有数据
        if (orders.length > 0) {
          this.setData({
            orders: refresh ? orders : [...this.data.orders, ...orders],
            hasMore: orders.length >= this.data.pageSize,
            page: refresh ? 1 : this.data.page + 1
          });
          console.log('[订单列表] 从API加载成功:', orders.length, '个订单');
        } else {
          console.log('[订单列表] API返回空订单列表');
          // API返回空列表时，不加载模拟数据
          this.setData({
            orders: refresh ? [] : this.data.orders,
            hasMore: false
          });
        }
      } else {
        console.warn('[订单列表] API返回失败或空数据');
        // API返回失败时，只有在没有现有订单时才加载模拟数据
        if (this.data.orders.length === 0) {
          this.loadMockOrders();
        }
      }
    } catch (error) {
      console.error('[订单列表] 加载失败:', error);
      // 只有在没有现有订单时才加载模拟数据
      if (this.data.orders.length === 0) {
        this.loadMockOrders();
      }
    }
    
    this.setData({ loading: false });
  },
  
  // 获取状态文本
  getStatusText(status) {
    const statusMap = {
      'pending': '待支付',
      'paid': '已支付',
      'delivering': '配送中',
      'received': '已入库',
      'processing': '处理中',
      'ready': '待取件',
      'delivering_back': '配送中',
      'completed': '已完成',
      'cancelled': '已取消'
    };
    return statusMap[status] || status || '未知';
  },
  
  // 加载模拟订单数据（后备方案）
  loadMockOrders() {
    this.setData({
      orders: this.getMockOrders()
    });
  },

  // 获取模拟订单数据
  getMockOrders() {
    return [
      {
        id: '1',
        storeName: '干洗店',
        status: 'ready',
        statusText: '待取件',
        items: [
          { id: '1', name: '西装', quantity: 1 },
          { id: '2', name: '衬衫', quantity: 2 }
        ],
        totalCount: 3,
        totalPrice: 280,
        createdAt: '2025-04-19 10:30'
      },
      {
        id: '2',
        storeName: '干洗店',
        status: 'processing',
        statusText: '处理中',
        items: [
          { id: '3', name: '外套', quantity: 1 }
        ],
        totalCount: 1,
        totalPrice: 150,
        createdAt: '2025-04-18 14:20'
      },
      {
        id: '3',
        storeName: '干洗店',
        status: 'completed',
        statusText: '已完成',
        items: [
          { id: '4', name: '裤子', quantity: 2 },
          { id: '5', name: '领带', quantity: 1 }
        ],
        totalCount: 3,
        totalPrice: 220,
        createdAt: '2025-04-15 09:15'
      }
    ];
  },

  // 查看订单详情
  onViewOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/orders/detail?id=${orderId}`
    });
  },

  // 立即取件
  onPickup(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/pickup/index?orderId=${orderId}`
    });
  },

  // 评价
  onRate(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/orders/rate?id=${orderId}`
    });
  },

  // 查看详情
  onViewDetail(e) {
    this.onViewOrder(e);
  },

  // 加载更多
  onLoadMore() {
    if (!this.data.loading && this.data.hasMore) {
      this.loadOrders();
    }
  },

  // 立即下单
  onCreateOrder() {
    app.showToast('下单功能开发中', 'none');
  }
});
