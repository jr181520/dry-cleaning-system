const app = getApp();

Page({
  data: {
    pickupCode: '',
    recentPickups: []
  },

  onLoad() {
    this.loadRecentPickups();
    if (app.globalData.pendingPickupCode) {
      this.setData({ pickupCode: app.globalData.pendingPickupCode });
      app.globalData.pendingPickupCode = null;
    }
  },

  loadRecentPickups() {
    const userId = (app.globalData.userInfo || {}).userId || '';
    app.request(`/orders/recent-pickups?userId=${userId}`)
      .then(res => {
        this.setData({ recentPickups: (res || {}).orders || [] });
      });
  },

  onScanTap() {
    my.scan({
      type: 'qr',
      success: (res) => {
        if (res.code) {
          this.setData({ pickupCode: res.code });
          this.verifyPickup();
        }
      }
    });
  },

  onCodeInput(e) {
    this.setData({ pickupCode: e.detail.value });
  },

  onVerifyTap() {
    if (!this.data.pickupCode) {
      my.showToast({ content: '请输入取件码', type: 'none' });
      return;
    }
    this.verifyPickup();
  },

  verifyPickup() {
    my.showLoading({ content: '验证中' });
    app.request('/orders/verify-pickup', {
      code: this.data.pickupCode,
      userId: (app.globalData.userInfo || {}).userId
    }, 'POST').then(res => {
      my.hideLoading();
      if (res && res.success) {
        my.showToast({ content: '取件成功', type: 'success' });
        this.setData({ pickupCode: '' });
        this.loadRecentPickups();
      } else {
        my.showToast({ content: (res || {}).error || '取件码无效', type: 'fail' });
      }
    }).catch(() => {
      my.hideLoading();
      my.showToast({ content: '验证失败', type: 'fail' });
    });
  }
});
