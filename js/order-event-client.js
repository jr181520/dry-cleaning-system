/**
 * 订单实时事件客户端
 * 通过 MQTT over WebSocket 连接 EMQX，接收订单状态变更事件
 * 
 * 使用方法：
 *   <script src="js/api-config.js"></script>
 *   <script src="js/order-event-client.js"></script>
 *   <script>
 *     OrderEventClient.start({
 *       storeId: 'ST001',
 *       mode: 'store',
 *       onOrderUpdate: (event) => { console.log('订单更新:', event); }
 *     });
 *   </script>
 */

const OrderEventClient = {
  client: null,
  config: null,
  reconnectTimer: null,
  reconnectCount: 0,
  maxReconnect: 20,
  isConnected: false,
  subscribedTopics: [],

  getMqttWsUrl() {
    const host = window.location.hostname || 'localhost';
    return `ws://${host}:8083/mqtt`;
  },

  /**
   * 更新UI中的MQTT连接状态指示
   */
  updateStatusUI(connected) {
    const dot = document.getElementById('mqtt-status-dot');
    const text = document.getElementById('mqtt-status-text');
    const badge = document.getElementById('mqtt-status-badge');
    if (!dot || !text || !badge) return;

    if (connected) {
      dot.className = 'w-1.5 h-1.5 rounded-full bg-green-500';
      text.textContent = '实时';
      badge.className = 'px-2 py-1 text-xs font-medium rounded-full hidden sm:inline-flex items-center gap-1 bg-green-50 text-green-700';
      badge.title = 'MQTT实时连接正常';
    } else {
      dot.className = 'w-1.5 h-1.5 rounded-full bg-gray-400';
      text.textContent = '离线';
      badge.className = 'px-2 py-1 text-xs font-medium rounded-full hidden sm:inline-flex items-center gap-1 bg-gray-100 text-gray-500';
      badge.title = 'MQTT未连接，使用轮询模式';
    }
  },

  /**
   * 启动订单事件监听
   */
  start(options = {}) {
    this.config = {
      storeId: options.storeId || 'ST001',
      mode: options.mode || 'store',
      onOrderUpdate: options.onOrderUpdate || (() => {}),
      onConnect: options.onConnect || (() => {}),
      onDisconnect: options.onDisconnect || (() => {})
    };

    this.connect();
    console.log(`[订单事件] 启动监听，模式: ${this.config.mode}，门店: ${this.config.storeId}`);

    // 暴露门店切换方法到全局
    window.OrderEventClient = this;
  },

  /**
   * 切换门店时重新订阅
   */
  switchStore(newStoreId) {
    if (!this.config || this.config.storeId === newStoreId) return;

    console.log(`[订单事件] 切换门店: ${this.config.storeId} → ${newStoreId}`);

    // 取消旧订阅
    if (this.client && this.isConnected && this.subscribedTopics.length > 0) {
      this.client.unsubscribe(this.subscribedTopics);
    }

    this.config.storeId = newStoreId;

    // 重新订阅新门店的topic
    if (this.client && this.isConnected) {
      const topics = this.getTopics();
      this.client.subscribe(topics, { qos: 1 }, (err) => {
        if (err) {
          console.error('[订单事件] 重新订阅失败:', err);
        } else {
          console.log('[订单事件] 已重新订阅:', topics.join(', '));
        }
      });
    }
  },

  /**
   * 获取当前模式应订阅的topics
   */
  getTopics() {
    const topics = [];
    if (this.config.mode === 'store') {
      topics.push(`dryclean/orders/${this.config.storeId}/update`);
      topics.push('dryclean/orders/all/update');
    } else {
      topics.push('dryclean/orders/all/update');
      topics.push('dryclean/orders/+/update');
    }
    return topics;
  },

  /**
   * 连接 EMQX WebSocket
   */
  connect() {
    if (this.client && this.isConnected) return;

    const wsUrl = this.getMqttWsUrl();
    console.log(`[订单事件] 正在连接 ${wsUrl}...`);

    try {
      if (typeof mqtt !== 'undefined' && mqtt.connect) {
        this.client = mqtt.connect(wsUrl, {
          clientId: `m_store_${this.config.storeId}_${Date.now()}`,
          username: 'admin',
          password: 'admin123',
          keepalive: 60,
          reconnectPeriod: 5000,
          connectTimeout: 10000,
          clean: true
        });

        this.client.on('connect', () => this.onConnect());
        this.client.on('message', (topic, message) => this.onMessage(topic, message));
        this.client.on('error', (err) => this.onError(err));
        this.client.on('close', () => this.onClose());
        this.client.on('offline', () => this.onClose());
        this.client.on('reconnect', () => {
          const newId = `m_store_${this.config.storeId}_${Date.now()}`;
          this.client.options.clientId = newId;
          console.log('[订单事件] 正在重连, 新clientId:', newId);
        });
      } else if (window.__mqttLoaded === undefined) {
        console.log('[订单事件] mqtt.js 正在加载，1秒后重试...');
        setTimeout(() => this.connect(), 1000);
      } else {
        console.log('[订单事件] mqtt.js 不可用，使用轮询模式');
        this.updateStatusUI(false);
        this.startPolling();
      }
    } catch (err) {
      console.error('[订单事件] 连接失败:', err);
      this.updateStatusUI(false);
      this.scheduleReconnect();
    }
  },

  onConnect() {
    this.isConnected = true;
    this.reconnectCount = 0;
    console.log('[订单事件] ✅ 已连接到 EMQX');

    // 订阅主题
    const topics = this.getTopics();
    this.subscribedTopics = topics;

    this.client.subscribe(topics, { qos: 1 }, (err) => {
      if (err) {
        console.error('[订单事件] 订阅失败:', err);
      } else {
        console.log('[订单事件] 已订阅:', topics.join(', '));
      }
    });

    this.updateStatusUI(true);
    this.config.onConnect();
  },

  onMessage(topic, message) {
    try {
      const payload = JSON.parse(message.toString());
      console.log(`[订单事件] 收到事件: ${payload.event}`, payload);
      this.config.onOrderUpdate(payload);
    } catch (e) {
      console.error('[订单事件] 解析消息失败:', e);
    }
  },

  onError(err) {
    console.error('[订单事件] 连接错误:', err.message);
  },

  onClose() {
    if (!this.isConnected) return;
    this.isConnected = false;
    console.log('[订单事件] 连接已断开');
    this.updateStatusUI(false);
    this.config.onDisconnect();
  },

  scheduleReconnect() {
    if (this.reconnectCount >= this.maxReconnect) {
      console.log('[订单事件] 达到最大重连次数，切换到轮询模式');
      this.updateStatusUI(false);
      this.startPolling();
      return;
    }

    this.reconnectCount++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectCount), 30000);
    console.log(`[订单事件] ${delay / 1000}秒后重连 (${this.reconnectCount}/${this.maxReconnect})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  },

  startPolling() {
    if (this.pollTimer) return;
    this.pollInterval = 8000;
    console.log(`[订单事件] 轮询模式启动，间隔 ${this.pollInterval / 1000}秒`);

    this.pollTimer = setInterval(async () => {
      try {
        const baseUrl = (typeof API_CONFIG !== 'undefined') ? API_CONFIG.baseUrl : 'http://localhost:3000/api';
        const endpoint = this.config.mode === 'admin'
          ? `${baseUrl}/admin/orders?page=1&pageSize=5`
          : `${baseUrl}/cleaning/store/${this.config.storeId}/orders?page=1&pageSize=5`;

        const res = await fetch(endpoint, {
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000)
        });

        if (res.ok) {
          const result = await res.json();
          this.config.onOrderUpdate({
            event: 'poll_update',
            mode: this.config.mode,
            data: result.data
          });
        }
      } catch (e) {
        // 轮询失败静默忽略
      }
    }, this.pollInterval);
  },

  stop() {
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isConnected = false;
    this.updateStatusUI(false);
    console.log('[订单事件] 已停止监听');
  }
};

window.OrderEventClient = OrderEventClient;
