const app = getApp();

Page({
  data: {
    categories: [
      { id: 1, name: '全部' },
      { id: 2, name: '衣物清洗' },
      { id: 3, name: '鞋类护理' },
      { id: 4, name: '箱包洗护' },
      { id: 5, name: '家纺清洗' },
      { id: 6, name: '奢品养护' }
    ],
    selectedCategory: 1,
    services: []
  },

  onLoad() {
    this.loadServices();
  },

  loadServices() {
    const allServices = [
      { id: 1, icon: '👔', name: '西装干洗', price: 88, desc: '含熨烫，3-5天取件', category: 2 },
      { id: 2, icon: '👕', name: '衬衫清洗', price: 25, desc: '含熨烫，2-3天取件', category: 2 },
      { id: 3, icon: '🧥', name: '羽绒服清洗', price: 68, desc: '专业清洗，5-7天取件', category: 2 },
      { id: 4, icon: '👖', name: '裤子清洗', price: 35, desc: '含熨烫，2-3天取件', category: 2 },
      { id: 5, icon: '👗', name: '连衣裙清洗', price: 58, desc: '专业护理，3-5天取件', category: 2 },
      { id: 6, icon: '👟', name: '鞋子清洗', price: 45, desc: '深度清洁，3-5天取件', category: 3 },
      { id: 7, icon: '👢', name: '靴子护理', price: 55, desc: '专业护理，3-5天取件', category: 3 },
      { id: 8, icon: '🎒', name: '背包清洗', price: 38, desc: '全面清洗，3-5天取件', category: 4 },
      { id: 9, icon: '🛍️', name: '手提包护理', price: 68, desc: '专业护理，5-7天取件', category: 4 },
      { id: 10, icon: '🛏️', name: '床单被套清洗', price: 58, desc: '大件清洗，5-7天取件', category: 5 },
      { id: 11, icon: '🧶', name: '毛毯清洗', price: 78, desc: '专业清洗，5-7天取件', category: 5 },
      { id: 12, icon: '💎', name: '奢侈品皮具', price: 188, desc: '顶级护理，7-10天取件', category: 6 }
    ];

    if (this.data.selectedCategory === 1) {
      this.setData({ services: allServices });
    } else {
      const filteredServices = allServices.filter(s => s.category === this.data.selectedCategory);
      this.setData({ services: filteredServices });
    }
  },

  onSelectCategory(e) {
    const categoryId = e.currentTarget.dataset.id;
    this.setData({
      selectedCategory: categoryId
    });
    this.loadServices();
  },

  onServiceDetail(e) {
    const serviceId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/services/detail/index?id=${serviceId}`
    });
  }
});