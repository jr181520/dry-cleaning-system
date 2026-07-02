/**
 * 跨端同步客户端 (Cross-System Sync Client)
 * 
 * 功能：
 *   1. 连接 MQTT 订阅 dryclean/sync/operation 接收对端操作
 *   2. 定期向后端发送心跳保持在线状态
 *   3. 本地操作去重（防止收到自己发出的操作）
 *   4. 显示同步状态指示器（在线/离线）
 *   5. 发布本地操作到同步频道通知对端
 * 
 * 使用方法：
 *   <script src="js/api-config.js"></script>
 *   <script src="js/cross-sync-client.js"></script>
 *   <script>
 *     CrossSyncClient.start({
 *       type: 'admin',       // 'admin' (index) | 'store' (m-index)
 *       onRemoteOperation: (op) => { console.log('收到对端操作:', op); },
 *       onSyncStatusChange: (status) => { updateSyncUI(status); }
 *     });
 *   </script>
 */

const CrossSyncClient = {
  // ===== 配置 =====
  config: {
    type: 'store',           // 'admin' | 'store'
    storeId: null,
    clientId: null,
    apiBase: null,
    mqttClient: null,
    
    // 同步间隔（毫秒）
    heartbeatInterval: 20000,
    statusPollInterval: 15000,
    
    // 回调
    onRemoteOperation: null,   // 收到对端操作的回调
    onSyncStatusChange: null,  // 同步状态变化的回调
    onPeerOnline: null,        // 对端上线的回调
    onPeerOffline: null,       // 对端下线的回调
    
    // 内部状态
    isRunning: false,
    isMqttConnected: false,
    heartbeatTimer: null,
    statusPollTimer: null,
    localOperations: [],        // 本地发出的操作ID（用于去重）
    maxLocalOpsCache: 50,
    peerOnline: { admin: false, store: false }
  },

  // ===== 初始化 =====
  start(options = {}) {
    if (this.config.isRunning) {
      console.log('[跨端同步] 已在运行中');
      return;
    }

    this.config.type = options.type || 'store';
    this.config.storeId = options.storeId || this._getStoreId();
    this.config.clientId = this.config.type + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    var rawBase = (typeof API_CONFIG !== 'undefined') ? API_CONFIG.baseUrl : 'http://localhost:3000';
    // 去除末尾的 /api（api-config.js 的 baseUrl 已含 /api，避免拼接成 /api/api/...）
    this.config.apiBase = rawBase.replace(/\/api$/, '');
    this.config.onRemoteOperation = options.onRemoteOperation || null;
    this.config.onSyncStatusChange = options.onSyncStatusChange || null;
    this.config.onPeerOnline = options.onPeerOnline || null;
    this.config.onPeerOffline = options.onPeerOffline || null;

    this.config.isRunning = true;
    console.log(`[跨端同步] 启动, 类型: ${this.config.type}, clientId: ${this.config.clientId}`);

    // 1. 注册到后端
    this._register();

    // 2. 启动 MQTT 监听 sync topic
    this._connectMqtt();

    // 3. 启动心跳
    this._startHeartbeat();

    // 4. 启动状态轮询（作为 MQTT 的补充）
    this._startStatusPoll();

    // 5. 页面关闭时注销
    window.addEventListener('beforeunload', () => {
      this._unregister();
    });

    // 6. 监听页面可见性变化，恢复时重新注册
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.config.isRunning) {
        this._register();
      }
    });
  },

  stop() {
    this.config.isRunning = false;
    if (this.config.heartbeatTimer) clearInterval(this.config.heartbeatTimer);
    if (this.config.statusPollTimer) clearInterval(this.config.statusPollTimer);
    if (this.config.mqttClient) {
      try { this.config.mqttClient.end(true); } catch (e) {}
      this.config.mqttClient = null;
    }
    this._unregister();
    console.log('[跨端同步] 已停止');
  },

  // ===== 注册/心跳/注销 =====
  async _register() {
    try {
      await fetch(`${this.config.apiBase}/api/sync/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: this.config.clientId,
          clientType: this.config.type,
          storeId: this.config.storeId,
          userAgent: navigator.userAgent
        }),
        signal: AbortSignal.timeout(3000)
      });
    } catch (e) {
      // 静默失败，后端可能未运行
    }
  },

  _startHeartbeat() {
    this.config.heartbeatTimer = setInterval(async () => {
      try {
        await fetch(`${this.config.apiBase}/api/sync/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: this.config.clientId }),
          signal: AbortSignal.timeout(3000)
        });
      } catch (e) {
        // 静默失败
      }
    }, this.config.heartbeatInterval);
  },

  async _unregister() {
    try {
      if (this.config.clientId) {
        await fetch(`${this.config.apiBase}/api/sync/unregister`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: this.config.clientId }),
          signal: AbortSignal.timeout(2000)
        });
      }
    } catch (e) {
      // 静默失败
    }
  },

  // ===== MQTT 连接 =====
  _connectMqtt() {
    if (typeof mqtt === 'undefined' || !mqtt.connect) {
      console.warn('[跨端同步] mqtt.js 未加载，将仅使用 REST API 轮询');
      return;
    }

    try {
      const host = window.location.hostname || 'localhost';
      const wsUrl = `ws://${host}:8083/mqtt`;
      
      this.config.mqttClient = mqtt.connect(wsUrl, {
        clientId: 'sync_' + this.config.clientId,
        username: 'admin',
        password: 'admin123',
        keepalive: 60,
        reconnectPeriod: 5000,
        connectTimeout: 10000,
        clean: true
      });

      this.config.mqttClient.on('connect', () => {
        this.config.isMqttConnected = true;
        console.log('[跨端同步] ✅ MQTT 已连接，订阅同步主题');

        // 订阅跨端操作广播主题
        this.config.mqttClient.subscribe('dryclean/sync/operation', { qos: 1 }, (err) => {
          if (err) {
            console.error('[跨端同步] 订阅 sync/operation 失败:', err);
          } else {
            console.log('[跨端同步] 已订阅 dryclean/sync/operation');
          }
        });

        // 订阅心跳主题（了解对端在线状态）
        this.config.mqttClient.subscribe('dryclean/sync/heartbeat', { qos: 0 }, (err) => {
          if (err) {
            console.error('[跨端同步] 订阅 sync/heartbeat 失败:', err);
          }
        });

        this._notifyStatus('connected');
      });

      this.config.mqttClient.on('message', (topic, message) => {
        try {
          const data = JSON.parse(message.toString());
          
          if (topic === 'dryclean/sync/operation') {
            this._handleSyncOperation(data);
          } else if (topic === 'dryclean/sync/heartbeat') {
            this._handleHeartbeat(data);
          }
        } catch (e) {
          console.error('[跨端同步] 消息解析失败:', e);
        }
      });

      this.config.mqttClient.on('error', (err) => {
        console.warn('[跨端同步] MQTT 错误:', err.message);
      });

      this.config.mqttClient.on('close', () => {
        if (this.config.isMqttConnected) {
          this.config.isMqttConnected = false;
          this._notifyStatus('disconnected');
          console.log('[跨端同步] MQTT 连接断开');
        }
      });

    } catch (e) {
      console.warn('[跨端同步] MQTT 连接失败:', e.message);
    }
  },

  // ===== 事件处理 =====
  _handleSyncOperation(data) {
    // 过滤掉自己发出的操作（本地回显抑制）
    if (data.clientId === this.config.clientId) {
      return;
    }

    // 检查是否近期处理过相同的同步ID（去重）
    if (data.syncId && this.config.localOperations.includes(data.syncId)) {
      return;
    }
    
    if (data.syncId) {
      this.config.localOperations.push(data.syncId);
      if (this.config.localOperations.length > this.config.maxLocalOpsCache) {
        this.config.localOperations = this.config.localOperations.slice(-this.config.maxLocalOpsCache);
      }
    }

    // 过滤：只关心对端的操作
    const myType = this.config.type;
    const theirType = data.source;
    
    // C-end/wechat 来源的消息始终接收
    // admin/store 的消息只在类型不匹配时才处理（即对端操作）
    const isMyOperation = (myType === 'admin' && theirType === 'index') || 
                          (myType === 'store' && theirType === 'm-index');
    const isExternalSource = theirType === 'c-end' || theirType === 'wechat';

    if (isMyOperation && !isExternalSource) {
      return; // 忽略自己类型的操作（由 orderEventService 直接推送处理）
    }

    console.log(`[跨端同步] 收到对端操作: ${theirType} - ${data.operation?.action || data.operation?.type}`);

    // 触发回调
    if (typeof this.config.onRemoteOperation === 'function') {
      this.config.onRemoteOperation({
        source: theirType,
        operation: data.operation,
        syncId: data.syncId,
        timestamp: data.timestamp
      });
    }
  },

  _handleHeartbeat(data) {
    if (!data.onlineClients) return;
    
    const prevAdmin = this.config.peerOnline.admin;
    const prevStore = this.config.peerOnline.store;
    
    this.config.peerOnline.admin = data.onlineClients.some(c => c.type === 'admin');
    this.config.peerOnline.store = data.onlineClients.some(c => c.type === 'store');

    // 检测对端上线/下线
    if (!prevAdmin && this.config.peerOnline.admin) {
      if (typeof this.config.onPeerOnline === 'function' && this.config.type === 'store') {
        this.config.onPeerOnline('admin');
      }
    }
    if (prevAdmin && !this.config.peerOnline.admin) {
      if (typeof this.config.onPeerOffline === 'function' && this.config.type === 'store') {
        this.config.onPeerOffline('admin');
      }
    }
    if (!prevStore && this.config.peerOnline.store) {
      if (typeof this.config.onPeerOnline === 'function' && this.config.type === 'admin') {
        this.config.onPeerOnline('store');
      }
    }
    if (prevStore && !this.config.peerOnline.store) {
      if (typeof this.config.onPeerOffline === 'function' && this.config.type === 'admin') {
        this.config.onPeerOffline('store');
      }
    }
  },

  // ===== 状态轮询 =====
  _startStatusPoll() {
    this.config.statusPollTimer = setInterval(async () => {
      try {
        const res = await fetch(`${this.config.apiBase}/api/sync/status`, {
          signal: AbortSignal.timeout(3000)
        });
        if (res.ok) {
          const result = await res.json();
          if (result.success && result.data) {
            this._notifyStatus(result.data.crossEndStatus);
          }
        }
      } catch (e) {
        // 静默忽略
      }
    }, this.config.statusPollInterval);
  },

  _notifyStatus(status) {
    if (typeof this.config.onSyncStatusChange === 'function') {
      this.config.onSyncStatusChange({
        status,
        mqttConnected: this.config.isMqttConnected,
        peerOnline: { ...this.config.peerOnline },
        timestamp: Date.now()
      });
    }
  },

  // ===== 发布本地操作 =====
  /**
   * 当本页面执行了订单操作时调用，通知对端
   * @param {object} operation - { type, action, orderId, orderNo, storeId, data }
   */
  notifyLocalOperation(operation) {
    if (!this.config.isRunning) return;

    // 记录本地操作以防止回显
    this.config.localOperations.push('local_' + Date.now());
    if (this.config.localOperations.length > this.config.maxLocalOpsCache) {
      this.config.localOperations = this.config.localOperations.slice(-this.config.maxLocalOpsCache);
    }

    // 通过 REST API 通知后端（后端会广播到 MQTT）
    fetch(`${this.config.apiBase}/api/sync/notify-operation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: this.config.type === 'admin' ? 'index' : 'm-index',
        clientId: this.config.clientId,
        operation
      }),
      signal: AbortSignal.timeout(3000)
    }).catch(() => {
      // 静默失败，对端可通过轮询获取
    });

    console.log(`[跨端同步] 发布本地操作: ${operation.action || operation.type} - ${operation.orderNo || operation.orderId}`);
  },

  // ===== 工具方法 =====
  _getStoreId() {
    try {
      const user = JSON.parse(localStorage.getItem('storeUser') || '{}');
      const currentStore = JSON.parse(localStorage.getItem('currentStore') || '{}');
      return currentStore.storeId || user.storeId || 'ST001';
    } catch (e) {
      return 'ST001';
    }
  },

  /**
   * 获取当前同步状态简要信息
   */
  getStatus() {
    return {
      type: this.config.type,
      isRunning: this.config.isRunning,
      mqttConnected: this.config.isMqttConnected,
      peerOnline: { ...this.config.peerOnline },
      clientId: this.config.clientId
    };
  }
};

window.CrossSyncClient = CrossSyncClient;
