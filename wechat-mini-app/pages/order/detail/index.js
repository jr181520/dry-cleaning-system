/**
 * 订单详情页面
 * 支持实时状态更新、扫码支付和取件方式选择
 */

const app = getApp();

// 订单状态配置
const STATUS_CONFIG = {
  pending: { text: '待支付', icon: 'clock-o', color: '#ff9800', gradient: 'linear-gradient(135deg, #ff9800, #ff5722)' },
  paid: { text: '已支付', icon: 'check-circle', color: '#4caf50', gradient: 'linear-gradient(135deg, #4caf50, #2e7d32)' },
  delivering: { text: '配送中', icon: 'truck', color: '#2196f3', gradient: 'linear-gradient(135deg, #2196f3, #1976d2)' },
  received: { text: '已入库', icon: 'inbox', color: '#9c27b0', gradient: 'linear-gradient(135deg, #9c27b0, #7b1fa2)' },
  processing: { text: '处理中', icon: 'refresh', color: '#ff5722', gradient: 'linear-gradient(135deg, #ff5722, #e64a19)' },
  ready: { text: '待取件', icon: 'gift', color: '#00bcd4', gradient: 'linear-gradient(135deg, #00bcd4, #0097a7)' },
  delivering_back: { text: '配送中', icon: 'truck', color: '#2196f3', gradient: 'linear-gradient(135deg, #2196f3, #1976d2)' },
  completed: { text: '已完成', icon: 'flag-checkered', color: '#4caf50', gradient: 'linear-gradient(135deg, #4caf50, #388e3c)' },
  cancelled: { text: '已取消', icon: 'times-circle', color: '#9e9e9e', gradient: 'linear-gradient(135deg, #9e9e9e, #757575)' }
};

// 步骤顺序
const STEPS_ORDER = ['paid', 'delivering', 'received', 'processing', 'ready', 'completed'];

Page({
  data: {
    orderId: '',
    order: null,
    statusConfig: {},
    steps: [],
    currentStep: 0,
    loading: true,
    polling: false,
    
    // 扫码支付相关
    showScanPayBanner: false,  // 显示扫码支付横幅
    scanPayAmount: 0,          // 扫码订单金额
    isFromScan: false,         // 是否从扫码进入
    
    // 取件方式选择
    showPickupMethod: false,
    selectedPickupMethod: 'store_pickup', // store_pickup: 到店自提, home_delivery: 配送到家
    deliveryForm: {
      address: '',
      contactName: '',
      contactPhone: ''
    }
  },

  pollTimer: null,
  pollInterval: 3000, // 3秒轮询

  onLoad(options) {
    const { id } = options;
    
    // 加载记忆的用户信息
    this.loadUserInfo();
    
    // 检查是否从扫码进入
    const scanPayOrder = app.globalData.scanPayOrder;
    if (scanPayOrder && scanPayOrder.orderId) {
      console.log('[订单详情] 从扫码进入:', scanPayOrder);
      this.setData({
        orderId: scanPayOrder.orderId,
        isFromScan: true,
        scanPayAmount: scanPayOrder.amount
      });
      this.loadOrderDetail();
      this.startPolling();
      
      // 清除扫码数据
      app.clearScanData();
    } else if (id) {
      this.setData({ orderId: id });
      this.loadOrderDetail();
      this.startPolling();
    } else {
      // 演示数据
      this.loadDemoOrder();
    }
  },

  onShow() {
    // 每次显示页面时刷新数据
    if (this.data.order) {
      this.loadOrderDetail();
    }
  },

  onUnload() {
    this.stopPolling();
  },

  onPullDownRefresh() {
    this.loadOrderDetail(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 加载用户记忆的信息
  loadUserInfo() {
    const savedInfo = wx.getStorageSync('userDeliveryInfo');
    if (savedInfo) {
      this.setData({
        deliveryForm: {
          address: savedInfo.pickupAddress || '',
          contactName: savedInfo.contactName || '',
          contactPhone: savedInfo.contactPhone || ''
        }
      });
    }
  },

  // 保存用户信息
  saveUserInfo() {
    const info = {
      contactName: this.data.deliveryForm.contactName,
      contactPhone: this.data.deliveryForm.contactPhone,
      pickupAddress: this.data.deliveryForm.address,
      updateTime: Date.now()
    };
    wx.setStorageSync('userDeliveryInfo', info);
  },

  // 加载订单详情
  async loadOrderDetail(callback) {
    try {
      const result = await app.request(`/orders/${this.data.orderId}/status`);
      
      if (result.success) {
        this.updateOrderUI(result.data);
      }
    } catch (error) {
      console.error('加载订单失败', error);
      if (this.data.orderId === 'demo') {
        this.loadDemoOrder();
      }
    } finally {
      this.setData({ loading: false });
      if (callback) callback();
    }
  },

  // 更新订单UI
  updateOrderUI(order) {
    const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
    const currentStep = STEPS_ORDER.indexOf(order.status);
    
    // 生成步骤数据
    const steps = STEPS_ORDER.map((step, index) => ({
      key: step,
      text: this.getStepText(step),
      active: index <= currentStep,
      current: index === currentStep,
      icon: this.getStepIcon(step)
    }));

    // 判断是否显示取件方式选择
    const showPickupMethod = order.status === 'ready';

    this.setData({
      order,
      statusConfig,
      steps,
      currentStep,
      showPickupMethod
    });
    
    // 如果是扫码进入且订单待支付，显示扫码支付横幅
    if (this.data.isFromScan && order.status === 'pending') {
      this.showScanPayBanner();
    }
  },
  
  // 显示扫码支付横幅
  showScanPayBanner() {
    const { order } = this.data;
    if (!order) return;
    
    this.setData({
      showScanPayBanner: true,
      scanPayAmount: order.amounts?.total || order.totalAmount || 0
    });
  },
  
  // 关闭扫码支付横幅
  closeScanPayBanner() {
    this.setData({ showScanPayBanner: false });
  },
  
  // 立即支付（扫码支付流程）
  onScanPay() {
    const { order, orderId } = this.data;
    if (!order) return;
    
    // 设置当前订单到全局
    app.globalData.currentOrder = {
      orderId: orderId,
      store: {
        id: order.storeId || '',
        name: order.storeName || '',
        address: order.storeAddress || ''
      },
      services: order.items || [],
      fees: {
        serviceFee: order.amounts?.serviceFee || 0,
        deliveryFee: order.amounts?.deliveryFee || 0,
        totalAmount: order.amounts?.total || order.totalAmount || 0
      },
      deliveryMethod: order.deliveryMethod || 'pickup',
      time: order.pickupTime || {}
    };
    
    // 跳转到支付页面
    wx.navigateTo({ url: '/pages/order/payment/index' });
  },
  
  // 稍后支付
  onLaterPay() {
    this.closeScanPayBanner();
    wx.showToast({
      title: '订单已保存，可稍后支付',
      icon: 'none'
    });
  },

  // 获取步骤文字
  getStepText(step) {
    const textMap = {
      paid: '已支付',
      delivering: '取件中',
      received: '已入库',
      processing: '处理中',
      ready: '待取件',
      completed: '完成'
    };
    return textMap[step] || step;
  },

  // 获取步骤图标
  getStepIcon(step) {
    const iconMap = {
      paid: 'check-circle',
      delivering: 'truck',
      received: 'inbox',
      processing: 'refresh',
      ready: 'gift',
      completed: 'flag'
    };
    return iconMap[step] || 'circle';
  },

  // 选择取件方式
  onSelectPickupMethod(e) {
    const method = e.currentTarget.dataset.method;
    this.setData({ selectedPickupMethod: method });
  },

  // 更新配送表单
  onDeliveryFormInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`deliveryForm.${field}`]: e.detail.value
    });
  },

  // 处理主操作（到店自提或配送到家）
  async onHandleMainAction() {
    const { order, selectedPickupMethod, deliveryForm } = this.data;
    
    if (order.status !== 'ready') return;
    
    // 保存用户信息
    this.saveUserInfo();
    
    if (selectedPickupMethod === 'home_delivery') {
      // 配送到家
      if (!deliveryForm.address || !deliveryForm.contactName || !deliveryForm.contactPhone) {
        wx.showToast({ title: '请填写完整配送信息', icon: 'none' });
        return;
      }
      
      await this.submitPickupMethod();
    } else {
      // 到店自提，直接确认取件
      await this.onConfirmPickup();
    }
  },

  // 提交取件方式
  async submitPickupMethod() {
    const { orderId, selectedPickupMethod, deliveryForm } = this.data;
    
    try {
      const result = await app.request(`/orders/${orderId}/pickup-method`, {
        method: selectedPickupMethod,
        address: deliveryForm.address,
        contactName: deliveryForm.contactName,
        contactPhone: deliveryForm.contactPhone
      }, 'POST');
      
      if (result.success) {
        wx.showToast({ title: '已选择配送到家', icon: 'success' });
        // 重新加载订单
        this.loadOrderDetail();
      } else {
        wx.showToast({ title: result.error || '操作失败', icon: 'none' });
      }
    } catch (error) {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // 开始轮询
  startPolling() {
    if (this.data.polling) return;
    
    this.setData({ polling: true });
    
    this.pollTimer = setInterval(() => {
      this.loadOrderDetail();
    }, this.pollInterval);
  },

  // 停止轮询
  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.setData({ polling: false });
  },

  // 加载演示订单
  loadDemoOrder() {
    const demoOrder = {
      orderId: 'demo123',
      orderNo: 'CL20260422001',
      status: 'ready', // 演示待取件状态
      statusText: '待取件',
      statusDescription: '衣物已处理完成，请选择取件方式',
      items: [
        { name: '西装', status: '待取件' },
        { name: '衬衫 x2', status: '待取件' }
      ],
      amounts: { total: 280 },
      storeName: '优衣库干洗店',
      storeAddress: '朝阳区建国路88号',
      storePhone: '400-888-8888',
      pickupCode: 'P654321',
      createdAt: new Date().toISOString(),
      latestHistory: {
        note: '衣物清洗完成，已打包好，等待取件',
        time: new Date().toISOString()
      }
    };
    
    this.updateOrderUI(demoOrder);
    this.setData({ loading: false });
  },

  // 确认取件
  onConfirmPickup() {
    wx.showModal({
      title: '确认取件',
      content: '确认您已完成取件？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await app.request(`/orders/${this.data.orderId}/pickup`, {}, 'POST');
            if (result.success) {
              wx.showToast({ title: '取件成功', icon: 'success' });
              this.loadOrderDetail();
            } else {
              wx.showToast({ title: result.error || '操作失败', icon: 'none' });
            }
          } catch (error) {
            wx.showToast({ title: '操作失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 复制订单号
  copyOrderNo() {
    const orderNo = this.data.order.orderNo || this.data.order.orderId;
    wx.setClipboardData({
      data: orderNo,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' });
      }
    });
  },

  // 催单
  onRemind() {
    wx.showToast({ title: '已通知门店', icon: 'success' });
  },

  // 联系门店
  onCallStore() {
    wx.showModal({
      title: '门店电话',
      content: this.data.order.storePhone || '400-888-8888',
      confirmText: '拨打',
      success: (res) => {
        if (res.confirm) {
          wx.makePhoneCall({ phoneNumber: this.data.order.storePhone || '4008888888' });
        }
      }
    });
  },

  // 导航到门店
  onNavigateToStore() {
    wx.openLocation({
      latitude: 39.908,
      longitude: 116.397,
      name: this.data.order.storeName,
      address: this.data.order.storeAddress,
      scale: 18
    });
  },

  // 评价
  onRate() {
    wx.showToast({ title: '评价功能开发中', icon: 'none' });
  },

  // 支付
  onPay() {
    wx.navigateTo({ url: '/pages/order/payment/index' });
  },

  // 返回首页
  onGoHome() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  // 格式化时间
  formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
});
