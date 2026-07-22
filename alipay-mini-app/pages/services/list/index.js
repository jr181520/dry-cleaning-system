const app = getApp();

Page({
  data: {
    categoryId: '',
    services: []
  },

  onLoad(query) {
    if (query.categoryId) {
      this.setData({ categoryId: query.categoryId });
      this.loadServices(query.categoryId);
    } else {
      this.loadServices('');
    }
  },

  onPullDownRefresh() {
    this.loadServices(this.data.categoryId);
  },

  loadServices(categoryId) {
    my.showLoading({ content: '加载中' });
    app.request('/services', { categoryId })
      .then(res => {
        my.hideLoading();
        my.stopPullDownRefresh();
        const services = (res || {}).services || [];
        this.setData({ services });
      })
      .catch(() => {
        my.hideLoading();
        my.stopPullDownRefresh();
      });
  },

  onServiceTap(e) {
    const id = e.target.dataset.id;
    my.navigateTo({ url: `/pages/services/detail/index?id=${id}` });
  },

  onOrderTap(e) {
    const id = e.target.dataset.id;
    my.navigateTo({ url: `/pages/order/create/index?serviceId=${id}` });
  }
});
