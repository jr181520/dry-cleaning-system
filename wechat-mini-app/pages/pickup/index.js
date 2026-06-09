const app = getApp();

Page({
  data: {
    manualCode: '',
    pickupResult: null,
    recentRecords: [],
    pendingOrders: [],
    currentOrder: null,
    // 灯条相关状态
    itemLightStatuses: {},    // { [itemIndex]: 'on' | 'off' }
    itemCheckedOut: {},        // { [itemIndex]: true }
    activeLightItems: [],      // 当前活跃灯条列表
    allLit: false,
    allCheckedOut: false,
    pendingLightCount: 0,      // 待点亮物品数
    pollTimer: null            // 轮询定时器
  },

  onLoad(options) {
    console.log('取件页面加载', options);
    
    // 如果有取件码参数，自动验证
    if (options.code) {
      this.verifyPickupCode(options.code);
    }
    
    this.loadRecentRecords();
    this.loadPendingOrders();
  },

  onShow() {
    // 检查是否有待处理的取件码
    if (app.globalData.pendingPickupCode) {
      this.verifyPickupCode(app.globalData.pendingPickupCode);
      app.globalData.pendingPickupCode = null;
    }
    // 检查是否有从订单列表传入的订单ID（门店自提）
    if (app.globalData.pendingPickupOrderId) {
      const orderId = app.globalData.pendingPickupOrderId;
      app.globalData.pendingPickupOrderId = null;
      this.loadOrderPickupInfo(orderId);
    }
    this.loadPendingOrders();
  },

  onHide() {
    this.stopPolling();
  },

  onUnload() {
    this.stopPolling();
  },

  // ============================================
  // 灯条轮询
  // ============================================

  startPolling(orderNo) {
    this.stopPolling();
    const timer = setInterval(() => {
      this.checkBindings(orderNo);
    }, 3000); // 每3秒轮询一次
    this.data.pollTimer = timer;
  },

  stopPolling() {
    if (this.data.pollTimer) {
      clearInterval(this.data.pollTimer);
      this.data.pollTimer = null;
    }
  },

  // 检查订单所有物品的灯条绑定状态
  async checkBindings(orderNo) {
    try {
      const result = await app.request(`/store/order-light/order/${orderNo}/bindings`, {}, 'GET');
      
      if (result.success && result.data && result.data.bindings) {
        const bindings = result.data.bindings;
        const itemLightStatuses = {};
        const itemCheckedOut = {};
        
        bindings.forEach(b => {
          if (b.itemIndex !== null && b.itemIndex !== undefined) {
            itemLightStatuses[b.itemIndex] = b.status === 'active' ? 'on' : 'off';
            itemCheckedOut[b.itemIndex] = b.status === 'completed';
          }
        });
        
        // 更新 pickupResult 中物品的灯条状态
        const pickupResult = this.data.pickupResult;
        if (pickupResult && pickupResult.order && pickupResult.order.items) {
          const items = pickupResult.order.items.map((item, idx) => ({
            ...item,
            lightOn: itemLightStatuses[idx] === 'on',
            checkedOut: itemCheckedOut[idx] === true
          }));
          
          pickupResult.order.items = items;
        }
        
        const activeLightItems = (pickupResult?.order?.items || [])
          .map((item, idx) => ({ ...item, index: idx }))
          .filter(item => item.lightOn);
        
        const allLit = (pickupResult?.order?.items || []).every(item => item.lightOn || item.checkedOut);
        const allCheckedOut = (pickupResult?.order?.items || []).every(item => item.checkedOut);
        const pendingLightCount = (pickupResult?.order?.items || []).filter(item => !item.lightOn && !item.checkedOut).length;
        
        this.setData({
          itemLightStatuses,
          itemCheckedOut,
          activeLightItems,
          allLit,
          allCheckedOut,
          pendingLightCount,
          pickupResult
        });
        
        // 全部出库则停止轮询
        if (allCheckedOut) {
          this.stopPolling();
        }
      }
    } catch (error) {
      console.error('检查灯条绑定状态失败:', error);
    }
  },

  // ============================================
  // 加载订单取件信息（门店自提入口）
  // ============================================

  async loadOrderPickupInfo(orderId) {
    app.showLoading('加载取件信息...');
    try {
      const result = await app.request(`/cleaning/orders/${orderId}`, {}, 'GET');
      app.hideLoading();

      if (result.success && result.data) {
        const order = result.data;
        const pickupCode = order.pickupCode || order.orderNo || '';
        const storeId = order.storeId || 'ST001';
        const orderNo = order.orderNo || orderId;
        
        // 初始化物品列表（附带灯条状态）
        const items = (order.items || []).map(item => ({
          name: item.name || item.itemName || '物品',
          price: item.price || item.unitPrice || 0,
          quantity: item.quantity || 1,
          lightOn: false,
          checkedOut: false
        }));
        
        const itemCount = items.length;
        const pendingLightCount = itemCount;
        
        this.setData({
          pickupResult: {
            status: 'success',
            title: '门店自提',
            message: '点击"亮灯取件"通知店员为您服务',
            order: {
              id: order._id || orderId,
              orderNo: orderNo,
              storeId: storeId,
              customerName: order.contactName || '客户',
              customerPhone: order.contactPhone || '',
              itemCount: itemCount,
              items: items,
              location: order.storeName || order.storeAddress || '门店',
              code: pickupCode
            }
          },
          currentOrder: {
            id: order._id || orderId,
            orderNo: orderNo,
            storeId: storeId,
            code: pickupCode
          },
          manualCode: pickupCode,
          itemLightStatuses: {},
          itemCheckedOut: {},
          activeLightItems: [],
          allLit: false,
          allCheckedOut: false,
          pendingLightCount: pendingLightCount
        });
        
        // 开始轮询灯条状态
        this.startPolling(orderNo);
        
        // 查询已有的绑定状态
        this.checkBindings(orderNo);
      } else {
        app.showToast('订单信息加载失败', 'none');
      }
    } catch (error) {
      app.hideLoading();
      console.error('加载取件信息失败:', error);
      app.showToast('网络错误，请稍后重试', 'none');
    }
  },

  // ============================================
  // 灯条操作
  // ============================================

  // 点亮单个物品灯条
  async onLightItem(e) {
    const itemIndex = parseInt(e.currentTarget.dataset.index);
    const order = this.data.pickupResult?.order;
    if (!order) return;
    
    const item = order.items[itemIndex];
    if (!item || item.checkedOut) return;
    
    app.showLoading('正在点亮灯条...');
    
    try {
      const userInfo = app.globalData.userInfo;
      const result = await app.request('/store/order-light/bind', {
        orderId: order.orderNo,
        storeId: order.storeId,
        itemIndex: itemIndex,
        color: 'green',
        bindingType: 'pickup',
        userId: userInfo?.openid || userInfo?.id || '',
        itemName: item.name || ('物品' + (itemIndex + 1)),
        customerName: userInfo?.nickName || userInfo?.name || order.customerName || '客户',
        remark: `小程序取件 - ${item.name}`
      }, 'POST');
      
      app.hideLoading();
      
      if (result.success) {
        // 更新本地状态
        const items = [...order.items];
        items[itemIndex] = { ...items[itemIndex], lightOn: true };
        
        const pickupResult = { ...this.data.pickupResult };
        pickupResult.order.items = items;
        
        const activeLightItems = items
          .map((it, idx) => ({ ...it, index: idx }))
          .filter(it => it.lightOn);
        
        const allLit = items.every(it => it.lightOn || it.checkedOut);
        const pendingLightCount = items.filter(it => !it.lightOn && !it.checkedOut).length;
        
        this.setData({
          pickupResult,
          activeLightItems,
          allLit,
          pendingLightCount,
          [`itemLightStatuses.${itemIndex}`]: 'on'
        });
        
        app.showToast(`✅ 已点亮"${item.name}"灯条`, 'success');
      } else {
        app.showToast(result.message || '点亮失败', 'none');
      }
    } catch (error) {
      app.hideLoading();
      console.error('点亮灯条失败:', error);
      app.showToast('网络错误，请稍后重试', 'none');
    }
  },

  // 一键点亮所有灯条
  async onLightAllItems() {
    const order = this.data.pickupResult?.order;
    if (!order) return;
    
    const pendingItems = order.items
      .map((item, idx) => ({ item, index: idx }))
      .filter(({ item }) => !item.lightOn && !item.checkedOut);
    
    if (pendingItems.length === 0) {
      app.showToast('所有物品灯条已点亮或已出库', 'none');
      return;
    }
    
    app.showLoading(`正在点亮 ${pendingItems.length} 个灯条...`);
    
    let successCount = 0;
    const userInfo = app.globalData.userInfo;
    
    for (let i = 0; i < pendingItems.length; i++) {
      const { item, index: itemIndex } = pendingItems[i];
      
      try {
        await app.request('/store/order-light/bind', {
          orderId: order.orderNo,
          storeId: order.storeId,
          itemIndex: itemIndex,
          color: 'green',
          bindingType: 'pickup',
          userId: userInfo?.openid || userInfo?.id || '',
          itemName: item.name || ('物品' + (itemIndex + 1)),
          customerName: userInfo?.nickName || userInfo?.name || order.customerName || '客户',
          remark: `小程序批量取件 - ${item.name}`
        }, 'POST');
        successCount++;
        
        // 更新本地状态
        const items = [...order.items];
        items[itemIndex] = { ...items[itemIndex], lightOn: true };
        
        const pickupResult = { ...this.data.pickupResult };
        pickupResult.order.items = items;
        
        const activeLightItems = items
          .map((it, idx) => ({ ...it, index: idx }))
          .filter(it => it.lightOn);
        
        this.setData({
          pickupResult,
          activeLightItems,
          [`itemLightStatuses.${itemIndex}`]: 'on'
        });
      } catch (err) {
        console.error(`点亮物品 ${itemIndex} 失败:`, err);
      }
      
      // 间隔500ms避免过快
      if (i < pendingItems.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    app.hideLoading();
    
    const allLit = order.items.every(it => it.lightOn || it.checkedOut);
    const pendingLightCount = order.items.filter(it => !it.lightOn && !it.checkedOut).length;
    
    this.setData({ allLit, pendingLightCount });
    
    app.showToast(`✅ 已点亮 ${successCount} 个灯条`, 'success');
  },

  // 刷新灯条状态
  async onRefreshStatus() {
    const order = this.data.pickupResult?.order;
    if (!order) return;
    
    app.showLoading('刷新中...');
    await this.checkBindings(order.orderNo);
    app.hideLoading();
    app.showToast('已刷新', 'success');
  },

  // ============================================
  // 取件码验证（walk-in 模式）
  // ============================================

  async verifyPickupCode(code) {
    if (!code) return;

    app.showLoading('验证取件码...');

    try {
      const result = await app.request('/store/pickup/verify', {
        code: code
      }, 'POST');

      app.hideLoading();

      if (result.success && result.data) {
        const orderData = result.data;
        const orderNo = orderData.orderNo;
        const storeId = orderData.storeId || 'ST001';
        
        // 初始化物品列表
        const items = (orderData.items || []).map(item => ({
          name: item.name || item.itemName || '物品',
          price: item.price || item.unitPrice || 0,
          quantity: item.quantity || 1,
          lightOn: false,
          checkedOut: false
        }));
        
        const itemCount = orderData.itemCount || items.length;
        const pendingLightCount = items.length;

        this.setData({
          pickupResult: {
            status: 'success',
            title: '取件码验证成功',
            message: '点击"亮灯取件"通知店员为您服务',
            order: {
              id: orderData.id || orderData._id,
              orderNo: orderNo,
              storeId: storeId,
              customerName: orderData.contactName || '客户',
              customerPhone: orderData.contactPhone || '',
              itemCount: itemCount,
              items: items,
              location: orderData.storeId || '门店',
              code: orderData.pickupCode || code,
              lightBinding: orderData.lightBinding
            }
          },
          currentOrder: {
            id: orderData.id || orderData._id,
            orderNo: orderNo,
            storeId: storeId,
            code: orderData.pickupCode || code
          },
          itemLightStatuses: {},
          itemCheckedOut: {},
          activeLightItems: [],
          allLit: false,
          allCheckedOut: false,
          pendingLightCount: pendingLightCount
        });

        this.saveToLocalRecords({
          id: Date.now().toString(),
          code: code,
          orderId: orderData.id || orderData._id,
          status: 'verified',
          time: new Date().toLocaleString()
        });
        
        // 开始轮询
        this.startPolling(orderNo);
        this.checkBindings(orderNo);
      } else {
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

  // ============================================
  // 操作按钮
  // ============================================

  // 取消/返回
  onCancel() {
    this.stopPolling();
    this.setData({
      pickupResult: null,
      manualCode: '',
      currentOrder: null,
      itemLightStatuses: {},
      itemCheckedOut: {},
      activeLightItems: [],
      allLit: false,
      allCheckedOut: false,
      pendingLightCount: 0
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

  // ============================================
  // 本地记录
  // ============================================

  loadRecentRecords() {
    const records = wx.getStorageSync('pickupRecords') || [];
    this.setData({
      recentRecords: records.slice(0, 5)
    });
  },

  saveToLocalRecords(record) {
    let records = wx.getStorageSync('pickupRecords') || [];
    records.unshift(record);
    
    if (records.length > 20) {
      records = records.slice(0, 20);
    }
    
    wx.setStorageSync('pickupRecords', records);
    this.loadRecentRecords();
  },

  // ============================================
  // 待取件列表
  // ============================================

  async loadPendingOrders() {
    try {
      const userInfo = app.globalData.userInfo;
      const userId = userInfo?.openid || userInfo?.id || '';
      const result = await app.request(`/orders/pending?userId=${userId}`, {}, 'GET');
      
      if (result.success && result.data) {
        const pendingOrders = (Array.isArray(result.data) ? result.data : []).map(order => ({
          id: order._id || order.id,
          orderNo: order.orderNo,
          code: order.pickupCode || order.orderNo,
          customerName: order.contactName || '客户',
          storeId: order.storeId,
          items: order.items || [],
          itemCount: order.items ? order.items.reduce((sum, item) => sum + (item.quantity || 1), 0) : 0,
          status: order.status
        }));
        
        this.setData({ pendingOrders });
      }
    } catch (error) {
      console.error('加载待取件列表失败:', error);
    }
  },

  // 从待取件列表快速取件
  onQuickPickup(e) {
    const orderId = e.currentTarget.dataset.id;
    const code = e.currentTarget.dataset.code;
    
    app.showLoading('加载订单信息...');
    app.request('/store/pickup/verify', {
      orderId: orderId,
      code: code
    }, 'POST').then(result => {
      app.hideLoading();
      if (result.success && result.data) {
        const orderData = result.data;
        const orderNo = orderData.orderNo;
        const storeId = orderData.storeId || 'ST001';
        
        const items = (orderData.items || []).map(item => ({
          name: item.name || item.itemName || '物品',
          price: item.price || item.unitPrice || 0,
          quantity: item.quantity || 1,
          lightOn: false,
          checkedOut: false
        }));
        
        const itemCount = orderData.itemCount || items.length;
        
        this.setData({
          pickupResult: {
            status: 'success',
            title: '取件码验证成功',
            message: '点击"亮灯取件"通知店员为您服务',
            order: {
              id: orderData.id || orderData._id,
              orderNo: orderNo,
              storeId: storeId,
              customerName: orderData.contactName || '客户',
              customerPhone: orderData.contactPhone || '',
              itemCount: itemCount,
              items: items,
              location: orderData.storeId || '门店',
              code: orderData.pickupCode || code,
              lightBinding: orderData.lightBinding
            }
          },
          currentOrder: {
            id: orderData.id || orderData._id,
            orderNo: orderNo,
            storeId: storeId,
            code: orderData.pickupCode || code
          },
          itemLightStatuses: {},
          itemCheckedOut: {},
          activeLightItems: [],
          allLit: false,
          allCheckedOut: false,
          pendingLightCount: items.length
        });
        
        this.saveToLocalRecords({
          id: Date.now().toString(),
          code: code,
          orderId: orderData.id || orderData._id,
          status: 'verified',
          time: new Date().toLocaleString()
        });
        
        this.startPolling(orderNo);
        this.checkBindings(orderNo);
      } else {
        app.showToast(result.message || '订单验证失败', 'none');
      }
    }).catch(error => {
      app.hideLoading();
      console.error('快速取件验证失败:', error);
      app.showToast('网络错误，请稍后重试', 'none');
    });
  }
});
