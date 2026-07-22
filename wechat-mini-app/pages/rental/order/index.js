const app = getApp();
const API_BASE = app.globalData?.apiBase || '';

Page({
  data: {
    itemId: '', storeId: '', rentalDays: 1, depositMode: 'deposit',
    itemName: '', itemImage: '', itemSpec: '', dailyRate: '0.00',
    depositAmount: '0.00', rentalCost: '0.00', totalPrice: '0.00',
    contactName: '', contactPhone: '', address: '',
    paymentMethod: 'wechat'
  },

  onLoad(options) {
    this.setData({
      itemId: options.itemId || '',
      storeId: options.storeId || '',
      rentalDays: parseInt(options.days) || 1,
      depositMode: options.depositMode || 'deposit'
    });
    this.loadItem();
    this.loadAddress();
  },

  async loadItem() {
    try {
      const res = await wx.request({ url: `${API_BASE}/api/rental/items/${this.data.itemId}` });
      if (res.data.success) {
        const item = res.data.item;
        const rental = (item.dailyRate || 0) * this.data.rentalDays;
        const deposit = this.data.depositMode === 'credit_free' ? 0 : (item.depositAmount || 0);
        this.setData({
          itemName: item.name,
          itemImage: item.images?.[0] || '',
          itemSpec: [item.brand, item.size, item.color].filter(Boolean).join(' / '),
          dailyRate: (item.dailyRate || 0).toFixed(2),
          depositAmount: deposit.toFixed(2),
          rentalCost: rental.toFixed(2),
          totalPrice: (rental + deposit).toFixed(2)
        });
      }
    } catch(e) { console.error(e); }
  },

  loadAddress() {
    try {
      const addr = wx.getStorageSync('rental_address');
      if (addr) {
        this.setData({ contactName: addr.name, contactPhone: addr.phone, address: addr.address });
      }
    } catch(e) {}
  },

  editAddress() {
    wx.showModal({
      title: '配送地址',
      editable: true,
      placeholderText: '请输入姓名、手机号、地址（逗号分隔）',
      content: `${this.data.contactName},${this.data.contactPhone},${this.data.address}`,
      success: (res) => {
        if (res.confirm && res.content) {
          const parts = res.content.split(',').map(s => s.trim());
          const addr = { name: parts[0] || '', phone: parts[1] || '', address: parts[2] || '' };
          this.setData({ contactName: addr.name, contactPhone: addr.phone, address: addr.address });
          wx.setStorageSync('rental_address', addr);
        }
      }
    });
  },

  selectPay(e) {
    this.setData({ paymentMethod: e.currentTarget.dataset.method });
  },

  async submitOrder() {
    if (!this.data.contactName || !this.data.address) {
      return wx.showToast({ title: '请填写配送地址', icon: 'none' });
    }

    wx.showLoading({ title: '提交中...' });
    try {
      const userId = app.globalData?.userInfo?.id || 'wx_anonymous';
      const res = await wx.request({
        url: `${API_BASE}/api/rental/orders`,
        method: 'POST',
        data: {
          userId,
          storeId: this.data.storeId,
          items: [{ itemId: this.data.itemId, quantity: 1 }],
          rentalDays: this.data.rentalDays,
          depositMode: this.data.depositMode,
          deliveryMethod: 'courier',
          deliveryAddress: {
            contactName: this.data.contactName,
            contactPhone: this.data.contactPhone,
            address: this.data.address
          }
        }
      });

      wx.hideLoading();
      if (res.data.success) {
        wx.showModal({
          title: '下单成功',
          content: `订单号: ${res.data.order.orderNo}\n合计: ¥${this.data.totalPrice}`,
          showCancel: false,
          success: () => {
            wx.redirectTo({ url: `/pages/rental/order-detail/index?orderNo=${res.data.order.orderNo}` });
          }
        });
      } else {
        wx.showToast({ title: res.data.error || '下单失败', icon: 'none' });
      }
    } catch(e) {
      wx.hideLoading();
      wx.showToast({ title: '网络异常', icon: 'none' });
    }
  }
});
