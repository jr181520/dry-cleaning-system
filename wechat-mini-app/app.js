App({
  onLaunch(options) {
    console.log('小程序启动', options);
    
    // 检查是否是扫码进入（小程序码场景）
    this.handleScanEntry(options);
    
    // 仅同步恢复缓存，onLaunch 必须极速返回
    // 所有网络操作推迟到 onShow（框架已就绪）
    this._restoreCache();
    this._firstShow = true;
  },
  
  onShow(options) {
    console.log('小程序显示', options);
    
    // 如果是扫码进入，更新扫码数据
    if (options.query && (options.query.id || options.query.scene)) {
      this.handleScanEntry(options);
    }
    
    // 检查取件码
    if (options.query && options.query.code) {
      this.globalData.pendingPickupCode = options.query.code;
    }
    
    // 首次 onShow：执行延迟初始化（框架已完全就绪，不会 timeout）
    if (this._firstShow) {
      this._firstShow = false;
      // 大延迟，确保所有页面 onLoad/onShow 已完成
      setTimeout(() => {
        this.loadModuleConfig().catch(() => {});
        this.login();
      }, 800);
    }
    
    // 数据同步放在首次初始化之后
    if (this.globalData.isLoggedIn) {
      setTimeout(() => this.syncAllData(), 2000);
    }
  },
  
  // 处理扫码进入
  handleScanEntry(options) {
    const { query, scene } = options;
    console.log('[扫码进入] scene:', scene, 'query:', query);
    
    // 优先使用query参数
    if (query) {
      // 小程序码参数：id=订单ID&s=门店ID&a=金额
      if (query.id) {
        console.log('[扫码进入] 订单支付场景:', query);
        this.globalData.scanPayOrder = {
          orderId: query.id,
          storeId: query.s || '',
          amount: parseFloat(query.a) || 0
        };
      }
      // 门店二维码参数
      else if (query.store) {
        console.log('[扫码进入] 门店场景:', query.store);
        this.globalData.scanStoreId = query.store;
      }
      // 取件码
      else if (query.code) {
        console.log('[扫码进入] 取件码:', query.code);
        this.globalData.pendingPickupCode = query.code;
      }
    }
    
    // 处理scene参数（部分场景可能通过scene传递）
    if (scene && !query) {
      try {
        // scene参数可能是URL编码的JSON
        let sceneData = decodeURIComponent(scene);
        
        // 检查是否是URL参数格式 (id=xxx&s=xxx&a=xxx)
        if (sceneData.includes('=')) {
          const params = new URLSearchParams(sceneData);
          if (params.has('id')) {
            this.globalData.scanPayOrder = {
              orderId: params.get('id'),
              storeId: params.get('s') || '',
              amount: parseFloat(params.get('a')) || 0
            };
          }
        } 
        // 如果scene直接是订单ID（无=符号），直接作为订单ID使用
        else if (sceneData && sceneData.length > 5) {
          console.log('[扫码进入] scene直接作为订单ID:', sceneData);
          this.globalData.scanPayOrder = {
            orderId: sceneData,
            storeId: '',
            amount: 0
          };
        }
      } catch (e) {
        console.error('[扫码进入] scene解析失败:', e);
        // 尝试直接使用scene作为订单ID
        if (scene && scene.length > 5) {
          this.globalData.scanPayOrder = {
            orderId: scene,
            storeId: '',
            amount: 0
          };
        }
      }
    }
  },
  
  // 清除扫码数据
  clearScanData() {
    this.globalData.scanPayOrder = null;
    this.globalData.scanStoreId = null;
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
      const resolved = { value: false };
      const done = (val) => { if (!resolved.value) { resolved.value = true; resolve(val); } };
      
      wx.request({
        url: this.globalData.apiBaseUrl + '/system/modules',
        method: 'GET',
        timeout: 4000,
        header: {
          'content-type': 'application/json',
          'Authorization': this.globalData.token ? `Bearer ${this.globalData.token}` : ''
        },
        success: res => {
          if (res.data && res.data.success) {
            done(res.data.data);
          } else {
            done(null);
          }
        },
        fail: () => done(null)
      });
      
      // 4秒安全兜底，防止 wx.request 永不回调
      setTimeout(() => done(null), 4000);
    });
  },
  
  // 更新TabBar
  updateTabBar() {
    const modules = this.globalData.enabledModules || [];
    
    let tabList = [
      { pagePath: 'pages/index/index', text: '首页' },
      { pagePath: 'pages/orders/index', text: '订单' }
    ];
    
    if (modules.some(m => m.name === 'cleaning')) {
      tabList.push({ pagePath: 'pages/services/list/index', text: '服务' });
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
    // 扫码相关
    scanPayOrder: null,    // 扫码支付订单信息
    scanStoreId: null,     // 扫码门店ID
    // 订单相关
    currentOrder: null,    // 当前订单（用于支付页面）
    orders: [],           // 订单列表
    // API配置
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
  
  // 同步恢复缓存（极快，不阻塞 onLaunch） — 供 onLaunch 和 login 复用
  _restoreCache() {
    const savedUserInfo = wx.getStorageSync('userInfo');
    const savedToken = wx.getStorageSync('token');
    if (savedUserInfo && savedUserInfo.openid) {
      this.globalData.userInfo = savedUserInfo;
      this.globalData.token = savedToken;
      this.globalData.isLoggedIn = true;
      console.log('[登录] 从缓存恢复登录状态，openid:', savedUserInfo.openid);
      return true;
    }
    return false;
  },

  // 登录（运行时异步调用，不阻塞 onLaunch）
  login() {
    // 如果 _restoreCache 已恢复，不再重复
    if (this.globalData.isLoggedIn) return;
    
    // 安全兜底：3秒后强制使用模拟登录（缩短等待时间）
    let loginDone = false;
    const forceMockTimeout = setTimeout(() => {
      if (!loginDone) {
        console.warn('[登录] wx.login 超时，强制使用模拟登录');
        loginDone = true;
        this.mockLogin();
      }
    }, 3000);
    
    const finishLogin = () => {
      loginDone = true;
      clearTimeout(forceMockTimeout);
    };
    
    wx.login({
      success: res => {
        if (res.code) {
          console.log('[登录] 微信登录成功，code:', res.code);
          this.request('/auth/wxmini-login', {
            code: res.code
          }, 'POST').then(data => {
            finishLogin();
            if (data.openid) {
              const userInfo = {
                openid: data.openid,
                sessionKey: data.session_key,
                ...data.user
              };
              this.globalData.userInfo = userInfo;
              this.globalData.token = data.token;
              this.globalData.isLoggedIn = true;
              
              wx.setStorageSync('userInfo', userInfo);
              wx.setStorageSync('token', data.token);
              
              console.log('[登录] 完成，openid:', data.openid);
            } else {
              console.warn('[登录] 后端未返回openid，使用模拟登录');
              this.mockLogin();
            }
          }).catch(err => {
            finishLogin();
            console.error('[登录] 请求失败:', err);
            this.mockLogin();
          });
        }
      },
      fail: err => {
        finishLogin();
        console.error('[登录] wx.login失败:', err);
        this.mockLogin();
      }
    });
  },
  
  // 模拟登录（用于开发测试）
  mockLogin() {
    const mockOpenid = 'oMini_' + Date.now();
    const mockUserInfo = {
      openid: mockOpenid,
      nickname: '测试用户',
      sessionKey: 'mock_session',
      ...wx.getStorageSync('userInfo') || {}
    };
    
    this.globalData.userInfo = mockUserInfo;
    this.globalData.token = 'mock_token_' + mockOpenid;
    this.globalData.isLoggedIn = true;
    
    // 保存到本地存储
    wx.setStorageSync('userInfo', mockUserInfo);
    wx.setStorageSync('token', this.globalData.token);
    
    console.log('[登录] 模拟登录完成，openid:', mockOpenid);
  },
  
  // ============================================================
  // 统一数据同步（跨平台数据一致性）
  // 小程序每次 onShow 调用此方法，以后端为权威数据源
  // ============================================================
  async syncAllData() {
    if (!this.globalData.isLoggedIn) {
      console.log('[同步] 未登录，跳过数据同步');
      return;
    }
    
    const userInfo = this.globalData.userInfo || {};
    const userId = userInfo._id || userInfo.id || userInfo.openid;
    
    if (!userId) {
      console.log('[同步] 无用户标识，跳过同步');
      return;
    }
    
    // 获取已保存的手机号（用于跨平台匹配C端订单）
    const deliveryInfo = wx.getStorageSync('userDeliveryInfo') || {};
    const savedPhone = deliveryInfo.contactPhone || userInfo.phone || '';
    console.log('[同步] 🔍 用户标识 userId:', userId, '手机号:', savedPhone, '来源:', {
      deliveryPhone: deliveryInfo.contactPhone,
      userPhone: userInfo.phone
    });

    try {
      // 构建同步 URL，传入手机号用于跨平台订单匹配
      let syncUrl = `/sync/all?types=user,orders,member,delivery`;
      if (savedPhone) {
        syncUrl += `&phone=${encodeURIComponent(savedPhone)}`;
      }
      
      const data = await this.request(syncUrl, {}, 'GET');
      
      if (!data || !data.success) return;
      
      const serverData = data.data;
      let syncedItems = [];
      
      // 1. 同步用户资料（后端数据覆盖本地）
      if (serverData.user) {
        const merged = {
          ...wx.getStorageSync('userInfo') || {},
          name: serverData.user.name || '',
          nickname: serverData.user.name || serverData.user.nickname || '',
          avatar: serverData.user.avatar || '',
          phone: serverData.user.phone || '',
          gender: serverData.user.gender !== undefined ? serverData.user.gender : 0,
          birthday: serverData.user.birthday || '',
          _id: serverData.user._id || '',
          openid: serverData.user.openid || (wx.getStorageSync('userInfo') || {}).openid || '',
          creditScore: serverData.user.creditScore,
          userNo: serverData.user.userNo || ''
        };
        wx.setStorageSync('userInfo', merged);
        this.globalData.userInfo = merged;
        syncedItems.push('用户');
      }
      
      // 2. 同步会员信息
      if (serverData.member) {
        wx.setStorageSync('memberInfo', serverData.member);
        syncedItems.push('会员');
      }
      
      // 3. 同步订单数据
      if (serverData.orders) {
        this.globalData.orders = serverData.orders;
        wx.setStorageSync('orders', serverData.orders);
        // 通知当前页面刷新
        if (this.syncCallback) {
          this.syncCallback(serverData.orders);
        }
        syncedItems.push(`订单(${serverData.orders.length})`);
      }
      
      // 4. 同步配送信息
      if (serverData.delivery) {
        const dl = serverData.delivery.savedInfo || serverData.delivery.defaultAddress;
        if (dl) {
          const existing = wx.getStorageSync('userDeliveryInfo') || {};
          wx.setStorageSync('userDeliveryInfo', { ...existing, ...dl });
          syncedItems.push('配送');
        }
      }
      
      if (syncedItems.length > 0) {
        console.log(`[同步] ✅ ${syncedItems.join('、')} 已同步`);
      }
    } catch (error) {
      // 静默降级：网络失败时使用本地缓存
      console.log('[同步] 跳过（使用本地数据）:', error && error.error || error);
    }
  },
  
  // 兼容旧方法名
  syncOrders() {
    this.syncAllData();
  },
  
  // 监听同步完成（供页面注册回调）
  onOrdersSynced(callback) {
    this.syncCallback = callback;
  },
  
  // 封装请求方法（支持mock降级+硬超时保护）
  request(url, data = {}, method = 'GET') {
    const fullUrl = this.globalData.apiBaseUrl + url;
    console.log('[API请求]', method, fullUrl, data);
    
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (action, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(hardTimeout);
        action(value);
      };
      
      // 硬超时兜底：3.5 秒后强制结束，防止 wx.request 不回调解锁 Promise
      const hardTimeout = setTimeout(() => {
        console.warn('[API硬超时] 强制结束', url);
        const mockData = this.getMockResponse(url, data, method);
        if (mockData) {
          finish(resolve, mockData);
        } else {
          finish(resolve, { success: false, data: null, error: 'timeout' });
        }
      }, 3500);
      
      wx.request({
        url: fullUrl,
        data: data,
        method: method,
        timeout: 3000,
        header: {
          'content-type': 'application/json',
          'Authorization': this.globalData.token ? `Bearer ${this.globalData.token}` : ''
        },
        success: res => {
          console.log('[API响应]', url, 'status:', res.statusCode);
          if (res.statusCode === 200) {
            finish(resolve, res.data);
          } else if (res.statusCode === 401) {
            console.warn('[API] Token过期，清除登录状态');
            wx.removeStorageSync('userInfo');
            wx.removeStorageSync('token');
            finish(reject, { success: false, error: '登录已过期，请重新打开小程序' });
          } else {
            finish(reject, res.data || { success: false, error: '请求失败' });
          }
        },
        fail: err => {
          console.warn('[API请求失败]', url, err.errMsg || err);
          const mockData = this.getMockResponse(url, data, method);
          if (mockData) {
            console.log('[Mock降级] 使用模拟数据:', url);
            finish(resolve, mockData);
          } else {
            finish(reject, { success: false, error: err.errMsg || '网络请求失败' });
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

    // 获取模拟服务商数据（与C端保持一致，含solo/shared双模式定价）
    getMockProviders() {
      return [
        { id: 'meituan', name: '美团跑腿', icon: '🛵', rating: 4.9, estimatedTime: '30-45分钟', pricing: { solo: { originalFee: 15, discount: 3, actualFee: 12 }, shared: { originalFee: 9.75, discount: 6.75, actualFee: 8.25 } } },
        { id: 'jd', name: '京东秒送', icon: '🚚', rating: 4.8, estimatedTime: '35-50分钟', pricing: { solo: { originalFee: 18, discount: 0, actualFee: 18 }, shared: { originalFee: 10.8, discount: 7.2, actualFee: 10.8 } } },
        { id: 'sf', name: '顺丰跑腿', icon: '✈️', rating: 4.9, estimatedTime: '40-60分钟', pricing: { solo: { originalFee: 20, discount: 5, actualFee: 15 }, shared: { originalFee: 14, discount: 9, actualFee: 10 } } },
        { id: 'taobao', name: '淘宝闪购', icon: '🛒', rating: 4.7, estimatedTime: '30-50分钟', pricing: { solo: { originalFee: 16, discount: 3, actualFee: 13 }, shared: { originalFee: 9.92, discount: 9.08, actualFee: 9.92 } } }
      ];
    },

    // 查询配送服务商（使用后端 /api/delivery/quotes 获取实时报价）
    async queryProviders(params) {
      try {
        const baseUrl = this.globalData.apiBaseUrl;
        const res = await new Promise((resolve) => {
          wx.request({
            url: `${baseUrl}/delivery/quotes`,
            method: 'POST',
            data: {
              distance: params.distance || 3,
              serviceTotal: params.serviceTotal || 0,
              isNewUser: params.isNewUser || false
            },
            header: {
              'content-type': 'application/json',
              'Authorization': this.globalData.token ? `Bearer ${this.globalData.token}` : ''
            },
            success: r => resolve(r),
            fail: () => resolve({ data: null })
          });
        });

        if (res.data && res.data.success && res.data.data && res.data.data.length > 0) {
          return {
            success: true,
            providers: res.data.data,
            recommended: null
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