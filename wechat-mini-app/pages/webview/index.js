// pages/webview/index.js
Page({
  data: {
    webViewUrl: '',
    title: '支付页面',
    type: 'alipay', // alipay or unionpay
    loaded: false,
    canGoBack: false
  },

  onLoad(options) {
    if (options.url) {
      const url = decodeURIComponent(options.url);
      const type = options.type || 'alipay';
      
      this.setData({
        webViewUrl: url,
        type: type,
        title: type === 'alipay' ? '支付宝支付' : '银联支付'
      });
    }
    
    // 设置导航栏标题
    wx.setNavigationBarTitle({
      title: this.data.title
    });
  },

  onReady() {
    this.setData({ loaded: true });
  },

  // WebView加载成功
  onWebViewLoad(e) {
    console.log('WebView加载成功', e.detail);
    this.setData({ loaded: true });
  },

  // WebView加载失败
  onWebViewError(e) {
    console.error('WebView加载失败', e);
    wx.showToast({
      title: '页面加载失败',
      icon: 'none'
    });
  },

  // 页面加载完成
  onLoadSuccess() {
    wx.hideLoading();
  },

  // 点击关闭按钮
  onClose() {
    wx.showModal({
      title: '提示',
      content: '支付尚未完成，是否确认关闭？',
      success: (res) => {
        if (res.confirm) {
          // 跳转到订单列表
          wx.redirectTo({
            url: '/pages/order/list/index'
          });
        }
      }
    });
  },

  // 点击完成按钮
  onComplete() {
    // 跳转到订单列表
    wx.redirectTo({
      url: '/pages/order/list/index'
    });
  },

  // 监听返回按钮
  onBack() {
    if (this.data.canGoBack) {
      wx.navigateBack();
    } else {
      this.onClose();
    }
  },

  // 页面卸载时检查支付状态
  onUnload() {
    // 提示用户检查支付状态
    wx.showToast({
      title: '请检查订单支付状态',
      icon: 'none',
      duration: 2000
    });
  }
});
