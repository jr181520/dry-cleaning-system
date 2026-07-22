const app = getApp();

Page({
  data: {
    deliveryMethod: 'pickup',
    address: {
      name: '',
      phone: '',
      detail: ''
    }
  },

  onLoad() {
    var _addr = my.getStorageSync({ key: 'defaultAddress' }) || {};
    const savedAddress = _addr.data;
    if (savedAddress) {
      this.setData({ address: savedAddress });
    }
  },

  onMethodTap(e) {
    const method = e.target.dataset.method;
    this.setData({ deliveryMethod: method });
  },

  onNameInput(e) {
    this.setData({ 'address.name': e.detail.value });
  },

  onPhoneInput(e) {
    this.setData({ 'address.phone': e.detail.value });
  },

  onDetailInput(e) {
    this.setData({ 'address.detail': e.detail.value });
  },

  onSubmitTap() {
    const order = app.globalData.currentOrder;
    if (!order) {
      my.showToast({ content: '订单信息缺失', type: 'fail' });
      return;
    }
    if (this.data.deliveryMethod === 'courier') {
      if (!this.data.address.name || !this.data.address.phone || !this.data.address.detail) {
        my.showToast({ content: '请填写完整地址', type: 'none' });
        return;
      }
      my.setStorageSync({ key: 'defaultAddress', data: this.data.address });
    }
    order.deliveryMethod = this.data.deliveryMethod;
    order.address = this.data.deliveryMethod === 'courier' ? this.data.address : null;
    app.globalData.currentOrder = order;
    my.navigateTo({ url: '/pages/order/payment/index' });
  }
});
