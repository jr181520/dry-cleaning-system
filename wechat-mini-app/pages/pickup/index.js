const app = getApp();

Page({
  data: {
    manualCode: '',
    pickupResult: null,
    recentRecords: [],
    pendingOrders: [],
    currentOrder: null
  },

  onLoad(options) {
    console.log('取件页面加载', options);
    
    // 如果有取件码参数，自动验证
    if (options.code) {
      this.verifyPickupCode(options.code);
    }
    
    // 加载最近取件记录
    this.loadRecentRecords();
    // 加载待取件列表
    this.loadPendingOrders();
  },

  onShow() {
    // 检查是否有待处理的取件码
    if (app.globalData.pendingPickupCode) {
      this.verifyPickupCode(app.globalData.pendingPickupCode);
      app.globalData.pendingPickupCode = null;
    }
    // 重新加载待取件列表
    this.loadPendingOrders();
  },

  // 手动输入取件码
  onManualInput(e) {
    this.setData({
      manualCode: e.detail.value.trim().toUpperCase()
    });
  },

  // 提交取件码
  onSubmitCode() {
    const code = this.data.manualCode;
    if (!code) {
      app.showToast('请输入取件码', 'none');
      return;
    }
    this.verifyPickupCode(code);
  },

  // 验证取件码
  async verifyPickupCode(code) {
    if (!code) return;

    app.showLoading('验证取件码...');

    try {
      const result = await app.request('/pickup/verify', {
        code: code
      }, 'POST');

      app.hideLoading();

      if (result.success) {
        // 验证成功
        this.setData({
          pickupResult: {
            status: 'success',
            title: '取件码验证成功',
            message: result.message || '请确认取件信息',
            order: result.order
          },
          currentOrder: result.order
        });

        // 保存到本地记录
        this.saveToLocalRecords({
          id: Date.now().toString(),
          code: code,
          orderId: result.order?.id,
          status: 'completed',
          time: new Date().toLocaleString()
        });
      } else {
        // 验证失败
        this.setData({
          pickupResult: {
            status: 'error',
            title: '取件码无效',
            message: result.message || '请检查取件码是否正确'
          }
        });
      }
    } catch (error) {
      app.hideLoading();
      console.error('验证取件码失败', error);
      
      this.setData({
        pickupResult: {
          status: 'error',
          title: '验证失败',
          message: '网络错误，请稍后重试'
        }
      });
    }
  },

  // 扫描二维码
  onScanQR() {
    wx.scanCode({
      onlyFromCamera: true,
      success: res => {
        console.log('扫码成功', res);
        
        try {
          const data = JSON.parse(res.result);
          if (data.type === 'pickup' && data.code) {
            this.verifyPickupCode(data.code);
          } else {
            app.showToast('无效的二维码', 'none');
          }
        } catch (e) {
          // 如果不是JSON格式，直接当作取件码处理
          this.verifyPickupCode(res.result);
        }
      },
      fail: err => {
        console.error('扫码失败', err);
        if (err.errMsg !== 'scanCode:fail cancel') {
          app.showToast('扫码失败，请重试', 'none');
        }
      }
    });
  },

  // 确认取件
  async onConfirmPickup() {
    if (!this.data.currentOrder) return;

    app.showLoading('确认取件中...');

    try {
      const result = await app.request('/pickup/confirm', {
        orderId: this.data.currentOrder.id,
        code: this.data.pickupResult?.order?.code
      }, 'POST');

      app.hideLoading();

      if (result.success) {
        app.showToast('取件成功！', 'success');
        
        // 清空结果，准备下一次取件
        setTimeout(() => {
          this.setData({
            pickupResult: null,
            manualCode: '',
            currentOrder: null
          });
        }, 1500);
      } else {
        app.showToast(result.message || '取件失败', 'none');
      }
    } catch (error) {
      app.hideLoading();
      console.error('确认取件失败', error);
      app.showToast('网络错误，请稍后重试', 'none');
    }
  },

  // 取消
  onCancel() {
    this.setData({
      pickupResult: null,
      manualCode: '',
      currentOrder: null
    });
  },

  // 重新扫码
  onRetry() {
    this.setData({
      pickupResult: null,
      manualCode: ''
    });
    this.onScanQR();
  },

  // 查看全部记录
  onViewAllRecords() {
    wx.navigateTo({
      url: '/pages/orders/index?type=pickup'
    });
  },

  // 加载最近记录
  loadRecentRecords() {
    const records = wx.getStorageSync('pickupRecords') || [];
    this.setData({
      recentRecords: records.slice(0, 5)
    });
  },

  // 保存到本地记录
  saveToLocalRecords(record) {
    let records = wx.getStorageSync('pickupRecords') || [];
    records.unshift(record);
    
    // 只保留最近20条记录
    if (records.length > 20) {
      records = records.slice(0, 20);
    }
    
    wx.setStorageSync('pickupRecords', records);
    this.loadRecentRecords();
  },

  // 加载待取件列表
  loadPendingOrders() {
    // 模拟待取件数据
    const pendingOrders = [
      {
        id: 1,
        code: 'P000123456',
        customerName: '张三',
        items: [
          { name: '西装', quantity: 1 },
          { name: '衬衫', quantity: 2 }
        ],
        status: 'pending'
      },
      {
        id: 2,
        code: 'P000234567',
        customerName: '李四',
        items: [
          { name: '羽绒服', quantity: 1 }
        ],
        status: 'pending'
      },
      {
        id: 3,
        code: 'P000345678',
        customerName: '王五',
        items: [
          { name: '裤子', quantity: 2 },
          { name: '毛衣', quantity: 1 }
        ],
        status: 'pending'
      }
    ];
    
    this.setData({
      pendingOrders: pendingOrders
    });
  },

  // 快速取件
  onQuickPickup(e) {
    const code = e.currentTarget.dataset.code;
    this.verifyPickupCode(code);
  },

  // 一键全部取出
  onBatchPickup() {
    const pendingOrders = this.data.pendingOrders;
    if (pendingOrders.length === 0) return;
    
    app.showLoading('正在处理全部取件...');
    
    // 模拟批量取件
    setTimeout(() => {
      app.hideLoading();
      app.showToast('全部取件完成', 'success');
      
      // 清空待取件列表
      this.setData({
        pendingOrders: []
      });
    }, 1500);
  }
});
