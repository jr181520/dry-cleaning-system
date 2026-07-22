const app = getApp();
const zhima = require('../../../utils/zhima');

const STATUS_MAP = {
  reserved:  { label: '已预约', gradient: 'status-reserved' },
  paid:      { label: '已支付', gradient: 'status-paid' },
  shipped:   { label: '配送中', gradient: 'status-shipped' },
  using:     { label: '使用中', gradient: 'status-using' },
  due:       { label: '即将到期', gradient: 'status-due' },
  overdue:   { label: '已逾期', gradient: 'status-overdue' },
  returning: { label: '归还中', gradient: 'status-returning' },
  returned:  { label: '已归还', gradient: 'status-returned' },
  completed: { label: '已完成', gradient: 'status-completed' },
  cancelled: { label: '已取消', gradient: 'status-cancelled' }
};

Page({
  data: {
    order: null,
    loading: true,
    statusInfo: {},
    remainingDays: 0,
    dueDate: '',
    zhimaScore: 0,
    zhimaLevel: null,
    timer: null
  },

  onLoad(query) {
    this.orderNo = query.orderNo;
    this.loadOrder();
  },

  onUnload() {
    if (this._timer) clearInterval(this._timer);
  },

  async loadOrder() {
    try {
      const res = await app.request(`/rental/orders/${this.orderNo}`);
      const order = (res && res.data) || (res && res.order) || res;
      if (!order) {
        my.showToast({ content: '订单不存在', type: 'fail' });
        return;
      }

      const status = order.status || 'reserved';
      const statusInfo = STATUS_MAP[status] || { label: status, gradient: 'status-reserved' };

      this.setData({ order, statusInfo, loading: false });

      // 倒计时
      if (['using', 'due', 'overdue'].includes(status) && order.dueDate) {
        this.startCountdown(order.dueDate);
      }

      // 芝麻信用
      if (order.depositMode === 'credit_free') {
        this.loadZhima();
      }
    } catch (e) {
      console.error('[订单详情] 加载失败:', e);
      this.setData({ loading: false });
    }
  },

  startCountdown(dueDateStr) {
    const update = () => {
      const due = new Date(dueDateStr).getTime();
      const now = Date.now();
      const diff = due - now;
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      const dueDate = new Date(due).toLocaleDateString('zh-CN');
      this.setData({
        remainingDays: days > 0 ? days : 0,
        dueDate,
        isOverdue: days < 0
      });
    };
    update();
    this._timer = setInterval(update, 60000);
  },

  async loadZhima() {
    try {
      const result = await zhima.getZhimaScore();
      const level = zhima.getLevelDesc(result.score);
      this.setData({ zhimaScore: result.score, zhimaLevel: level });
    } catch (e) { /* 非关键 */ }
  },

  async onConfirmReceive() {
    my.confirm({
      title: '确认收货',
      content: '确认已收到租赁商品？',
      confirmButtonText: '确认',
      cancelButtonText: '取消'
    }).then(async (res) => {
      if (!res.confirm) return;
      try {
        const result = await app.request(`/rental/orders/${this.orderNo}/confirm-receive`, {}, 'POST');
        if (result && result.success) {
          my.showToast({ content: '收货成功', type: 'success' });
          this.loadOrder();
        } else {
          my.showToast({ content: (result || {}).error || '操作失败', type: 'fail' });
        }
      } catch (e) {
        my.showToast({ content: '操作失败', type: 'fail' });
      }
    });
  },

  async onReturn() {
    my.confirm({
      title: '发起归还',
      content: '确认要归还此商品吗？',
      confirmButtonText: '确认归还',
      cancelButtonText: '取消'
    }).then(async (res) => {
      if (!res.confirm) return;
      try {
        const result = await app.request(`/rental/orders/${this.orderNo}/return`, {}, 'POST');
        if (result && result.success) {
          my.showToast({ content: '归还申请已提交', type: 'success' });
          // 守约上报
          if (this.data.order.depositMode === 'credit_free') {
            zhima.reportCompliance(this.orderNo);
          }
          this.loadOrder();
        } else {
          my.showToast({ content: (result || {}).error || '操作失败', type: 'fail' });
        }
      } catch (e) {
        my.showToast({ content: '操作失败', type: 'fail' });
      }
    });
  },

  async onCancel() {
    my.confirm({
      title: '取消订单',
      content: '确认要取消此订单吗？',
      confirmButtonText: '确认取消',
      cancelButtonText: '暂不'
    }).then(async (res) => {
      if (!res.confirm) return;
      try {
        const result = await app.request(`/rental/orders/${this.orderNo}/cancel`, {}, 'POST');
        if (result && result.success) {
          my.showToast({ content: '订单已取消', type: 'success' });
          this.loadOrder();
        } else {
          my.showToast({ content: (result || {}).error || '取消失败', type: 'fail' });
        }
      } catch (e) {
        my.showToast({ content: '操作失败', type: 'fail' });
      }
    });
  }
});
