const app = getApp();
const API_BASE = app.globalData?.apiBase || '';
const CATEGORY_LABELS = { clothing: '服饰', digital: '数码', outdoor: '户外', electronics: '电子', luxury: '轻奢', baby: '母婴', sports: '运动', tools: '工具', other: '其他' };

Page({
  data: {
    item: {},
    categoryLabel: '',
    selectedDays: 1,
    selectedDepositMode: 'deposit',
    dayPresets: [],
    totalPrice: '0.00',
    depositAmount: '0.00'
  },

  onLoad(options) {
    if (options.id) this.loadItem(options.id);
  },

  async loadItem(id) {
    try {
      const res = await wx.request({ url: `${API_BASE}/api/rental/items/${id}` });
      if (res.data.success) {
        const item = res.data.item;
        const minDays = item.rentalPeriodMin || 1;
        const maxDays = item.rentalPeriodMax || 30;
        const presets = [1, 3, 7, 14, 30].filter(d => d >= minDays && d <= maxDays);
        if (presets.length === 0) presets.push(minDays);

        let depositMode = item.depositMode === 'both' ? 'deposit' : item.depositMode;

        this.setData({
          item,
          categoryLabel: CATEGORY_LABELS[item.category] || item.category,
          dayPresets: presets,
          selectedDays: minDays,
          selectedDepositMode: depositMode
        });
        this.updateTotal();
      }
    } catch(e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  selectDay(e) {
    const days = e.currentTarget.dataset.days;
    this.setData({ selectedDays: days });
    this.updateTotal();
  },

  onCustomDays(e) {
    const { item } = this.data;
    let days = parseInt(e.detail.value) || item.rentalPeriodMin || 1;
    days = Math.max(item.rentalPeriodMin || 1, Math.min(item.rentalPeriodMax || 30, days));
    this.setData({ selectedDays: days });
    this.updateTotal();
  },

  selectDepositMode(e) {
    this.setData({ selectedDepositMode: e.currentTarget.dataset.mode });
    this.updateTotal();
  },

  updateTotal() {
    const { item, selectedDays, selectedDepositMode } = this.data;
    const rental = (item.dailyRate || 0) * selectedDays;
    const deposit = selectedDepositMode === 'credit_free' ? 0 : (item.depositAmount || 0);
    this.setData({
      totalPrice: (rental + deposit).toFixed(2),
      depositAmount: deposit.toFixed(2)
    });
  },

  goOrder() {
    const { item, selectedDays, selectedDepositMode } = this.data;
    wx.navigateTo({
      url: `/pages/rental/order/index?itemId=${item._id}&storeId=${item.storeId}&days=${selectedDays}&depositMode=${selectedDepositMode}`
    });
  }
});
