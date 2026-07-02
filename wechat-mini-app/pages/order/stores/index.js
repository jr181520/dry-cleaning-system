// pages/order/stores/index.js — 智慧大脑推荐引擎
const app = getApp();

Page({
  data: {
    // 推荐选项卡
    recommendTabs: [
      { id: 'comprehensive', label: '综合推荐', icon: '🧠', active: true },
      { id: 'nearby', label: '附近推荐', icon: '📍', active: false },
      { id: 'bestPrice', label: '价优推荐', icon: '💰', active: false }
    ],
    activeTab: 'comprehensive',

    // 推荐门店列表
    comprehensive: [],
    nearby: [],
    bestPrice: [],
    displayStores: [],

    // 已选服务
    selectedServices: [],
    serviceDetails: [],
    serviceCount: 0,

    // 寄养详情
    boardingDetail: null,

    // 加载状态
    loading: true,
    loadError: false,

    // 筛选
    filterOptions: {
      isPromotion: false,
      isOnline: true
    }
  },

  onLoad(options) {
    console.log('[智慧推荐] 页面参数:', options);
    this.loadServicesData();
    this.loadBoardingData();
    this.loadRecommendations();
  },

  // 从全局数据加载服务信息
  loadServicesData() {
    const globalServices = app.globalData.selectedServices;
    if (globalServices && globalServices.length > 0) {
      this.setData({
        selectedServices: globalServices.map(s => s.id),
        serviceDetails: globalServices,
        serviceCount: globalServices.length
      });
      console.log('[智慧推荐] 已选服务:', globalServices.map(s => s.name));
    } else {
      console.warn('[智慧推荐] 无已选服务数据');
    }
  },

  // 加载寄养数据
  loadBoardingData() {
    const boardingDetail = app.globalData.boardingDetail;
    if (boardingDetail) {
      this.setData({ boardingDetail });
      console.log('[智慧推荐] 寄养详情:', boardingDetail);
    }
  },

  // 调用智慧大脑推荐API
  async loadRecommendations() {
    if (this.data.selectedServices.length === 0) {
      this.loadStoresFallback();
      return;
    }

    this.setData({ loading: true, loadError: false });

    // 读取品类上下文（从下单页传递）
    const categoryId = app.globalData.orderCategory || 'cleaning';

    try {
      const requestBody = {
        categoryId: categoryId,
        serviceIds: this.data.selectedServices,
        boardingDetail: this.data.boardingDetail || null,
        lat: app.globalData.latitude || null,
        lng: app.globalData.longitude || null
      };

      console.log('[智慧推荐] 请求参数:', JSON.stringify(requestBody));

      // 使用通用门店推荐接口，categoryId 在 body 中传递
      const result = await app.request('/cleaning/stores/recommend', requestBody, 'POST');

      if (result.success && result.data) {
        const formatList = function(list) {
          return (list || []).map(function(store) {
            return {
              id: store.storeId,
              storeId: store.storeId,
              name: store.storeName,
              address: store.address || '',
              distance: store.distance ? store.distance.toFixed(1) + 'km' : '未知',
              distanceValue: store.distance || 0,
              phone: store.phone || '',
              rating: store.rating || 4.5,
              isOnline: store.isOnline !== false,
              isRecommended: store.isRecommended || false,
              hasPromotion: store.hasPromotion || false,
              promotions: store.promotions || [],
              serviceCount: (store.matchedServices || []).length,
              matchedServices: store.matchedServices || [],
              serviceTotal: store.serviceTotal || 0,
              discount: store.discount || 0,
              finalPrice: store.finalPrice || 0,
              boardingConfig: store.boardingConfig || null
            };
          });
        };

        const comprehensive = formatList(result.data.comprehensive);
        const nearby = formatList(result.data.nearby);
        const bestPrice = formatList(result.data.bestPrice);

        this.setData({
          comprehensive: comprehensive,
          nearby: nearby,
          bestPrice: bestPrice,
          displayStores: comprehensive,
          loading: false
        });

        console.log('[智慧推荐] 加载成功: 综合' + comprehensive.length + ' 附近' + nearby.length + ' 价优' + bestPrice.length);
      } else {
        console.warn('[智慧推荐] API返回空数据');
        this.loadStoresFallback();
      }
    } catch (error) {
      console.error('[智慧推荐] 加载失败:', error);
      this.loadStoresFallback();
    }
  },

  // API失败时的传统加载方式
  async loadStoresFallback() {
    console.log('[智慧推荐] 使用传统方式加载门店...');
    try {
      const result = await app.request('/cleaning/stores');
      if (result.success && result.data && result.data.length > 0) {
        const stores = result.data.map(store => ({
          id: store.storeId || store.id,
          storeId: store.storeId || store.id,
          name: store.name || store.storeName,
          address: store.address || store.location || '',
          distance: store.distance ? parseFloat(store.distance).toFixed(1) + 'km' : '未知',
          distanceValue: parseFloat(store.distance) || 0,
          phone: store.phone || store.contactPhone || '',
          rating: store.rating || 4.5,
          serviceCount: store.serviceCount || 0,
          isOnline: store.status !== 'closed' && store.status !== 'offline',
          isRecommended: store.isRecommended || false,
          hasPromotion: store.hasPromotion || false,
          promotions: [],
          matchedServices: [],
          serviceTotal: 0,
          discount: 0,
          finalPrice: 0
        }));

        this.setData({
          comprehensive: stores,
          nearby: stores,
          bestPrice: stores,
          displayStores: stores,
          loading: false
        });
      } else {
        this.loadDefaultStores();
      }
    } catch (error) {
      console.error('[门店加载] 传统方式也失败:', error);
      this.loadDefaultStores();
    }
  },

  // 加载默认门店（离线兜底）
  loadDefaultStores() {
    var self = this;
    var stores = [
      {
        id: 'ST001', storeId: 'ST001',
        name: '干洗店旗舰店', address: '朝阳区建国路88号',
        distance: '1.2km', distanceValue: 1.2,
        phone: '400-888-8888', rating: 4.8,
        serviceCount: 0, isOnline: true,
        isRecommended: true, hasPromotion: true,
        promotions: [{ name: '全场9折' }],
        matchedServices: [], serviceTotal: 0, discount: 0, finalPrice: 0
      },
      {
        id: 'ST002', storeId: 'ST002',
        name: '干洗店中心店', address: '海淀区中关村大街1号',
        distance: '2.5km', distanceValue: 2.5,
        phone: '400-888-8889', rating: 4.6,
        serviceCount: 0, isOnline: true,
        isRecommended: true, hasPromotion: false,
        promotions: [],
        matchedServices: [], serviceTotal: 0, discount: 0, finalPrice: 0
      },
      {
        id: 'ST003', storeId: 'ST003',
        name: '干洗店东门店', address: '东城区王府井大街5号',
        distance: '3.8km', distanceValue: 3.8,
        phone: '400-888-8890', rating: 4.5,
        serviceCount: 0, isOnline: false,
        isRecommended: false, hasPromotion: false,
        promotions: [],
        matchedServices: [], serviceTotal: 0, discount: 0, finalPrice: 0
      }
    ];

    self.setData({
      comprehensive: stores,
      nearby: stores,
      bestPrice: stores,
      displayStores: stores,
      loading: false,
      loadError: true
    });
  },

  // 切换推荐选项卡
  onSwitchTab(e) {
    const tabId = e.currentTarget.dataset.id;
    if (tabId === this.data.activeTab) return;

    // 更新标签状态
    const recommendTabs = this.data.recommendTabs.map(function(tab) {
      return { id: tab.id, label: tab.label, icon: tab.icon, active: tab.id === tabId };
    });

    // 获取对应列表
    var displayStores = [];
    if (tabId === 'comprehensive') displayStores = this.data.comprehensive;
    else if (tabId === 'nearby') displayStores = this.data.nearby;
    else if (tabId === 'bestPrice') displayStores = this.data.bestPrice;

    this.setData({
      recommendTabs: recommendTabs,
      activeTab: tabId,
      displayStores: displayStores
    });

    console.log('[智慧推荐] 切换到:', tabId, '共' + displayStores.length + '家门店');
  },

  // 切换筛选条件
  onFilterChange(e) {
    const filterType = e.currentTarget.dataset.type;
    const checked = e.detail.value.length > 0;

    const filterOptions = {};
    filterOptions.isPromotion = this.data.filterOptions.isPromotion;
    filterOptions.isOnline = this.data.filterOptions.isOnline;

    if (filterType === 'promotion') {
      filterOptions.isPromotion = checked;
    } else if (filterType === 'online') {
      filterOptions.isOnline = checked;
    }

    this.setData({ filterOptions: filterOptions });
    this.applyFilters();
  },

  // 应用筛选
  applyFilters() {
    var sourceList = [];
    if (this.data.activeTab === 'comprehensive') sourceList = this.data.comprehensive;
    else if (this.data.activeTab === 'nearby') sourceList = this.data.nearby;
    else if (this.data.activeTab === 'bestPrice') sourceList = this.data.bestPrice;

    var filtered = sourceList.slice();

    if (this.data.filterOptions.isPromotion) {
      filtered = filtered.filter(function(s) { return s.hasPromotion; });
    }
    if (this.data.filterOptions.isOnline) {
      filtered = filtered.filter(function(s) { return s.isOnline; });
    }

    this.setData({ displayStores: filtered });
  },

  // 选择门店 — 更新服务价格并跳转配送页
  onSelectStore(e) {
    const storeId = e.currentTarget.dataset.id;
    const store = this.getStoreFromLists(storeId);

    if (!store) {
      app.showToast('门店信息不存在', 'none');
      return;
    }

    if (!store.isOnline) {
      app.showToast('该门店暂未营业', 'none');
      return;
    }

    if (!this.data.serviceDetails || this.data.serviceDetails.length === 0) {
      console.error('[选择门店] 错误: 服务数据为空!');
      app.showToast('请先选择服务', 'none');
      setTimeout(function() { wx.navigateBack(); }, 1500);
      return;
    }

    // 用推荐API返回的报价更新已选服务价格
    var updatedServices = this.data.serviceDetails.map(function(selSvc) {
      var match = (store.matchedServices || []).find(function(m) {
        return m.serviceId === selSvc.id || m.name === selSvc.name;
      });
      if (match) {
        selSvc.price = match.price;
        selSvc.storePrice = match.price;
      }
      return selSvc;
    });

    var updatedTotalPrice = updatedServices.reduce(function(sum, s) { return sum + (s.price || 0); }, 0);

    // 保存选中的门店到全局
    app.globalData.selectedStore = {
      id: store.storeId || store.id,
      storeId: store.storeId || store.id,
      name: store.name,
      address: store.address,
      phone: store.phone,
      rating: store.rating,
      distance: store.distance,
      distanceValue: store.distanceValue,
      isOnline: store.isOnline,
      isPromotion: store.hasPromotion,
      isRecommended: store.isRecommended,
      baseDeliveryFee: store.baseDeliveryFee || 8,
      finalPrice: store.finalPrice,
      discount: store.discount,
      serviceTotal: store.serviceTotal
    };
    app.globalData.selectedServices = updatedServices;
    app.globalData.serviceTotalPrice = updatedTotalPrice;

    console.log('[选择门店] 已选择:', store.name, '总价:', updatedTotalPrice);

    wx.navigateTo({ url: '/pages/order/delivery/index' });
  },

  // 从三个列表中查找门店
  getStoreFromLists(storeId) {
    var allLists = [this.data.comprehensive, this.data.nearby, this.data.bestPrice];
    for (var i = 0; i < allLists.length; i++) {
      var found = allLists[i].find(function(s) { return s.id === storeId || s.storeId === storeId; });
      if (found) return found;
    }
    return null;
  },

  // 查看门店详情
  onViewStoreDetail(e) {
    const storeId = e.currentTarget.dataset.id;
    const store = this.getStoreFromLists(storeId);

    if (store) {
      var promoText = '';
      if (store.promotions && store.promotions.length > 0) {
        promoText = '\n🔥 ' + store.promotions.map(function(p) { return p.name; }).join(', ');
      }
      wx.showModal({
        title: store.name,
        content: '📍 ' + store.address + '\n📞 ' + store.phone + '\n⭐ 评分: ' + store.rating + '\n📏 ' + store.distance + promoText,
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
      fail: function() {
        app.showToast('拨打电话失败', 'none');
      }
    });
  },

  // 暂不选择门店
  onSkipStore() {
    if (!this.data.serviceDetails || this.data.serviceDetails.length === 0) {
      app.showToast('请先选择服务', 'none');
      return;
    }

    wx.showModal({
      title: '确认跳过门店选择',
      content: '系统将自动分配最近的门店为您服务。配送费用将根据您的位置自动计算。',
      confirmText: '确认跳过',
      cancelText: '返回选择',
      success: function(res) {
        if (res.confirm) {
          app.globalData.selectedStore = null;
          wx.navigateTo({ url: '/pages/order/delivery/index' });
        }
      }
    });
  }
});