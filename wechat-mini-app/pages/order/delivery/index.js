// pages/order/delivery/index.js
const app = getApp();

Page({
  data: {
    // 配送方式
    deliveryMethods: [
      {
        id: 'pickup',
        name: '自送到店',
        icon: '🏪',
        desc: '自行将衣物送到门店',
        discount: 0.9,  // 享受9折优惠
        discountText: '享9折优惠'
      },
      {
        id: 'courier',
        name: '跑腿上门取件',
        icon: '🛵',
        desc: '骑手上门取件送到门店',
        discount: 1,
        discountText: ''
      }
    ],
    selectedDeliveryMethod: 'pickup',
    
    // 配送服务商（跑腿方式时显示）
    deliveryProviders: [],
    selectedProvider: null,
    
    // 用户信息
    selectedStore: null,
    selectedServices: [],
    serviceTotalPrice: 0,
    contactName: '',       // 联系人姓名
    userAddress: '',
    userPhone: '',
    
    // 费用明细
    originalPrice: 0,      // 原价
    discount: 0,          // 折扣金额
    storeFee: 0,           // 门店服务费
    deliveryFee: 0,        // 配送费
    totalAmount: 0,        // 总计
    
    // 预约时间
    timeOptions: [],
    selectedTime: null,
    selectedTimeText: ''
  },

  onLoad() {
    // 获取全局数据
    const selectedStore = app.globalData.selectedStore;
    const selectedServices = app.globalData.selectedServices;
    const serviceTotalPrice = app.globalData.serviceTotalPrice;
    
    if (!selectedServices || selectedServices.length === 0) {
      app.showToast('请先选择服务', 'none');
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }
    
    this.setData({
      selectedStore: selectedStore, // 可能是 null
      selectedServices: selectedServices,
      serviceTotalPrice: serviceTotalPrice,
      originalPrice: serviceTotalPrice
    });
    
    // 加载用户信息
    this.loadUserInfo();
    
    // 生成预约时间选项
    this.generateTimeOptions();
    
    // 加载配送服务商
    this.loadDeliveryProviders();
    
    // 计算初始费用
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

    // 加载配送服务商（聚合跑腿API）
  async loadDeliveryProviders() {
    try {
      // 根据是否有门店选择不同的取件地址
      const pickupAddress = this.data.selectedStore 
        ? this.data.selectedStore.address 
        : '系统自动分配最近门店';
      
      // 模拟调用聚合跑腿API
      const result = await app.delivery.queryProviders({
        pickupAddress: pickupAddress,
        userAddress: this.data.userAddress
      });
      
      if (result.success) {
        this.setData({
          deliveryProviders: result.providers,
          selectedProvider: result.providers[0]
        });
        this.calculateFees();
      }
    } catch (error) {
      console.error('加载配送服务商失败', error);
      // 使用默认数据（与C端保持一致）
      const defaultProviders = [
        {
          id: 'meituan',
          name: '美团跑腿',
          icon: '🛵',
          estimatedTime: '30-45分钟',
          fee: 12,
          actualFee: 9,
          rating: 4.9,
          hasDiscount: true,
          discountInfo: '新用户首单立减3元'
        },
        {
          id: 'jd',
          name: '京东秒送',
          icon: '🚚',
          estimatedTime: '35-50分钟',
          fee: 15,
          actualFee: 15,
          rating: 4.8,
          hasDiscount: false,
          discountInfo: ''
        },
        {
          id: 'shunfeng',
          name: '顺丰跑腿',
          icon: '✈️',
          estimatedTime: '40-60分钟',
          fee: 18,
          actualFee: 13,
          rating: 4.9,
          hasDiscount: true,
          discountInfo: '满50元减5元'
        }
      ];
      
      this.setData({
        deliveryProviders: defaultProviders,
        selectedProvider: null
      });
      this.calculateFees();
    }
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
        selectedProvider: provider
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

  // 计算费用明细
  calculateFees() {
    const { selectedDeliveryMethod, selectedProvider, serviceTotalPrice } = this.data;
    
    let storeFee = serviceTotalPrice;
    let discount = 0;
    let deliveryFee = 0;
    
    if (selectedDeliveryMethod === 'pickup') {
      // 自送到店享受9折优惠
      discount = serviceTotalPrice * 0.1;
      storeFee = Math.round(serviceTotalPrice * 0.9);
      deliveryFee = 0;
    } else {
      // 跑腿上门取件
      deliveryFee = selectedProvider?.actualFee || selectedProvider?.fee || 0;
    }
    
    const totalAmount = storeFee + deliveryFee;
    
    this.setData({
      originalPrice: serviceTotalPrice,
      discount: discount,
      storeFee: storeFee,
      deliveryFee: deliveryFee,
      totalAmount: totalAmount
    });
  },

  // 跳转到支付页面
  onConfirmOrder() {
    if (!this.data.selectedTime) {
      app.showToast('请选择预约时间', 'none');
      return;
    }
    
    if (this.data.selectedDeliveryMethod === 'courier' && !this.data.selectedProvider) {
      app.showToast('请选择配送服务商', 'none');
      return;
    }
    
    // 保存配送信息到本地存储
    app.deliveryInfo.save({
      contactName: this.data.contactName || '',
      contactPhone: this.data.userPhone || '',
      pickupAddress: this.data.userAddress || ''
    });
    
    // 保存订单数据到全局
    const orderData = {
      store: this.data.selectedStore, // 可能是 null（系统自动分配）
      storeAutoAssigned: !this.data.selectedStore, // 标记是否自动分配门店
      services: this.data.selectedServices,
      deliveryMethod: this.data.selectedDeliveryMethod,
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
        totalAmount: this.data.totalAmount
      },
      contactName: this.data.contactName,
      userAddress: this.data.userAddress,
      userPhone: this.data.userPhone,
      createdAt: new Date().toISOString(),
      // 跑腿订单配送信息
      courier: this.data.selectedDeliveryMethod === 'courier' ? {
        name: this.data.selectedProvider ? 
          (this.data.selectedProvider.id === 'meituan' ? '张师傅' : 
           this.data.selectedProvider.id === 'shunfeng' ? '李师傅' : '王师傅') : '配送员',
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
