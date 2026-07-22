const app = getApp();

Page({
  data: {
    orderId: '',
    delivery: null,
    courier: null,
    steps: []
  },

  onLoad(query) {
    if (query.id) {
      this.setData({ orderId: query.id });
      this.loadDelivery(query.id);
    }
  },

  loadDelivery(orderId) {
    my.showLoading({ content: '加载中' });
    app.request(`/delivery/tracking/${orderId}`)
      .then(res => {
        my.hideLoading();
        if (res && res.delivery) {
          this.setData({
            delivery: res.delivery,
            courier: res.courier,
            steps: res.steps || []
          });
        }
      })
      .catch(() => {
        my.hideLoading();
      });
  },

  onCallCourierTap() {
    if (this.data.courier && this.data.courier.phone) {
      my.makePhoneCall({ number: this.data.courier.phone });
    }
  }
});
