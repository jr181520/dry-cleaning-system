const app = getApp();

Page({
  data: {
    order: null,
    paymentMethod: 'alipay',
    orderId: ''
  },

  onLoad(query) {
    if (query.id) {
      this.setData({ orderId: query.id });
      this.loadOrder(query.id);
    } else {
      const order = app.globalData.currentOrder;
      if (order) {
        this.setData({ order });
      }
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

  onMethodTap(e) {
    const method = e.target.dataset.method;
    this.setData({ paymentMethod: method });
  },

  onPayTap() {
    if (!this.data.order) {
      my.showToast({ content: '订单信息不完整', type: 'fail' });
      return;
    }
    my.showLoading({ content: '创建订单' });
    app.request('/orders/create', this.data.order, 'POST')
      .then(res => {
        my.hideLoading();
        if (res && res.success && res.orderId) {
          this.processPayment(res.orderId, res.tradeNo);
        } else {
          my.showToast({ content: (res || {}).error || '创建订单失败', type: 'fail' });
        }
      })
      .catch(() => {
        my.hideLoading();
        my.showToast({ content: '创建订单失败', type: 'fail' });
      });
  },

  processPayment(orderId, tradeNo) {
    if (this.data.paymentMethod === 'alipay' && tradeNo) {
      my.tradePay({
        tradeNO: tradeNo,
        success: (res) => {
          if (res.resultCode === '9000') {
            my.showToast({ content: '支付成功', type: 'success' });
            my.redirectTo({ url: `/pages/order/success/index?id=${orderId}` });
          } else {
            my.showToast({ content: '支付取消', type: 'none' });
          }
        },
        fail: () => {
          my.showToast({ content: '支付失败', type: 'fail' });
        }
      });
    } else {
      my.showToast({ content: '支付成功', type: 'success' });
      my.redirectTo({ url: `/pages/order/success/index?id=${orderId}` });
    }
  }
});
