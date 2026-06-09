/**
 * 订单事件服务
 * 通过 MQTT 发布订单状态变更事件，实现小程序→M端/Admin端实时数据同步
 * 
 * MQTT 主题设计：
 *   dryclean/orders/{storeId}/update  - 门店级订单更新（m-index 订阅）
 *   dryclean/orders/all/update        - 全局订单更新（admin 订阅）
 * 
 * 消息格式：
 *   { event: 'order_paid'|'order_cancelled'|..., orderId, orderNo, storeId, status, updatedAt }
 */

const TOPIC_PREFIX = 'dryclean/orders';

let lightService = null;

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

class OrderEventService {
  /**
   * 发布订单状态变更事件
   * @param {string} event - 事件类型: order_created, order_paid, order_cancelled, order_status_changed
   * @param {object} order - 订单对象
   */
  publishOrderEvent(event, order) {
    const mqtt = getMqttClient();
    if (!mqtt) {
      console.log('[订单事件] MQTT 未连接，跳过事件发布');
      return;
    }

    const storeId = order.storeId || 'UNKNOWN';
    const payload = {
      event,
      orderId: order._id?.toString() || order.orderId,
      orderNo: order.orderNo,
      storeId,
      userId: order.userId,
      status: order.status,
      paymentMethod: order.payment?.method,
      totalAmount: order.amounts?.total || 0,
      updatedAt: new Date().toISOString()
    };

    // 发布到门店级主题（m-index 订阅）
    const storeTopic = `${TOPIC_PREFIX}/${storeId}/update`;
    mqtt.publish(storeTopic, payload);

    // 发布到全局主题（admin 订阅）
    const globalTopic = `${TOPIC_PREFIX}/all/update`;
    mqtt.publish(globalTopic, payload);

    console.log(`[订单事件] 已发布 ${event} → ${storeTopic}, ${globalTopic}`);
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
