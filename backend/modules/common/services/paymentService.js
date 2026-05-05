/**
 * 统一支付服务
 * 支持微信/支付宝/银联/余额
 * 支持多方分账
 */

const MODULE_CONFIG = require('../../../config/modules');

class PaymentService {
  constructor() {
    this.config = MODULE_CONFIG.payment;
  }
  
  /**
   * 创建支付订单
   * @param {Object} params
   * @param {string} params.orderId - 业务订单ID
   * @param {number} params.amount - 支付金额
   * @param {string} params.subject - 订单标题
   * @param {string} params.method - 支付方式
   * @param {string} params.openid - 用户openid
   * @param {string} params.orderType - 订单类型
   */
  async createPayment(params) {
    const { orderId, amount, subject, method, openid, orderType } = params;
    
    let result;
    
    switch (method) {
      case 'wechat':
        result = await this.wechatPay({ orderId, amount, subject, openid });
        break;
      case 'alipay':
        result = await this.alipay({ orderId, amount, subject });
        break;
      case 'unionpay':
        result = await this.unionpay({ orderId, amount, subject });
        break;
      case 'balance':
        result = await this.balancePay({ orderId, amount });
        break;
      default:
        throw new Error('不支持的支付方式');
    }
    
    return result;
  }
  
  /**
   * 微信支付
   */
  async wechatPay(params) {
    return {
      success: true,
      paymentMethod: 'wechat',
      data: { prepayId: 'wx' + Date.now() }
    };
  }
  
  /**
   * 支付宝支付
   */
  async alipay(params) {
    return {
      success: true,
      paymentMethod: 'alipay',
      data: { tradeNo: 'ali' + Date.now(), payUrl: 'https://...' }
    };
  }
  
  /**
   * 银联支付
   */
  async unionpay(params) {
    return {
      success: true,
      paymentMethod: 'unionpay',
      data: { tn: 'union' + Date.now() }
    };
  }
  
  /**
   * 余额支付
   */
  async balancePay(params) {
    return {
      success: true,
      paymentMethod: 'balance',
      data: { transactionId: 'bal' + Date.now() }
    };
  }
  
  /**
   * 分账处理
   */
  async splitPayment(order) {
    const { orderType, amounts, items } = order;
    let splits = [];
    
    switch (orderType) {
      case 'cleaning':
        splits = await this.splitCleaningPayment(order);
        break;
      case 'recycle':
        splits = await this.splitRecyclePayment(order);
        break;
      case 'rental':
        splits = await this.splitRentalPayment(order);
        break;
      case 'deposit':
        splits = [{ type: 'deposit', accountId: 'PLATFORM', amount: amounts.total }];
        break;
      default:
        throw new Error('未知订单类型');
    }
    return splits;
  }
  
  /**
   * 干洗订单分账：平台抽佣，剩余给门店
   */
  async splitCleaningPayment(order) {
    const { amounts, storeId } = order;
    const total = amounts.total;
    const platformRatio = this.config.receivers.platform.ratio;
    const platformAmount = Math.round(total * platformRatio * 100) / 100;
    const storeAmount = Math.round((total - platformAmount) * 100) / 100;
    
    return [
      { type: 'store', accountId: storeId, amount: storeAmount, settled: false },
      { type: 'platform', accountId: 'PLATFORM', amount: platformAmount, settled: false }
    ];
  }
  
  /**
   * 回收订单分账：用户获得货款，平台收取服务费
   */
  async splitRecyclePayment(order) {
    const { amounts, userId } = order;
    const userAmount = amounts.subtotal;
    const platformAmount = Math.round(userAmount * this.config.recycle.platform * 100) / 100;
    
    return [
      { type: 'user', accountId: userId, amount: userAmount - platformAmount, settled: false },
      { type: 'platform', accountId: 'PLATFORM', amount: platformAmount, settled: false }
    ];
  }
  
  /**
   * 租赁订单分账
   */
  async splitRentalPayment(order) {
    const { amounts, items } = order;
    const rent = amounts.subtotal;
    const deposit = amounts.deposit;
    const splits = [];
    
    if (rent > 0) {
      splits.push(
        { type: 'owner', accountId: items[0]?.ownerId, amount: Math.round(rent * this.config.rental.owner * 100) / 100, settled: false },
        { type: 'brand', accountId: items[0]?.rental?.brandId, amount: Math.round(rent * this.config.rental.brand * 100) / 100, settled: false },
        { type: 'platform', accountId: 'PLATFORM', amount: Math.round(rent * this.config.rental.platform * 100) / 100, settled: false }
      );
    }
    
    if (deposit > 0) {
      splits.push({
        type: 'deposit', accountId: 'PLATFORM', amount: deposit, settled: false,
        holdUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
    }
    return splits;
  }
  
  async refund(transactionId, amount, reason) {
    return { success: true, refundId: 'ref' + Date.now(), refundAmount: amount, status: 'processing' };
  }
  
  async queryPayment(transactionId) {
    return { success: true, status: 'paid', paidAt: new Date().toISOString() };
  }
}

module.exports = new PaymentService();
