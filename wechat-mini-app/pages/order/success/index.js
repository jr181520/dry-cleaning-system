// pages/order/success/index.js
const app = getApp();

Page({
  data: {
    orderId: '',
    orderData: null,
    courierInfo: null,
    // 分享相关
    showShareModal: false,
    shareQRImage: '',  // 分享小程序码图片（base64）
    shareLoading: false
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
    
    // 如果有待支付订单，自动加载分享小程序码
    if (this.data.orderId) {
      this.loadShareQR();
    }
  },
  
  // 加载分享小程序码
  async loadShareQR() {
    const { orderId, orderData } = this.data;
    if (!orderId || this.data.shareLoading) return;
    
    this.setData({ shareLoading: true });
    
    try {
      // 调用后端API生成小程序码
      const res = await app.request('/mini-qr/generate', {
        type: 'order_pay',
        orderId: orderId,
        storeId: orderData?.store?.id || '',
        amount: orderData?.fees?.totalAmount || 0
      }, 'POST');
      
      if (res.success && res.data) {
        // 开发模式返回SVG，正式模式返回PNG
        let imageSrc;
        if (res.data.isDevMode && res.data.contentType === 'image/svg+xml') {
          imageSrc = `data:image/svg+xml;base64,${res.data.imageData}`;
        } else {
          imageSrc = `data:${res.data.contentType || 'image/png'};base64,${res.data.imageData}`;
        }
        this.setData({
          shareQRImage: imageSrc
        });
      } else {
        console.log('[分享码] API返回失败，使用占位图');
      }
    } catch (error) {
      console.error('[分享码] 加载失败:', error);
    } finally {
      this.setData({ shareLoading: false });
    }
  },
  
  // 显示分享弹窗
  onShareOrder() {
    // 如果还没有加载小程序码，先加载
    if (!this.data.shareQRImage && !this.data.shareLoading) {
      this.loadShareQR();
    }
    this.setData({ showShareModal: true });
  },
  
  // 关闭分享弹窗
  closeShareModal() {
    this.setData({ showShareModal: false });
  },
  
  // 保存小程序码到相册
  onSaveQR() {
    if (!this.data.shareQRImage) {
      wx.showToast({ title: '图片加载中，请稍后', icon: 'none' });
      return;
    }
    
    // 将base64转为临时文件
    const filePath = `${wx.env.USER_DATA_PATH}/order_qr_${this.data.orderId}.png`;
    const buffer = wx.base64ToArrayBuffer(this.data.shareQRImage.replace(/^data:image\/\w+;base64,/, ''));
    
    wx.getFileSystemManager().writeFile({
      filePath: filePath,
      data: buffer,
      encoding: 'binary',
      success: () => {
        wx.saveImageToPhotosAlbum({
          filePath: filePath,
          success: () => {
            wx.showToast({ title: '已保存到相册', icon: 'success' });
            this.closeShareModal();
          },
          fail: (err) => {
            console.error('保存失败:', err);
            wx.showToast({ title: '保存失败', icon: 'none' });
          }
        });
      },
      fail: (err) => {
        console.error('写入文件失败:', err);
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    });
  },
  
  // 预览小程序码
  onPreviewQR() {
    if (!this.data.shareQRImage) {
      wx.showToast({ title: '图片加载中', icon: 'none' });
      return;
    }
    
    const filePath = `${wx.env.USER_DATA_PATH}/order_qr_preview.png`;
    const buffer = wx.base64ToArrayBuffer(this.data.shareQRImage.replace(/^data:image\/\w+;base64,/, ''));
    
    wx.getFileSystemManager().writeFile({
      filePath: filePath,
      data: buffer,
      encoding: 'binary',
      success: () => {
        wx.previewImage({
          urls: [filePath],
          current: filePath
        });
      },
      fail: (err) => {
        console.error('预览失败:', err);
      }
    });
  },
  
  // 分享给朋友
  onShareAppMessage() {
    const { orderId, orderData } = this.data;
    return {
      title: '帮我支付干洗订单',
      path: `/pages/order/detail/index?id=${orderId}`,
      imageUrl: this.data.shareQRImage || ''
    };
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
