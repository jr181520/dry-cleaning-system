/**
 * 订单实时追踪模块
 * 用于C端HTML页面和微信小程序
 */

// 订单状态配置
const ORDER_STATUS_CONFIG = {
  pending: {
    text: '待支付',
    description: '等待您完成支付',
    icon: 'icon-wallet',
    color: '#ff9800',
    step: 0
  },
  paid: {
    text: '已支付',
    description: '已支付完成，等待配送员上门取件',
    icon: 'icon-check-circle',
    color: '#4caf50',
    step: 1
  },
  delivering: {
    text: '配送中',
    description: '配送员正在路上，请保持手机畅通',
    icon: 'icon-truck',
    color: '#2196f3',
    step: 2
  },
  received: {
    text: '已入库',
    description: '衣物已送达服务网点，正在处理中',
    icon: 'icon-warehouse',
    color: '#9c27b0',
    step: 3
  },
  processing: {
    text: '处理中',
    description: '衣物正在清洗护理中',
    icon: 'icon-loader',
    color: '#ff5722',
    step: 4
  },
  ready: {
    text: '待取件',
    description: '衣物已处理完成，请到店取件或等待配送',
    icon: 'icon-package',
    color: '#00bcd4',
    step: 5
  },
  store_outbound: {
    text: '已出库',
    description: '商家已完成出库，等待取走/配送',
    icon: 'icon-send',
    color: '#00bcd4',
    step: 6
  },
  delivering_back: {
    text: '配送中',
    description: '配送员正在送回您的衣物',
    icon: 'icon-truck',
    color: '#2196f3',
    step: 7
  },
  completed: {
    text: '已完成',
    description: '订单已完成，感谢您的使用',
    icon: 'icon-check-circle-fill',
    color: '#4caf50',
    step: 8
  },
  cancelled: {
    text: '已取消',
    description: '订单已取消',
    icon: 'icon-close-circle',
    color: '#9e9e9e',
    step: -1
  }
};

// 订单流程步骤
const ORDER_STEPS = [
  { key: 'paid', label: '支付成功' },
  { key: 'delivering', label: '配送中' },
  { key: 'received', label: '已入库' },
  { key: 'processing', label: '处理中' },
  { key: 'ready', label: '待取件' },
  { key: 'store_outbound', label: '已出库' },
  { key: 'completed', label: '完成' }
];

/**
 * 订单追踪类
 */
class OrderTracker {
  constructor(options = {}) {
    this.apiBase = options.apiBase || '/api';
    this.pollInterval = options.pollInterval || 3000; // 默认3秒轮询
    this.maxPollAttempts = options.maxPollAttempts || 100;
    this.pollAttempts = 0;
    this.currentOrderId = null;
    this.pollTimer = null;
    this.onStatusChange = options.onStatusChange || null;
    this.onError = options.onError || null;
  }

  /**
   * 开始追踪订单
   */
  startTracking(orderId) {
    this.currentOrderId = orderId;
    this.pollAttempts = 0;
    this.startPolling();
  }

  /**
   * 停止追踪
   */
  stopTracking() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.currentOrderId = null;
    this.pollAttempts = 0;
  }

  /**
   * 开始轮询
   */
  async startPolling() {
    if (!this.currentOrderId) return;
    
    try {
      const status = await this.fetchOrderStatus(this.currentOrderId);
      this.pollAttempts++;
      
      // 触发状态变化回调
      if (this.onStatusChange) {
        this.onStatusChange(status);
      }
      
      // 如果订单已完成或取消，停止轮询
      if (['completed', 'cancelled'].includes(status.status)) {
        this.stopTracking();
        return;
      }
      
      // 继续轮询
      if (this.pollAttempts < this.maxPollAttempts) {
        this.pollTimer = setTimeout(() => {
          this.startPolling();
        }, this.pollInterval);
      } else {
        this.stopTracking();
        if (this.onError) {
          this.onError(new Error('轮询超时'));
        }
      }
    } catch (error) {
      console.error('获取订单状态失败:', error);
      
      // API失败时，尝试从localStorage获取最新状态
      const localStatus = this.fetchOrderStatusFromLocalStorage(this.currentOrderId);
      if (localStatus && this.onStatusChange) {
        console.log('从localStorage获取到订单状态:', localStatus.status);
        this.onStatusChange(localStatus);
      }
      
      if (this.onError) {
        this.onError(error);
      }
      // 失败后继续轮询
      if (this.pollAttempts < this.maxPollAttempts) {
        this.pollTimer = setTimeout(() => {
          this.startPolling();
        }, this.pollInterval);
      }
    }
  }
  
  /**
   * 从localStorage获取订单状态
   */
  fetchOrderStatusFromLocalStorage(orderId) {
    try {
      // 尝试从orders列表获取
      const ordersStr = localStorage.getItem('orders');
      if (ordersStr) {
        const orders = JSON.parse(ordersStr);
        const order = orders.find(o => o.orderId === orderId || o.id === orderId);
        if (order) {
          // 返回完整订单对象，确保与API返回格式一致
          return {
            ...order,
            orderId: order.orderId || order.id,
            status: order.status,
            deliveryStatus: order.deliveryStatus,
            items: order.items,
            services: order.services,
            updatedAt: order.updatedAt
          };
        }
      }
      
      // 尝试从currentOrder获取
      const currentOrderStr = localStorage.getItem('currentOrder');
      if (currentOrderStr) {
        const order = JSON.parse(currentOrderStr);
        if (order.orderId === orderId || order.id === orderId) {
          // 返回完整订单对象
          return {
            ...order,
            orderId: order.orderId || order.id,
            status: order.status,
            deliveryStatus: order.deliveryStatus,
            items: order.items,
            services: order.services,
            updatedAt: order.updatedAt
          };
        }
      }
      
      return null;
    } catch (e) {
      console.error('从localStorage获取订单状态失败:', e);
      return null;
    }
  }

  /**
   * 获取订单状态
   */
  async fetchOrderStatus(orderId) {
    const token = this.getAuthToken();
    const headers = token ? { 
      'Authorization': `Bearer ${token}`,
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    } : {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    
    const response = await fetch(`${this.apiBase}/cleaning/orders/${orderId}/status`, {
      headers
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '获取订单状态失败');
    }
    
    return result.data;
  }

  /**
   * 获取认证Token
   */
  getAuthToken() {
    return localStorage.getItem('authToken') || '';
  }

  /**
   * 获取状态配置
   */
  getStatusConfig(status) {
    return ORDER_STATUS_CONFIG[status] || ORDER_STATUS_CONFIG.pending;
  }

  /**
   * 生成状态UI
   */
  renderStatusUI(status) {
    const config = this.getStatusConfig(status);
    
    return `
      <div class="status-display">
        <div class="status-icon" style="color: ${config.color}">
          <span class="${config.icon}"></span>
        </div>
        <div class="status-text">
          <text class="status-name">${config.text}</text>
          <text class="status-desc">${config.description}</text>
        </div>
      </div>
    `;
  }

  /**
   * 生成订单进度条UI
   */
  renderProgressUI(currentStatus) {
    const currentStep = this.getStatusConfig(currentStatus).step;
    
    let html = '<div class="order-progress"><div class="progress-steps">';
    
    ORDER_STEPS.forEach((step, index) => {
      const stepConfig = this.getStatusConfig(step.key);
      const isActive = stepConfig.step <= currentStep;
      const isCurrent = stepConfig.step === currentStep;
      
      html += `
        <div class="progress-step ${isActive ? 'active' : ''} ${isCurrent ? 'current' : ''}">
          <div class="step-icon" style="background-color: ${isActive ? stepConfig.color : '#e0e0e0'}">
            ${isActive ? '<span class="icon-check"></span>' : '<span class="step-num">' + (index + 1) + '</span>'}
          </div>
          <text class="step-label">${step.label}</text>
        </div>
      `;
    });
    
    html += '</div></div>';
    
    return html;
  }
}

/**
 * 订单详情页面初始化
 */
function initOrderDetailPage(orderId) {
  const tracker = new OrderTracker({
    pollInterval: 3000,
    onStatusChange: (status) => {
      updateOrderStatusUI(status);
    },
    onError: (error) => {
      console.error('订单状态更新失败:', error);
    }
  });
  
  tracker.startTracking(orderId);
  
  return tracker;
}

/**
 * 更新订单状态UI
 */
function updateOrderStatusUI(status) {
  const tracker = new OrderTracker();
  
  // 更新状态显示
  const statusDisplay = document.querySelector('.order-status-display');
  if (statusDisplay) {
    statusDisplay.innerHTML = tracker.renderStatusUI(status.status);
  }
  
  // 更新进度条
  const progressBar = document.querySelector('.order-progress-bar');
  if (progressBar) {
    progressBar.innerHTML = tracker.renderProgressUI(status.status);
  }
  
  // 更新最新动态
  if (status.latestHistory) {
    const latestNote = document.querySelector('.latest-status-note');
    if (latestNote) {
      latestNote.textContent = status.latestHistory.note || '';
    }
  }
}

/**
 * WebSocket实时通知（可选）
 */
class OrderWebSocket {
  constructor(options = {}) {
    this.wsUrl = options.wsUrl || '';
    this.reconnectInterval = options.reconnectInterval || 5000;
    this.onMessage = options.onMessage || null;
    this.ws = null;
    this.reconnectTimer = null;
  }

  connect(userId) {
    if (!this.wsUrl) return;
    
    try {
      this.ws = new WebSocket(`${this.wsUrl}?userId=${userId}`);
      
      this.ws.onopen = () => {
        console.log('WebSocket连接已建立');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };
      
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (this.onMessage) {
          this.onMessage(data);
        }
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket连接已关闭，准备重连...');
        this.scheduleReconnect(userId);
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
      };
    } catch (error) {
      console.error('WebSocket连接失败:', error);
      this.scheduleReconnect(userId);
    }
  }

  scheduleReconnect(userId) {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.connect(userId);
      }, this.reconnectInterval);
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// 导出给全局使用
if (typeof window !== 'undefined') {
  window.OrderTracker = OrderTracker;
  window.OrderWebSocket = OrderWebSocket;
  window.ORDER_STATUS_CONFIG = ORDER_STATUS_CONFIG;
  window.ORDER_STEPS = ORDER_STEPS;
  window.initOrderDetailPage = initOrderDetailPage;
  window.updateOrderStatusUI = updateOrderStatusUI;
}
