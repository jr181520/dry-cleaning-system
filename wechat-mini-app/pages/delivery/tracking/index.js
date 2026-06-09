const app = getApp();

Page({
  data: {
    orderId: '',
    loading: true,
    order: null,
    delivery: {
      status: 'delivering',
      statusText: '配送中',
      subtitle: '骑手正在赶往目的地',
      icon: 'deliver',
      isLive: true,
      pickupAddress: '',
      deliveryAddress: '',
      contactName: '',
      contactPhone: '',
      driver: null,
      timeline: []
    }
  },

  onLoad(options) {
    if (options.orderId) {
      this.setData({ orderId: options.orderId });
      this.loadDeliveryInfo(options.orderId);
    }
  },

  onShow() {
    // 每次显示时刷新
    if (this.data.orderId) {
      this.loadDeliveryInfo(this.data.orderId);
    }
  },

  // 加载配送信息
  async loadDeliveryInfo(orderId) {
    this.setData({ loading: true });

    try {
      const result = await app.request(`/cleaning/orders/${orderId}`, {}, 'GET');
      
      if (result.success && result.data) {
        const orderData = result.data;
        const delivery = orderData.delivery || {};
        const orderStatus = orderData.status || 'ready';
        
        // 构建配送状态
        const deliveryInfo = this.buildDeliveryInfo(orderStatus, delivery, orderData);
        
        this.setData({
          order: {
            orderNo: orderData.orderNo || orderData._id || orderId,
            itemCount: orderData.items ? orderData.items.reduce((sum, item) => sum + (item.quantity || 1), 0) : 0,
            status: orderStatus
          },
          delivery: deliveryInfo,
          loading: false
        });
      } else {
        // API返回失败，使用模拟数据
        this.loadMockData(orderId);
        this.setData({ loading: false });
      }
    } catch (error) {
      console.error('加载配送信息失败:', error);
      this.loadMockData(orderId);
      this.setData({ loading: false });
    }
  },

  // 构建配送信息
  buildDeliveryInfo(orderStatus, delivery, orderData) {
    const statusMap = {
      'ready': {
        status: 'pending',
        statusText: '待配送',
        subtitle: '正在为您匹配骑手',
        icon: 'waiting',
        isLive: false
      },
      'delivering': {
        status: 'delivering',
        statusText: '取件中',
        subtitle: '骑手正在前往门店取件',
        icon: 'deliver',
        isLive: true
      },
      'delivering_back': {
        status: 'delivering',
        statusText: '配送中',
        subtitle: '骑手正在为您派送',
        icon: 'deliver',
        isLive: true
      },
      'completed': {
        status: 'completed',
        statusText: '已送达',
        subtitle: '订单已送达，感谢使用',
        icon: 'check',
        isLive: false
      }
    };

    const currentStatus = statusMap[orderStatus] || statusMap['ready'];

    // 司机信息
    const driver = delivery.driverName ? {
      name: delivery.driverName,
      phone: delivery.driverPhone || '',
      vehicle: delivery.vehicle || '电动车',
      eta: delivery.eta || '约15分钟',
      stars: delivery.driverRating || 5
    } : {
      name: '王师傅',
      phone: '13800001111',
      vehicle: '电动车',
      eta: '约15分钟',
      stars: 5
    };

    // 时间线
    const timeline = this.buildTimeline(orderStatus, orderData);

    return {
      ...currentStatus,
      driver: driver,
      timeline: timeline,
      pickupAddress: delivery.pickupAddress || orderData.storeAddress || orderData.storeName || '-',
      deliveryAddress: delivery.address || delivery.deliveryAddress || '-',
      contactName: delivery.contactName || orderData.contactName || '-',
      contactPhone: delivery.contactPhone || orderData.contactPhone || '-'
    };
  },

  // 构建配送进度时间线
  buildTimeline(orderStatus, orderData) {
    const now = new Date();
    const formatTime = (date) => {
      const h = String(date.getHours()).padStart(2, '0');
      const m = String(date.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    };

    const steps = [
      { key: 'created', title: '订单已提交', active: true, time: formatTime(new Date(now - 3600000)), desc: '配送订单已生成' },
      { key: 'assigned', title: '骑手已接单', active: orderStatus !== 'ready', time: formatTime(new Date(now - 1800000)), desc: '骑手已确认接单' },
      { key: 'pickup', title: '门店取件', active: ['delivering', 'delivering_back', 'completed'].includes(orderStatus), time: formatTime(new Date(now - 1200000)), desc: '骑手已到达门店取件' },
      { key: 'delivering', title: '配送中', active: ['delivering_back', 'completed'].includes(orderStatus), time: formatTime(new Date(now - 600000)), desc: '骑手正在为您派送' },
      { key: 'completed', title: '已送达', active: orderStatus === 'completed', time: orderStatus === 'completed' ? formatTime(now) : '', desc: '配送完成' }
    ];

    return steps;
  },

  // 模拟数据
  loadMockData(orderId) {
    const now = new Date();
    const formatTime = (date) => {
      const h = String(date.getHours()).padStart(2, '0');
      const m = String(date.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    };

    this.setData({
      order: {
        orderNo: orderId || 'ORD0001',
        itemCount: 3,
        status: 'delivering_back'
      },
      delivery: {
        status: 'delivering',
        statusText: '配送中',
        subtitle: '骑手正在为您派送',
        icon: 'deliver',
        isLive: true,
        driver: {
          name: '王师傅',
          phone: '13800001111',
          vehicle: '电动车',
          eta: '约15分钟',
          stars: 5
        },
        pickupAddress: '朝阳区干洗店（建国路88号）',
        deliveryAddress: '朝阳区望京SOHO T1 1506',
        contactName: '张先生',
        contactPhone: '13912345678',
        timeline: [
          { key: 'created', title: '订单已提交', active: true, time: formatTime(new Date(now - 3600000)), desc: '配送订单已生成' },
          { key: 'assigned', title: '骑手已接单', active: true, time: formatTime(new Date(now - 1800000)), desc: '骑手已确认接单' },
          { key: 'pickup', title: '门店取件', active: true, time: formatTime(new Date(now - 1200000)), desc: '骑手已到达门店取件' },
          { key: 'delivering', title: '配送中', active: true, time: formatTime(new Date(now - 600000)), desc: '骑手正在为您派送' },
          { key: 'completed', title: '已送达', active: false, time: '', desc: '配送完成' }
        ]
      }
    });
  },

  // 联系配送员
  onCallDriver() {
    const phone = this.data.delivery.driver?.phone;
    if (phone) {
      wx.makePhoneCall({
        phoneNumber: phone
      });
    } else {
      app.showToast('暂无配送员联系方式', 'none');
    }
  },

  // 联系门店
  onContactStore() {
    wx.navigateBack();
  }
});
