const app = getApp();

Page({
  data: {
    keyword: '',
    stores: [],
    filteredStores: [],
    location: null
  },

  onLoad() {
    this.getLocation();
  },

  getLocation() {
    my.getLocation({
      type: 1,
      success: (res) => {
        this.setData({ location: res });
        this.loadStores();
      },
      fail: () => {
        this.loadStores();
      }
    });
  },

  loadStores() {
    my.showLoading({ content: '加载中' });
    const params = this.data.location ? {
      lat: this.data.location.latitude,
      lng: this.data.location.longitude
    } : {};
    app.request('/cleaning/stores', params)
      .then(res => {
        my.hideLoading();
        const stores = (res || {}).stores || [];
        this.setData({ stores, filteredStores: stores });
      })
      .catch(() => {
        my.hideLoading();
      });
  },

  onSearchInput(e) {
    const keyword = e.detail.value;
    this.setData({ keyword });
    this.filterStores();
  },

  filterStores() {
    const keyword = this.data.keyword.toLowerCase();
    if (!keyword) {
      this.setData({ filteredStores: this.data.stores });
      return;
    }
    const filtered = this.data.stores.filter(s =>
      s.name.toLowerCase().includes(keyword) ||
      s.address.toLowerCase().includes(keyword)
    );
    this.setData({ filteredStores: filtered });
  },

  onStoreTap(e) {
    const id = e.target.dataset.id;
    const store = this.data.filteredStores.find(s => s.id === id);
    const pages = getCurrentPages();
    const prevPage = pages[pages.length - 2];
    if (prevPage) {
      prevPage.setData({ selectedStore: store });
    }
    my.navigateBack();
  }
});
