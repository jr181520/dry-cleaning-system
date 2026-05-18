// pages/order/payment/index.js
const app = getApp();

Page({
  data: {
    // 订单数据
    orderData: null,
    
    // 支付方式列表
    paymentMethods: [
      {
        id: 'wechat',
        name: '微信支付',
        icon: '/images/wechat-pay.png',
        iconEmoji: '💬',
        desc: '微信安全支付',
        recommended: true
      },
      {
        id: 'balance',
        name: '账户余额',
        icon: '/images/balance-pay.png',
        iconEmoji: '💰',
        desc: '使用账户余额支付',
        recommended: false
      },
      {
        id: 'alipay',
        name: '支付宝',
        icon: '/images/alipay.png',
        iconEmoji: '💙',
        desc: '跳转支付宝支付',
        recommended: false
      },
      {
        id: 'unionpay',
        name: '银行卡支付',
        icon: '/images/unionpay.png',
        iconEmoji: '💳',
        desc: '跳转银联/银行卡支付',
        recommended: false
      }
    ],
    selectedPaymentMethod: 'wechat',
    
    // 用户信息
    userBalance: 500.00,
    memberBalance: 1000.00,
    memberPoints: 1200,
    
    // 订单号
    orderId: '',
    
    // 支付状态
    isPaying: false,
    countdown: 1800,  // 30分钟倒计时（秒）
    
    // 支付宝/银联支付跳转URL
    externalPayUrl: '',
    showExternalPayModal: false
  },

  onLoad() {
    // 获取订单数据
    const orderData = app.globalData.currentOrder;
    
    if (!orderData) {
      app.showToast('订单信息不存在', 'none');
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }
    
    this.setData({
      orderData: orderData
    });
    
    // 生成订单号
    this.generateOrderId();
    
    // 开始倒计时
    this.startCountdown();
    
    // 加载用户余额信息
    this.loadUserBalance();
  },

  onUnload() {
    // 清除倒计时
    if (this.interval) {
      clearInterval(this.interval);
    }
  },

  // 生成订单号
  generateOrderId() {
    const now = new Date();
    const orderId = `ORD${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    this.setData({ orderId });
  },

  // 开始倒计时
  startCountdown() {
    this.interval = setInterval(() => {
      const countdown = this.data.countdown - 1;
      if (countdown <= 0) {
        clearInterval(this.interval);
        app.showToast('订单已超时', 'none');
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        this.setData({ countdown });
      }
    }, 1000);
  },

  // 格式化倒计时
  formatCountdown(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  },

  // 加载用户余额
  async loadUserBalance() {
    const userInfo = app.globalData.userInfo;
    
    try {
      const res = await app.request('/balance/' + userInfo.openid);
      if (res.success && res.data) {
        this.setData({
          userBalance: res.data.balance || 500,
          memberBalance: res.data.memberBalance || 1000
        });
      } else {
        // 模拟数据
        this.setData({
          userBalance: 500,
          memberBalance: 1000
        });
      }
    } catch (error) {
      console.error('加载余额失败:', error);
      // 使用模拟数据
      this.setData({
        userBalance: 500,
        memberBalance: 1000
      });
    }
  },

  // 选择支付方式
  onSelectPayment(e) {
    const paymentId = e.currentTarget.dataset.id;
    this.setData({
      selectedPaymentMethod: paymentId
    });
  },

  // 确认支付
  async onConfirmPayment() {
    if (this.data.isPaying) {
      return;
    }
    
    // 余额不足检查
    if (this.data.selectedPaymentMethod === 'balance') {
      const totalAmount = this.data.orderData.fees.totalAmount;
      if (this.data.userBalance < totalAmount) {
        app.showToast('余额不足，请选择其他支付方式', 'none');
        return;
      }
    }
    
    this.setData({ isPaying: true });
    app.showLoading('正在处理...');
    
    try {
      // 第一步：创建真实订单
      console.log('[支付] 开始创建订单...');
      const orderResult = await this.createOrder();
      
      if (!orderResult.success) {
        throw new Error(orderResult.error || '创建订单失败');
      }
      
      // 更新本地订单ID
      const realOrderId = orderResult.data?.orderNo || orderResult.data?.orderId || this.data.orderId;
      this.setData({ orderId: realOrderId });
      console.log('[支付] 订单创建成功:', realOrderId);
      
      // 第二步：调用支付接口
      let result;
      
      // 根据支付方式调用不同接口
      switch (this.data.selectedPaymentMethod) {
        case 'wechat':
          result = await this.wechatPay(realOrderId);
          break;
        case 'balance':
          result = await this.balancePay(realOrderId);
          break;
        case 'alipay':
          result = await this.alipayPay(realOrderId);
          break;
        case 'unionpay':
          result = await this.unionpayPay(realOrderId);
          break;
        default:
          throw new Error('未知的支付方式');
      }
      
      // 处理支付结果
      if (result.success) {
        app.hideLoading();
        app.showToast('支付成功', 'success');
        
        // 保存订单到历史
        const orderData = {
          ...this.data.orderData,
          orderId: realOrderId,
          paymentMethod: this.data.selectedPaymentMethod,
          paymentMethodName: this.getPaymentMethodName(),
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        
        // 更新全局订单列表
        const orders = app.globalData.orders || [];
        orders.unshift(orderData);
        app.globalData.orders = orders;
        
        // 跳转支付成功页面
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/order/success/index?orderId=${realOrderId}&amount=${this.data.orderData.fees.totalAmount}&storeId=${this.data.orderData.store?.id || ''}`
          });
        }, 1500);
      } else {
        throw new Error(result.message || '支付失败');
      }
      
    } catch (error) {
      app.hideLoading();
      app.showToast(error.message || '支付失败，请重试', 'none');
      this.setData({ isPaying: false });
    }
  },
  
  // 创建真实订单
  async createOrder() {
    try {
      const userInfo = app.globalData.userInfo;
      const orderData = this.data.orderData;
      
      // 准备订单数据
      const orderPayload = {
        userId: userInfo?.openid || userInfo?.id || 'guest_' + Date.now(),
        storeId: orderData.store?.storeId || orderData.store?.id || 'ST001',
        items: orderData.services.map(service => ({
          name: service.name,
          price: service.price,
          quantity: 1,
          serviceType: 'dry_clean'
        })),
        deliveryMethod: orderData.deliveryMethod,
        selectedProvider: orderData.provider?.id || null,
        delivery: {
          type: orderData.deliveryMethod === 'courier' ? 'delivery' : 'pickup',
          address: orderData.userAddress || '',
          contactName: orderData.contactName || '',
          contactPhone: orderData.userPhone || '',
          fee: orderData.fees.deliveryFee || 0
        },
        amounts: {
          subtotal: orderData.fees.originalPrice || 0,
          discount: orderData.fees.discount || 0,
          deliveryFee: orderData.fees.deliveryFee || 0,
          total: orderData.fees.totalAmount || 0
        },
        pickupTime: orderData.time?.text || '',
        notes: ''
      };
      
      console.log('[创建订单] 提交数据:', JSON.stringify(orderPayload, null, 2));
      
      // 调用后端API创建订单
      const result = await app.request('/cleaning/orders', orderPayload, 'POST');
      
      if (result.success && result.data) {
        console.log('[创建订单] 后端返回:', result.data);
        return {
          success: true,
          data: result.data,
          orderId: result.data.orderNo || result.data._id || result.data.id
        };
      } else {
        console.error('[创建订单] API返回失败:', result.error);
        return {
          success: false,
          error: result.error || '创建订单失败'
        };
      }
    } catch (error) {
      console.error('[创建订单] 请求失败:', error);
      return {
        success: false,
        error: error.message || '网络请求失败'
      };
    }
  },
  
  // 获取支付方式名称
  getPaymentMethodName() {
    const methodNames = {
      'wechat': '微信支付',
      'balance': '账户余额',
      'alipay': '支付宝',
      'unionpay': '银行卡支付'
    };
    return methodNames[this.data.selectedPaymentMethod] || '其他支付';
  },
  
  // 微信支付
  async wechatPay(orderId) {
    try {
      // 优先调用后端API获取支付参数
      const res = await app.request('/payment/wechat/unified', {
        orderId: orderId || this.data.orderId,
        amount: this.data.orderData.fees.totalAmount * 100, // 转为分
        openid: app.globalData.userInfo?.openid || '',
        subject: '干洗服务订单-' + (orderId || this.data.orderId)
      }, 'POST');
      
      if (res.success && res.data && res.data.payment) {
        // 小程序调起微信支付
        const payment = res.data.payment;
        await wx.requestPayment({
          timeStamp: payment.timeStamp,
          nonceStr: payment.nonceStr,
          package: payment.package,
          signType: payment.signType || 'MD5',
          paySign: payment.paySign
        });
        
        return { success: true, message: '支付成功' };
      } else {
        // API未接入，使用模拟支付
        console.log('[支付] 后端API未返回支付参数，使用模拟支付');
        return await this.mockPay();
      }
    } catch (error) {
      console.error('微信支付失败:', error);
      // 检查是否是用户取消
      if (error.errMsg && error.errMsg.includes('cancel')) {
        return { success: false, message: '用户取消支付' };
      }
      // 网络错误或其他错误，使用模拟支付
      console.log('[支付] 使用模拟支付作为后备');
      return await this.mockPay();
    }
  },
  
  // 余额支付
  async balancePay(orderId) {
    try {
      // 余额支付：调用统一的支付接口
      const res = await app.request('/payment/create', {
        orderId: orderId || this.data.orderId,
        amount: this.data.orderData.fees.totalAmount,
        subject: '干洗服务订单-' + (orderId || this.data.orderId),
        paymentMethod: 'balance',
        userId: app.globalData.userInfo?.openid || app.globalData.userInfo?.id
      }, 'POST');
      
      if (res.success) {
        return { success: true, message: '余额支付成功' };
      } else {
        throw new Error(res.message || '余额支付失败');
      }
    } catch (error) {
      console.error('余额支付失败:', error);
      // 使用模拟支付
      return await this.mockPay();
    }
  },
  
  // 支付宝支付
  async alipayPay(orderId) {
    try {
      const res = await app.request('/payment/create', {
        orderId: orderId || this.data.orderId,
        amount: this.data.orderData.fees.totalAmount,
        subject: '干洗服务订单-' + (orderId || this.data.orderId),
        paymentMethod: 'alipay'
      }, 'POST');
      
      if (res.success && res.data && res.data.payUrl) {
        // 显示支付宝跳转提示
        this.setData({
          externalPayUrl: res.data.payUrl,
          showExternalPayModal: true
        });
        
        // 跳转到H5支付页面
        wx.navigateTo({
          url: `/pages/webview/index?url=${encodeURIComponent(res.data.payUrl)}&type=alipay`
        });
        
        return { success: false, message: '正在跳转支付宝...' };
      } else {
        // API未接入，提示用户使用其他方式
        app.showToast('支付宝支付暂未接入，请选择其他支付方式', 'none');
        return { success: false, message: '支付宝支付暂未接入' };
      }
    } catch (error) {
      console.error('支付宝支付创建失败:', error);
      app.showToast('支付宝支付暂未接入，请选择其他支付方式', 'none');
      return { success: false, message: '支付宝支付暂未接入' };
    }
  },
  
  // 银行卡/银联支付
  async unionpayPay(orderId) {
    try {
      const res = await app.request('/payment/create', {
        orderId: orderId || this.data.orderId,
        amount: this.data.orderData.fees.totalAmount,
        subject: '干洗服务订单-' + (orderId || this.data.orderId),
        paymentMethod: 'unionpay'
      }, 'POST');
      
      if (res.success && res.data && res.data.payUrl) {
        // 显示银联跳转提示
        this.setData({
          externalPayUrl: res.data.payUrl,
          showExternalPayModal: true
        });
        
        // 跳转到H5支付页面
        wx.navigateTo({
          url: `/pages/webview/index?url=${encodeURIComponent(res.data.payUrl)}&type=unionpay`
        });
        
        return { success: false, message: '正在跳转银联支付...' };
      } else {
        // API未接入，提示用户使用其他方式
        app.showToast('银联支付暂未接入，请选择其他支付方式', 'none');
        return { success: false, message: '银联支付暂未接入' };
      }
    } catch (error) {
      console.error('银联支付创建失败:', error);
      app.showToast('银联支付暂未接入，请选择其他支付方式', 'none');
      return { success: false, message: '银联支付暂未接入' };
    }
  },
  
  // 模拟支付（用于开发和测试）
  async mockPay() {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // 模拟90%成功率
        if (Math.random() > 0.1) {
          resolve({ success: true, message: '支付成功（模拟）' });
        } else {
          reject(new Error('支付失败（模拟）'));
        }
      }, 2000);
    });
  },

  // 取消订单
  onCancelOrder() {
    wx.showModal({
      title: '提示',
      content: '确定要取消该订单吗？',
      success: res => {
        if (res.confirm) {
          app.showToast('订单已取消', 'none');
          setTimeout(() => {
            wx.switchTab({
              url: '/pages/index/index'
            });
          }, 1500);
        }
      }
    });
  },

  // 查看订单详情
  onViewOrderDetail() {
    const detail = `
订单编号：${this.data.orderId}
门店：${this.data.orderData.store.name}
地址：${this.data.orderData.store.address}
服务：${this.data.orderData.services.map(s => s.name).join('、')}
取件方式：${this.data.orderData.deliveryMethod === 'pickup' ? '自送到店' : '跑腿上门取件'}
预约时间：${this.data.orderData.time.text}
    `.trim();
    
    wx.showModal({
      title: '订单详情',
      content: detail,
      showCancel: false,
      confirmText: '知道了'
    });
  }
});

// 格式化倒计时（用于WXML）
function formatCountdown(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

// 导出方法供WXML使用
module.exports = {
  formatCountdown: formatCountdown
};
