const app = getApp();

Page({
  data: {
    serviceId: '',
    service: null
  },

  onLoad(query) {
    if (query.id) {
      this.setData({ serviceId: query.id });
      this.loadService(query.id);
    }
  },

  loadService(id) {
    my.showLoading({ content: '加载中' });
    app.request(`/services/${id}`)
      .then(res => {
        my.hideLoading();
        if (res && res.service) {
          this.setData({ service: res.service });
        }
      })
      .catch(() => {
        my.hideLoading();
      });
  },

  onOrderTap() {
    my.navigateTo({ url: `/pages/order/create/index?serviceId=${this.data.serviceId}` });
  }
});
