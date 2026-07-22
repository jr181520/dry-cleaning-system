const app = getApp();
const categories = require('../../utils/category');

Page({
  data: {
    banners: [
      { id: 1, image: '/images/banner1.png' },
      { id: 2, image: '/images/banner2.png' }
    ],
    categories: [],
    currentCategory: 'cleaning',
    hotServices: [],
    nearbyStores: [],
    pendingPickup: null,
    location: null
  },

  onLoad() {
    this.initCategories();
    this.getLocation();
    this.checkPendingPickup();
  },

  onPullDownRefresh() {
    this.getLocation();
    this.checkPendingPickup();
    this.loadHotServices();
    this.loadNearbyStores();
  },

  initCategories() {
    const cats = categories.getAll();
    this.setData({ categories: cats });
    this.loadHotServices();
  },

  getLocation() {
    my.getLocation({
      type: 1,
      success: (res) => {
        this.setData({ location: res });
        this.loadNearbyStores();
      }
    });
  },

  checkPendingPickup() {
    app.request('/orders/pending-pickup', { userId: app.globalData.userId })
      .then(res => {
        if (res && res.length > 0) {
          this.setData({ pendingPickup: res[0] });
        }
      });
  },

  loadHotServices() {
    app.request('/services/hot', { categoryId: this.data.currentCategory })
      .then(res => {
        this.setData({ hotServices: res || [] });
      });
  },

  loadNearbyStores() {
    if (!this.data.location) return;
    app.request('/cleaning/stores', {
      lat: this.data.location.latitude,
      lng: this.data.location.longitude
    }).then(res => {
      this.setData({ nearbyStores: res || [] });
    });
  },

  onCategoryTap(e) {
    const id = e.target.dataset.id;
    this.setData({ currentCategory: id });
    this.loadHotServices();
  },

  onServiceTap(e) {
    const id = e.target.dataset.id;
    my.navigateTo({ url: `/pages/services/detail/index?id=${id}` });
  },

  onStoreTap(e) {
    const id = e.target.dataset.id;
    my.navigateTo({ url: `/pages/order/create/index?storeId=${id}&categoryId=${this.data.currentCategory}` });
  },

  onSearchTap() {
    my.navigateTo({ url: '/pages/services/list/index' });
  },

  onPickupTap() {
    my.navigateTo({ url: '/pages/pickup/index' });
  }
});
