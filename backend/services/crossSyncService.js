/**
 * 跨系统数据同步服务 (Cross-System Data Sync Service)
 * 
 * 核心功能：
 *   1. 桥接 index (Admin) ↔ m-index (M端/门店) 之间的操作同步
 *   2. 追踪每笔操作来源，防止本地回显（local echo suppression）
 *   3. 提供 MQTT + REST API 双通道同步
 *   4. 集成 notificationHubService 确保通知一致性
 * 
 * 数据流：
 *   C端/微信小程序 → orderService → orderEventService → MQTT → index + m-index
 *   index 操作 → REST API → crossSyncService → MQTT → m-index
 *   m-index 操作 → REST API → crossSyncService → MQTT → index
 * 
 * MQTT 主题设计：
 *   dryclean/sync/operation       - 跨端操作广播（index ↔ m-index）
 *   dryclean/sync/heartbeat       - 页面在线心跳
 *   dryclean/orders/{storeId}/update - 门店订单更新（已有）
 *   dryclean/orders/all/update       - 全局订单更新（已有）
 */

const TOPIC_SYNC_OPERATION = 'dryclean/sync/operation';
const TOPIC_SYNC_HEARTBEAT = 'dryclean/sync/heartbeat';
const MAX_OPERATIONS = 200;       // 最多保留操作记录
const OPERATION_TTL = 30 * 60000; // 操作记录有效期 30 分钟

let lightService = null;
let notificationHub = null;

function getLightService() {
  if (!lightService) {
    try { lightService = require('./lightService'); } catch (e) { return null; }
  }
  return lightService.isConnected() ? lightService : null;
}

function getNotificationHub() {
  if (!notificationHub) {
    try { notificationHub = require('./notificationHubService'); } catch (e) { return null; }
  }
  return notificationHub;
}

class CrossSyncService {
  constructor() {
    // 操作记录: [{ id, source, type, orderId, orderNo, storeId, data, timestamp }]
    this.operations = [];

    // 在线客户端追踪: { clientId: { type: 'admin'|'store', storeId, lastHeartbeat, connectedAt } }
    this.clients = new Map();

    // 同步 ID 自增
    this.syncIdCounter = 0;

    // 定时清理过期操作（每60秒）
    this.cleanupTimer = setInterval(() => this.cleanup(), 60000);

    // 定时同步心跳广播（每30秒）
    this.heartbeatTimer = setInterval(() => this.broadcastHeartbeat(), 30000);

    console.log('[跨端同步] 服务已初始化');
  }

  /**
   * 注册在线客户端
   */
  registerClient(clientId, clientInfo) {
    this.clients.set(clientId, {
      type: clientInfo.type || 'unknown',   // 'admin' | 'store'
      storeId: clientInfo.storeId || null,
      lastHeartbeat: Date.now(),
      connectedAt: Date.now(),
      userAgent: clientInfo.userAgent || ''
    });

    console.log(`[跨端同步] 客户端上线: ${clientId} (${clientInfo.type})`);
    
    // 广播客户端上线事件
    this.publishSyncEvent({
      type: 'client_online',
      clientId,
      clientType: clientInfo.type,
      storeId: clientInfo.storeId
    });
  }

  /**
   * 更新客户端心跳
   */
  updateHeartbeat(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastHeartbeat = Date.now();
    }
  }

  /**
   * 注销客户端
   */
  unregisterClient(clientId) {
    if (this.clients.has(clientId)) {
      const client = this.clients.get(clientId);
      console.log(`[跨端同步] 客户端下线: ${clientId} (${client.type})`);
      this.clients.delete(clientId);

      this.publishSyncEvent({
        type: 'client_offline',
        clientId,
        clientType: client.type
      });
    }
  }

  /**
   * 获取在线客户端列表
   */
  getOnlineClients() {
    const now = Date.now();
    const online = [];
    const offline = [];

    this.clients.forEach((client, id) => {
      // 60秒无心跳视为离线
      if (now - client.lastHeartbeat < 60000) {
        online.push({ clientId: id, ...client, isOnline: true });
      } else {
        offline.push({ clientId: id, ...client, isOnline: false });
      }
    });

    // 清理离线客户端
    offline.forEach(c => this.clients.delete(c.clientId));

    return { online, total: online.length };
  }

  /**
   * 记录跨端操作
   * @param {string} source - 操作来源: 'index' | 'm-index' | 'c-end' | 'wechat'
   * @param {object} operation - 操作详情
   *   { type, orderId, orderNo, storeId, action, data, clientId }
   */
  recordOperation(source, operation) {
    const record = {
      id: ++this.syncIdCounter,
      source,
      type: operation.type || 'unknown',
      action: operation.action || '',
      orderId: operation.orderId || null,
      orderNo: operation.orderNo || null,
      storeId: operation.storeId || null,
      data: operation.data || {},
      clientId: operation.clientId || null,
      timestamp: Date.now()
    };

    this.operations.unshift(record);

    // 限制数量
    if (this.operations.length > MAX_OPERATIONS) {
      this.operations.length = MAX_OPERATIONS;
    }

    // 发布到 MQTT（广播给所有在线客户端）
    this.publishSyncEvent({
      type: 'operation',
      source,
      operation: {
        type: record.type,
        action: record.action,
        orderId: record.orderId,
        orderNo: record.orderNo,
        storeId: record.storeId,
        data: record.data
      },
      syncId: record.id,
      clientId: record.clientId  // 携带操作者clientId，客户端可据此过滤自己的操作
    });

    // 同步写入通知中心
    const hub = getNotificationHub();
    if (hub && operation.storeId) {
      const notifTitle = this._getOperationTitle(source, operation);
      hub.addNotification(operation.storeId, {
        type: 'sync_operation',
        title: notifTitle,
        message: `${source === 'index' ? '总后台' : source === 'm-index' ? '门店端' : source === 'c-end' ? 'C端' : '微信小程序'}执行了${operation.action || operation.type}操作${operation.orderNo ? '：' + operation.orderNo : ''}`,
        orderId: operation.orderId,
        orderNo: operation.orderNo,
        priority: 'normal',
        data: { source, operation: record }
      });
    }

    console.log(`[跨端同步] 记录操作 [${source}]: ${operation.action || operation.type} - ${operation.orderNo || operation.orderId || ''} (syncId: ${record.id})`);
    return record;
  }

  /**
   * 获取操作标题
   */
  _getOperationTitle(source, operation) {
    const sourceName = source === 'index' ? '总后台' : source === 'm-index' ? '门店端' : source === 'c-end' ? 'C端' : '微信小程序';
    const actionMap = {
      'create': '创建了订单',
      'update': '更新了订单',
      'pay': '支付了订单',
      'cancel': '取消了订单',
      'delete': '删除了订单',
      'receive': '收件',
      'process': '开始处理',
      'complete': '完成清洗',
      'pickup': '取件确认',
      'status_change': '变更了状态',
      'light_on': '点亮了灯条',
      'light_off': '关闭了灯条'
    };
    const actionText = actionMap[operation.type] || operation.action || '操作了订单';
    return `📱 ${sourceName}${actionText}`;
  }

  /**
   * 通过 MQTT 发布同步事件
   */
  publishSyncEvent(event) {
    const mqtt = getLightService();
    if (mqtt) {
      try {
        mqtt.publish(TOPIC_SYNC_OPERATION, {
          ...event,
          timestamp: Date.now()
        });
      } catch (e) {
        console.error('[跨端同步] MQTT 发布失败:', e.message);
      }
    }
  }

  /**
   * 广播心跳（让所有客户端知道彼此在线）
   */
  broadcastHeartbeat() {
    const mqtt = getLightService();
    if (mqtt) {
      try {
        const onlineClients = [];
        this.clients.forEach((client, id) => {
          if (Date.now() - client.lastHeartbeat < 60000) {
            onlineClients.push({ clientId: id, type: client.type, storeId: client.storeId });
          }
        });

        mqtt.publish(TOPIC_SYNC_HEARTBEAT, {
          type: 'sync_heartbeat',
          onlineClients,
          serverTime: Date.now()
        });
      } catch (e) {
        // 静默忽略心跳发送失败
      }
    }
  }

  /**
   * 获取操作历史
   * @param {string} source - 可选过滤来源
   * @param {number} limit - 返回数量
   * @param {number} since - 时间戳过滤
   */
  getOperations(source = null, limit = 50, since = 0) {
    let list = [...this.operations];

    if (source) {
      list = list.filter(o => o.source === source);
    }
    if (since > 0) {
      list = list.filter(o => o.timestamp > since);
    }

    // 过滤过期
    const now = Date.now();
    list = list.filter(o => now - o.timestamp < OPERATION_TTL);

    return list.slice(0, limit);
  }

  /**
   * 获取同步状态摘要
   */
  getSyncStatus() {
    const clients = this.getOnlineClients();
    const recentOps = this.getOperations(null, 10);
    const adminOnline = clients.online.some(c => c.type === 'admin');
    const storeOnline = clients.online.some(c => c.type === 'store');
    const mqttConnected = getLightService() ? getLightService().isConnected() : false;

    return {
      mqttConnected,
      clients,
      recentOperations: recentOps.length,
      lastOperation: recentOps[0] || null,
      crossEndStatus: adminOnline && storeOnline ? 'full_sync' : adminOnline ? 'admin_only' : storeOnline ? 'store_only' : 'offline',
      serverTime: Date.now()
    };
  }

  /**
   * 清理过期操作记录
   */
  cleanup() {
    const now = Date.now();
    this.operations = this.operations.filter(o => now - o.timestamp < OPERATION_TTL);

    // 清理超时客户端
    this.clients.forEach((client, id) => {
      if (now - client.lastHeartbeat > 120000) {
        this.clients.delete(id);
      }
    });
  }

  /**
   * 销毁服务
   */
  destroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.clients.clear();
    this.operations = [];
    console.log('[跨端同步] 服务已销毁');
  }
}

const instance = new CrossSyncService();
module.exports = instance;
