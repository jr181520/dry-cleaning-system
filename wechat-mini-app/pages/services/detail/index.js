const app = getApp();
const categoryUtil = require('../../../utils/category');

Page({
  data: {
    service: null,
    serviceId: null,
    categoryId: 'cleaning'
  },

  onLoad(options) {
    const serviceId = options.id;
    const categoryId = options.category || 'cleaning';
    
    this.setData({ serviceId, categoryId });
    this.loadServiceDetail(serviceId, categoryId);
  },

  loadServiceDetail(serviceId, categoryId) {
    // 从品类工具获取服务定义
    const services = categoryUtil.getServices(categoryId);
    const service = services.find(s => String(s.id) === String(serviceId));

    if (service) {
      this.setData({ service });
    } else {
      // 跨品类查找兜底
      const cats = categoryUtil.getAllCategories();
      for (var i = 0; i < cats.length; i++) {
        const svcs = categoryUtil.getServices(cats[i].id);
        const found = svcs.find(s => String(s.id) === String(serviceId));
        if (found) {
          this.setData({ service: found, categoryId: cats[i].id });
          return;
        }
      }
    }
  },

  onBookService() {
    // 将当前服务保存到全局数据
    if (this.data.service) {
      app.globalData.pendingServiceFromDetail = {
        id: this.data.service.id,
        icon: this.data.service.icon,
        name: this.data.service.name,
        desc: this.data.service.desc,
        unit: this.data.service.unit,
        isBoarding: this.data.service.isBoarding || false,
        categoryId: this.data.categoryId
      };
    }
    
    // 跳转到服务选择页面（订单创建页面）
    wx.navigateTo({
      url: '/pages/order/create/index?from=detail&category=' + this.data.categoryId
    });
  }
});