// pages/order/delivery/index.js
const app = getApp();

Page({
  data: {
    // 配送方式
    deliveryMethods: [
      {
        id: 'pickup', name: '自送到店', icon: '🏪',
        desc: '自行将衣物送到门店', discountText: '享9折优惠'
      },
      {
        id: 'courier', name: '跑腿上门取件', icon: '🛵',
        desc: '骑手上门取件送到门店', discountText: ''
      }
    ],
    selectedDeliveryMethod: 'pickup',
    
    // 配送服务商（跑腿方式时显示）
    deliveryProviders: [],
    selectedProvider: null,
    deliveryType: 'solo',  // solo: 一对一, shared: 拼单 — 与C端保持一致
    
    // 用户信息
    selectedStore: null,
    selectedServices: [],
    serviceTotalPrice: 0,
    contactName: '',
    userAddress: '',
    userPhone: '',
    
    // 费用明细
    originalPrice: 0,
    discount: 0,
    storeFee: 0,
    deliveryFee: 0,
    deliveryOriginalFee: 0,
    deliveryDiscount: 0,
    totalAmount: 0,
    
    // 预约时间
    timeOptions: [],
    selectedTime: null,
    selectedTimeText: ''
  },

  onLoad() {
    console.log('[配送页面] 全局数据检查:');
    console.log('[配送页面] - selectedStore:', app.globalData.selectedStore);
    console.log('[配送页面] - selectedServices:', app.globalData.selectedServices);
    console.log('[配送页面] - serviceTotalPrice:', app.globalData.serviceTotalPrice);
    
    const selectedStore = app.globalData.selectedStore;
    const selectedServices = app.globalData.selectedServices;
    const serviceTotalPrice = app.globalData.serviceTotalPrice;
    
    if (!selectedServices || selectedServices.length === 0) {
      console.error('[配送页面] 错误: 服务数据为空!');
      app.showToast('请先选择服务', 'none');
      setTimeout(() => { wx.navigateBack(); }, 1500);
      return;
    }
    
    this.setData({
      selectedStore: selectedStore,
      selectedServices: selectedServices,
      serviceTotalPrice: serviceTotalPrice,
      originalPrice: serviceTotalPrice
    });
    
    this.loadUserInfo();
    this.generateTimeOptions();
    this.loadDeliveryProviders();
    this.calculateFees();
  },

  // 加载用户信息
  loadUserInfo() {
    // 优先从记忆存储中加载
    const savedInfo = app.deliveryInfo.load();
    
    if (savedInfo) {
      this.setData({
        userAddress: savedInfo.pickupAddress || '',
        userPhone: savedInfo.contactPhone || '',
        contactName: savedInfo.contactName || ''
      });
    } else {
      // 如果没有记忆数据，使用默认数据
      const userInfo = app.globalData.userInfo;
      this.setData({
        userAddress: userInfo?.address || '',
        userPhone: userInfo?.phone || '',
        contactName: userInfo?.name || ''
      });
    }
  },

  // 生成预约时间选项
  generateTimeOptions() {
    const now = new Date();
    const options = [];
    
    // 生成今天和明天的选项
    for (let day = 0; day < 2; day++) {
      const date = new Date(now);
      date.setDate(date.getDate() + day);
      const dateStr = day === 0 ? '今天' : '明天';
      
      // 生成时间段
      const hours = day === 0 ? [14, 16, 18, 20] : [9, 11, 14, 16, 18];
      
      hours.forEach((hour, index) => {
        if (day === 0 && hour <= now.getHours()) {
          return; // 跳过已过的时间
        }
        
        const endHour = hour + 2;
        const timeText = `${dateStr} ${hour}:00-${endHour}:00`;
        
        options.push({
          id: `${day}_${hour}`,
          date: date.toISOString().split('T')[0],
          time: `${hour}:00`,
          text: timeText
        });
      });
    }
    
    this.setData({
      timeOptions: options,
      selectedTime: options[0]?.id,
      selectedTimeText: options[0]?.text
    });
  },

  // 加载配送服务商（从后端获取实时报价，含一对一/拼单两种模式）
  async loadDeliveryProviders() {
    try {
      // 获取配送距离
      let distanceKm = 3;
      if (this.data.selectedStore) {
        var distStr = (this.data.selectedStore.distance || '3km').replace(/[^0-9.]/g, '');
        var d = parseFloat(distStr);
        if (!isNaN(d) && d > 0) distanceKm = d;
      }
      
      var serviceTotal = this.data.serviceTotalPrice;
      var isNewUser = !wx.getStorageSync('hasOrderedBefore');
      
      // 调用后端 /api/delivery/quotes 获取所有服务商实时报价
      const result = await app.request('/delivery/quotes', {
        distance: distanceKm,
        serviceTotal: serviceTotal,
        isNewUser: isNewUser
      }, 'POST');
      
      if (result.success && result.data && result.data.length > 0) {
        this.setData({
          deliveryProviders: result.data,
          selectedProvider: null
        });
        console.log('[配送报价] 从后端获取实时报价成功:', result.data.length, '个服务商');
      } else {
        throw new Error('后端返回数据为空');
      }
    } catch (error) {
      console.warn('[配送报价] 获取失败，使用本地默认:', error.message || error);
      // 离线兜底：使用本地默认服务商（含solo/shared定价）
      var defaultProviders = [
        { id: 'meituan', name: '美团跑腿', icon: '🛵', rating: 4.9, estimatedTime: '30-45分钟', pricing: { solo: { originalFee: 15, discount: 3, actualFee: 12 }, shared: { originalFee: 9.75, discount: 6.75, actualFee: 8.25 } } },
        { id: 'jd', name: '京东秒送', icon: '🚚', rating: 4.8, estimatedTime: '35-50分钟', pricing: { solo: { originalFee: 18, discount: 0, actualFee: 18 }, shared: { originalFee: 10.8, discount: 7.2, actualFee: 10.8 } } },
        { id: 'sf', name: '顺丰跑腿', icon: '✈️', rating: 4.9, estimatedTime: '40-60分钟', pricing: { solo: { originalFee: 20, discount: 5, actualFee: 15 }, shared: { originalFee: 14, discount: 9, actualFee: 10 } } },
        { id: 'taobao', name: '淘宝闪购', icon: '🛒', rating: 4.7, estimatedTime: '30-50分钟', pricing: { solo: { originalFee: 16, discount: 3, actualFee: 13 }, shared: { originalFee: 9.92, discount: 9.08, actualFee: 9.92 } } }
      ];
      
      this.setData({
        deliveryProviders: defaultProviders,
        selectedProvider: null
      });
    }
    
    this.calculateFees();
  },

  // 选择配送方式
  onSelectDeliveryMethod(e) {
    const methodId = e.currentTarget.dataset.id;
    this.setData({
      selectedDeliveryMethod: methodId
    });
    this.calculateFees();
  },

  // 选择配送服务商
  onSelectProvider(e) {
    const providerId = e.currentTarget.dataset.id;
    const provider = this.data.deliveryProviders.find(p => p.id === providerId);
    
    if (provider) {
      this.setData({
        selectedDeliveryMethod: 'courier',
        selectedProvider: provider
      });
      this.calculateFees();
    }
  },
  
  // 选择配送方式（一对一/拼单）— 与C端一致
  onSelectDeliveryType(e) {
    const providerId = e.currentTarget.dataset.providerId;
    const type = e.currentTarget.dataset.type;
    const provider = this.data.deliveryProviders.find(p => p.id === providerId);
    
    if (provider) {
      this.setData({
        selectedDeliveryMethod: 'courier',
        selectedProvider: provider,
        deliveryType: type
      });
      this.calculateFees();
    }
  },

  // 选择预约时间
  onSelectTime(e) {
    const timeId = e.currentTarget.dataset.id;
    const timeOption = this.data.timeOptions.find(t => t.id === timeId);
    
    if (timeOption) {
      this.setData({
        selectedTime: timeId,
        selectedTimeText: timeOption.text
      });
    }
  },

  // 联系人姓名输入
  onContactNameInput(e) {
    this.setData({
      contactName: e.detail.value
    });
  },

  // 联系电话输入
  onPhoneInput(e) {
    this.setData({
      userPhone: e.detail.value
    });
  },

  // 取件地址输入
  onAddressInput(e) {
    this.setData({
      userAddress: e.detail.value
    });
  },

  // 计算费用明细（含一对一/拼单配送模式）— 与C端一致
  calculateFees() {
    const { selectedDeliveryMethod, selectedProvider, serviceTotalPrice, deliveryType } = this.data;
    
    let storeFee = serviceTotalPrice;
    let discount = 0;
    let deliveryFee = 0;
    let deliveryOriginalFee = 0;
    let deliveryDiscount = 0;
    
    if (selectedDeliveryMethod === 'pickup') {
      // 自送到店享受9折优惠
      discount = Math.round(serviceTotalPrice * 0.1);
      storeFee = serviceTotalPrice - discount;
      deliveryFee = 0;
    } else if (selectedProvider) {
      // 跑腿上门取件：根据deliveryType（solo/shared）获取对应价格
      var dt = deliveryType || 'solo';
      var p = selectedProvider;
      
      if (p.pricing && p.pricing[dt]) {
        deliveryFee = p.pricing[dt].actualFee;
        deliveryOriginalFee = p.pricing[dt].originalFee;
        deliveryDiscount = p.pricing[dt].discount;
      } else if (p.actualFee) {
        deliveryFee = p.actualFee;
      } else if (p.fee) {
        deliveryFee = p.fee;
      }
    }
    
    const totalAmount = storeFee + deliveryFee;
    
    this.setData({
      originalPrice: serviceTotalPrice,
      discount: discount,
      storeFee: storeFee,
      deliveryFee: deliveryFee,
      deliveryOriginalFee: deliveryOriginalFee,
      deliveryDiscount: deliveryDiscount,
      totalAmount: totalAmount
    });
  },

  // 跳转到支付页面
  onConfirmOrder() {
    if (!this.data.selectedTime) {
      app.showToast('请选择预约时间', 'none');
      return;
    }
    
    if (this.data.selectedDeliveryMethod === 'courier') {
      if (!this.data.selectedProvider) {
        app.showToast('请选择配送服务商', 'none');
        return;
      }
      if (!this.data.contactName || !this.data.contactName.trim()) {
        app.showToast('请填写联系人姓名', 'none');
        return;
      }
      if (!this.data.userPhone || !this.data.userPhone.trim()) {
        app.showToast('请填写联系电话', 'none');
        return;
      }
      if (this.data.userPhone.trim().length < 11) {
        app.showToast('请填写正确的联系电话', 'none');
        return;
      }
      if (!this.data.userAddress || !this.data.userAddress.trim()) {
        app.showToast('请填写取件地址', 'none');
        return;
      }
    }
    
    // 保存配送信息到本地存储
    app.deliveryInfo.save({
      contactName: this.data.contactName || '',
      contactPhone: this.data.userPhone || '',
      pickupAddress: this.data.userAddress || ''
    });
    
    // 保存订单数据到全局
    const deliveryMethodMap = {
      'pickup': 'store_pickup',
      'courier': 'courier'
    };
    
    const orderData = {
      store: this.data.selectedStore,
      storeAutoAssigned: !this.data.selectedStore,
      services: this.data.selectedServices,
      deliveryMethod: deliveryMethodMap[this.data.selectedDeliveryMethod] || 'store_pickup',
      deliveryType: this.data.deliveryType || 'solo',  // 一对一/拼单
      provider: this.data.selectedProvider,
      time: {
        id: this.data.selectedTime,
        text: this.data.selectedTimeText
      },
      fees: {
        originalPrice: this.data.originalPrice,
        discount: this.data.discount,
        storeFee: this.data.storeFee,
        deliveryFee: this.data.deliveryFee,
        deliveryOriginalFee: this.data.deliveryOriginalFee,
        deliveryDiscount: this.data.deliveryDiscount,
        totalAmount: this.data.totalAmount
      },
      contactName: this.data.contactName,
      userAddress: this.data.userAddress,
      userPhone: this.data.userPhone,
      createdAt: new Date().toISOString(),
      courier: this.data.selectedDeliveryMethod === 'courier' ? {
        name: this.data.selectedProvider ? 
          (this.data.selectedProvider.id === 'meituan' ? '张师傅' : 
           this.data.selectedProvider.id === 'sf' ? '李师傅' : '王师傅') : '配送员',
        phone: '138****1234',
        distance: '1.5km',
        eta: '15分钟',
        status: 'picking',
        progress: 0,
        assignedAt: new Date().toISOString()
      } : null
    };
    
    app.globalData.currentOrder = orderData;
    
    // 跳转到支付页面
    wx.navigateTo({
      url: '/pages/order/payment/index'
    });
  },

  // 查看服务商详情
  onViewProviderDetail(e) {
    const provider = e.currentTarget.dataset.provider;
    wx.showModal({
      title: provider.name,
      content: `预计送达时间：${provider.estimatedTime}\n用户评分：${provider.rating}⭐\n${provider.discountInfo || '暂无优惠活动'}`,
      showCancel: false,
      confirmText: '知道了'
    });
  }
});
