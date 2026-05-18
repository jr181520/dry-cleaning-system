// pages/order/stores/index.js
const app = getApp();

Page({
  data: {
    // 排序选项
    sortOptions: [
      { id: 'price', label: '价格最优', icon: '💰', active: false },
      { id: 'distance', label: '距离最近', icon: '📍', active: true },
      { id: 'rating', label: '推荐优先', icon: '⭐', active: false }
    ],
    
    // 门店列表
    stores: [],
    originalStores: [],
    
    // 已选服务
    selectedServices: [],
    serviceDetails: [],
    serviceTotalPrice: 0,
    
    // 筛选
    filterOptions: {
      isPromotion: false,  // 仅促销
      isOnline: true      // 仅营业中
    },
    
    // 配送信息
    userAddress: '',
    deliveryFee: 0,
    deliveryProviders: [],
    selectedDeliveryProvider: null
  },

  onLoad(options) {
    // 获取传递的服务数据
    if (options.services) {
      try {
        // 尝试解析 URL 参数
        let servicesStr = options.services;
        // 如果字符串被编码，先解码
        if (servicesStr.includes('%')) {
          servicesStr = decodeURIComponent(servicesStr);
        }
        const services = JSON.parse(servicesStr);
        
        if (Array.isArray(services) && services.length > 0) {
          this.setData({
            selectedServices: services.map(s => s.id),
            serviceDetails: services,
            serviceTotalPrice: services.reduce((sum, s) => sum + (s.price || 0), 0)
          });
          console.log('服务数据加载成功:', services);
        }
      } catch (e) {
        console.error('解析服务数据失败:', e);
        // 尝试从全局数据获取
        const globalServices = app.globalData.selectedServices;
        if (globalServices && globalServices.length > 0) {
          this.setData({
            selectedServices: globalServices.map(s => s.id),
            serviceDetails: globalServices,
            serviceTotalPrice: globalServices.reduce((sum, s) => sum + (s.price || 0), 0)
          });
          console.log('从全局数据恢复服务:', globalServices);
        }
      }
    }
    
    // 加载门店列表
    this.loadStores();
    
    // 加载用户地址
    this.loadUserAddress();
    
    // 查询配送费用
    this.queryDeliveryFee();
  },

  // 加载门店数据
  async loadStores() {
    try {
      // 从后端API获取门店列表
      const result = await app.request('/cleaning/stores');
      
      if (result.success && result.data && result.data.length > 0) {
        // 转换门店数据格式
        const stores = result.data.map(store => ({
          id: store.storeId || store.id,
          name: store.name || store.storeName,
          address: store.address || store.location || '',
          distance: store.distance ? `${store.distance}km` : '未知',
          distanceValue: parseFloat(store.distance) || 0,
          phone: store.phone || store.contactPhone || '',
          hours: store.hours || store.businessHours || '09:00-21:00',
          rating: store.rating || 4.5,
          serviceCount: store.serviceCount || 0,
          minPrice: store.minPrice || store.startingPrice || 0,
          isPromotion: store.hasPromotion || false,
          isRecommended: store.isRecommended || false,
          isOnline: store.status !== 'closed' && store.status !== 'offline',
          promotionDesc: store.promotionDesc || '',
          baseDeliveryFee: store.deliveryFee || 8,
          storeId: store.storeId || store.id
        }));
        
        this.setData({
          stores: stores,
          originalStores: stores
        });
        
        console.log('[门店列表] 从API加载成功:', stores.length, '家门店');
      } else {
        console.warn('[门店列表] API返回空数据，使用默认门店');
        this.loadDefaultStores();
      }
    } catch (error) {
      console.error('[门店列表] 加载失败:', error);
      // 使用默认门店列表
      this.loadDefaultStores();
    }
    
    // 默认按距离排序
    this.sortStores('distance');
  },
  
  // 加载默认门店列表（API失败时的后备）
  loadDefaultStores() {
    const stores = [
      {
        id: 'ST001',
        name: '干洗店旗舰店',
        address: '某某市某某区某某街道123号',
        distance: '1.2km',
        distanceValue: 1.2,
        phone: '400-888-8888',
        hours: '08:00-22:00',
        rating: 4.8,
        serviceCount: 12,
        minPrice: 25,
        isPromotion: true,
        isRecommended: true,
        isOnline: true,
        promotionDesc: '全场8折',
        baseDeliveryFee: 8
      },
      {
        id: 'ST002',
        name: '干洗店中心店',
        address: '某某市某某区某某街道456号',
        distance: '2.5km',
        distanceValue: 2.5,
        phone: '400-888-8889',
        hours: '09:00-21:00',
        rating: 4.6,
        serviceCount: 10,
        minPrice: 20,
        isPromotion: false,
        isRecommended: true,
        isOnline: true,
        promotionDesc: '',
        baseDeliveryFee: 6
      },
      {
        id: 'ST003',
        name: '干洗店东门店',
        address: '某某市某某区某某街道789号',
        distance: '3.1km',
        distanceValue: 3.1,
        phone: '400-888-8890',
        hours: '10:00-20:00',
        rating: 4.5,
        serviceCount: 8,
        minPrice: 30,
        isPromotion: true,
        isRecommended: false,
        isOnline: true,
        promotionDesc: '新店开业优惠',
        baseDeliveryFee: 10
      }
    ];
    
    this.setData({
      stores: stores,
      originalStores: stores
    });
  },

  // 加载用户地址
  loadUserAddress() {
    // 模拟用户地址
    const userInfo = app.globalData.userInfo;
    if (userInfo && userInfo.address) {
      this.setData({ userAddress: userInfo.address });
    } else {
      this.setData({
        userAddress: '某某市某某区某某小区'
      });
    }
  },

  // 查询配送服务商
  async queryDeliveryFee() {
    try {
      // 尝试从后端API获取配送服务商
      const result = await app.request('/delivery/providers');
      
      if (result.success && result.data && result.data.length > 0) {
        const providers = result.data.map(p => ({
          id: p.id || p.providerId,
          name: p.name || p.providerName,
          logo: app.delivery.getProviderIcon(p.id || p.providerId),
          estimatedTime: p.estimatedTime || '30-40分钟',
          fee: p.fee || p.price || 10,
          rating: p.rating || 4.5,
          discount: p.discount || p.coupon || 0
        }));
        
        this.setData({
          deliveryProviders: providers,
          selectedDeliveryProvider: providers[0]
        });
        
        console.log('[配送服务商] 从API加载成功:', providers.length, '个服务商');
      } else {
        this.loadDefaultDeliveryProviders();
      }
    } catch (error) {
      console.error('[配送服务商] 加载失败:', error);
      this.loadDefaultDeliveryProviders();
    }
  },
  
  // 加载默认配送服务商（后备方案）
  loadDefaultDeliveryProviders() {
    const providers = [
      {
        id: 'meituan',
        name: '美团跑腿',
        logo: '🛵',
        estimatedTime: '25-35分钟',
        fee: 10,
        rating: 4.8,
        discount: 2
      },
      {
        id: 'dada',
        name: '达达配送',
        logo: '🚚',
        estimatedTime: '35-45分钟',
        fee: 8,
        rating: 4.5,
        discount: 1
      }
    ];
    
    this.setData({
      deliveryProviders: providers,
      selectedDeliveryProvider: providers[0]
    });
  },

  // 选择排序方式
  onSortChange(e) {
    const sortId = e.currentTarget.dataset.id;
    
    // 更新排序选项状态
    const sortOptions = this.data.sortOptions.map(option => ({
      ...option,
      active: option.id === sortId
    }));
    
    this.setData({ sortOptions });
    this.sortStores(sortId);
  },

  // 排序门店
  sortStores(sortId) {
    let stores = [...this.data.originalStores];
    
    switch (sortId) {
      case 'price':
        // 价格最优：按最低价升序
        stores.sort((a, b) => a.minPrice - b.minPrice);
        break;
      case 'distance':
        // 距离最近：按距离升序
        stores.sort((a, b) => a.distanceValue - b.distanceValue);
        break;
      case 'rating':
        // 推荐优先：按评分降序
        stores.sort((a, b) => b.rating - a.rating);
        break;
    }
    
    this.setData({ stores });
  },

  // 切换筛选条件
  onFilterChange(e) {
    const filterType = e.currentTarget.dataset.type;
    const checked = e.detail.value.length > 0;
    
    const filterOptions = { ...this.data.filterOptions };
    
    if (filterType === 'promotion') {
      filterOptions.isPromotion = checked;
    } else if (filterType === 'online') {
      filterOptions.isOnline = checked;
    }
    
    this.setData({ filterOptions });
    this.applyFilters();
  },

  // 应用筛选
  applyFilters() {
    let stores = [...this.data.originalStores];
    
    // 筛选促销门店
    if (this.data.filterOptions.isPromotion) {
      stores = stores.filter(store => store.isPromotion);
    }
    
    // 筛选营业中
    if (this.data.filterOptions.isOnline) {
      stores = stores.filter(store => store.isOnline);
    }
    
    // 应用当前排序
    const activeSort = this.data.sortOptions.find(o => o.active);
    if (activeSort) {
      this.sortStores(activeSort.id);
    } else {
      this.setData({ stores });
    }
  },

  // 选择门店
  onSelectStore(e) {
    const storeId = e.currentTarget.dataset.id;
    const store = this.data.stores.find(s => s.id === storeId || s.storeId === storeId);
    
    if (!store) {
      app.showToast('门店信息不存在', 'none');
      return;
    }
    
    if (!store.isOnline) {
      app.showToast('该门店暂未营业', 'none');
      return;
    }
    
    // 保存选中的门店到全局（确保storeId正确）
    app.globalData.selectedStore = {
      ...store,
      storeId: store.storeId || store.id  // 统一使用storeId
    };
    app.globalData.selectedServices = this.data.serviceDetails;
    app.globalData.serviceTotalPrice = this.data.serviceTotalPrice;
    
    console.log('[选择门店] 已保存:', app.globalData.selectedStore);
    
    // 跳转到配送方式选择页面
    wx.navigateTo({
      url: '/pages/order/delivery/index'
    });
  },

  // 查看门店详情
  onViewStoreDetail(e) {
    const storeId = e.currentTarget.dataset.id;
    const store = this.data.stores.find(s => s.id === storeId);
    
    if (store) {
      wx.showModal({
        title: store.name,
        content: `📍 ${store.address}\n📞 ${store.phone}\n⏰ ${store.hours}\n⭐ 评分: ${store.rating}\n服务项目: ${store.serviceCount}项`,
        showCancel: false,
        confirmText: '知道了'
      });
    }
  },

  // 联系门店
  onContactStore(e) {
    const phone = e.currentTarget.dataset.phone;
    wx.makePhoneCall({
      phoneNumber: phone,
      fail: () => {
        app.showToast('拨打电话失败', 'none');
      }
    });
  },

  // 暂不选择门店（跳过）
  onSkipStore() {
    wx.showModal({
      title: '确认跳过门店选择',
      content: '您可以选择暂不指定门店，系统将自动分配最近的门店为您服务。配送费用将根据您的位置自动计算。',
      confirmText: '确认跳过',
      cancelText: '返回选择',
      success: (res) => {
        if (res.confirm) {
          // 清空门店选择
          app.globalData.selectedStore = null;
          app.globalData.selectedServices = this.data.serviceDetails;
          app.globalData.serviceTotalPrice = this.data.serviceTotalPrice;
          
          // 跳转到配送方式选择页面
          wx.navigateTo({
            url: '/pages/order/delivery/index'
          });
        }
      }
    });
  }
});
