const app = getApp();
const categoryUtil = require('../../../utils/category');

Page({
  data: {
    categories: [],
    selectedCategory: 'cleaning',
    services: [],
    currentCategory: null
  },

  onLoad(options) {
    // 如果URL带了品类参数，使用该品类作为初始选中
    const initialCategory = options.category || 'cleaning';
    this.initCategories(initialCategory);
  },

  // 初始化品类列表
  initCategories(initialCategory) {
    const cats = categoryUtil.getAllCategories();
    const currentCat = categoryUtil.getCategory(initialCategory);
    const services = categoryUtil.getServices(initialCategory);
    this.setData({
      categories: cats,
      selectedCategory: initialCategory,
      currentCategory: currentCat,
      services: services
    });
  },

  // 切换品类
  onSelectCategory(e) {
    const categoryId = e.currentTarget.dataset.id;
    if (categoryId === this.data.selectedCategory) return;

    const cat = categoryUtil.getCategory(categoryId);
    const services = categoryUtil.getServices(categoryId);

    this.setData({
      selectedCategory: categoryId,
      currentCategory: cat,
      services: services
    });
  },

  // 查看服务详情
  onServiceDetail(e) {
    const serviceId = e.currentTarget.dataset.id;
    const categoryId = this.data.selectedCategory;
    wx.navigateTo({
      url: '/pages/services/detail/index?id=' + serviceId + '&category=' + categoryId
    });
  },

  // 预约服务 — 跳转下单流程（携带品类参数）
  onBookService(e) {
    const serviceId = e.currentTarget.dataset.id;
    const service = this.data.services.find(s => s.id === serviceId);
    const categoryId = this.data.selectedCategory;
    
    if (service) {
      app.globalData.pendingServiceFromDetail = {
        id: service.id,
        icon: service.icon,
        name: service.name,
        desc: service.desc,
        unit: service.unit,
        isBoarding: service.isBoarding || false,
        categoryId: categoryId
      };
    }
    wx.navigateTo({
      url: `/pages/order/create/index?from=services&category=${categoryId}`
    });
  }
});