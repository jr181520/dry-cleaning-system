const app = getApp();
const API_BASE = app.globalData?.apiBase || '';

Page({
  data: {
    categories: [
      { value: 'all', label: '全部' },
      { value: 'clothing', label: '服饰' },
      { value: 'digital', label: '数码' },
      { value: 'outdoor', label: '户外' },
      { value: 'electronics', label: '电子' },
      { value: 'luxury', label: '轻奢' },
      { value: 'baby', label: '母婴' },
      { value: 'sports', label: '运动' }
    ],
    currentCategory: 'all',
    keyword: '',
    items: [],
    page: 1,
    total: 0,
    loading: false
  },

  onLoad() {
    this.loadItems();
  },

  onPullDownRefresh() {
    this.setData({ page: 1, items: [] });
    this.loadItems().then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.items.length < this.data.total) {
      this.setData({ page: this.data.page + 1 });
      this.loadItems();
    }
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value, page: 1, items: [] });
    clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => this.loadItems(), 300);
  },

  onCategoryTap(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({ currentCategory: category, page: 1, items: [] });
    this.loadItems();
  },

  async loadItems() {
    this.setData({ loading: true });
    const { currentCategory, keyword, page } = this.data;
    let url = `${API_BASE}/api/rental/items?page=${page}&limit=20`;
    if (currentCategory !== 'all') url += `&category=${currentCategory}`;
    if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;

    try {
      const res = await wx.request({ url, method: 'GET' });
      if (res.data.success) {
        const newItems = page === 1 ? res.data.items : this.data.items.concat(res.data.items);
        this.setData({ items: newItems, total: res.data.total, loading: false });
      }
    } catch(e) {
      console.error('加载失败:', e);
      this.setData({ loading: false });
    }
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/rental/detail/index?id=${id}` });
  }
});
