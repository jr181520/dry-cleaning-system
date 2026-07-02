/**
 * 消息中心服务 (Message Center Service)
 * 
 * 与 notificationHubService 不同，本服务专门处理：
 *   1. 客户消息 — C端/微信小程序用户下单、支付、咨询等产生的消息
 *   2. 账户消息 — Admin ↔ Store 之间的直接通讯
 *   3. 系统公告 — 管理员发布的全员通知
 * 
 * 和 bell 铃铛通知（系统事件流）完全独立，互不干扰。
 */

const MAX_MESSAGES = 200;       // 最多保留消息数
const TTL_MS = 7 * 24 * 3600000; // 消息保留 7 天

class MessageService {
  constructor() {
    /** @type {Array<{id, threadId, fromType, fromId, fromName, toType, toId, type, subject, content, orderNo, storeId, read, createdAt}>} */
    this.messages = [];
    this.idCounter = 0;

    // 定时清理过期消息（每10分钟）
    this.cleanupTimer = setInterval(() => this.cleanup(), 600000);
    console.log('[消息中心] 服务已初始化');
  }

  /**
   * 添加消息
   */
  addMessage(msg) {
    const message = {
      id: ++this.idCounter,
      threadId: msg.threadId || `thread_${Date.now()}`,
      fromType: msg.fromType || 'system',
      fromId: msg.fromId || '',
      fromName: msg.fromName || '系统',
      toType: msg.toType || 'store',
      toId: msg.toId || '',
      type: msg.type || 'direct_message',
      subject: msg.subject || '',
      content: msg.content || '',
      orderNo: msg.orderNo || null,
      storeId: msg.storeId || null,
      read: false,
      createdAt: Date.now()
    };

    this.messages.unshift(message);

    if (this.messages.length > MAX_MESSAGES) {
      this.messages.length = MAX_MESSAGES;
    }

    console.log(`[消息中心] 新消息 #${message.id}: [${message.type}] ${message.subject || message.content?.substring(0, 40)}`);
    return message;
  }

  /**
   * 添加客户操作消息（C端/微信用户下单/支付等）
   * 由 orderEventService 调用
   */
  addCustomerOrderMessage(order, event, source) {
    const storeId = order.storeId || order.store_id;
    if (!storeId) return null;

    const sourceName = source === 'wechat' ? '微信小程序' : source === 'c-end' ? 'C端' : source;
    const customerName = order.customerName || order.contact?.name || '客户';
    const itemsText = order.items?.map(i => i.name || i.itemName).filter(Boolean).slice(0, 3).join('、') || '衣物';

    const configs = {
      order_created: {
        type: 'customer_order',
        subject: `🆕 客户新订单`,
        content: `${customerName}通过${sourceName}创建了新订单（${order.orderNo}），包含${itemsText}，共${order.items?.length || 0}件，金额¥${order.amounts?.total || order.totalAmount || 0}`
      },
      order_paid: {
        type: 'customer_payment',
        subject: `💰 客户已支付`,
        content: `${customerName}已完成支付（${order.orderNo}），金额¥${order.totalAmount || order.amounts?.total || 0}，支付方式：${order.paymentMethod || '微信支付'}`
      },
      order_cancelled: {
        type: 'customer_order',
        subject: `❌ 客户取消订单`,
        content: `${customerName}取消了订单（${order.orderNo}）`
      }
    };

    const config = configs[event];
    if (!config) return null;

    return this.addMessage({
      threadId: `order_${order.orderNo || order._id}`,
      fromType: 'customer',
      fromId: order.userId || '',
      fromName: customerName,
      toType: 'store',
      toId: storeId,
      type: config.type,
      subject: config.subject,
      content: config.content,
      orderNo: order.orderNo,
      storeId
    });
  }

  /**
   * 获取消息列表
   * @param {object} filters
   *   - storeId: 门店ID（'ALL' 获取所有）
   *   - type: 消息类型过滤
   *   - threadId: 按线程过滤
   *   - limit: 返回数量
   *   - since: 时间戳过滤
   */
  getMessages(filters = {}) {
    let list = [...this.messages];
    const { storeId, type, threadId, limit = 50, since = 0 } = filters;

    if (storeId && storeId !== 'ALL') {
      list = list.filter(m => m.storeId === storeId || m.toId === storeId || m.fromId === storeId);
    }

    if (type) {
      const types = Array.isArray(type) ? type : [type];
      list = list.filter(m => types.includes(m.type));
    }

    if (threadId) {
      list = list.filter(m => m.threadId === threadId);
    }

    if (since > 0) {
      list = list.filter(m => m.createdAt > since);
    }

    // 过滤过期
    const now = Date.now();
    list = list.filter(m => now - m.createdAt < TTL_MS);

    // 最新在前
    list.sort((a, b) => b.createdAt - a.createdAt);

    const unreadCount = list.filter(m => !m.read).length;

    return {
      messages: list.slice(0, limit),
      unreadCount,
      total: list.length,
      hasMore: list.length > limit
    };
  }

  /**
   * 获取消息线程列表（聚合视图，用于消息列表侧边栏）
   */
  getThreads(storeId) {
    const allMessages = storeId && storeId !== 'ALL'
      ? this.messages.filter(m => m.storeId === storeId || m.toId === storeId || m.fromId === storeId)
      : [...this.messages];

    const now = Date.now();
    const validMessages = allMessages.filter(m => now - m.createdAt < TTL_MS);

    // 按 threadId 聚合
    const threadMap = new Map();
    validMessages.forEach(m => {
      const existing = threadMap.get(m.threadId);
      if (!existing || m.createdAt > existing.lastTime) {
        threadMap.set(m.threadId, {
          threadId: m.threadId,
          fromName: m.fromName,
          fromType: m.fromType,
          type: m.type,
          subject: m.subject,
          lastContent: m.content?.substring(0, 80) || '',
          lastTime: m.createdAt,
          orderNo: m.orderNo,
          storeId: m.storeId,
          unreadCount: 0,
          totalMessages: 0
        });
      }

      const entry = threadMap.get(m.threadId);
      if (!m.read) entry.unreadCount++;
      entry.totalMessages++;
    });

    const threads = Array.from(threadMap.values())
      .sort((a, b) => b.lastTime - a.lastTime);

    return { threads, total: threads.length };
  }

  /**
   * 标记消息为已读
   */
  markAsRead(messageIds) {
    const idSet = new Set(messageIds);
    let count = 0;
    this.messages.forEach(m => {
      if (idSet.has(m.id) && !m.read) {
        m.read = true;
        count++;
      }
    });
    return { marked: count };
  }

  /**
   * 标记整个线程为已读
   */
  markThreadAsRead(threadId) {
    let count = 0;
    this.messages.forEach(m => {
      if (m.threadId === threadId && !m.read) {
        m.read = true;
        count++;
      }
    });
    return { marked: count };
  }

  /**
   * 清理过期消息
   */
  cleanup() {
    const now = Date.now();
    const before = this.messages.length;
    this.messages = this.messages.filter(m => now - m.createdAt < TTL_MS);
    if (before > this.messages.length) {
      console.log(`[消息中心] 清理 ${before - this.messages.length} 条过期消息`);
    }
  }

  /**
   * 销毁服务
   */
  destroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.messages = [];
    console.log('[消息中心] 服务已销毁');
  }
}

const instance = new MessageService();
module.exports = instance;
