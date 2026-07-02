/**
 * 订单事件服务
 * 通过 MQTT 发布订单状态变更事件，实现小程序→M端/Admin端实时数据同步
 * 
 * MQTT 主题设计：
 *   dryclean/orders/{storeId}/update  - 门店级订单更新（m-index 订阅）
 *   dryclean/orders/all/update        - 全局订单更新（admin 订阅）
 *   dryclean/sync/operation           - 跨端操作广播（index ↔ m-index）
 * 
 * 消息格式：
 *   { event: 'order_paid'|'order_cancelled'|..., orderId, orderNo, storeId, status, updatedAt, _source }
 */

const TOPIC_PREFIX = 'dryclean/orders';

let lightService = null;
let notificationHub = null;
let crossSyncService = null;
let messageService = null;

// 延迟加载 lightService（避免循环依赖）
function getMqttClient() {
  if (!lightService) {
    try {
      lightService = require('./lightService');
    } catch (e) {
      return null;
    }
  }
  return lightService.isConnected() ? lightService : null;
}

// 延迟加载 notificationHubService
function getNotificationHub() {
  if (!notificationHub) {
    try {
      notificationHub = require('./notificationHubService');
    } catch (e) {
      return null;
    }
  }
  return notificationHub;
}

// 延迟加载 crossSyncService
function getCrossSyncService() {
  if (!crossSyncService) {
    try {
      crossSyncService = require('./crossSyncService');
    } catch (e) {
      return null;
    }
  }
  return crossSyncService;
}

// 延迟加载 messageService
function getMessageService() {
  if (!messageService) {
    try {
      messageService = require('./messageService');
    } catch (e) {
      return null;
    }
  }
  return messageService;
}

class OrderEventService {
  /**
   * 发布订单状态变更事件
   * @param {string} event - 事件类型: order_created, order_paid, order_cancelled, order_status_changed
   * @param {object} order - 订单对象
   * @param {object} options - 可选参数
   *   { source: 'c-end'|'wechat'|'index'|'m-index' - 操作来源 }
   */
  publishOrderEvent(event, order, options = {}) {
    const storeId = order.storeId || order.store_id || 'UNKNOWN';
    const source = options.source || order.createdFrom || 'app';
    const payload = {
      event,
      orderId: order._id?.toString() || order.orderId,
      orderNo: order.orderNo,
      storeId,
      userId: order.userId,
      status: order.status,
      paymentMethod: order.payment?.method,
      totalAmount: order.amounts?.total || 0,
      items: order.items?.map(i => ({ name: i.name, price: i.price, quantity: i.quantity })) || [],
      customerName: order.delivery?.contactName || '',
      createdFrom: order.createdFrom || source,
      _source: source,  // 操作来源标识
      _oldStatus: order._oldStatus || null,
      updatedAt: new Date().toISOString()
    };

    const mqtt = getMqttClient();
    if (mqtt) {
      // 发布到门店级主题（m-index 订阅）
      const storeTopic = `${TOPIC_PREFIX}/${storeId}/update`;
      mqtt.publish(storeTopic, payload);

      // 发布到全局主题（admin 订阅）
      const globalTopic = `${TOPIC_PREFIX}/all/update`;
      mqtt.publish(globalTopic, payload);

      console.log(`[订单事件] 已发布 ${event} [来源:${source}] → ${storeTopic}, ${globalTopic}`);
    } else {
      console.log('[订单事件] MQTT 未连接，跳过事件发布');
    }

    // 同步写入通知中心（Admin 端可轮询获取）
    const hub = getNotificationHub();
    if (hub) {
      hub.addOrderEvent(event, payload);
    }

    // 记录到跨端同步服务（用于追踪操作来源）
    const sync = getCrossSyncService();
    if (sync) {
      const actionMap = {
        'order_created': 'create',
        'order_paid': 'pay',
        'order_cancelled': 'cancel',
        'order_status_changed': 'status_change'
      };
      sync.recordOperation(source, {
        type: actionMap[event] || event,
        action: event,
        orderId: payload.orderId,
        orderNo: payload.orderNo,
        storeId,
        data: { status: payload.status, totalAmount: payload.totalAmount }
      });
    }

    // 对于C端/微信操作，写入消息中心（客户可见的消息）
    if (source === 'wechat' || source === 'c-end') {
      const msgSvc = getMessageService();
      if (msgSvc) {
        msgSvc.addCustomerOrderMessage(order, event, source);
      }
    }
  }

  /** 订单创建 */
  onOrderCreated(order) {
    this.publishOrderEvent('order_created', order);
  }

  /** 订单支付成功 */
  onOrderPaid(order) {
    this.publishOrderEvent('order_paid', order);
  }

  /** 订单取消 */
  onOrderCancelled(order) {
    this.publishOrderEvent('order_cancelled', order);
  }

  /** 订单状态变更（通用） */
  onOrderStatusChanged(order, oldStatus) {
    this.publishOrderEvent('order_status_changed', { ...order.toObject?.() || order, _oldStatus: oldStatus });
  }
}

module.exports = new OrderEventService();
