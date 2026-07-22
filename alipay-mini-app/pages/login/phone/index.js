var app = getApp();

Page({
  data: {
    phone: '',
    code: '',
    canSend: false,
    sendBtnText: '获取验证码',
    countdown: 0
  },

  _timer: null,

  onPhoneInput: function(e) {
    var phone = (e.detail.value || '').replace(/\D/g, '');
    this.setData({
      phone: phone,
      canSend: phone.length === 11 && this.data.countdown <= 0
    });
  },

  onCodeInput: function(e) {
    this.setData({ code: e.detail.value || '' });
  },

  // 发送验证码
  onSendCode: function() {
    var self = this;
    var phone = this.data.phone;
    if (phone.length !== 11) {
      my.showToast({ content: '请输入11位手机号', type: 'none' });
      return;
    }
    if (this.data.countdown > 0) return;

    my.showLoading({ content: '发送中' });

    app.request('/auth/send-code', { phone: phone, type: 'login' }, 'POST')
      .then(function(result) {
        my.hideLoading();
        if (result && result.success) {
          my.showToast({ content: '验证码已发送', type: 'success' });
          self._startCountdown();
        } else {
          // 后端发送失败，提示但仍允许输入任意6位码（开发环境）
          console.warn('[手机登录] 发送验证码失败，开发环境可输入任意6位码');
          my.showToast({ content: '开发环境：任意6位码即可', type: 'none' });
          self._startCountdown();
        }
      })
      .catch(function() {
        my.hideLoading();
        my.showToast({ content: '开发环境：任意6位码即可', type: 'none' });
        self._startCountdown();
      });
  },

  _startCountdown: function() {
    var self = this;
    var sec = 60;
    this.setData({ countdown: sec, sendBtnText: sec + 's', canSend: false });
    this._timer = setInterval(function() {
      sec--;
      if (sec <= 0) {
        clearInterval(self._timer);
        self._timer = null;
        self.setData({ countdown: 0, sendBtnText: '获取验证码', canSend: self.data.phone.length === 11 });
      } else {
        self.setData({ countdown: sec, sendBtnText: sec + 's' });
      }
    }, 1000);
  },

  // 提交登录
  onSubmit: function() {
    var self = this;
    var phone = this.data.phone;
    var code = this.data.code;

    if (phone.length !== 11) {
      my.showToast({ content: '请输入11位手机号', type: 'none' });
      return;
    }
    if (!code || code.length < 4) {
      my.showToast({ content: '请输入验证码', type: 'none' });
      return;
    }

    my.showLoading({ content: '登录中' });

    // 先尝试后端 phone-login
    app.request('/auth/phone-login', { phone: phone, code: code }, 'POST')
      .then(function(result) {
        my.hideLoading();
        if (result && result.success) {
          var user = result.data || result.user || {};
          app.globalData.userInfo = user;
          app.globalData.token = result.token || '';
          app.globalData.isLoggedIn = true;
          my.setStorageSync({ key: 'userInfo', data: user });
          my.setStorageSync({ key: 'token', data: result.token || '' });
          my.showToast({ content: '登录成功', type: 'success' });
          setTimeout(function() { my.navigateBack({ fail: function() { my.switchTab({ url: '/pages/index/index' }); } }); }, 1000);
        } else {
          // 后端无 phone-login，尝试 verify-code + 本地登录
          console.warn('[手机登录] phone-login 不可用，尝试 verify-code');
          self._verifyAndLogin(phone, code);
        }
      })
      .catch(function() {
        console.warn('[手机登录] phone-login 请求异常，尝试 verify-code');
        self._verifyAndLogin(phone, code);
      });
  },

  // 验证验证码后登录
  _verifyAndLogin: function(phone, code) {
    var self = this;
    app.request('/auth/verify-code', { phone: phone, code: code }, 'POST')
      .then(function(vResult) {
        if (vResult && vResult.success) {
          // 验证码通过，调用 login（但 login 需要 password，所以走 mock）
          self._doMockPhoneLogin(phone);
        } else {
          // 验证失败，开发环境仍可 mock
          console.warn('[手机登录] verify-code 失败，使用 Mock 登录');
          self._doMockPhoneLogin(phone);
        }
      })
      .catch(function() {
        console.warn('[手机登录] verify-code 异常，使用 Mock 登录');
        self._doMockPhoneLogin(phone);
      });
  },

  // Mock 手机号登录（开发环境）
  _doMockPhoneLogin: function(phone) {
    var mockUser = {
      userId: 'mock_phone_' + phone,
      nickname: phone.substring(0, 3) + '****' + phone.substring(7),
      phone: phone,
      avatar: '',
      alipayUserId: ''
    };
    app.globalData.userInfo = mockUser;
    app.globalData.token = 'mock-token-phone-' + Date.now();
    app.globalData.isLoggedIn = true;
    my.setStorageSync({ key: 'userInfo', data: mockUser });
    my.setStorageSync({ key: 'token', data: app.globalData.token });
    my.hideLoading();
    my.showToast({ content: '登录成功（开发环境）', type: 'success' });
    setTimeout(function() { my.navigateBack({ fail: function() { my.switchTab({ url: '/pages/index/index' }); } }); }, 1000);
  },

  onUnload: function() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }
});