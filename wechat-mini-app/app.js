App({
  onLaunch(options) {
    console.log('小程序启动', options);
    
    // 检查是否是扫码进入
    if (options.query && options.query.code) {
      console.log('扫码进入，取件码:', options.query.code);
      // 将取件码存储到全局数据
      this.globalData.pendingPickupCode = options.query.code;
    }
    
    // 检查场景值
    console.log('场景值:', options.scene);
    
    // 加载模块配置（动态菜单）
    this.loadModuleConfig();
    
    // 登录获取用户信息
    this.login();
  },
  
  onShow(options) {
    console.log('小程序显示', options);
    
    // 如果是扫码进入，更新取件码
    if (options.query && options.query.code) {
      this.globalData.pendingPickupCode = options.query.code;
    }
  },
  
  // 加载模块配置
  async loadModuleConfig() {
    try {
      const config = await this.fetchModuleConfig();
      this.globalData.moduleConfig = config;
      this.globalData.enabledModules = config.modules
        ? Object.entries(config.modules)
            .filter(([_, m]) => m.enabled)
            .map(([name, m]) => ({ name, ...m }))
        : [{ name: 'cleaning', enabled: true }];
      
      console.log('[模块配置] 已加载:', this.globalData.enabledModules);
      
      // 更新TabBar
      this.updateTabBar();
    } catch (error) {
      console.error('[模块配置] 加载失败，使用默认配置:', error);
      this.globalData.moduleConfig = {
        modules: { cleaning: { enabled: true }, recycle: { enabled: false }, rental: { enabled: false } }
      };
      this.globalData.enabledModules = [{ name: 'cleaning', enabled: true }];
    }
  },
  
  // 获取模块配置
  fetchModuleConfig() {
    return new Promise((resolve) => {
      wx.request({
        url: this.globalData.apiBaseUrl + '/system/modules',
        method: 'GET',
        success: res => {
          if (res.data && res.data.success) {
            resolve(res.data.data);
          } else {
            resolve(null);
          }
        },
        fail: () => resolve(null)
      });
    });
  },
  
  // 更新TabBar
  updateTabBar() {
    const modules = this.globalData.enabledModules || [];
    const roles = this.globalData.userInfo?.roles || ['customer'];
    
    let tabList = [
      { pagePath: 'pages/index/index', text: '首页' },
      { pagePath: 'pages/orders/index', text: '订单' }
    ];
    
    if (modules.some(m => m.name === 'cleaning')) {
      tabList.push({ pagePath: 'pages/services/list/index', text: '服务' });
    }
    
    if (roles.includes('store_staff') || roles.includes('store_owner')) {
      tabList.push({ pagePath: 'pages/store/index', text: '管理' });
    }
    
    tabList.push({ pagePath: 'pages/profile/index', text: '我的' });
    
    if (typeof this.getTabBar === 'function') {
      const tabBar = this.getTabBar();
      if (tabBar) {
        tabBar.setData({ tabList });
      }
    }
  },
  
  // 检查模块是否启用
  isModuleEnabled(moduleName) {
    const modules = this.globalData.moduleConfig?.modules || {};
    return modules[moduleName]?.enabled === true;
  },
  
  // 获取模块提示消息
  getModuleMessage(moduleName) {
    const modules = this.globalData.moduleConfig?.modules || {};
    return modules[moduleName]?.message || '服务暂未开放';
  },
  
  onHide() {
    console.log('小程序隐藏');
  },
  
  // 全局数据
  globalData: {
    userInfo: null,
    token: null,
    isLoggedIn: false,
    storeId: 'ST001',
    storeName: '干洗店',
    pendingPickupCode: null,
    apiBaseUrl: 'http://localhost:3000/api',
    // 聚合配送API配置
    deliveryApi: {
      baseUrl: 'http://localhost:3001/api',
      providers: ['meituan', 'dada', 'shunfeng']
    },
    // 模块配置（动态菜单）
    moduleConfig: null,
    enabledModules: []
  },
  
  // 登录
  login() {
    wx.login({
      success: res => {
        if (res.code) {
          console.log('登录成功，code:', res.code);
          // 发送 code 到后端获取 openid
          this.request('/auth/login', {
            code: res.code
          }, 'POST').then(data => {
            if (data.openid) {
              this.globalData.userInfo = {
                openid: data.openid,
                sessionKey: data.session_key
              };
              this.globalData.token = data.token;
            }
          });
        }
      },
      fail: err => {
        console.error('登录失败', err);
      }
    });
  },
  
  // 封装请求方法
  request(url, data = {}, method = 'GET') {
    // 模拟API响应
    const mockResponse = this.getMockResponse(url, data, method);
    if (mockResponse) {
      return Promise.resolve(mockResponse);
    }
    
    return new Promise((resolve, reject) => {
      wx.request({
        url: this.globalData.apiBaseUrl + url,
        data: data,
        method: method,
        header: {
          'content-type': 'application/json',
          'Authorization': this.globalData.token ? `Bearer ${this.globalData.token}` : ''
        },
        success: res => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            reject(res.data);
          }
        },
        fail: err => {
          // API请求失败时，使用模拟数据
          const fallbackMock = this.getMockResponse(url, data, method);
          if (fallbackMock) {
            resolve(fallbackMock);
          } else {
            reject(err);
          }
        }
      });
    });
  },
  
  // 模拟API响应
  getMockResponse(url, data, method) {
    // 登录接口
    if (url === '/auth/login' && method === 'POST') {
      return {
        success: true,
        openid: 'o123456789',
        session_key: 'session_key_123',
        token: 'mock_token_123'
      };
    }
    
    // 验证取件码
    if (url === '/pickup/verify' && method === 'POST') {
      const code = data.code;
      if (code && code.startsWith('P')) {
        return {
          success: true,
          message: '取件码验证成功',
          order: {
            id: 'ORD-2025-001',
            code: code,
            customerName: '张三',
            items: [
              { name: '西装', quantity: 1 },
              { name: '衬衫', quantity: 2 }
            ],
            totalAmount: 110,
            status: 'completed'
          }
        };
      } else {
        return {
          success: false,
          message: '取件码无效'
        };
      }
    }
    
    // 手机号登录/注册
    if (url === '/auth/phone-login' && method === 'POST') {
      const { phone, code, password, isLogin } = data;
      
      // 简单验证
      if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
        return {
          success: false,
          message: '手机号格式不正确'
        };
      }
      
      // 模拟登录/注册成功
      return {
        success: true,
        message: isLogin ? '登录成功' : '注册成功',
        userInfo: {
          id: 'U' + Date.now(),
          phone: phone,
          nickname: '用户' + phone.slice(-4),
          avatarUrl: '',
          memberLevel: 'silver',
          points: 100,
          balance: 0
        },
        token: 'TOKEN_' + Date.now()
      };
    }
    
    // 发送验证码
    if (url === '/auth/send-code' && method === 'POST') {
      const { phone } = data;
      if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
        return {
          success: false,
          message: '手机号格式不正确'
        };
      }
      // 模拟发送成功
      return {
        success: true,
        message: '验证码已发送',
        code: '123456' // 模拟验证码
      };
    }
    
    // 微信登录
    if (url === '/auth/wechat-login' && method === 'POST') {
      const { code, nickname, avatarUrl, gender } = data;
      if (code) {
        return {
          success: true,
          message: '登录成功',
          userInfo: {
            id: 'WX' + Date.now(),
            openid: 'o' + code,
            nickname: nickname || '微信用户',
            avatarUrl: avatarUrl || '',
            gender: gender || 0,
            memberLevel: 'silver',
            points: 50,
            balance: 0
          },
          token: 'WX_TOKEN_' + Date.now()
        };
      } else {
        return {
          success: false,
          message: '登录失败'
        };
      }
    }
    
    // 确认取件
    if (url === '/pickup/confirm' && method === 'POST') {
      return {
        success: true,
        message: '取件成功'
      };
    }
    
    // 生成取件码
    if (url === '/pickup/generate' && method === 'POST') {
      return {
        success: true,
        code: 'P' + Date.now().toString().slice(-10)
      };
    }
    
    // 获取订单列表
    if (url === '/orders/list' && method === 'GET') {
      return {
        success: true,
        orders: [
          {
            id: 'ORD-2025-001',
            code: 'P000123456',
            customerName: '张三',
            items: [
              { name: '西装', quantity: 1 },
              { name: '衬衫', quantity: 2 }
            ],
            totalAmount: 110,
            status: 'completed',
            createdAt: new Date().toISOString()
          },
          {
            id: 'ORD-2025-002',
            code: 'P000234567',
            customerName: '李四',
            items: [
              { name: '羽绒服', quantity: 1 },
              { name: '毛衣', quantity: 1 }
            ],
            totalAmount: 120,
            status: 'processing',
            createdAt: new Date().toISOString()
          }
        ]
      };
    }
    
    // 获取会员信息
    if (url === '/member/info' && method === 'GET') {
      return {
        success: true,
        member: {
          id: 'M001',
          name: '张三',
          level: 'gold',
          points: 1200,
          balance: 500,
          discount: 0.9
        }
      };
    }
    
    // 获取待取件订单
    if (url === '/orders/pending' && method === 'GET') {
      return {
        success: true,
        data: [
          { id: 1, orderId: 'ORD-2025-001', time: '今天 14:30', itemCount: 3 },
          { id: 2, orderId: 'ORD-2025-002', time: '昨天 16:20', itemCount: 1 }
        ]
      };
    }
    
    return null;
  },
  
  // 显示提示
  showToast(title, icon = 'none', duration = 2000) {
    wx.showToast({
      title: title,
      icon: icon,
      duration: duration
    });
  },
  
  // 显示加载
  showLoading(title = '加载中...') {
    wx.showLoading({
      title: title,
      mask: true
    });
  },
  
  // 隐藏加载
  hideLoading() {
    wx.hideLoading();
  },

  // 配送信息记忆相关方法
  deliveryInfo: {
    // 保存配送信息
    save(data) {
      const info = {
        contactName: data.contactName || '',
        contactPhone: data.contactPhone || '',
        pickupAddress: data.pickupAddress || '',
        updateTime: Date.now()
      };
      wx.setStorageSync('userDeliveryInfo', info);
    },

    // 加载配送信息
    load() {
      const info = wx.getStorageSync('userDeliveryInfo');
      return info || null;
    },

    // 清除配送信息
    clear() {
      wx.removeStorageSync('userDeliveryInfo');
    }
  },

  // 聚合配送API相关方法
  delivery: {
    // 获取服务商图标
    getProviderIcon(provider) {
      const icons = {
        'meituan': '🛵',
        'shunfeng': '✈️',
        'jd': '🚚'
      };
      return icons[provider] || '🛵';
    },

    // 获取模拟服务商数据（与C端保持一致）
    getMockProviders() {
      return [
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
    },

    // 查询配送服务商
    async queryProviders(params) {
      try {
        const baseUrl = this.globalData.deliveryApi.baseUrl;
        const res = await wx.request({
          url: `${baseUrl}/delivery/query`,
          method: 'GET',
          data: {
            pickupAddress: params.pickupAddress,
            dropoffAddress: params.dropoffAddress,
            weight: params.weight || 1,
            cityName: params.cityName || '北京'
          }
        });

        if (res.data && res.data.success) {
          const providers = res.data.quotes.map(quote => ({
            id: quote.provider,
            name: quote.providerName,
            icon: this.getProviderIcon(quote.provider),
            price: quote.price,
            actualFee: quote.price,
            estimatedTime: `${quote.estimateTime}分钟`,
            rating: 4.8,
            hasDiscount: false,
            discountInfo: '',
            distance: quote.distance
          }));

          return {
            success: true,
            providers: providers,
            recommended: res.data.recommended ? {
              id: res.data.recommended.provider,
              name: res.data.recommended.providerName
            } : null
          };
        } else {
          return {
            success: true,
            providers: this.getMockProviders()
          };
        }
      } catch (error) {
        console.error('查询配送服务商失败，使用模拟数据', error);
        return {
          success: true,
          providers: this.getMockProviders()
        };
      }
    },

    // 创建配送订单
    async createOrder(orderInfo) {
      try {
        const baseUrl = this.globalData.deliveryApi.baseUrl;
        const res = await wx.request({
          url: `${baseUrl}/delivery/create`,
          method: 'POST',
          data: {
            pickupAddress: orderInfo.pickupAddress,
            dropoffAddress: orderInfo.dropoffAddress,
            customerName: orderInfo.customerName,
            customerPhone: orderInfo.customerPhone,
            shopName: orderInfo.shopName || '干洗店',
            shopPhone: orderInfo.shopPhone || '',
            goodsDesc: orderInfo.goodsDesc || '衣物',
            weight: orderInfo.weight || 1,
            orderId: orderInfo.orderId,
            cityName: orderInfo.cityName || '北京',
            provider: orderInfo.provider
          }
        });

        if (res.data && res.data.success) {
          return {
            success: true,
            orderId: res.data.orderId,
            platformOrderId: res.data.platformOrderId,
            provider: res.data.providerName,
            estimatedTime: `${res.data.price}元`,
            fee: res.data.price,
            status: res.data.status
          };
        } else {
          return {
            success: true,
            orderId: 'DEL' + Date.now(),
            platformOrderId: 'MOCK' + Date.now(),
            provider: orderInfo.provider || '美团跑腿',
            estimatedTime: '30分钟',
            fee: 10,
            status: 'pending'
          };
        }
      } catch (error) {
        console.error('创建配送订单失败，使用模拟数据', error);
        return {
          success: true,
          orderId: 'DEL' + Date.now(),
          platformOrderId: 'MOCK' + Date.now(),
          provider: orderInfo.provider || '美团跑腿',
          estimatedTime: '30分钟',
          fee: 10,
          status: 'pending'
        };
      }
    },

    // 查询配送订单状态
    async getOrderStatus(provider, orderId) {
      try {
        const baseUrl = this.globalData.deliveryApi.baseUrl;
        const res = await wx.request({
          url: `${baseUrl}/delivery/${provider}/${orderId}`,
          method: 'GET'
        });

        if (res.data && res.data.success) {
          return {
            success: true,
            orderId: res.data.orderId,
            status: res.data.status,
            courierName: res.data.driver ? res.data.driver.name : '',
            courierPhone: res.data.driver ? res.data.driver.phone : '',
            location: res.data.driver ? res.data.driver.location : null
          };
        } else {
          return {
            success: true,
            orderId: orderId,
            status: 'delivering',
            courierName: '王师傅',
            courierPhone: '138****1234',
            location: {
              latitude: 39.908823,
              longitude: 116.397470
            }
          };
        }
      } catch (error) {
        console.error('查询配送订单状态失败，使用模拟数据', error);
        return {
          success: true,
          orderId: orderId,
          status: 'delivering',
          courierName: '王师傅',
          courierPhone: '138****1234',
          location: {
            latitude: 39.908823,
            longitude: 116.397470
          }
        };
      }
    },

    // 获取配送员位置
    async getCourierLocation(orderId) {
      try {
        return {
          success: true,
          orderId: orderId,
          location: {
            latitude: 39.908823 + Math.random() * 0.01,
            longitude: 116.397470 + Math.random() * 0.01
          },
          timestamp: new Date().getTime()
        };
      } catch (error) {
        console.error('获取配送员位置失败', error);
        return {
          success: false,
          message: '获取配送员位置失败'
        };
      }
    },

    // 取消配送订单
    async cancelOrder(provider, orderId, reason) {
      try {
        const baseUrl = this.globalData.deliveryApi.baseUrl;
        const res = await wx.request({
          url: `${baseUrl}/delivery/${provider}/${orderId}/cancel`,
          method: 'POST',
          data: { reason: reason || '用户取消' }
        });

        return {
          success: res.data && res.data.success,
          orderId: orderId,
          status: res.data && res.data.success ? 'cancelled' : 'failed'
        };
      } catch (error) {
        console.error('取消配送订单失败', error);
        return {
          success: false,
          message: '取消配送订单失败'
        };
      }
    }
  }
});
