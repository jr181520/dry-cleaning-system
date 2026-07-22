App({
  onLaunch(options) {
    console.log('[支付宝小程序] 启动', options);
    this.handleScanEntry(options);
    this._restoreCache();
    this._firstShow = true;
  },

  onShow(options) {
    console.log('[支付宝小程序] 显示', options);
    if (options.query) {
      if (options.query.id || options.query.store) {
        this.handleScanEntry(options);
      }
      if (options.query.code) {
        this.globalData.pendingPickupCode = options.query.code;
      }
    }
    if (this._firstShow) {
      this._firstShow = false;
      setTimeout(() => {
        this.loadModuleConfig().catch(() => {});
        this.login();
      }, 800);
    }
    if (this.globalData.isLoggedIn) {
      setTimeout(() => this.syncAllData(), 2000);
    }
  },

  // 扫码入口处理
  handleScanEntry(options) {
    const { query } = options;
    if (query) {
      if (query.id) {
        this.globalData.scanPayOrder = { orderId: query.id, storeId: query.s || '', amount: parseFloat(query.a) || 0 };
      } else if (query.store) {
        this.globalData.scanStoreId = query.store;
      } else if (query.code) {
        this.globalData.pendingPickupCode = query.code;
      }
    }
  },

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
        ? Object.entries(config.modules).filter(([_, m]) => m.enabled).map(([name, m]) => ({ name, ...m }))
        : [{ name: 'cleaning', enabled: true }];
      console.log('[模块配置] 已加载:', this.globalData.enabledModules);
    } catch (e) {
      console.error('[模块配置] 加载失败:', e);
      this.globalData.moduleConfig = { modules: { cleaning: { enabled: true } } };
      this.globalData.enabledModules = [{ name: 'cleaning', enabled: true }];
    }
  },

  fetchModuleConfig() {
    return new Promise((resolve) => {
      let resolved = false;
      const done = (val) => { if (!resolved) { resolved = true; resolve(val); } };

      my.request({
        url: this.globalData.apiBaseUrl + '/system/modules',
        method: 'GET',
        headers: {
          'content-type': 'application/json',
          'Authorization': this.globalData.token ? `Bearer ${this.globalData.token}` : ''
        },
        success: res => {
          if (res.data && res.data.success) done(res.data.data);
          else done(null);
        },
        fail: () => done(null)
      });
      setTimeout(() => done(null), 4000);
    });
  },

  isModuleEnabled(moduleName) {
    const modules = (this.globalData.moduleConfig || {}).modules || {};
    return (modules[moduleName] || {}).enabled === true;
  },

  // 恢复缓存
  _restoreCache() {
    try {
      var _su = my.getStorageSync({ key: 'userInfo' }) || {};
      const savedUserInfo = _su.data;
      var _st = my.getStorageSync({ key: 'token' }) || {};
      const savedToken = _st.data;
      if (savedUserInfo && savedUserInfo.userId) {
        this.globalData.userInfo = savedUserInfo;
        this.globalData.token = savedToken;
        this.globalData.isLoggedIn = true;
        console.log('[登录] 从缓存恢复登录状态');
        return true;
      }
    } catch (e) { /* 缓存不存在 */ }
    return false;
  },

  // 登录（支付宝授权）
  login() {
    return new Promise((resolve) => {
      // 先尝试缓存恢复
      if (this._restoreCache()) {
        resolve(this.globalData.userInfo);
        return;
      }
      // 支付宝授权登录
      my.getAuthCode({
        scopes: 'auth_user',
        success: (res) => {
          if (res.authCode) {
            this.request('/auth/alipay-login', { authCode: res.authCode }, 'POST')
              .then(result => {
                if (result && result.success) {
                  const user = result.data || result.user || {};
                  this.globalData.userInfo = user;
                  this.globalData.token = result.token || '';
                  this.globalData.isLoggedIn = true;
                  my.setStorageSync({ key: 'userInfo', data: user });
                  my.setStorageSync({ key: 'token', data: result.token || '' });
                  console.log('[登录] 支付宝授权登录成功');
                  resolve(user);
                } else {
                  this._mockLogin();
                  resolve(this.globalData.userInfo);
                }
              })
              .catch(() => {
                this._mockLogin();
                resolve(this.globalData.userInfo);
              });
          } else {
            this._mockLogin();
            resolve(this.globalData.userInfo);
          }
        },
        fail: () => {
          this._mockLogin();
          resolve(this.globalData.userInfo);
        }
      });
    });
  },

  _mockLogin() {
    const mockUser = {
      userId: 'mock_alipay_' + Date.now().toString(36),
      nickname: '支付宝用户',
      phone: '',
      avatar: '',
      alipayUserId: 'mock_zfb_user'
    };
    this.globalData.userInfo = mockUser;
    this.globalData.token = 'mock-token-alipay-' + Date.now();
    this.globalData.isLoggedIn = true;
    my.setStorageSync({ key: 'userInfo', data: mockUser });
    my.setStorageSync({ key: 'token', data: this.globalData.token });
    console.log('[登录] Mock登录');
  },

  // 网络请求封装
  request(url, data = {}, method = 'GET') {
    const fullUrl = this.globalData.apiBaseUrl + url;
    return new Promise((resolve) => {
      let settled = false;
      const finish = (val) => { if (!settled) { settled = true; clearTimeout(timer); resolve(val); } };

      const timer = setTimeout(() => {
        const mock = this.getMockResponse(url, data, method);
        finish(mock || { success: false, data: null, error: 'timeout' });
      }, 3500);

      my.request({
        url: fullUrl,
        data: data,
        method: method,
        headers: {
          'content-type': 'application/json',
          'Authorization': this.globalData.token ? `Bearer ${this.globalData.token}` : ''
        },
        success: res => {
          if (res.statusCode === 200) finish(res.data);
          else if (res.statusCode === 401) {
            my.removeStorageSync({ key: 'userInfo' });
            my.removeStorageSync({ key: 'token' });
            this.globalData.isLoggedIn = false;
            finish({ success: false, error: '未登录' });
          } else {
            finish({ success: false, error: (res.data || {}).error || '请求失败' });
          }
        },
        fail: (err) => {
          const mock = this.getMockResponse(url, data, method);
          finish(mock || { success: false, error: (err || {}).errorMessage || '网络异常' });
        }
      });
    });
  },

  // Mock数据降级
  getMockResponse(url, data, method) {
    if (url.includes('/system/modules')) {
      return { success: true, data: { modules: { cleaning: { enabled: true }, rental: { enabled: true }, rental_leisure: { enabled: true } } } };
    }
    if (url.includes('/rental/items')) {
      return { success: true, items: [], total: 0, page: 1, limit: 20 };
    }
    if (url.includes('/rental/items/categories')) {
      return { success: true, categories: [] };
    }
    if (url.includes('/orders')) {
      return { success: true, orders: [], total: 0 };
    }
    if (url.includes('/cleaning/stores')) {
      return { success: true, stores: [{ id: 'ST001', name: '默认门店', address: '门店地址' }] };
    }
    return null;
  },

  // 数据同步
  async syncAllData() {
    if (!this.globalData.isLoggedIn) return;
    try {
      const [orders] = await Promise.all([
        this.request('/orders?userId=' + ((this.globalData.userInfo || {}).userId || '')),
      ]);
      if (orders && orders.success) this.globalData.orders = orders.orders || [];
    } catch (e) { /* 同步失败静默 */ }
  },

  globalData: {
    userInfo: null,
    token: null,
    isLoggedIn: false,
    storeId: 'ST001',
    storeName: '干洗店',
    pendingPickupCode: null,
    scanPayOrder: null,
    scanStoreId: null,
    currentOrder: null,
    orders: [],
    apiBaseUrl: 'http://localhost:3000/api',
    moduleConfig: null,
    enabledModules: [],
    // 支付宝特色
    alipayUserId: null,
    zhimaCreditScore: null
  }
});
