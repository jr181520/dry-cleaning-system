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
      const result = await app.request('/orders/list', {
        status: this.data.currentTab,
        page: refresh ? 1 : this.data.page,
        pageSize: this.data.pageSize
      });
      
      if (result.success) {
        this.setData({
          orders: refresh ? result.orders : [...this.data.orders, ...result.orders],
          hasMore: result.orders.length >= this.data.pageSize,
          page: refresh ? 1 : this.data.page + 1
        });
      }
    } catch (error) {
      console.error('加载订单失败', error);
      // 使用本地模拟数据
      this.setData({
        orders: this.getMockOrders()
      });
    }
    
    this.setData({ loading: false });
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
