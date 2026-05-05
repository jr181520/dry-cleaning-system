/**
 * 消息通知服务
 * 支持多业务类型模板
 */

const MODULE_CONFIG = require('../../../config/modules');

// 消息模板定义
const TEMPLATES = {
  // ========== 干洗业务 ==========
  cleaning: {
    order_created: {
      title: '订单已创建',
      body: '您的清洗订单已创建，订单号：{orderNo}，预计{estimatedDays}天完成',
      channels: ['wechat', 'sms']
    },
    order_paid: {
      title: '支付成功',
      body: '您的清洗订单已支付成功，金额：{amount}元',
      channels: ['wechat', 'sms']
    },
    order_received: {
      title: '衣物已收件',
      body: '门店已收到您的{itemName}，正在处理中',
      channels: ['wechat', 'push']
    },
    order_completed: {
      title: '清洗完成',
      body: '您的{itemName}已清洗完成，请前往{storeName}取件',
      channels: ['wechat', 'sms', 'push']
    },
    order_picked_up: {
      title: '已取件',
      body: '您的{itemName}已取件，感谢使用我们的服务',
      channels: ['wechat']
    },
    delivery_fee_paid: {
      title: '配送费已支付',
      body: '您已支付配送费{fee}元，{provider}骑手将上门取件',
      channels: ['wechat', 'sms']
    },
    pickup_method_selected: {
      title: '取件方式已选择',
      body: '您已选择取件方式：{method}，订单号：{orderNo}',
      channels: ['wechat']
    },
    pickup_scanned: {
      title: '取件码已扫描',
      body: '您的取件码已被扫描，订单号：{orderNo}，等待门店出库',
      channels: ['wechat', 'push']
    },
    order_ready: {
      title: '衣物已就绪',
      body: '您的衣物已处理完成，请在{storeName}取件',
      channels: ['wechat', 'sms', 'push']
    },
    courier_assigned: {
      title: '骑手已接单',
      body: '{provider}骑手已接单，将前往{storeName}取件',
      channels: ['wechat', 'push']
    },
    delivering_back: {
      title: '配送中',
      body: '您的衣物正在配送中，预计{estimatedTime}送达',
      channels: ['wechat', 'push']
    }
  },
  
  // ========== 回收业务 ==========
  recycle: {
    submit_request: {
      title: '回收请求已提交',
      body: '您的物品回收请求已提交，等待回收员上门评估',
      channels: ['wechat', 'sms']
    },
    assessor_assigned: {
      title: '回收员已接单',
      body: '回收员{assessorName}已接单，预计{estimatedTime}到达',
      channels: ['wechat', 'push']
    },
    price_assigned: {
      title: '回收估价已出',
      body: '您的{itemName}估价{price}元，是否同意回收？',
      channels: ['wechat', 'sms']
    },
    user_confirmed: {
      title: '回收已确认',
      body: '您已确认以{price}元回收{itemName}，款项将打入您的账户',
      channels: ['wechat', 'push']
    },
    collected: {
      title: '物品已回收',
      body: '您的{itemName}已回收完成，{price}元已到账',
      channels: ['wechat', 'sms']
    }
  },
  
  // ========== 租赁业务 ==========
  rental: {
    reserved: {
      title: '预约成功',
      body: '您已预约{itemName}，起租日期：{startDate}',
      channels: ['wechat', 'sms']
    },
    payment_required: {
      title: '请支付押金',
      body: '您的租赁订单需支付押金{deposit}元，请尽快支付',
      channels: ['wechat', 'sms', 'push']
    },
    rental_started: {
      title: '租赁已开始',
      body: '您的{itemName}租赁已开始，归还日期：{dueDate}',
      channels: ['wechat', 'push']
    },
    reminder_3days: {
      title: '归还提醒',
      body: '您的{itemName}将于3天后到期（{dueDate}），请准备归还',
      channels: ['wechat', 'sms', 'push']
    },
    reminder_1day: {
      title: '归还提醒',
      body: '您的{itemName}将于明天到期，请按时归还',
      channels: ['wechat', 'sms', 'push']
    },
    due_today: {
      title: '今日归还',
      body: '您的{itemName}今日到期，请前往{storeName}归还',
      channels: ['wechat', 'sms', 'push']
    },
    overdue: {
      title: '已逾期',
      body: '您的{itemName}已逾期{overdueDays}天，产生滞纳金{penalty}元/天',
      channels: ['wechat', 'sms', 'push', 'phone']
    },
    returned: {
      title: '已归还',
      body: '您的{itemName}已归还，押金将于{releaseDate}退回',
      channels: ['wechat', 'push']
    },
    deposit_released: {
      title: '押金已退回',
      body: '您的押金{amount}元已退回至账户余额',
      channels: ['wechat', 'sms']
    },
    deposit_forfeited: {
      title: '押金扣除',
      body: '因{reason}，您的押金{amount}元已被扣除',
      channels: ['wechat', 'sms']
    }
  },
  
  // ========== 系统消息 ==========
  system: {
    account_bound: {
      title: '账号绑定成功',
      body: '您的{platform}账号已成功绑定',
      channels: ['wechat']
    },
    password_changed: {
      title: '密码已修改',
      body: '您的账号密码已成功修改，如非本人操作请立即联系客服',
      channels: ['wechat', 'sms']
    },
    suspicious_activity: {
      title: '账号异常',
      body: '检测到您的账号存在异常登录，请确认是否为本人操作',
      channels: ['wechat', 'sms', 'phone']
    }
  }
};

class NotificationService {
  constructor() {
    this.templates = TEMPLATES;
  }
  
  /**
   * 发送通知
   * @param {string} userId
   * @param {string} templateKey - 如 'cleaning.order_completed'
   * @param {Object} params - 模板变量
   */
  async send(userId, templateKey, params) {
    const [category, event] = templateKey.split('.');
    const template = this.templates[category]?.[event];
    
    if (!template) {
      throw new Error(`模板不存在: ${templateKey}`);
    }
    
    // 渲染内容
    const title = this.render(template.title, params);
    const body = this.render(template.body, params);
    
    // 按渠道发送
    const results = {};
    for (const channel of template.channels) {
      try {
        results[channel] = await this.sendByChannel(userId, channel, { title, body, templateKey, params });
      } catch (error) {
        results[channel] = { success: false, error: error.message };
      }
    }
    
    return { success: true, results };
  }
  
  /**
   * 按渠道发送
   */
  async sendByChannel(userId, channel, content) {
    switch (channel) {
      case 'wechat':
        return this.sendWechat(userId, content);
      case 'sms':
        return this.sendSms(userId, content);
      case 'push':
        return this.sendPush(userId, content);
      case 'phone':
        return this.sendPhone(userId, content);
      default:
        throw new Error(`不支持的渠道: ${channel}`);
    }
  }
  
  /**
   * 微信订阅消息
   */
  async sendWechat(userId, content) {
    // TODO: 对接微信订阅消息API
    return { success: true, messageId: 'wx_' + Date.now() };
  }
  
  /**
   * 短信通知
   */
  async sendSms(userId, content) {
    // TODO: 对接短信网关
    return { success: true, messageId: 'sms_' + Date.now() };
  }
  
  /**
   * App推送
   */
  async sendPush(userId, content) {
    // TODO: 对接个推/极光等
    return { success: true, messageId: 'push_' + Date.now() };
  }
  
  /**
   * 电话通知
   */
  async sendPhone(userId, content) {
    // TODO: 对接语音通知服务
    return { success: true, messageId: 'phone_' + Date.now() };
  }
  
  /**
   * 渲染模板变量
   */
  render(template, params) {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match;
    });
  }
  
  /**
   * 获取可用模板列表
   */
  getAvailableTemplates(moduleType) {
    return this.templates[moduleType] || {};
  }
}

module.exports = new NotificationService();
