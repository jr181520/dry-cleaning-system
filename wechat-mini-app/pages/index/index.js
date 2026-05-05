const app = getApp();

Page({
  data: {
    banners: [
      { id: 1, image: '/assets/images/banner1.jpg', title: '限时优惠' },
      { id: 2, image: '/assets/images/banner2.jpg', title: '会员专享' },
      { id: 3, image: '/assets/images/banner3.jpg', title: '新用户福利' }
    ],
    pendingOrders: [],
    services: [
      { id: 1, icon: '👔', name: '西装干洗', price: 88, desc: '含熨烫，3-5天取件' },
      { id: 2, icon: '👕', name: '衬衫清洗', price: 25, desc: '含熨烫，2-3天取件' },
      { id: 3, icon: '🧥', name: '羽绒服清洗', price: 68, desc: '专业清洗，5-7天取件' },
      { id: 4, icon: '👖', name: '裤子清洗', price: 35, desc: '含熨烫，2-3天取件' },
      { id: 5, icon: '👗', name: '连衣裙清洗', price: 58, desc: '专业护理，3-5天取件' },
      { id: 6, icon: '👟', name: '鞋子清洗', price: 45, desc: '深度清洁，3-5天取件' }
    ],
    nearbyStores: [
      {
        id: 1,
        name: '干洗店旗舰店',
        address: '某某市某某区某某街道123号',
        distance: '1.2km',
        phone: '400-888-8888',
        hours: '08:00-22:00',
        serviceCount: 12,
        minPrice: 25,
        isPromotion: true,
        isRecommended: true,
        isOnline: true
      },
      {
        id: 2,
        name: '干洗店中心店',
        address: '某某市某某区某某街道456号',
        distance: '2.5km',
        phone: '400-888-8889',
        hours: '09:00-21:00',
        serviceCount: 10,
        minPrice: 20,
        isPromotion: false,
        isRecommended: true,
        isOnline: true
      },
      {
        id: 3,
        name: '干洗店东门店',
        address: '某某市某某区某某街道789号',
        distance: '3.1km',
        phone: '400-888-8890',
        hours: '10:00-20:00',
        serviceCount: 8,
        minPrice: 30,
        isPromotion: true,
        isRecommended: false,
        isOnline: true
      }
    ],
    selectedStoreId: null
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData();
    wx.stopPullDownRefresh();
  },

  loadData() {
    // 加载待取件订单
    this.loadPendingOrders();
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

  // 我的订单
  onMyOrders() {
    wx.switchTab({
      url: '/pages/orders/index'
    });
  },

  // 会员中心
  onMembership() {
    wx.switchTab({
      url: '/pages/profile/index'
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

  // 线上下单
  onQuickOrder() {
    // 直接跳转到服务选择页面
    wx.navigateTo({
      url: '/pages/order/create/index'
    });
  },

  // 查看全部服务
  onViewAllServices() {
    wx.navigateTo({
      url: '/pages/services/list'
    });
  },

  // 选择服务项目
  onSelectService(e) {
    const serviceId = e.currentTarget.dataset.id;
    // 直接跳转到服务详情页，让用户在详情页预约
    wx.navigateTo({
      url: `/pages/services/detail/index?id=${serviceId}`
    });
  },

  // 查看全部门店
  onViewAllStores() {
    wx.navigateTo({
      url: '/pages/stores/list'
    });
  },

  // 选择门店
  onSelectStore(e) {
    const storeId = e.currentTarget.dataset.id;
    this.setData({
      selectedStoreId: storeId
    });
    app.showToast('门店已选择', 'success');
  }
});