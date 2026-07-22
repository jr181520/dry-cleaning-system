const app = getApp();
const API_BASE = app.globalData?.apiBase || '';
const STATUS_MAP = {
  reserved: { text: '待支付', desc: '请尽快完成支付', icon: '⏰' },
  paid: { text: '待发货', desc: '商家正在准备', icon: '📦' },
  shipped: { text: '配送中', desc: '跑腿小哥正在配送', icon: '🚚' },
  using: { text: '使用中', desc: '请妥善保管', icon: '💎' },
  due: { text: '即将到期', desc: '请尽快归还', icon: '⚠️' },
  overdue: { text: '已逾期', desc: '请尽快归还', icon: '❗' },
  returning: { text: '归还中', desc: '物品正在送回门店', icon: '🔄' },
  returned: { text: '已归还', desc: '等待押金退还', icon: '✅' },
  completed: { text: '已完成', desc: '感谢使用', icon: '⭐' },
  cancelled: { text: '已取消', desc: '订单已取消', icon: '❌' }
};
const DEPOSIT_LABELS = { deposit: '纯押金', credit_free: '信用免押', both: '押金/免押' };

Page({
  data: {
    order: {}, statusText: '', statusDesc: '', statusIcon: '',
    showCountdown: false, daysRemaining: 0, dueDateText: '',
    showActions: false, createdAtText: '', depositModeText: ''
  },

  onLoad(options) {
    if (options.orderNo) this.loadOrder(options.orderNo);
  },

  async loadOrder(orderNo) {
    try {
      const res = await wx.request({ url: `${API_BASE}/api/rental/orders/${orderNo}` });
      if (res.data.success) {
        const order = res.data.order;
        const st = STATUS_MAP[order.status] || STATUS_MAP.reserved;
        const showCountdown = ['using', 'due'].includes(order.status) && order.dueDate;
        let daysRemaining = 0;
        if (showCountdown) {
          daysRemaining = Math.max(0, Math.ceil((new Date(order.dueDate) - new Date()) / 86400000));
        }
        this.setData({
          order,
          statusText: st.text,
          statusDesc: st.desc,
          statusIcon: st.icon,
          showCountdown,
          daysRemaining,
          dueDateText: showCountdown ? new Date(order.dueDate).toLocaleDateString('zh-CN') : '',
          showActions: ['reserved', 'shipped', 'using', 'due', 'overdue'].includes(order.status),
          createdAtText: new Date(order.createdAt || order.reservedAt).toLocaleString('zh-CN'),
          depositModeText: DEPOSIT_LABELS[order.depositMode] || '--'
        });
      }
    } catch(e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  confirmReceive() {
    wx.showModal({
      title: '确认收货',
      content: '确认已收到物品？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await wx.request({ url: `${API_BASE}/api/rental/orders/${this.data.order.orderNo}/confirm-receive`, method: 'POST' });
            wx.showToast({ title: '已确认收货' });
            this.loadOrder(this.data.order.orderNo);
          } catch(e) { wx.showToast({ title: '操作失败', icon: 'none' }); }
        }
      }
    });
  },

  openReturn() {
    wx.showModal({
      title: '发起归还',
      content: '确认发起归还？跑腿小哥将上门取件',
      success: async (res) => {
        if (res.confirm) {
          try {
            const addr = wx.getStorageSync('rental_address') || {};
            await wx.request({
              url: `${API_BASE}/api/rental/orders/${this.data.order.orderNo}/return`,
              method: 'POST',
              data: { deliveryMethod: 'courier', address: addr.address || '用户地址', contactPhone: addr.phone || '' }
            });
            wx.showToast({ title: '归还已发起' });
            this.loadOrder(this.data.order.orderNo);
          } catch(e) { wx.showToast({ title: '操作失败', icon: 'none' }); }
        }
      }
    });
  },

  cancelOrder() {
    wx.showModal({
      title: '取消订单',
      content: '确定取消此订单？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await wx.request({
              url: `${API_BASE}/api/rental/orders/${this.data.order.orderNo}/cancel`,
              method: 'POST',
              data: { reason: '用户取消' }
            });
            wx.showToast({ title: '已取消' });
            this.loadOrder(this.data.order.orderNo);
          } catch(e) { wx.showToast({ title: '操作失败', icon: 'none' }); }
        }
      }
    });
  }
});
