const app = getApp();

Page({
  data: {
    store: null,
    categoryId: '',
    services: [],
    selectedItems: [],
    total: 0
  },

  onLoad(query) {
    const { storeId, categoryId } = query;
    this.setData({ categoryId });
    this.loadStore(storeId);
    this.loadServices(categoryId);
  },

  loadStore(storeId) {
    app.request(`/cleaning/stores/${storeId}`)
      .then(res => {
        if (res && res.store) {
          this.setData({ store: res.store });
        }
      });
  },

  loadServices(categoryId) {
    app.request('/services', { categoryId })
      .then(res => {
        const services = (res || {}).services || [];
        this.setData({ services });
      });
  },

  onAddItem(e) {
    const id = e.target.dataset.id;
    const service = this.data.services.find(s => s.id === id);
    if (!service) return;

    let items = [...this.data.selectedItems];
    const existing = items.find(i => i.id === id);
    if (existing) {
      existing.quantity += 1;
    } else {
      items.push({ ...service, quantity: 1 });
    }
    this.setData({ selectedItems: items });
    this.calculateTotal();
  },

  onMinusItem(e) {
    const id = e.target.dataset.id;
    let items = [...this.data.selectedItems];
    const existing = items.find(i => i.id === id);
    if (existing) {
      existing.quantity -= 1;
      if (existing.quantity <= 0) {
        items = items.filter(i => i.id !== id);
      }
    }
    this.setData({ selectedItems: items });
    this.calculateTotal();
  },

  calculateTotal() {
    const total = this.data.selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    this.setData({ total });
  },

  getItemQuantity(id) {
    const item = this.data.selectedItems.find(i => i.id === id);
    return item ? item.quantity : 0;
  },

  onSubmitTap() {
    if (this.data.selectedItems.length === 0) {
      my.showToast({ content: '请选择服务项目', type: 'none' });
      return;
    }
    const orderData = {
      userId: (app.globalData.userInfo || {}).userId,
      storeId: this.data.store.id,
      categoryId: this.data.categoryId,
      items: this.data.selectedItems,
      total: this.data.total
    };
    app.globalData.currentOrder = orderData;
    my.navigateTo({ url: '/pages/order/delivery/index' });
  }
});
