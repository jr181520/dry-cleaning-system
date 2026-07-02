/**
 * 通知中心服务
 * 统一收集所有业务事件（订单创建、灯条点亮等），供 Admin 端轮询查询
 * 
 * 通知来源：
 *   1. C端/微信小程序创建订单 → orderEventService 发布 MQTT 事件时同步写入
 *   2. 取件触发灯条点亮 → orderLightRoutes 激活灯条时同步写入
 * 
 * Admin 端（index.html）通过：
 *   - MQTT WebSocket 订阅 dryclean/orders/all/update 获取实时订单事件
 *   - REST API GET /api/admin/notifications/:storeId 获取历史通知
 */

const MAX_NOTIFICATIONS = 100;  // 每个门店最多保留的通知数
const TTL_MS = 3600000;         // 通知有效期：1小时

class NotificationHubService {
  constructor() {
    // storeId -> Array<Notification>
    this.notifications = new Map();
    
    // 全局通知（所有门店可见）
    this.globalNotifications = [];
    
    // 自增ID
    this.idCounter = 0;
    
    // 定时清理过期通知（每60秒）
    this.cleanupTimer = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * 添加通知
   * @param {string} storeId - 门店ID（可选，不传则为全局通知）
   * @param {object} notification - 通知对象
   *   { type: 'order_created'|'order_paid'|'light_activated'|'light_deactivated'|'order_status_changed'|...,
   *     title: string,
   *     message: string,
   *     orderId?: string,
   *     orderNo?: string,
   *     priority: 'high'|'normal'|'low',
   *     data?: object }
   */
  addNotification(storeId, notification) {
    const notif = {
      id: ++this.idCounter,
      storeId: storeId || 'GLOBAL',
      type: notification.type || 'system',
      title: notification.title || '系统通知',
      message: notification.message || '',
      orderId: notification.orderId || null,
      orderNo: notification.orderNo || null,
      priority: notification.priority || 'normal',
      data: notification.data || {},
      read: false,
      createdAt: Date.now()
    };

    if (storeId) {
      if (!this.notifications.has(storeId)) {
        this.notifications.set(storeId, []);
      }
      const list = this.notifications.get(storeId);
      list.unshift(notif);
      // 限制数量
      if (list.length > MAX_NOTIFICATIONS) {
        list.length = MAX_NOTIFICATIONS;
      }
    } else {
      this.globalNotifications.unshift(notif);
      if (this.globalNotifications.length > MAX_NOTIFICATIONS) {
        this.globalNotifications.length = MAX_NOTIFICATIONS;
      }
    }

    // 注意：门店通知在 per-store 列表中已存储（第64行），
    // 不再重复插入 globalNotifications（getNotifications('ALL') 会合并所有列表）
    // 避免同一通知对象在全局列表中重复出现

    console.log(`[通知中心] 新增通知 [${storeId || 'GLOBAL'}]: ${notif.title}`);
    return notif;
  }

  /**
   * 添加订单事件通知
   * 由 orderEventService 在发布 MQTT 事件时调用
   */
  addOrderEvent(event, order) {
    const storeId = order.storeId || order.store_id;
    if (!storeId) return;

    const eventConfig = {
      order_created: {
        title: '🆕 新订单',
        message: `客户通过${order.createdFrom === 'wechat' ? '微信小程序' : 'C端'}创建了订单 ${order.orderNo}，物品${order.items?.length || 0}件，金额¥${order.amounts?.total || 0}`,
        priority: 'high'
      },
      order_paid: {
        title: '💰 订单已支付',
        message: `订单 ${order.orderNo} 已支付 ¥${order.totalAmount || order.amounts?.total || 0}，支付方式：${order.paymentMethod || '微信支付'}`,
        priority: 'high'
      },
      order_cancelled: {
        title: '❌ 订单已取消',
        message: `订单 ${order.orderNo} 已被取消`,
        priority: 'normal'
      },
      order_status_changed: {
        title: '📋 订单状态变更',
        message: `订单 ${order.orderNo} 状态已更新为 ${order.status}`,
        priority: 'normal'
      }
    };

    const config = eventConfig[event];
    if (!config) return;

    this.addNotification(storeId, {
      type: event,
      title: config.title,
      message: config.message,
      orderId: order._id?.toString() || order.orderId,
      orderNo: order.orderNo,
      priority: config.priority,
      data: { order }
    });
  }

  /**
   * 添加灯条事件通知
   * 由 orderLightRoutes 在激活/关闭灯条时调用
   */
  addLightEvent(storeId, { orderId, itemIndex, itemName, customerName, color, action, orderNo }) {
    if (!storeId) return;

    const isActivate = action === 'activate' || action === 'on' || action === 'bind';
    const config = isActivate ? {
      title: '💡 灯条已点亮',
      message: `${customerName || '客户'}的取件触发灯条点亮${itemName ? '（' + itemName + '）' : ''}${orderNo ? '，订单号：' + orderNo : ''}`,
      priority: 'high',
      type: 'light_activated'
    } : {
      title: '🔌 灯条已关闭',
      message: `订单 ${orderNo || orderId} 的灯条已关闭${itemName ? '（' + itemName + '）' : ''}`,
      priority: 'normal',
      type: 'light_deactivated'
    };

    this.addNotification(storeId, {
      ...config,
      orderId,
      orderNo: orderNo || null,
      data: { itemIndex, itemName, customerName, color }
    });
  }

  /**
   * 获取门店未读通知
   * @param {string} storeId - 门店ID（'ALL' 获取所有门店通知）
   * @param {number} limit - 返回数量
   * @param {number} since - 时间戳，只返回此时间之后的
   */
  getNotifications(storeId, limit = 20, since = 0) {
    let list;
    if (storeId === 'ALL' || !storeId) {
      // 合并全局通知 + 所有门店通知
      list = [...this.globalNotifications];
      this.notifications.forEach(storeList => {
        storeList.forEach(n => list.push(n));
      });
      // 去重（同一通知对象可能在多个列表中出现）
      const seen = new Set();
      list = list.filter(n => {
        if (seen.has(n.id)) return false;
        seen.add(n.id);
        return true;
      });
    } else {
      list = this.notifications.get(storeId) || [];
    }

    // 过滤过期
    const now = Date.now();
    list = list.filter(n => now - n.createdAt < TTL_MS);

    // 过滤 since
    if (since > 0) {
      list = list.filter(n => n.createdAt > since);
    }

    // 排序（最新在前）并限制数量
    list.sort((a, b) => b.createdAt - a.createdAt);
    if (limit > 0) {
      list = list.slice(0, limit);
    }

    const unreadCount = list.filter(n => !n.read).length;

    return { notifications: list, unreadCount, total: list.length };
  }

  /**
   * 标记通知为已读
   */
  markAsRead(storeId, notificationIds) {
    const idSet = new Set(notificationIds);
    let count = 0;

    const lists = [];
    if (storeId && storeId !== 'ALL') {
      const list = this.notifications.get(storeId);
      if (list) lists.push(list);
    } else {
      this.notifications.forEach(l => lists.push(l));
    }
    if (storeId === 'ALL' || !storeId) {
      lists.push(this.globalNotifications);
    }

    for (const list of lists) {
      for (const n of list) {
        if (idSet.has(n.id) && !n.read) {
          n.read = true;
          count++;
        }
      }
    }

    return { marked: count };
  }

  /**
   * 清理过期通知
   */
  cleanup() {
    const now = Date.now();
    const cutoff = now - TTL_MS;

    for (const [storeId, list] of this.notifications) {
      const filtered = list.filter(n => now - n.createdAt < TTL_MS);
      if (filtered.length === 0) {
        this.notifications.delete(storeId);
      } else {
        this.notifications.set(storeId, filtered);
      }
    }

    this.globalNotifications = this.globalNotifications.filter(n => now - n.createdAt < TTL_MS);
  }

  /**
   * 销毁服务（清除定时器）
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}

// 单例
const instance = new NotificationHubService();
module.exports = instance;
