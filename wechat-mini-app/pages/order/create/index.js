const app = getApp();
const categoryUtil = require('../../../utils/category');

Page({
  data: {
    // 品类
    categories: categoryUtil.getAllCategories(),
    activeCategory: 'cleaning',
    currentCategory: categoryUtil.getCategory('cleaning'),
    
    // 服务列表（当前品类的服务）
    services: [],
    loading: true,
    
    // 已选服务
    selectedServices: [],
    serviceCount: 0,
    
    // 寄养详情（仅当选择寄养服务时显示）
    showBoardingModal: false,
    boardingDetail: {
      petType: 'small_dog',
      petName: '',
      days: 1,
      foodOption: 'store'
    },
    petTypeOptions: [
      { value: 'small_dog', label: '小型犬' },
      { value: 'medium_dog', label: '中型犬' },
      { value: 'large_dog', label: '大型犬' },
      { value: 'cat', label: '猫' }
    ]
  },

  onLoad(options) {
    // 从URL参数获取品类（默认干洗）
    const categoryId = options.category || 'cleaning';
    this.setData({ activeCategory: categoryId });
    this.loadCategoryServices(categoryId);
    
    // 保存品类到全局数据（供门店推荐页使用）
    app.globalData.orderCategory = categoryId;
    
    // 检查是否从服务详情页/首页/服务列表跳转过来，自动选中服务
    if (options.from === 'detail' || options.from === 'home' || options.from === 'services') {
      this.handleFromDetailPage();
    }
  },

  // 加载指定品类的服务列表（从品类工具获取，SaaS模式：价格由门店决定）
  loadCategoryServices(categoryId) {
    const cat = categoryUtil.getCategory(categoryId);
    if (!cat) {
      console.warn('[服务选择] 未知品类:', categoryId, '使用干洗兜底');
      return this.loadCategoryServices('cleaning');
    }

    // 从品类工具获取该品类的所有服务
    const catServices = categoryUtil.getServices(categoryId);
    const services = catServices.map(svc => ({
      ...svc,
      selected: false
    }));

    this.setData({
      activeCategory: categoryId,
      currentCategory: cat,
      services: services,
      loading: false
    });

    console.log('[服务选择] 品类:', cat.name, '服务数:', services.length);
  },

  // 切换品类
  onSwitchCategory(e) {
    const categoryId = e.currentTarget.dataset.id;
    if (categoryId === this.data.activeCategory) return;
    
    // 切换品类时清除已选服务
    this.setData({
      selectedServices: [],
      serviceCount: 0,
      loading: true
    });
    
    // 保存品类到全局数据
    app.globalData.orderCategory = categoryId;
    this.loadCategoryServices(categoryId);
  },

  // 从服务详情页跳转过来的处理
  handleFromDetailPage() {
    const pendingService = app.globalData.pendingServiceFromDetail;
    if (!pendingService) return;

    // 如果详情页带了品类ID，切换到对应品类
    if (pendingService.categoryId && pendingService.categoryId !== this.data.activeCategory) {
      this.setData({
        activeCategory: pendingService.categoryId,
        loading: true
      });
      app.globalData.orderCategory = pendingService.categoryId;
      this.loadCategoryServices(pendingService.categoryId);
    }

    // 延迟执行选中（等待服务列表渲染）
    setTimeout(() => {
      if (!this.data.services || this.data.services.length === 0) return;
      
      // 清空全局数据
      delete app.globalData.pendingServiceFromDetail;
      
      // 找到对应的服务并选中
      const services = [...this.data.services].map(s => ({
        ...s,
        selected: String(s.id) === String(pendingService.id)
      }));
      
      const selectedServices = services.filter(s => s.selected).map(s => ({
        id: s.id,
        icon: s.icon,
        name: s.name,
        desc: s.desc,
        unit: s.unit,
        isBoarding: s.isBoarding || false,
        deposit: s.deposit || 0
      }));
      
      this.setData({
        services,
        selectedServices,
        serviceCount: selectedServices.length
      });
      
      console.log('[服务选择] 从详情页自动选中:', pendingService.name);
    }, 200);
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
      
      this.setData({
        services,
        selectedServices,
        serviceCount: selectedServices.length
      });
    }
  },

  // 下一步：判断是否有寄养服务
  onNextStep() {
    if (this.data.selectedServices.length === 0) {
      app.showToast('请至少选择一项服务', 'none');
      return;
    }
    
    // 检查是否选择了寄养服务
    const hasBoarding = this.data.selectedServices.some(s => s.isBoarding === true);
    
    if (hasBoarding) {
      // 显示寄养详情弹窗
      this.setData({ showBoardingModal: true });
    } else {
      // 直接跳转门店选择
      this.navigateToStores();
    }
  },

  // 寄养弹窗 - 选择宠物类型
  onSelectPetType(e) {
    const petType = e.currentTarget.dataset.type;
    const boardingDetail = { ...this.data.boardingDetail, petType };
    this.setData({ boardingDetail });
  },

  // 寄养弹窗 - 输入宠物名
  onPetNameInput(e) {
    const boardingDetail = { ...this.data.boardingDetail, petName: e.detail.value };
    this.setData({ boardingDetail });
  },

  // 寄养弹窗 - 减少天数
  onDaysMinus() {
    if (this.data.boardingDetail.days <= 1) return;
    const boardingDetail = { ...this.data.boardingDetail, days: this.data.boardingDetail.days - 1 };
    this.setData({ boardingDetail });
  },

  // 寄养弹窗 - 增加天数
  onDaysPlus() {
    const boardingDetail = { ...this.data.boardingDetail, days: this.data.boardingDetail.days + 1 };
    this.setData({ boardingDetail });
  },

  // 寄养弹窗 - 选择喂养方式
  onSelectFoodOption(e) {
    const foodOption = e.currentTarget.dataset.option;
    const boardingDetail = { ...this.data.boardingDetail, foodOption };
    this.setData({ boardingDetail });
  },

  // 寄养弹窗 - 确认
  onConfirmBoarding() {
    if (!this.data.boardingDetail.petName || this.data.boardingDetail.petName.trim() === '') {
      app.showToast('请输入宠物名称', 'none');
      return;
    }
    this.setData({ showBoardingModal: false });
    this.navigateToStores();
  },

  // 跳转到门店选择页（智慧大脑推荐）
  navigateToStores() {
    // 保存到全局数据
    app.globalData.selectedServices = this.data.selectedServices;
    app.globalData.serviceCount = this.data.serviceCount;
    // 保存当前品类上下文
    app.globalData.orderCategory = this.data.activeCategory;
    app.globalData.orderCategoryName = (this.data.currentCategory || {}).name || '';
    
    // 如果有寄养详情，一并传递
    if (this.data.selectedServices.some(s => s.isBoarding === true)) {
      app.globalData.boardingDetail = this.data.boardingDetail;
    } else {
      delete app.globalData.boardingDetail;
    }
    
    console.log('[服务选择] 品类:', this.data.activeCategory, '已选服务:', this.data.selectedServices.map(s => s.name));
    
    // 跳转到门店选择页面
    wx.navigateTo({
      url: '/pages/order/stores/index'
    });
  }
});