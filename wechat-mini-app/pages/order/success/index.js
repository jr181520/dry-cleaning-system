// pages/order/success/index.js
const app = getApp();

Page({
  data: {
    orderId: '',
    orderData: null,
    courierInfo: null
  },

  onLoad(options) {
    if (options.orderId) {
      this.setData({
        orderId: options.orderId
      });
    }
    
    // 获取订单数据
    const orderData = app.globalData.currentOrder;
    if (orderData) {
      this.setData({
        orderData: orderData
      });
      
      // 如果是跑腿订单，初始化配送跟踪
      if (orderData.deliveryMethod === 'courier' && orderData.courier) {
        this.initDeliveryTracker(orderData.courier);
      }
    }
  },

  // 初始化配送跟踪
  initDeliveryTracker(courier) {
    const statusMap = {
      'picking': { text: '取件中', class: 'picking' },
      'delivering': { text: '配送中', class: 'delivering' },
      'delivered': { text: '已送达', class: 'delivered' }
    };
    
    const status = statusMap[courier.status] || statusMap.picking;
    
    this.setData({
      courierInfo: {
        ...courier,
        statusText: status.text,
        statusClass: status.class
      }
    });
    
    // 启动定时更新
    this.startDeliveryUpdates();
  },

  // 启动配送状态更新
  startDeliveryUpdates() {
    // 每30秒更新一次
    this.deliveryTimer = setInterval(() => {
      const courierInfo = this.data.courierInfo;
      if (courierInfo && courierInfo.status !== 'delivered') {
        this.updateDeliveryProgress();
      }
    }, 30000);
  },

  // 更新配送进度
  updateDeliveryProgress() {
    const courierInfo = this.data.courierInfo;
    if (!courierInfo) return;
    
    let newProgress = courierInfo.progress;
    let newStatus = courierInfo.status;
    let newStatusText = courierInfo.statusText;
    let newStatusClass = courierInfo.statusClass;
    let newEta = courierInfo.eta;
    let newDistance = courierInfo.distance;
    
    if (courierInfo.status === 'picking') {
      newProgress = 10;
      newStatus = 'delivering';
      newStatusText = '配送中';
      newStatusClass = 'delivering';
      newDistance = '0.8km';
      newEta = '8分钟';
    } else if (courierInfo.status === 'delivering') {
      newProgress = 90;
      newStatus = 'delivered';
      newStatusText = '已送达';
      newStatusClass = 'delivered';
      newDistance = '0km';
      newEta = '0分钟';
    }
    
    this.setData({
      courierInfo: {
        ...courierInfo,
        progress: newProgress,
        status: newStatus,
        statusText: newStatusText,
        statusClass: newStatusClass,
        eta: newEta,
        distance: newDistance
      }
    });
    
    // 如果已送达，停止更新
    if (newStatus === 'delivered') {
      clearInterval(this.deliveryTimer);
    }
  },

  // 刷新配送状态
  onRefreshDelivery() {
    wx.showLoading({ title: '刷新中...' });
    
    setTimeout(() => {
      this.updateDeliveryProgress();
      wx.hideLoading();
      
      wx.showToast({
        title: '已刷新',
        icon: 'success',
        duration: 1500
      });
    }, 1000);
  },

  // 拨打电话
  onCallCourier() {
    const phone = this.data.courierInfo?.phone || '13812345678';
    wx.makePhoneCall({
      phoneNumber: phone.replace(/\*/g, '1234'),
      fail: () => {
        wx.showModal({
          title: '联系电话',
          content: this.data.courierInfo?.phone || '138****1234',
          showCancel: false,
          confirmText: '知道了'
        });
      }
    });
  },

  // 联系骑手
  onChatCourier() {
    wx.showModal({
      title: '联系骑手',
      content: '骑手电话：' + (this.data.courierInfo?.phone || '138****1234'),
      showCancel: true,
      cancelText: '取消',
      confirmText: '拨打',
      success: (res) => {
        if (res.confirm) {
          this.onCallCourier();
        }
      }
    });
  },

  // 查看订单
  onViewOrder() {
    wx.switchTab({
      url: '/pages/orders/index'
    });
  },

  // 返回首页
  onBackHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  onUnload() {
    // 清除定时器
    if (this.deliveryTimer) {
      clearInterval(this.deliveryTimer);
    }
  }
});
