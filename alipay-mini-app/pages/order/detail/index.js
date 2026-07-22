const app = getApp();

Page({
  data: {
    order: null,
    orderId: ''
  },

  onLoad(query) {
    if (query.id) {
      this.setData({ orderId: query.id });
      this.loadOrder(query.id);
    }
  },

  loadOrder(id) {
    my.showLoading({ content: '加载中' });
    app.request(`/orders/${id}`)
      .then(res => {
        my.hideLoading();
        if (res && res.order) {
          this.setData({ order: res.order });
        }
      })
      .catch(() => {
        my.hideLoading();
      });
  },

  onPayTap() {
    my.navigateTo({ url: `/pages/order/payment/index?id=${this.data.orderId}` });
  },

  onCancelTap() {
    my.confirm({
      title: '确认取消',
      content: '确定要取消该订单吗？',
      success: (res) => {
        if (res.confirm) {
          app.request(`/orders/${this.data.orderId}/cancel`, {}, 'POST')
            .then(() => {
              my.showToast({ content: '已取消', type: 'success' });
              this.loadOrder(this.data.orderId);
            });
        }
      }
    });
  },

  onTrackingTap() {
    my.navigateTo({ url: `/pages/delivery/tracking/index?id=${this.data.orderId}` });
  }
});
