// pages/login/index.js
const app = getApp();

Page({
  data: {
    phone: '',
    code: '',
    password: '',
    confirmPassword: '',
    nickname: '',
    avatarUrl: '',
    isLogin: true, // true: 登录模式, false: 注册模式
    isAgree: false, // 是否同意协议
    countdown: 0, // 验证码倒计时
    loading: false,
    showPassword: false,
    showConfirmPassword: false,
    loginMethod: 'wechat', // 'wechat' | 'phone'
  },

  onLoad(options) {
    // 检查是否已登录
    const userInfo = app.globalData.userInfo;
    if (userInfo && userInfo.openid) {
      wx.switchTab({
        url: '/pages/index/index'
      });
    }
    
    // 如果有重定向URL，保存
    if (options.redirect) {
      this.setData({ redirectUrl: options.redirect });
    }
  },

  // 切换登录/注册模式
  onToggleMode() {
    this.setData({
      isLogin: !this.data.isLogin,
      phone: '',
      code: '',
      password: '',
      confirmPassword: '',
      nickname: '',
      countdown: 0
    });
  },

  // 切换登录方式
  onToggleLoginMethod(e) {
    const method = e.currentTarget.dataset.method;
    this.setData({
      loginMethod: method
    });
  },

  // 输入手机号
  onPhoneInput(e) {
    this.setData({
      phone: e.detail.value
    });
  },

  // 输入验证码
  onCodeInput(e) {
    this.setData({
      code: e.detail.value
    });
  },

  // 输入密码
  onPasswordInput(e) {
    this.setData({
      password: e.detail.value
    });
  },

  // 确认密码
  onConfirmPasswordInput(e) {
    this.setData({
      confirmPassword: e.detail.value
    });
  },

  // 昵称
  onNicknameInput(e) {
    this.setData({
      nickname: e.detail.value
    });
  },

  // 同意协议
  onAgreeChange(e) {
    this.setData({
      isAgree: e.detail.value.length > 0
    });
  },

  // 切换密码显示
  onTogglePassword() {
    this.setData({
      showPassword: !this.data.showPassword
    });
  },

  // 切换确认密码显示
  onToggleConfirmPassword() {
    this.setData({
      showConfirmPassword: !this.data.showConfirmPassword
    });
  },

  // 微信一键登录
  async onWechatLogin() {
    if (!this.data.isAgree) {
      app.showToast('请先阅读并同意用户协议', 'none');
      return;
    }

    this.setData({ loading: true });

    try {
      // 调用微信登录
      const loginResult = await this.wxLogin();
      
      if (loginResult.code) {
        // 获取用户信息（需要用户授权）
        const userProfile = await this.getUserProfile();
        
        // 调用后端API进行登录/注册
        const result = await app.request('/auth/wechat-login', {
          code: loginResult.code,
          nickname: userProfile.nickname || '微信用户',
          avatarUrl: userProfile.avatarUrl,
          gender: userProfile.gender
        }, 'POST');

        if (result.success) {
          // 保存用户信息到全局
          app.globalData.userInfo = result.userInfo;
          app.globalData.token = result.token;
          
          // 保存到本地存储
          wx.setStorageSync('userInfo', result.userInfo);
          wx.setStorageSync('token', result.token);
          
          app.showToast('登录成功', 'success');
          
          // 跳转到目标页面或首页
          setTimeout(() => {
            if (this.data.redirectUrl) {
              wx.redirectTo({
                url: this.data.redirectUrl
              });
            } else {
              wx.switchTab({
                url: '/pages/index/index'
              });
            }
          }, 1500);
        } else {
          app.showToast(result.message || '登录失败', 'none');
        }
      }
    } catch (error) {
      console.error('微信登录失败', error);
      app.showToast('登录失败，请重试', 'none');
    } finally {
      this.setData({ loading: false });
    }
  },

  // 微信登录获取code
  wxLogin() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: res => {
          if (res.code) {
            resolve(res);
          } else {
            reject(new Error('获取code失败'));
          }
        },
        fail: reject
      });
    });
  },

  // 获取用户信息
  getUserProfile() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: res => {
          resolve({
            nickname: res.userInfo.nickName,
            avatarUrl: res.userInfo.avatarUrl,
            gender: res.userInfo.gender // 0: 未知, 1: 男, 2: 女
          });
        },
        fail: err => {
          console.error('获取用户信息失败', err);
          // 即使获取失败也返回默认信息
          resolve({
            nickname: '微信用户',
            avatarUrl: '',
            gender: 0
          });
        }
      });
    });
  },

  // 手机号登录
  async onPhoneLogin() {
    const { phone, code, password, isAgree } = this.data;

    if (!isAgree) {
      app.showToast('请先阅读并同意用户协议', 'none');
      return;
    }

    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      app.showToast('请输入正确的手机号', 'none');
      return;
    }

    if (this.data.isLogin) {
      // 登录模式：手机号 + 密码 或 手机号 + 验证码
      if (!password && !code) {
        app.showToast('请输入密码或验证码', 'none');
        return;
      }
    } else {
      // 注册模式：需要验证码和密码
      if (!code) {
        app.showToast('请输入验证码', 'none');
        return;
      }
      if (!password || password.length < 6) {
        app.showToast('密码至少6位', 'none');
        return;
      }
      if (password !== this.data.confirmPassword) {
        app.showToast('两次密码不一致', 'none');
        return;
      }
    }

    this.setData({ loading: true });

    try {
      const result = await app.request('/auth/phone-login', {
        phone: phone,
        code: code,
        password: password,
        isLogin: this.data.isLogin
      }, 'POST');

      if (result.success) {
        app.globalData.userInfo = result.userInfo;
        app.globalData.token = result.token;
        
        wx.setStorageSync('userInfo', result.userInfo);
        wx.setStorageSync('token', result.token);
        
        app.showToast(this.data.isLogin ? '登录成功' : '注册成功', 'success');
        
        setTimeout(() => {
          if (this.data.redirectUrl) {
            wx.redirectTo({
              url: this.data.redirectUrl
            });
          } else {
            wx.switchTab({
              url: '/pages/index/index'
            });
          }
        }, 1500);
      } else {
        app.showToast(result.message || (this.data.isLogin ? '登录失败' : '注册失败'), 'none');
      }
    } catch (error) {
      console.error('手机号登录失败', error);
      app.showToast('操作失败，请重试', 'none');
    } finally {
      this.setData({ loading: false });
    }
  },

  // 发送验证码
  async onSendCode() {
    const { phone, countdown } = this.data;

    if (countdown > 0) {
      return;
    }

    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      app.showToast('请输入正确的手机号', 'none');
      return;
    }

    try {
      const result = await app.request('/auth/send-code', {
        phone: phone,
        type: this.data.isLogin ? 'login' : 'register'
      }, 'POST');

      if (result.success) {
        app.showToast('验证码已发送', 'success');
        // 开始倒计时
        this.startCountdown();
      } else {
        app.showToast(result.message || '发送失败', 'none');
      }
    } catch (error) {
      console.error('发送验证码失败', error);
      app.showToast('发送失败，请重试', 'none');
    }
  },

  // 验证码倒计时
  startCountdown() {
    let seconds = 60;
    this.setData({ countdown: seconds });
    
    const timer = setInterval(() => {
      seconds--;
      if (seconds <= 0) {
        clearInterval(timer);
        this.setData({ countdown: 0 });
      } else {
        this.setData({ countdown: seconds });
      }
    }, 1000);
  },

  // 跳转到用户协议
  onViewAgreement() {
    wx.showModal({
      title: '用户服务协议',
      content: '这里是用户服务协议的详细内容...\n\n1. 服务条款\n2. 隐私政策\n3. 其他条款',
      showCancel: false,
      confirmText: '我已阅读'
    });
  },

  // 跳转到隐私政策
  onViewPrivacy() {
    wx.showModal({
      title: '隐私政策',
      content: '这里是隐私政策的详细内容...\n\n我们会保护您的个人信息安全。',
      showCancel: false,
      confirmText: '我已阅读'
    });
  },

  // 游客体验
  onGuestAccess() {
    wx.showModal({
      title: '提示',
      content: '游客模式可以浏览部分功能，但无法下单和使用完整服务。是否继续？',
      success: res => {
        if (res.confirm) {
          wx.switchTab({
            url: '/pages/index/index'
          });
        }
      }
    });
  }
});
