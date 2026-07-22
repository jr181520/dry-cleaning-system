const app = getApp();
const zhima = require('../../../utils/zhima');

Page({
  data: {
    item: null,
    loading: true,
    rentalDays: 7,
    depositMode: 'deposit',
    deliveryMethod: 'courier',
    address: null,
    rentalFee: 0,
    depositFee: 0,
    deliveryFee: 0,
    totalPrice: 0,
    zhimaScore: 0,
    zhimaEligible: false,
    showHuabei: false,
    submitting: false
  },

  onLoad(query) {
    this.itemId = query.itemId;
    this.storeId = query.storeId || app.globalData.storeId;
    this.setData({
      rentalDays: parseInt(query.days) || 7,
      depositMode: query.depositMode || 'deposit'
    });
    this.loadItem();
    this.loadAddress();
  },

  async loadItem() {
    try {
      const res = await app.request(`/rental/items/${this.itemId}`);
      const item = (res && res.data) || (res && res.item) || res;
      if (!item) {
        my.showToast({ content: '商品不存在', type: 'fail' });
        return;
      }
      this.setData({ item, loading: false });
      await this.checkZhima();
      this.calcFees();
    } catch (e) {
      console.error('[确认订单] 加载失败:', e);
      this.setData({ loading: false });
    }
  },

  loadAddress() {
    try {
      const saved = my.getStorageSync({ key: 'rental_address' });
      if (saved && saved.data) this.setData({ address: saved.data });
    } catch (e) { /* 无地址 */ }
  },

  async checkZhima() {
    const { depositMode, item } = this.data;
    if (depositMode === 'credit_free' && item) {
      const result = await zhima.checkFreezeDeposit(item.depositAmount || 0);
      this.setData({
        zhimaScore: result.score,
        zhimaEligible: result.eligible
      });
      if (!result.eligible) {
        my.confirm({
          title: '信用分不足',
          content: result.message + '，是否改用押金方式？',
          confirmButtonText: '改用押金',
          cancelButtonText: '取消'
        }).then(r => {
          if (r.confirm) this.setData({ depositMode: 'deposit' });
          this.calcFees();
        });
      }
    }
  },

  calcFees() {
    const { item, rentalDays, depositMode } = this.data;
    if (!item) return;
    const rentalFee = (item.dailyRate || 0) * rentalDays;
    const depositFee = depositMode === 'credit_free' ? 0 : (item.depositAmount || 0);
    const deliveryFee = item.deliveryFee || 0;
    const total = rentalFee + depositFee + deliveryFee;
    this.setData({
      rentalFee,
      depositFee,
      deliveryFee,
      totalPrice: total,
      showHuabei: total > 500
    });
  },

  onEditAddress() {
    my.confirm({
      title: '填写收货地址',
      content: '请确认您的姓名、电话和地址',
      confirmButtonText: '填写',
      cancelButtonText: '取消'
    }).then(async (res) => {
      if (!res.confirm) return;
      const name = await this.promptInput('收货人姓名');
      if (!name) return;
      const phone = await this.promptInput('手机号码');
      if (!phone) return;
      const addr = await this.promptInput('详细地址');
      if (!addr) return;
      const address = { name, phone, address: addr };
      this.setData({ address });
      my.setStorageSync({ key: 'rental_address', data: address });
    });
  },

  promptInput(title) {
    return new Promise(resolve => {
      my.prompt({
        title,
        message: '',
        placeholder: '请输入' + title,
        success: (res) => resolve(res.ok ? res.inputValue : ''),
        fail: () => resolve('')
      });
    });
  },

  async onSubmit() {
    if (this.data.submitting) return;
    const { item, address, rentalDays, depositMode } = this.data;

    if (!app.globalData.isLoggedIn) {
      my.showToast({ content: '请先登录', type: 'fail' });
      return;
    }
    if (!address || !address.name) {
      my.showToast({ content: '请填写收货地址', type: 'fail' });
      return;
    }

    this.setData({ submitting: true });

    try {
      // 信用免押先冻结
      if (depositMode === 'credit_free') {
        const freezeResult = await zhima.checkFreezeDeposit(item.depositAmount || 0);
        if (!freezeResult.eligible) {
          my.showToast({ content: '信用分不足，请改用押金', type: 'fail' });
          this.setData({ submitting: false });
          return;
        }
      }

      const orderData = {
        userId: (app.globalData.userInfo || {}).userId,
        storeId: this.storeId,
        items: [{ itemId: this.itemId, quantity: 1 }],
        rentalDays,
        depositMode,
        deliveryMethod: 'courier',
        deliveryAddress: address
      };

      const res = await app.request('/rental/orders', orderData, 'POST');
      if (!(res && res.success) && !(res && res.orderNo)) {
        my.showToast({ content: (res || {}).error || '下单失败', type: 'fail' });
        this.setData({ submitting: false });
        return;
      }

      const orderNo = res.orderNo || (res.data || {}).orderNo;
      const paySign = res.paySign || (res.data || {}).paySign;

      // 支付宝支付
      if (paySign) {
        my.tradePay({
          tradeNO: paySign,
          success: () => {
            my.showToast({ content: '支付成功', type: 'success' });
            my.redirectTo({ url: `/pages/rental/order-detail/index?orderNo=${orderNo}` });
          },
          fail: () => {
            my.showToast({ content: '支付取消', type: 'none' });
            my.redirectTo({ url: `/pages/rental/order-detail/index?orderNo=${orderNo}` });
          }
        });
      } else {
        my.redirectTo({ url: `/pages/rental/order-detail/index?orderNo=${orderNo}` });
      }
    } catch (e) {
      console.error('[确认订单] 提交失败:', e);
      my.showToast({ content: '提交失败，请重试', type: 'fail' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
