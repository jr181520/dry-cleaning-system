const app = getApp();

Page({
  data: {
    // 服务列表
    services: [],
    loading: true,
    
    // 已选服务
    selectedServices: [],
    totalPrice: 0
  },

  onLoad(options) {
    // 加载服务列表
    this.loadServices();
    
    // 检查是否从服务详情页跳转过来
    if (options.from === 'detail') {
      this.handleFromDetailPage();
    }
  },

  // 加载服务列表（从后端API获取）
  async loadServices() {
    try {
      // 从后端API获取服务列表
      const result = await app.request('/cleaning/services', {}, 'GET');
      
      if (result.success && result.data && result.data.length > 0) {
        // 转换服务数据格式，并添加selected字段
        const services = result.data.map(service => ({
          ...service,
          selected: false
        }));
        
        this.setData({
          services: services,
          loading: false
        });
        
        console.log('[服务列表] 从API加载成功:', services.length, '个服务');
      } else {
        console.warn('[服务列表] API返回空数据，使用默认服务');
        this.loadDefaultServices();
      }
    } catch (error) {
      console.error('[服务列表] 加载失败:', error);
      // API失败时使用默认服务
      this.loadDefaultServices();
    }
  },
  
  // 加载默认服务列表（API失败时的后备）
  loadDefaultServices() {
    const defaultServices = [
      { id: 1, icon: '👔', name: '西装干洗', price: 88, desc: '含熨烫，3-5天取件', selected: false },
      { id: 2, icon: '👕', name: '衬衫清洗', price: 25, desc: '含熨烫，2-3天取件', selected: false },
      { id: 3, icon: '🧥', name: '羽绒服清洗', price: 68, desc: '专业清洗，5-7天取件', selected: false },
      { id: 4, icon: '👖', name: '裤子清洗', price: 35, desc: '含熨烫，2-3天取件', selected: false },
      { id: 5, icon: '👗', name: '连衣裙清洗', price: 58, desc: '专业护理，3-5天取件', selected: false },
      { id: 6, icon: '👟', name: '鞋子清洗', price: 45, desc: '深度清洁，3-5天取件', selected: false }
    ];
    
    this.setData({
      services: defaultServices,
      loading: false
    });
  },

  // 从服务详情页跳转过来的处理
  handleFromDetailPage() {
    const pendingService = app.globalData.pendingServiceFromDetail;
    if (pendingService && this.data.services.length > 0) {
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
    
    // 保存到全局数据（用于跨页面传递）
    app.globalData.selectedServices = this.data.selectedServices;
    app.globalData.serviceTotalPrice = this.data.totalPrice;
    
    // 跳转到门店选择页面
    wx.navigateTo({
      url: '/pages/order/stores/index'
    });
  }
});
