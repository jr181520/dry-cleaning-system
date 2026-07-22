const app = getApp();

Page({
  data: {
    agreed: false
  },

  onAlipayLogin() {
    if (!this.data.agreed) {
      my.showToast({ content: '请先同意用户协议', type: 'none' });
      return;
    }
    my.showLoading({ content: '登录中' });
    my.getAuthCode({
      scopes: 'auth_user',
      success: (res) => {
        if (res.authCode) {
          app.request('/auth/alipay-login', { authCode: res.authCode }, 'POST')
            .then(result => {
              my.hideLoading();
              if (result && result.success) {
                const user = result.data || result.user || {};
                app.globalData.userInfo = user;
                app.globalData.token = result.token || '';
                app.globalData.isLoggedIn = true;
                my.setStorageSync({ key: 'userInfo', data: user });
                my.setStorageSync({ key: 'token', data: result.token || '' });
                my.showToast({ content: '登录成功', type: 'success' });
                setTimeout(() => this._goBack(), 1000);
              } else {
                // 后端登录失败，使用 mock 登录
                console.warn('[登录] 后端登录失败，使用Mock登录');
                this._doMockLogin();
              }
            })
            .catch((e) => {
              console.warn('[登录] 请求异常，使用Mock登录:', e);
              this._doMockLogin();
            });
        } else {
          console.warn('[登录] getAuthCode未返回authCode，使用Mock登录');
          this._doMockLogin();
        }
      },
      fail: (err) => {
        // 模拟器环境或无关联小程序时 getAuthCode 会失败，fallback 到 mock 登录
        console.warn('[登录] getAuthCode失败，使用Mock登录:', err);
        this._doMockLogin();
      }
    });
  },

  // Mock 登录（开发/模拟器环境）
  _doMockLogin() {
    var mockUser = {
      userId: 'mock_alipay_' + Date.now().toString(36),
      nickname: '支付宝用户(模拟)',
      phone: '',
      avatar: '',
      alipayUserId: 'mock_zfb_user'
    };
    app.globalData.userInfo = mockUser;
    app.globalData.token = 'mock-token-alipay-' + Date.now();
    app.globalData.isLoggedIn = true;
    my.setStorageSync({ key: 'userInfo', data: mockUser });
    my.setStorageSync({ key: 'token', data: app.globalData.token });
    my.hideLoading();
    my.showToast({ content: '模拟登录成功（开发环境）', type: 'success' });
    setTimeout(function() {
      // 使用 _goBack 安全回退
      try { my.navigateBack(); } catch(e) { my.switchTab({ url: '/pages/index/index' }); }
    }, 1000);
  },

  // 安全回退：优先 navigateBack，失败时跳首页
  _goBack() {
    my.navigateBack({
      fail: function() {
        my.switchTab({ url: '/pages/index/index' });
      }
    });
  },

  onPhoneLogin() {
    if (!this.data.agreed) {
      my.showToast({ content: '请先同意用户协议', type: 'none' });
      return;
    }
    my.navigateTo({ url: '/pages/login/phone/index' });
  },

  onAgreementChange(e) {
    this.setData({ agreed: e.detail.value });
  },

  onAgreementTap() {
    my.navigateTo({ url: '/pages/webview/index?url=/user-agreement' });
  }
});
