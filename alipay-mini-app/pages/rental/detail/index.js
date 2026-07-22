const app = getApp();
const zhima = require('../../../utils/zhima');

const PERIOD_PRESETS = [1, 3, 7, 14, 30];

Page({
  data: {
    item: null,
    loading: true,
    currentImage: 0,
    selectedDays: 7,
    customDays: '',
    periodPresets: [],
    depositMode: 'deposit',
    zhimaScore: 0,
    zhimaEligible: false,
    rentalSubtotal: 0,
    depositAmount: 0,
    totalPrice: 0
  },

  onLoad(query) {
    this.itemId = query.id;
    this.storeId = query.storeId || app.globalData.storeId;
    this.loadDetail();
  },

  async loadDetail() {
    try {
      const res = await app.request(`/rental/items/${this.itemId}`);
      const item = (res && res.data) || (res && res.item) || res;
      if (!item) {
        my.showToast({ content: '商品不存在', type: 'fail' });
        return;
      }

      const minDays = item.minRentalDays || 1;
      const maxDays = item.maxRentalDays || 365;
      const presets = PERIOD_PRESETS.filter(d => d >= minDays && d <= maxDays);
      const defaultDays = presets.length > 0 ? presets[Math.min(2, presets.length - 1)] : minDays;

      this.setData({
        item,
        periodPresets: presets,
        selectedDays: defaultDays,
        depositMode: item.depositMode === 'credit_free' ? 'credit_free' : 'deposit',
        loading: false
      });

      if (item.depositMode === 'both' || item.depositMode === 'credit_free') {
        this.checkZhima();
      }

      this.calcPrice();
    } catch (e) {
      console.error('[商品详情] 加载失败:', e);
      my.showToast({ content: '加载失败', type: 'fail' });
      this.setData({ loading: false });
    }
  },

  async checkZhima() {
    try {
      const result = await zhima.getZhimaScore();
      this.setData({
        zhimaScore: result.score,
        zhimaEligible: result.eligible
      });
    } catch (e) {
      console.warn('[芝麻信用] 查询失败:', e);
    }
  },

  calcPrice() {
    const { item, selectedDays, depositMode } = this.data;
    if (!item) return;
    const subtotal = (item.dailyRate || 0) * selectedDays;
    const deposit = depositMode === 'credit_free' ? 0 : (item.depositAmount || 0);
    this.setData({
      rentalSubtotal: subtotal,
      depositAmount: deposit,
      totalPrice: subtotal + deposit
    });
  },

  onSwiperChange(e) {
    this.setData({ currentImage: e.detail.current });
  },

  onPeriodTap(e) {
    const days = e.currentTarget.dataset.days;
    this.setData({ selectedDays: days, customDays: '' });
    this.calcPrice();
  },

  onCustomDays(e) {
    const val = parseInt(e.detail.value) || 0;
    const { item } = this.data;
    const min = (item || {}).minRentalDays || 1;
    const max = (item || {}).maxRentalDays || 365;
    if (val >= min && val <= max) {
      this.setData({ selectedDays: val, customDays: String(val) });
    } else {
      my.showToast({ content: `租期范围：${min}-${max}天`, type: 'none' });
    }
    this.calcPrice();
  },

  onDepositModeTap(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode === 'credit_free' && !this.data.zhimaEligible) {
      my.confirm({
        title: '芝麻信用分不足',
        content: '您的芝麻信用分未达到免押要求，是否查看提升方式？',
        confirmButtonText: '去提升',
        cancelButtonText: '取消'
      }).then(res => {
        if (res.confirm) zhima.openZhimaPage();
      });
      return;
    }
    this.setData({ depositMode: mode });
    this.calcPrice();
  },

  onOrderTap() {
    const { item, selectedDays, depositMode } = this.data;
    if (!app.globalData.isLoggedIn) {
      my.showToast({ content: '请先登录', type: 'fail' });
      return;
    }
    my.navigateTo({
      url: `/pages/rental/order/index?itemId=${this.itemId}&storeId=${this.storeId}&days=${selectedDays}&depositMode=${depositMode}`
    });
  }
});
