// pages/login/index.js
const app = getApp();

Page({
  data: {
    loading: false
  },

  onLoad() {
    console.log('[登录页] 加载完成');
    // 检查是否已登录 — 延迟跳转避开框架初始化期
    if (app.globalData.isLoggedIn) {
      console.log('[登录页] 已登录，稍后跳转首页');
      setTimeout(() => {
        wx.switchTab({ 
          url: '/pages/index/index',
          fail: () => {
            // switchTab 失败（框架未就绪），使用 reLaunch 保底
            wx.reLaunch({ url: '/pages/index/index' });
          }
        });
      }, 500);
    }
  },

  // 按钮点击登录
  onLoginTap() {
    console.log('[登录页] 点击登录');
    this.doLogin();
  },

  onGetPhoneNumber(e) {
    console.log('[登录页] 获取手机号事件:', e.detail);
    console.log('[登录页] errMsg:', e.detail.errMsg);
    
    if (e.detail.errMsg === 'getPhoneNumber:ok') {
      console.log('[登录页] 准备调用 doLogin');
      this.doLogin();
    } else {
      console.log('[登录页] 用户取消，静默登录');
      this.doLogin();
    }
  },

  doLogin() {
    if (this.data.loading) return;
    
    console.log('[登录页] 开始登录');
    this.setData({ loading: true });
    
    wx.login({
      success: res => {
        console.log('[登录页] wx.login成功, code:', res.code);
        if (res.code) {
          app.request('/auth/wxmini-login', {
            code: res.code
          }, 'POST').then(result => {
            console.log('[登录页] 登录成功:', result);
            const data = result.data;
            if (data && data.openid) {
              app.globalData.userInfo = {
                openid: data.openid,
                sessionKey: data.session_key,
                ...data.user
              };
              app.globalData.token = data.token;
              app.globalData.isLoggedIn = true;
              wx.showToast({ title: '登录成功', icon: 'success' });
              
              // 延迟跳转，确保提示显示
              setTimeout(() => {
                wx.switchTab({ 
                  url: '/pages/index/index',
                  fail: (err) => {
                    console.error('[登录页] 跳转失败:', err);
                    wx.reLaunch({ url: '/pages/index/index' });
                  }
                });
              }, 1000);
            } else {
              console.error('[登录页] 数据异常:', data);
              wx.showToast({ title: '登录数据异常', icon: 'none' });
            }
          }).catch(err => {
            console.error('[登录页] 登录失败:', err);
            wx.showToast({ title: '登录失败: ' + (err.error || '网络错误'), icon: 'none' });
          }).finally(() => {
            this.setData({ loading: false });
          });
        }
      },
      fail: err => {
        console.error('[登录页] wx.login失败:', err);
        wx.showToast({ title: '微信登录失败', icon: 'none' });
        this.setData({ loading: false });
      }
    });
  }
});
