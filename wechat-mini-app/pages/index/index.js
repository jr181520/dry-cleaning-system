const app = getApp();
const categoryUtil = require('../../utils/category');

Page({
  data: {
    banners: [
      { id: 1, image: '/assets/images/banner1.jpg', title: '限时优惠' },
      { id: 2, image: '/assets/images/banner2.jpg', title: '会员专享' },
      { id: 3, image: '/assets/images/banner3.jpg', title: '新用户福利' }
    ],
    pendingOrders: [],
    // 品类
    categories: categoryUtil.getAllCategories(),
    activeCategory: 'cleaning',
    currentCategory: categoryUtil.getCategory('cleaning'),
    // 服务列表（当前品类的热门服务）
    services: categoryUtil.getHomeServices('cleaning'),
    // 附近门店（从API动态加载）
    nearbyStores: [],
    loadingStores: true,
    selectedStoreId: null
  },

  onLoad() {
    // 不在 onLoad 中发起网络请求，避免 WAServiceMainContext timeout
    // 所有数据加载推迟到 onShow
  },

  onShow() {
    // 延迟加载数据，等待框架完全就绪且 app.onShow 初始化完成
    setTimeout(() => this.loadData(), 500);
  },

  onPullDownRefresh() {
    this.loadData();
    wx.stopPullDownRefresh();
  },

  loadData() {
    // 加载待取件订单
    this.loadPendingOrders();
    // 加载附近门店
    this.loadNearbyStores();
  },

  async loadPendingOrders() {
    try {
      const result = await app.request('/orders/pending');
      if (result.success) {
        this.setData({
          pendingOrders: result.data || []
        });
      }
    } catch (error) {
      console.error('加载待取件订单失败', error);
      // 使用本地模拟数据
      this.setData({
        pendingOrders: [
          { id: 1, orderId: 'ORD-2025-001', time: '今天 14:30', itemCount: 3 },
          { id: 2, orderId: 'ORD-2025-002', time: '昨天 16:20', itemCount: 1 }
        ]
      });
    }
  },

  // 从后端API加载附近门店（价格由商家设定）
  async loadNearbyStores() {
    try {
      const result = await app.request('/cleaning/stores');
      if (result.success && result.data && result.data.length > 0) {
        const stores = result.data.slice(0, 3).map(store => ({
          id: store.storeId || store.id,
          storeId: store.storeId || store.id,
          name: store.name || store.storeName,
          address: store.address || store.location || '',
          distance: store.distance ? parseFloat(store.distance).toFixed(1) + 'km' : '未知',
          distanceValue: parseFloat(store.distance) || 0,
          phone: store.phone || store.contactPhone || '',
          hours: store.hours || store.businessHours || '09:00-21:00',
          rating: store.rating || 4.5,
          serviceCount: store.serviceCount || 0,
          isPromotion: store.hasPromotion || false,
          isRecommended: store.isRecommended || false,
          isOnline: store.status !== 'closed' && store.status !== 'offline',
          promotionDesc: store.promotionDesc || ''
        }));
        this.setData({ nearbyStores: stores, loadingStores: false });
      }
    } catch (error) {
      console.error('加载附近门店失败', error);
      this.setData({ loadingStores: false });
      // 加载失败时使用默认定点数据（不含价格）
      this.setData({
        nearbyStores: [
          {
            id: 'ST001', storeId: 'ST001',
            name: '干洗店旗舰店', address: '朝阳区建国路88号',
            distance: '1.2km', phone: '400-888-8888', hours: '08:00-22:00',
            serviceCount: 12, isPromotion: true, isRecommended: true, isOnline: true
          },
          {
            id: 'ST002', storeId: 'ST002',
            name: '干洗店中心店', address: '海淀区中关村大街1号',
            distance: '2.5km', phone: '400-888-8889', hours: '09:00-21:00',
            serviceCount: 10, isPromotion: false, isRecommended: true, isOnline: true
          }
        ]
      });
    }
  },

  // 扫码取件
  onQuickPickup() {
    wx.scanCode({
      onlyFromCamera: true,
      success: res => {
        try {
          const data = JSON.parse(res.result);
          if (data.type === 'pickup' && data.code) {
            wx.navigateTo({
              url: `/pages/pickup/index?code=${data.code}`
            });
          }
        } catch (e) {
          wx.navigateTo({
            url: `/pages/pickup/index?code=${res.result}`
          });
        }
      },
      fail: err => {
        if (err.errMsg !== 'scanCode:fail cancel') {
          app.showToast('扫码失败，请重试', 'none');
        }
      }
    });
  },

  // 联系门店
  onContact() {
    app.showToast('请先选择门店', 'none');
  },

  // 查看订单
  onViewOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/orders/index?id=${orderId}`
    });
  },

  // 查看全部服务（携带当前品类上下文）
  onViewAllServices() {
    const categoryId = this.data.activeCategory || 'cleaning';
    wx.navigateTo({
      url: '/pages/services/list/index?category=' + categoryId
    });
  },

  // 选择服务项目 — 直接跳转下单页，跳过服务详情页
  onSelectService(e) {
    const serviceId = e.currentTarget.dataset.id;
    const categoryId = e.currentTarget.dataset.cat || this.data.activeCategory;
    
    // 从当前品类服务列表中找到对应服务
    const service = this.data.services.find(s => String(s.id) === String(serviceId));
    
    if (service) {
      app.globalData.pendingServiceFromDetail = {
        id: service.id,
        icon: service.icon,
        name: service.name,
        desc: service.desc,
        unit: service.unit,
        isBoarding: service.isBoarding || false,
        deposit: service.deposit || 0,
        categoryId: categoryId
      };
    }
    
    // 直接跳转到服务选择/下单页，跳过服务详情页
    wx.navigateTo({
      url: `/pages/order/create/index?from=home&category=${categoryId}`
    });
  },

  // 切换品类
  onSwitchCategory(e) {
    const categoryId = e.currentTarget.dataset.id;
    if (categoryId === this.data.activeCategory) return;

    const cat = categoryUtil.getCategory(categoryId);
    const services = categoryUtil.getHomeServices(categoryId);

    this.setData({
      activeCategory: categoryId,
      currentCategory: cat,
      services
    });
  },

  // 查看全部门店（跳转到门店选择页）
  onViewAllStores() {
    wx.navigateTo({
      url: '/pages/order/stores/index?from=home'
    });
  },

  // 选择门店 — 跳转下单流程
  onSelectStore(e) {
    const storeId = e.currentTarget.dataset.id;
    const store = this.data.nearbyStores.find(s => s.id === storeId);
    if (store) {
      app.globalData.selectedStore = store;
    }
    this.setData({ selectedStoreId: storeId });
    wx.switchTab({ url: '/pages/services/list/index' });
  }
});