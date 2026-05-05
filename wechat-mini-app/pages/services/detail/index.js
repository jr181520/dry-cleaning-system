const app = getApp();

Page({
  data: {
    service: null,
    serviceId: null
  },

  onLoad(options) {
    if (options.id) {
      this.setData({
        serviceId: parseInt(options.id)
      });
      this.loadServiceDetail();
    }
  },

  loadServiceDetail() {
    const allServices = [
      { id: 1, icon: '👔', name: '西装干洗', price: 88, desc: '含熨烫，3-5天取件' },
      { id: 2, icon: '👕', name: '衬衫清洗', price: 25, desc: '含熨烫，2-3天取件' },
      { id: 3, icon: '🧥', name: '羽绒服清洗', price: 68, desc: '专业清洗，5-7天取件' },
      { id: 4, icon: '👖', name: '裤子清洗', price: 35, desc: '含熨烫，2-3天取件' },
      { id: 5, icon: '👗', name: '连衣裙清洗', price: 58, desc: '专业护理，3-5天取件' },
      { id: 6, icon: '👟', name: '鞋子清洗', price: 45, desc: '深度清洁，3-5天取件' },
      { id: 7, icon: '👢', name: '靴子护理', price: 55, desc: '专业护理，3-5天取件' },
      { id: 8, icon: '🎒', name: '背包清洗', price: 38, desc: '全面清洗，3-5天取件' },
      { id: 9, icon: '🛍️', name: '手提包护理', price: 68, desc: '专业护理，5-7天取件' },
      { id: 10, icon: '🛏️', name: '床单被套清洗', price: 58, desc: '大件清洗，5-7天取件' },
      { id: 11, icon: '🧶', name: '毛毯清洗', price: 78, desc: '专业清洗，5-7天取件' },
      { id: 12, icon: '💎', name: '奢侈品皮具', price: 188, desc: '顶级护理，7-10天取件' }
    ];

    const service = allServices.find(s => s.id === this.data.serviceId);
    if (service) {
      this.setData({
        service: service
      });
    }
  },

  onBookService() {
    // 将当前服务保存到全局数据
    if (this.data.service) {
      app.globalData.pendingServiceFromDetail = this.data.service;
    }
    
    // 跳转到服务选择页面（订单创建页面）
    // 传递 from=detail 参数，让 order/create 知道是从服务详情页跳转的
    wx.navigateTo({
      url: '/pages/order/create/index?from=detail'
    });
  }
});