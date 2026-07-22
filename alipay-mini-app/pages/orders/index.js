const app = getApp();

Page({
  data: {
    tabs: [
      { key: '', name: '全部' },
      { key: 'pending', name: '待付款' },
      { key: 'processing', name: '进行中' },
      { key: 'completed', name: '已完成' }
    ],
    currentTab: '',
    orders: [],
    page: 1,
    hasMore: true
  },

  onLoad() {
    this.loadOrders();
  },

  onPullDownRefresh() {
    this.setData({ page: 1, orders: [], hasMore: true });
    this.loadOrders();
  },

  onReachBottom() {
    if (this.data.hasMore) {
      this.loadOrders();
    }
  },

  loadOrders() {
    my.showLoading({ content: '加载中' });
    const userId = (app.globalData.userInfo || {}).userId || '';
    const status = this.data.currentTab;
    app.request(`/orders?userId=${userId}&status=${status}&page=${this.data.page}&limit=10`)
      .then(res => {
        const list = (res || {}).orders || [];
        this.setData({
          orders: this.data.page === 1 ? list : [...this.data.orders, ...list],
          page: this.data.page + 1,
          hasMore: list.length >= 10
        });
        my.hideLoading();
        my.stopPullDownRefresh();
      })
      .catch(() => {
        my.hideLoading();
        my.stopPullDownRefresh();
      });
  },

  onTabTap(e) {
    const key = e.target.dataset.key;
    this.setData({ currentTab: key, page: 1, orders: [], hasMore: true });
    this.loadOrders();
  },

  onOrderTap(e) {
    const id = e.target.dataset.id;
    my.navigateTo({ url: `/pages/order/detail/index?id=${id}` });
  },

  onPayTap(e) {
    const id = e.target.dataset.id;
    my.navigateTo({ url: `/pages/order/payment/index?id=${id}` });
  },

  onCancelTap(e) {
    const id = e.target.dataset.id;
    my.confirm({
      title: '确认取消',
      content: '确定要取消该订单吗？',
      success: (res) => {
        if (res.confirm) {
          app.request(`/orders/${id}/cancel`, {}, 'POST').then(() => {
            my.showToast({ content: '已取消', type: 'success' });
            this.setData({ page: 1, orders: [], hasMore: true });
            this.loadOrders();
          });
        }
      }
    });
  }
});
