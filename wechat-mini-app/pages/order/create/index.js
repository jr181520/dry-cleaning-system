const app = getApp();

Page({
  data: {
    // 服务列表
    services: [
      { id: 1, icon: '👔', name: '西装干洗', price: 88, desc: '含熨烫，3-5天取件', selected: false },
      { id: 2, icon: '👕', name: '衬衫清洗', price: 25, desc: '含熨烫，2-3天取件', selected: false },
      { id: 3, icon: '🧥', name: '羽绒服清洗', price: 68, desc: '专业清洗，5-7天取件', selected: false },
      { id: 4, icon: '👖', name: '裤子清洗', price: 35, desc: '含熨烫，2-3天取件', selected: false },
      { id: 5, icon: '👗', name: '连衣裙清洗', price: 58, desc: '专业护理，3-5天取件', selected: false },
      { id: 6, icon: '👟', name: '鞋子清洗', price: 45, desc: '深度清洁，3-5天取件', selected: false }
    ],
    
    // 已选服务
    selectedServices: [],
    totalPrice: 0
  },

  onLoad(options) {
    // 检查是否从服务详情页跳转过来
    if (options.from === 'detail') {
      this.handleFromDetailPage();
    }
  },

  // 从服务详情页跳转过来的处理
  handleFromDetailPage() {
    const pendingService = app.globalData.pendingServiceFromDetail;
    if (pendingService) {
      // 清空全局数据
      delete app.globalData.pendingServiceFromDetail;
      
      // 找到对应的服务并选中
      const services = [...this.data.services].map(s => ({
        ...s,
        selected: s.id === pendingService.id
      }));
      
      const selectedServices = [pendingService];
      const totalPrice = pendingService.price;
      
      this.setData({
        services,
        selectedServices,
        totalPrice
      });
    }
  },

  // 选择/取消服务
  onToggleService(e) {
    const serviceId = e.currentTarget.dataset.id;
    const services = [...this.data.services];
    const service = services.find(s => s.id === serviceId);
    
    if (service) {
      service.selected = !service.selected;
      
      // 更新已选服务列表
      let selectedServices = [...this.data.selectedServices];
      if (service.selected) {
        selectedServices.push(service);
      } else {
        selectedServices = selectedServices.filter(s => s.id !== serviceId);
      }
      
      // 计算总价
      const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
      
      this.setData({
        services,
        selectedServices,
        totalPrice
      });
    }
  },

  // 下一步：选择门店
  onNextStep() {
    if (this.data.selectedServices.length === 0) {
      app.showToast('请至少选择一项服务', 'none');
      return;
    }
    
    // 将服务数据编码后传递
    const servicesJson = encodeURIComponent(JSON.stringify(this.data.selectedServices));
    
    wx.navigateTo({
      url: `/pages/order/stores/index?services=${servicesJson}`
    });
  }
});
