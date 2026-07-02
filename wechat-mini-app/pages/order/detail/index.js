/**
 * 订单详情页面
 * 支持实时状态更新、扫码支付和取件方式选择
 */

const app = getApp();

// 订单状态配置（完整覆盖所有后端可能返回的状态）
const STATUS_CONFIG = {
  pending: { text: '待支付', icon: 'clock-o', color: '#ff9800', gradient: 'linear-gradient(135deg, #ff9800, #ff5722)', desc: '订单已创建，请尽快完成支付' },
  paid: { text: '已支付', icon: 'check-circle', color: '#4caf50', gradient: 'linear-gradient(135deg, #4caf50, #2e7d32)', desc: '支付成功，等待门店收件入库' },
  delivering: { text: '取件配送中', icon: 'truck', color: '#2196f3', gradient: 'linear-gradient(135deg, #2196f3, #1976d2)', desc: '衣物正在配送至门店途中' },
  received: { text: '已入库', icon: 'inbox', color: '#9c27b0', gradient: 'linear-gradient(135deg, #9c27b0, #7b1fa2)', desc: '衣物已送达门店并入库，等待处理' },
  processing: { text: '处理中', icon: 'refresh', color: '#ff5722', gradient: 'linear-gradient(135deg, #ff5722, #e64a19)', desc: '正在处理您的衣物' },
  cleaning: { text: '清洗中', icon: 'refresh', color: '#ff9800', gradient: 'linear-gradient(135deg, #ff9800, #f57c00)', desc: '衣物正在清洗中，请耐心等待' },
  cleaned: { text: '清洗完成', icon: 'check-circle-o', color: '#00bcd4', gradient: 'linear-gradient(135deg, #00bcd4, #0097a7)', desc: '清洗已完成，等待质检和打包' },
  ready: { text: '待取件', icon: 'gift', color: '#00bcd4', gradient: 'linear-gradient(135deg, #00bcd4, #0097a7)', desc: '衣物已处理完成，请选择取件方式' },
  delivering_back: { text: '送回中', icon: 'truck', color: '#2196f3', gradient: 'linear-gradient(135deg, #2196f3, #1976d2)', desc: '衣物正在送回途中' },
  completed: { text: '已完成', icon: 'flag-checkered', color: '#4caf50', gradient: 'linear-gradient(135deg, #4caf50, #388e3c)', desc: '订单已完成，感谢您的使用' },
  cancelled: { text: '已取消', icon: 'times-circle', color: '#9e9e9e', gradient: 'linear-gradient(135deg, #9e9e9e, #757575)', desc: '订单已取消' },
  // C端/M端操作产生的中间态
  awaiting_store_confirm: { text: '待门店确认', icon: 'store', color: '#ff9800', gradient: 'linear-gradient(135deg, #ff9800, #ff5722)', desc: '等待门店确认接收' },
  store_confirmed: { text: '门店已确认', icon: 'check-circle-o', color: '#4caf50', gradient: 'linear-gradient(135deg, #4caf50, #2e7d32)', desc: '门店已确认接收订单' },
  awaiting_pickup_scan: { text: '等待扫码取件', icon: 'qrcode', color: '#607d8b', gradient: 'linear-gradient(135deg, #607d8b, #455a64)', desc: '等待门店扫码确认取件' },
  awaiting_store_outbound: { text: '等待出库', icon: 'logout', color: '#3f51b5', gradient: 'linear-gradient(135deg, #3f51b5, #303f9f)', desc: '等待门店出库' },
  store_outbound: { text: '已出库', icon: 'send', color: '#00bcd4', gradient: 'linear-gradient(135deg, #00bcd4, #0097a7)', desc: '商家已完成出库，等待取件' }
};

// 可见步骤（与C端对齐：7步）
// 索引: 0=paid  1=delivering  2=received  3=processing  4=ready  5=store_outbound  6=completed
const VISIBLE_STEPS = ['paid', 'delivering', 'received', 'processing', 'ready', 'store_outbound', 'completed'];

// 所有后端状态 → 步骤索引（-1 = 进度条前/不显示进度）
const STATUS_TO_STEP = {
  pending: -1,
  paid: 0,
  awaiting_store_confirm: 0,
  store_confirmed: 0,
  delivering: 1,
  received: 2,
  processing: 3,
  in_progress: 3,
  cleaning: 3,
  cleaned: 3,
  awaiting_store_outbound: 4,
  ready: 4,
  store_outbound: 5,
  delivering_back: 5,
  awaiting_pickup_scan: 5,
  completed: 6,
  cancelled: -1
};

Page({
  data: {
    orderId: '',
    order: null,
    statusConfig: {},
    steps: [],
    currentStep: 0,
    progressPercent: 0,
    loading: true,
    polling: false,
    
    // 扫码支付相关
    showScanPayBanner: false,  // 显示扫码支付横幅
    scanPayAmount: 0,          // 扫码订单金额
    isFromScan: false,         // 是否从扫码进入
    
    // 取件方式选择
    showPickupMethod: false,
    selectedPickupMethod: 'store_pickup', // store_pickup: 到店自提, home_delivery: 配送到家
    
    // 跑腿配送跟踪
    showCourierTracker: false,
    courierInfo: null,
    deliveryForm: {
      address: '',
      contactName: '',
      contactPhone: ''
    },

    // 跑腿服务商选择面板
    showCourierPanel: false,
    courierProviders: [],         // 服务商报价列表
    selectedCourier: '',          // 选中的服务商ID
    deliveryMode: 'solo',         // solo: 一对一, shared: 拼单
    courierFee: 0,                // 选中的配送费
    courierLoading: false,        // 报价加载中

    // 内嵌支付相关
    selectedPayMethod: 'wechat',
    showPayPanel: false,
    isPaying: false,

    // 灯条管理窗口
    showLightPanel: false,
    lightItems: [],           // 物品列表（含灯条状态）
    lightBindings: {},        // { itemIndex: { status, lightId } }
    allLit: false,
    allCheckedOut: false,
    pendingLightCount: 0,
    activeLightItems: []
  },

  pollTimer: null,
  pollInterval: 3000, // 3秒轮询
  lightPollTimer: null,
  courierPollTimer: null,  // 配送跟踪专用轮询
  deliveryCompleted: false, // 防止重复处理已送达

  onLoad(options) {
    const { id, mode } = options;
    console.log('[订单详情] onLoad, options:', options);
    console.log('[订单详情] 接收到的id:', id);
    
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
      console.log('[订单详情] 从订单列表进入，id:', id);
      this.setData({ orderId: id });
      this.loadOrderDetail();
      this.startPolling();
    } else {
      console.log('[订单详情] 无id参数，加载演示数据');
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
    this.stopLightPolling();
    this.stopCourierPolling();
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
      const orderId = this.data.orderId;
      console.log('[订单详情] 加载订单:', orderId);
      
      if (!orderId) {
        console.error('[订单详情] 订单ID为空');
        this.loadDemoOrder();
        return;
      }
      
      // 直接使用正确的API路径
      const result = await app.request(`/cleaning/orders/${orderId}`);
      console.log('[订单详情] API响应:', result);
      
      if (result.success && result.data) {
        this.updateOrderUI(result.data);
      } else {
        console.error('[订单详情] API返回失败:', result);
        // 尝试加载演示订单
        if (orderId === 'demo') {
          this.loadDemoOrder();
        } else {
          // 显示错误提示
          wx.showToast({
            title: result.error || '加载失败',
            icon: 'none'
          });
        }
      }
    } catch (error) {
      console.error('[订单详情] 加载失败:', error);
      if (this.data.orderId === 'demo') {
        this.loadDemoOrder();
      } else {
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
      }
    } finally {
      this.setData({ loading: false });
      if (callback) callback();
    }
  },

  // 更新订单UI
  updateOrderUI(order) {
    console.log('[订单详情] updateOrderUI 被调用');
    console.log('[订单详情] order 对象:', JSON.stringify(order));
    console.log('[订单详情] order.status 类型:', typeof order.status, '值:', order.status);
    
    // 确保 order.status 有有效值
    if (!order.status) {
      console.warn('[订单详情] order.status 为空，设置为 pending');
      order.status = 'pending';
    }
    
    const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
    
    // 根据状态映射计算当前步骤索引（与C端6步对齐）
    const currentStep = STATUS_TO_STEP[order.status] !== undefined ? STATUS_TO_STEP[order.status] : -1;
    
    // 进度百分比
    const progressPercent = currentStep >= 0 
      ? (currentStep / (VISIBLE_STEPS.length - 1)) * 100 
      : 0;

    // 生成6步进度数据，纯 class 驱动（与C端一致：固定紫色渐变）
    const steps = VISIBLE_STEPS.map((step, index) => {
      const isActive = index <= currentStep;
      const isCurrent = index === currentStep;
      return {
        key: step,
        text: this.getStepText(step),
        active: isActive,
        current: isCurrent,
        icon: this.getStepIcon(step)
      };
    });

    // 判断是否显示取件方式选择（ready / store_outbound 及中间取件态）
    const showPickupMethod = ['ready', 'store_outbound', 'awaiting_pickup_scan', 'awaiting_store_outbound'].includes(order.status);


    // 确保 statusDescription 有值
    if (!order.statusDescription) {
      order.statusDescription = statusConfig.desc || '';
    }

    // 处理跑腿配送跟踪信息（从后端 courier 字段读取）
    let courierInfo = null;
    let showCourierTracker = false;
    if (order.deliveryMethod === 'courier' || order.selectedProvider || order.courier) {
      const courier = order.courier || {};
      const isCourierOrder = !!(order.deliveryMethod === 'courier' || courier.provider);
      if (isCourierOrder && courier.status !== 'delivered') {
        showCourierTracker = true;
      }
      // 已送达 → 自动隐藏跟踪栏
      const statusMap = {
        'picking': { text: '取件中', className: 'picking' },
        'delivering': { text: '配送中', className: 'delivering' },
        'delivered': { text: '已送达', className: 'delivered' }
      };
      const st = statusMap[courier.status] || statusMap.picking;
      courierInfo = {
        name: courier.name || '配送员',
        phone: courier.phone || '138****1234',
        status: courier.status || 'picking',
        statusText: st.text,
        statusClass: st.className,
        progress: courier.progress || 0,
        distance: courier.distance || '1.5km',
        eta: courier.eta || '15分钟',
        assignedAt: courier.assignedAt || ''
      };
      
      // 注意：已送达的自动收起+返回逻辑不在此处（updateOrderUI在首次加载也调用）
      // 只在实时轮询 fetchCourierStatus() 中触发，避免进入详情页就被退出
    }

    // 【修复】为物品清单中的每个物品添加中文状态文本映射
    // 后端返回的 item.status 是英文值（如 'received'），需要转为中文显示
    const itemStatusMap = {
      pending: '待入库',
      received: '已入库',
      cleaning: '清洗中',
      cleaned: '清洗完成',
      ready: '待取件',
      completed: '已完成',
      courier_waiting: '等待骑手',
      courier_picked_up: '骑手已取件',
      courier_delivering: '配送中',
      customer_received: '已签收',
      customer_picked_up: '已取件'
    };
    if (order.items && Array.isArray(order.items)) {
      order.items = order.items.map(item => ({
        ...item,
        statusText: itemStatusMap[item.status] || item.status || '未知'
      }));
    }

    this.setData({
      order,
      statusConfig,
      steps,
      currentStep,
      progressPercent,
      showPickupMethod,
      courierInfo,
      showCourierTracker
    });
    
    // 跑腿订单 & 未送达 → 启动配送快速轮询
    if (showCourierTracker && courierInfo && courierInfo.status !== 'delivered') {
      this.startCourierPolling();
    } else if (!showCourierTracker || (courierInfo && courierInfo.status === 'delivered')) {
      this.stopCourierPolling();
    }
    
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

  // 获取步骤文字（与C端6步对齐）
  getStepText(step) {
    const textMap = {
      paid: '已支付',
      delivering: '取件中',
      received: '已入库',
      processing: '处理中',
      ready: '待取件',
      store_outbound: '已出库',
      completed: '完成'
    };
    return textMap[step] || step;
  },

  // 获取步骤图标（与C端7步对齐）
  getStepIcon(step) {
    const iconMap = {
      paid: 'check-circle',      // ✓ 已支付
      delivering: 'truck',       // 🚚 取件中
      received: 'inbox',         // 📦 已入库
      processing: 'refresh',     // ⚙ 处理中
      ready: 'gift',             // 🎁 待取件
      store_outbound: 'send',    // 📤 已出库
      completed: 'flag'          // 🏁 完成
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
    
    const validStatuses = ['ready', 'awaiting_pickup_scan', 'awaiting_store_outbound'];
    if (!validStatuses.includes(order.status)) return;
    
    // 保存用户信息
    this.saveUserInfo();
    
    if (selectedPickupMethod === 'home_delivery') {
      // 配送到家：验证表单 → 打开服务商选择面板
      if (!deliveryForm.address || !deliveryForm.contactName || !deliveryForm.contactPhone) {
        wx.showToast({ title: '请填写完整配送信息', icon: 'none' });
        return;
      }
      await this.openCourierPanel();
    } else {
      // 到店自提 - 打开扫码取件 / 灯条管理窗口
      await this.onScanPickup();
    }
  },

  // ============================================
  // 跑腿服务商选择面板
  // ============================================

  // 打开跑腿服务商选择面板
  async openCourierPanel() {
    this.setData({ showCourierPanel: true, courierLoading: true, selectedCourier: '', courierFee: 0 });
    await this.loadCourierQuotes();
    this.setData({ courierLoading: false });
  },

  // 关闭跑腿面板
  onCloseCourierPanel() {
    this.setData({ showCourierPanel: false });
  },

  // 切换配送模式
  onSwitchDeliveryMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ deliveryMode: mode, selectedCourier: '', courierFee: 0 });
  },

  // 加载服务商报价
  async loadCourierQuotes() {
    try {
      const result = await app.request('/delivery/quotes', {
        pickup: { latitude: 30.5, longitude: 114.3 },
        delivery: { latitude: 30.6, longitude: 114.4 },
        distance: 3,
        isNewUser: true
      }, 'POST');

      if (result.success && result.data && result.data.length > 0) {
        this.setData({ courierProviders: result.data });
      } else {
        this.useFallbackCourierQuotes();
      }
    } catch (error) {
      console.log('[跑腿面板] API不可用，使用本地数据:', error.message);
      this.useFallbackCourierQuotes();
    }
  },

  // 本地回退服务商数据
  useFallbackCourierQuotes() {
    this.setData({
      courierProviders: [
        {
          id: 'meituan', name: '美团跑腿', icon: '🛵',
          rating: 4.9, distance: 3.0, estimatedTime: '25-40分钟',
          hasDiscount: true, discountInfo: '新用户首单减¥3',
          pricing: {
            solo: { originalFee: 11, discount: 3, actualFee: 8 },
            shared: { originalFee: 7.15, discount: 0, actualFee: 7.15 }
          }
        },
        {
          id: 'jd', name: '京东秒送', icon: '🚚',
          rating: 4.8, distance: 3.0, estimatedTime: '30-45分钟',
          hasDiscount: true, discountInfo: '平日85折',
          pricing: {
            solo: { originalFee: 12, discount: 1.8, actualFee: 10.2 },
            shared: { originalFee: 7.2, discount: 0, actualFee: 7.2 }
          }
        },
        {
          id: 'sf', name: '顺丰跑腿', icon: '✈️',
          rating: 4.9, distance: 3.0, estimatedTime: '20-35分钟',
          hasDiscount: true, discountInfo: '满¥50减¥5',
          pricing: {
            solo: { originalFee: 12, discount: 5, actualFee: 7 },
            shared: { originalFee: 8.4, discount: 0, actualFee: 8.4 }
          }
        },
        {
          id: 'taobao', name: '淘宝闪购', icon: '🛒',
          rating: 4.7, distance: 3.0, estimatedTime: '25-40分钟',
          hasDiscount: true, discountInfo: '限时优惠¥3',
          pricing: {
            solo: { originalFee: 10.4, discount: 3, actualFee: 7.4 },
            shared: { originalFee: 6.45, discount: 0, actualFee: 6.45 }
          }
        }
      ]
    });
  },

  // 选择服务商
  onSelectCourier(e) {
    const providerId = e.currentTarget.dataset.provider;
    const { courierProviders, deliveryMode } = this.data;
    const provider = courierProviders.find(p => p.id === providerId);
    if (!provider) return;

    const pricing = deliveryMode === 'shared' ? provider.pricing.shared : provider.pricing.solo;
    this.setData({
      selectedCourier: providerId,
      courierFee: pricing.actualFee
    });
  },

  // 确认选择跑腿服务商并支付
  async onConfirmCourier() {
    const { selectedCourier, courierFee, deliveryMode, deliveryForm, orderId } = this.data;
    if (!selectedCourier) {
      wx.showToast({ title: '请先选择服务商', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交中...' });

    try {
      // 1. 提交取件方式
      await app.request(`/cleaning/orders/${orderId}/pickup-method`, {
        method: 'home_delivery',
        address: deliveryForm.address,
        contactName: deliveryForm.contactName,
        contactPhone: deliveryForm.contactPhone
      }, 'POST');

      // 2. 支付配送费
      const payResult = await app.request(`/cleaning/orders/${orderId}/pay-delivery-fee`, {
        provider: {
          meituan: '美团跑腿', jd: '京东秒送', sf: '顺丰跑腿', taobao: '淘宝闪购'
        }[selectedCourier] || selectedCourier,
        fee: courierFee,
        payTime: new Date().toISOString(),
        mode: deliveryMode
      }, 'POST');

      wx.hideLoading();

      if (payResult.success) {
        wx.showToast({ title: '配送已安排', icon: 'success' });
        this.setData({ showCourierPanel: false });
        this.loadOrderDetail();
      } else {
        wx.showToast({ title: payResult.error || '支付失败', icon: 'none' });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('[跑腿面板] 提交失败:', error);
      // 本地回退：模拟成功
      wx.showToast({ title: '配送已安排（离线模式）', icon: 'success' });
      this.setData({ showCourierPanel: false });
      this.loadOrderDetail();
    }
  },

  // ============================================
  // 扫码取件 / 灯条管理窗口
  // ============================================

  // 打开灯条管理窗口
  async onScanPickup() {
    const { order } = this.data;
    if (!order) return;
    
    const orderNo = order.orderNo || order.orderId || order._id;
    const storeId = order.storeId || 'ST001';
    
    // 初始化物品灯条状态
    const items = (order.items || []).map((item, idx) => ({
      ...item,
      index: idx,
      lightOn: false,
      checkedOut: false,
      name: item.name || ('物品' + (idx + 1))
    }));
    
    this.setData({
      showLightPanel: true,
      lightItems: items,
      lightBindings: {},
      allLit: false,
      allCheckedOut: false,
      pendingLightCount: items.length,
      activeLightItems: [],
      currentOrderNo: orderNo,
      currentStoreId: storeId
    });
    
    // 查询已有绑定状态
    await this.checkLightBindings();
    
    // 开始轮询
    this.startLightPolling();
  },

  // 轮询灯条绑定状态
  startLightPolling() {
    this.stopLightPolling();
    this.lightPollTimer = setInterval(() => {
      this.checkLightBindings();
    }, 3000);
  },

  stopLightPolling() {
    if (this.lightPollTimer) {
      clearInterval(this.lightPollTimer);
      this.lightPollTimer = null;
    }
  },

  // 查询订单物品灯条绑定状态
  async checkLightBindings() {
    try {
      const orderNo = this.data.currentOrderNo;
      if (!orderNo) return;
      
      const result = await app.request(`/store/order-light/order/${orderNo}/bindings`, {}, 'GET');
      
      if (result.success && result.data && result.data.bindings) {
        const bindings = result.data.bindings;
        const lightBindings = {};
        
        bindings.forEach(b => {
          if (b.itemIndex !== null && b.itemIndex !== undefined) {
            lightBindings[b.itemIndex] = {
              status: b.status,       // 'active' | 'completed'
              lightId: b._id,
              checkedOut: b.status === 'completed',
              lightOn: b.status === 'active'
            };
          }
        });
        
        // 更新物品状态
        const items = this.data.lightItems.map((item, idx) => ({
          ...item,
          lightOn: !!lightBindings[idx]?.lightOn,
          checkedOut: !!lightBindings[idx]?.checkedOut
        }));
        
        const activeLightItems = items
          .filter(it => it.lightOn);
        
        const allLit = items.every(it => it.lightOn || it.checkedOut);
        const allCheckedOut = items.every(it => it.checkedOut);
        const pendingLightCount = items.filter(it => !it.lightOn && !it.checkedOut).length;
        
        this.setData({
          lightBindings,
          lightItems: items,
          activeLightItems,
          allLit,
          allCheckedOut,
          pendingLightCount
        });
        
        // 全部出库 → 自动完成取件 & 关闭
        if (allCheckedOut && items.length > 0) {
          this.stopLightPolling();
          await this.autoCompletePickup();
        }
      }
    } catch (error) {
      console.error('检查灯条绑定状态失败:', error);
    }
  },

  // 全部出库后自动完成取件
  async autoCompletePickup() {
    try {
      const orderId = this.data.orderId || this.data.order?._id;
      const result = await app.request(`/orders/${orderId}/pickup`, {}, 'POST');
      if (result.success) {
        wx.showToast({ title: '所有物品已出库，取件完成', icon: 'success' });
        this.setData({ showLightPanel: false });
        this.loadOrderDetail();
      }
    } catch (error) {
      console.error('自动完成取件失败:', error);
    }
  },

  // 点亮单个物品灯条
  async onLightUpItem(e) {
    const itemIndex = parseInt(e.currentTarget.dataset.index);
    const item = this.data.lightItems[itemIndex];
    if (!item || item.checkedOut) return;
    
    wx.showLoading({ title: '正在点亮灯条...' });
    
    try {
      const result = await app.request('/store/order-light/bind', {
        orderId: this.data.currentOrderNo,
        storeId: this.data.currentStoreId,
        itemIndex: itemIndex,
        color: 'green',
        bindingType: 'pickup',
        userId: app.globalData.userInfo?.openid || app.globalData.userInfo?.id || '',
        itemName: item.name || ('物品' + (itemIndex + 1)),
        customerName: this.data.order?.contactName || '客户',
        remark: `小程序取件 - ${item.name}`
      }, 'POST');
      
      wx.hideLoading();
      
      if (result.success) {
        // 本地更新
        const items = [...this.data.lightItems];
        items[itemIndex] = { ...items[itemIndex], lightOn: true };
        
        const activeLightItems = items.filter(it => it.lightOn);
        const allLit = items.every(it => it.lightOn || it.checkedOut);
        const pendingLightCount = items.filter(it => !it.lightOn && !it.checkedOut).length;
        
        this.setData({
          lightItems: items,
          activeLightItems,
          allLit,
          pendingLightCount
        });
        
        wx.showToast({ title: `已点亮"${item.name}"灯条`, icon: 'success' });
      } else {
        wx.showToast({ title: result.message || '点亮失败', icon: 'none' });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('点亮灯条失败:', error);
      wx.showToast({ title: '网络错误，请稍后重试', icon: 'none' });
    }
  },

  // 一键点亮所有灯条
  async onLightUpAll() {
    const pendingItems = this.data.lightItems
      .map((item, idx) => ({ item, index: idx }))
      .filter(({ item }) => !item.lightOn && !item.checkedOut);
    
    if (pendingItems.length === 0) {
      wx.showToast({ title: '所有物品灯条已点亮或已出库', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: `正在点亮 ${pendingItems.length} 个灯条...` });
    
    let successCount = 0;
    for (const { item, index } of pendingItems) {
      try {
        const result = await app.request('/store/order-light/bind', {
          orderId: this.data.currentOrderNo,
          storeId: this.data.currentStoreId,
          itemIndex: index,
          color: 'green',
          bindingType: 'pickup',
          userId: app.globalData.userInfo?.openid || app.globalData.userInfo?.id || '',
          itemName: item.name || ('物品' + (index + 1)),
          customerName: this.data.order?.contactName || '客户',
          remark: `小程序取件 - ${item.name}`
        }, 'POST');
        
        if (result.success) {
          successCount++;
          const items = [...this.data.lightItems];
          items[index] = { ...items[index], lightOn: true };
          this.setData({ lightItems: items });
        }
      } catch (err) {
        console.error(`点亮物品${index}失败:`, err);
      }
    }
    
    wx.hideLoading();
    
    const activeLightItems = this.data.lightItems.filter(it => it.lightOn);
    const allLit = this.data.lightItems.every(it => it.lightOn || it.checkedOut);
    const pendingLightCount = this.data.lightItems.filter(it => !it.lightOn && !it.checkedOut).length;
    
    this.setData({
      activeLightItems,
      allLit,
      pendingLightCount
    });
    
    wx.showToast({ title: `成功点亮 ${successCount}/${pendingItems.length} 个灯条`, icon: 'success' });
  },

  // 关闭灯条管理窗口
  onCloseLightPanel() {
    this.stopLightPolling();
    this.setData({ showLightPanel: false });
  },

  // 提交取件方式（保留兼容，新流程走 onConfirmCourier）
  async submitPickupMethod() {
    const { orderId, selectedPickupMethod, deliveryForm } = this.data;
    
    try {
      const result = await app.request(`/cleaning/orders/${orderId}/pickup-method`, {
        method: selectedPickupMethod,
        address: deliveryForm.address,
        contactName: deliveryForm.contactName,
        contactPhone: deliveryForm.contactPhone
      }, 'POST');
      
      if (result.success) {
        wx.showToast({ title: '已选择配送到家', icon: 'success' });
        this.loadOrderDetail();
      } else {
        wx.showToast({ title: result.error || '操作失败', icon: 'none' });
      }
    } catch (error) {
      wx.showToast({ title: '操作失败（离线模式）', icon: 'none' });
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

  // ===== 配送跟踪专用快速轮询（2秒间隔） =====
  startCourierPolling() {
    if (this.courierPollTimer) return;
    console.log('[配送跟踪] 启动快速轮询（2秒间隔）');
    this.courierPollTimer = setInterval(() => {
      this.fetchCourierStatus();
    }, 2000);
  },

  stopCourierPolling() {
    if (this.courierPollTimer) {
      clearInterval(this.courierPollTimer);
      this.courierPollTimer = null;
      console.log('[配送跟踪] 停止快速轮询');
    }
  },

  // 获取配送状态（轻量级接口，只查 courier 字段）
  async fetchCourierStatus() {
    try {
      const result = await app.request(`/cleaning/orders/${this.data.orderId}`, {}, 'GET');
      if (result.success && result.data) {
        const courier = result.data.courier || {};
        const oldCourier = this.data.order?.courier || {};
        
        // 有变化才更新UI
        if (courier.status !== oldCourier.status || courier.progress !== oldCourier.progress) {
          console.log('[配送跟踪] 📍 状态更新:', oldCourier.status, '→', courier.status, '进度:', courier.progress + '%');
          
          // 直接更新 courierInfo 数据（避免全量刷新页面）
          const statusMap = {
            'picking': { text: '取件中', className: 'picking' },
            'delivering': { text: '配送中', className: 'delivering' },
            'delivered': { text: '已送达', className: 'delivered' }
          };
          const st = statusMap[courier.status] || statusMap.picking;
          
          this.setData({
            courierInfo: {
              name: courier.name || '配送员',
              phone: courier.phone || '138****1234',
              status: courier.status || 'picking',
              statusText: st.text,
              statusClass: st.className,
              progress: courier.progress || 0,
              distance: courier.distance || '1.5km',
              eta: courier.eta || '15分钟',
              assignedAt: courier.assignedAt || ''
            },
            showCourierTracker: courier.status !== 'delivered',
            'order.courier': courier
          });
          
          // 已送达 → 停止轮询 + 自动返回
          if (courier.status === 'delivered' && !this.deliveryCompleted) {
            this.deliveryCompleted = true;
            this.stopCourierPolling();
            
            // 先显示已送达状态 1 秒再隐藏
            setTimeout(() => {
              this.setData({ showCourierTracker: false });
              wx.showToast({ title: '🎉 配送已送达', icon: 'success', duration: 2000 });
              
              // 3秒后自动返回
              setTimeout(() => {
                wx.navigateBack({ delta: 1 });
              }, 3000);
            }, 1000);
          }
        }
      }
    } catch (e) {
      // 静默忽略轮询错误
    }
  },

  // 加载演示订单
  loadDemoOrder() {
    const demoOrder = {
      orderId: 'demo123',
      orderNo: 'CL20260422001',
      status: 'received', // 演示已入库状态
      statusText: '已入库',
      statusDescription: '衣物已送达门店并入库，等待处理',
      cleaning: {
        storeReceivedAt: new Date().toISOString()
      },
      statusHistory: [
        { time: new Date(Date.now() - 3600000).toISOString(), status: 'paid', note: '支付完成' },
        { time: new Date().toISOString(), status: 'received', note: '衣物已入库，门店已收件' }
      ],
      items: [
        { name: '西装', status: '已入库', quantity: 1 },
        { name: '衬衫', status: '已入库', quantity: 2 }
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

  // 选择支付方式（内嵌面板）
  onSelectPayMethod(e) {
    const method = e.currentTarget.dataset.method;
    this.setData({ selectedPayMethod: method });
  },

  // 展开/收起更多支付方式
  onTogglePayPanel() {
    this.setData({ showPayPanel: !this.data.showPayPanel });
  },

  // 关闭支付面板
  onClosePayPanel() {
    this.setData({ showPayPanel: false });
  },

  // 确认支付（内嵌面板）
  async onConfirmPay() {
    if (this.data.isPaying) return;

    const { order, orderId, selectedPayMethod } = this.data;
    if (!order) {
      wx.showToast({ title: '订单信息不存在', icon: 'none' });
      return;
    }

    // 余额不足检查
    if (selectedPayMethod === 'balance') {
      const totalAmount = order.amounts?.total || 0;
      // 这里可以接入实际余额查询，暂用固定值
      const userBalance = 500;
      if (userBalance < totalAmount) {
        wx.showToast({ title: '余额不足，请选择其他支付方式', icon: 'none' });
        return;
      }
    }

    this.setData({ isPaying: true });
    wx.showLoading({ title: '正在处理...' });

    try {
      // 调用后端确认支付
      await app.request(`/cleaning/orders/${orderId}/pay`, {
        method: selectedPayMethod,
        transactionId: 'TXN' + Date.now()
      }, 'POST');
      console.log('[支付] 后端订单状态已更新为paid');

      wx.hideLoading();
      wx.showToast({ title: '支付成功', icon: 'success' });

      // 刷新订单详情
      setTimeout(() => {
        this.loadOrderDetail();
      }, 1000);
    } catch (error) {
      wx.hideLoading();
      console.error('[支付] 失败:', error);
      wx.showToast({ title: error.message || '支付失败，请重试', icon: 'none' });
    } finally {
      this.setData({ isPaying: false });
    }
  },

  // 支付（跳转方式，保留作为备用）
  onPay() {
    const { order, orderId } = this.data;
    
    if (!order) {
      wx.showToast({ title: '订单信息不存在', icon: 'none' });
      return;
    }
    
    // 设置当前订单到全局，供支付页面使用
    app.globalData.currentOrder = {
      orderId: orderId,
      store: {
        id: order.storeId || '',
        name: order.storeName || '',
        address: order.storeAddress || ''
      },
      items: order.items || [],
      fees: {
        subtotal: order.amounts?.subtotal || 0,
        discount: order.amounts?.discount || 0,
        deliveryFee: order.amounts?.deliveryFee || 0,
        total: order.amounts?.total || 0,
        totalAmount: order.amounts?.total || 0
      },
      deliveryMethod: order.deliveryMethod || 'pickup',
      delivery: order.delivery || {},
      time: order.pickupTime || {},
      status: order.status
    };
    
    wx.navigateTo({ url: '/pages/order/payment/index' });
  },

  // 取消订单
  async onCancelOrder() {
    const { orderId, order } = this.data;
    
    // 仅允许取消待支付或已支付的订单
    if (!['pending', 'paid'].includes(order?.status)) {
      wx.showToast({ title: '当前状态无法取消', icon: 'none' });
      return;
    }
    
    wx.showModal({
      title: '确认取消订单',
      content: '确定要取消该订单吗？取消后将无法恢复。',
      confirmText: '确认取消',
      cancelText: '返回',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '正在取消...' });
          
          try {
            const result = await app.request(`/cleaning/orders/${orderId}/cancel`, {}, 'POST');
            
            wx.hideLoading();
            
            if (result.success) {
              wx.showToast({ title: '订单已取消', icon: 'success' });
              // 刷新订单详情
              this.loadOrderDetail();
            } else {
              throw new Error(result.error || '取消失败');
            }
          } catch (error) {
            wx.hideLoading();
            console.error('[取消订单] 失败:', error);
            wx.showToast({ title: error.message || '取消失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 再次下单
  onReorder() {
    const { order } = this.data;
    
    if (!order) {
      wx.showToast({ title: '订单信息不存在', icon: 'none' });
      return;
    }
    
    // 将订单中的服务项目保存到全局，供下单页面使用
    if (order.items && order.items.length > 0) {
      app.globalData.selectedServices = order.items.map(item => ({
        id: item.itemId || item.id || item.serviceType,
        name: item.name || item.serviceName || item.serviceType,
        price: item.price || 0,
        quantity: item.quantity || 1,
        serviceType: item.serviceType || item.id
      }));
      
      app.globalData.serviceTotalPrice = order.amounts?.subtotal || order.totalAmount || 0;
      
      // 如果有门店信息，也保存下来
      if (order.storeId || order.store) {
        app.globalData.selectedStore = {
          id: order.storeId || order.store?.storeId,
          storeId: order.storeId || order.store?.storeId,
          name: order.storeName || order.store?.name || '干洗店',
          address: order.storeAddress || order.store?.address || '',
          phone: order.storePhone || order.store?.phone || ''
        };
      }
      
      wx.showToast({ title: '已添加服务项目', icon: 'success' });
      
      // 跳转到门店选择页面
      wx.navigateTo({
        url: '/pages/order/stores/index'
      });
    } else {
      // 没有服务项目，跳转到服务选择页面
      wx.navigateTo({
        url: '/pages/order/create/index'
      });
    }
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
  },

});
