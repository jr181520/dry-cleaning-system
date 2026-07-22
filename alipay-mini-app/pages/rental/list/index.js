const app = getApp();

const CATEGORIES = [
  { label: '全部', value: '' },
  { label: '服饰', value: 'clothing' },
  { label: '数码', value: 'digital' },
  { label: '户外', value: 'outdoor' },
  { label: '电子', value: 'electronics' },
  { label: '轻奢', value: 'luxury' },
  { label: '母婴', value: 'baby' },
  { label: '运动', value: 'sports' }
];

Page({
  data: {
    categories: CATEGORIES,
    activeCategory: '',
    keyword: '',
    items: [],
    page: 1,
    limit: 20,
    hasMore: true,
    loading: false
  },

  _searchTimer: null,

  onLoad() {
    this.loadItems(true);
  },

  onPullDownRefresh() {
    this.loadItems(true).then(() => my.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadItems(false);
    }
  },

  async loadItems(reset) {
    if (this.data.loading) return;
    const page = reset ? 1 : this.data.page;
    this.setData({ loading: true });

    try {
      const query = `/rental/items?page=${page}&limit=${this.data.limit}&category=${this.data.activeCategory}&keyword=${encodeURIComponent(this.data.keyword)}`;
      const res = await app.request(query);
      const list = (res && res.items) || (res && res.data) || [];
      const total = (res && res.total) || 0;
      const newItems = reset ? list : this.data.items.concat(list);

      this.setData({
        items: newItems,
        page: page + 1,
        hasMore: newItems.length < total,
        loading: false
      });
    } catch (e) {
      console.error('[租物列表] 加载失败:', e);
      my.showToast({ content: '加载失败', type: 'fail' });
      this.setData({ loading: false });
    }
  },

  onSearch(e) {
    const keyword = e.detail.value || '';
    clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => {
      this.setData({ keyword });
      this.loadItems(true);
    }, 300);
  },

  onCategoryTap(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({ activeCategory: category });
    this.loadItems(true);
  },

  onItemTap(e) {
    const id = e.currentTarget.dataset.id;
    my.navigateTo({ url: `/pages/rental/detail/index?id=${id}` });
  }
});
