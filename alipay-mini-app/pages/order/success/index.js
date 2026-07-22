const app = getApp();

Page({
  data: {
    orderId: '',
    orderNo: ''
  },

  onLoad(query) {
    if (query.id) {
      this.setData({ orderId: query.id });
      this.loadOrder(query.id);
    }
  },

  loadOrder(id) {
    app.request(`/orders/${id}`)
      .then(res => {
        if (res && res.order) {
          this.setData({ orderNo: res.order.orderNo });
        }
      });
  },

  onViewOrderTap() {
    my.redirectTo({ url: `/pages/order/detail/index?id=${this.data.orderId}` });
  },

  onHomeTap() {
    my.switchTab({ url: '/pages/index/index' });
  }
});
