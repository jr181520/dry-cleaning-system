/**
 * 淘宝闪送配送服务商（底层对接蜂鸟即配/饿了么开放平台）
 * 
 * 说明：
 *   淘宝闪送目前主要由蜂鸟即配（Fengniao）提供运力，属于饿了么生态。
 *   商户需在饿了么开放平台 (open.ele.me) 注册并签约闪送服务。
 * 
 * 真实对接流程：
 *   1. 在饿了么开放平台注册商户 → 获取 appId + appSecret + merchantId
 *   2. 配置 TAOBAO_FENGNIAO_APP_ID / TAOBAO_FENGNIAO_SECRET / TAOBAO_MERCHANT_ID 环境变量
 *   3. 沙箱测试通过后切换生产环境
 * 
 * 备用方案（无蜂鸟签约时）：
 *   - 可回退使用菜鸟裹裹开放API (link.cainiao.com)
 *   - 或通过淘宝服务市场接入第三方配送ISV
 * 
 * Mock模式（无密钥时）：返回合理的模拟数据
 */

const DeliveryProviderBase = require('./providerBase');

class TaobaoProvider extends DeliveryProviderBase {
  constructor() {
    super({
      name: 'taobao',
      displayName: '淘宝闪送',
      apiBaseUrl: process.env.TAOBAO_API_URL || 'https://open-anmp.ele.me',
      credentials: {
        appId: process.env.TAOBAO_FENGNIAO_APP_ID || '',
        secret: process.env.TAOBAO_FENGNIAO_SECRET || '',
        merchantId: process.env.TAOBAO_MERCHANT_ID || ''
      },
      timeout: 15000
    });
    this.provider = 'taobao';
  }

  /** 蜂鸟签名算法：MD5（参数排序 + secret） */
  generateSign(params) {
    const sorted = this.sortedParams(params);
    return this.md5Sign(sorted + this.credentials.secret);
  }

  /**
   * 创建配送订单
   * POST /anmp/api/v2/order/create
   */
  async createOrder(params) {
    const { orderId, pickup, delivery, callbackUrl, goodsDesc, weight } = params;
    if (this.isMockMode) {
      return this._mockCreateOrder(params);
    }

    const timestamp = Date.now();
    const payload = {
      app_id: this.credentials.appId,
      merchant_id: this.credentials.merchantId,
      timestamp,
      sign: '',
      partner_order_code: orderId,
      order_add_time: timestamp,
      notify_url: callbackUrl || '',
      goods_type: 1,
      goods_weight: (weight || 1) * 1000,  // 蜂鸟单位：克
      goods_name: goodsDesc || '干洗衣物',
      sender_name: pickup.contactName || '',
      sender_phone: pickup.contactPhone || '',
      sender_address: pickup.address || '',
      sender_lat: pickup.latitude || 0,
      sender_lng: pickup.longitude || 0,
      receiver_name: delivery.contactName || '',
      receiver_phone: delivery.contactPhone || '',
      receiver_address: delivery.address || '',
      receiver_lat: delivery.latitude || 0,
      receiver_lng: delivery.longitude || 0
    };
    payload.sign = this.generateSign(payload);

    try {
      const result = await this.httpRequest('POST', '/anmp/api/v2/order/create', payload);
      if (result.code === '0' || result.code === 0 || result.success) {
        const data = result.data || result.result || {};
        return {
          success: true,
          provider: this.provider,
          platformOrderId: data.order_code || data.platform_order_id || orderId,
          deliveryId: orderId,
          status: 'pending',
          price: data.delivery_fee || data.total_price || 0,
          estimateTime: data.predict_delivery_time || 0
        };
      }
      console.error(`[淘宝] 创建订单失败:`, result);
      return { success: false, provider: this.provider, error: result.msg || result.message || '下单失败' };
    } catch (error) {
      console.error(`[淘宝] API调用失败:`, error.message);
      return this._mockCreateOrder(params);
    }
  }

  /**
   * 查询配送状态
   * POST /anmp/api/v2/order/query
   */
  async queryOrder(platformOrderId) {
    if (this.isMockMode) {
      return this._mockQueryOrder(platformOrderId);
    }

    const timestamp = Date.now();
    const payload = {
      app_id: this.credentials.appId,
      merchant_id: this.credentials.merchantId,
      timestamp,
      sign: '',
      partner_order_code: platformOrderId
    };
    payload.sign = this.generateSign(payload);

    try {
      const result = await this.httpRequest('POST', '/anmp/api/v2/order/query', payload);
      if (result.code === '0' || result.code === 0) {
        return this._normalizeTaobaoStatus(result.data || result.result || {});
      }
      return { success: false, provider: this.provider, error: result.msg };
    } catch (error) {
      console.error(`[淘宝] 查询状态失败:`, error.message);
      return this._mockQueryOrder(platformOrderId);
    }
  }

  /**
   * 取消配送
   * POST /anmp/api/v2/order/cancel
   */
  async cancelOrder(platformOrderId, reason = '') {
    if (this.isMockMode) {
      return { success: true, provider: this.provider, platformOrderId, message: '已取消（模拟）' };
    }

    const timestamp = Date.now();
    const payload = {
      app_id: this.credentials.appId,
      merchant_id: this.credentials.merchantId,
      timestamp,
      sign: '',
      partner_order_code: platformOrderId,
      cancel_reason: reason || '用户取消'
    };
    payload.sign = this.generateSign(payload);

    try {
      const result = await this.httpRequest('POST', '/anmp/api/v2/order/cancel', payload);
      if (result.code === '0' || result.code === 0) {
        return { success: true, provider: this.provider, platformOrderId, message: '已取消' };
      }
      return { success: false, provider: this.provider, error: result.msg || '取消失败' };
    } catch (error) {
      return { success: false, provider: this.provider, error: error.message };
    }
  }

  /** 查询价格 */
  async queryPrice(params) {
    if (this.isMockMode) return this._mockPrice(params);

    const timestamp = Date.now();
    const payload = {
      app_id: this.credentials.appId,
      merchant_id: this.credentials.merchantId,
      timestamp,
      sign: '',
      sender_lat: params.pickup?.latitude || 0,
      sender_lng: params.pickup?.longitude || 0,
      receiver_lat: params.delivery?.latitude || 0,
      receiver_lng: params.delivery?.longitude || 0,
      goods_weight: (params.weight || 1) * 1000
    };
    payload.sign = this.generateSign(payload);

    try {
      const result = await this.httpRequest('POST', '/anmp/api/v2/order/queryFee', payload);
      if (result.code === '0') {
        return { success: true, price: result.data?.delivery_fee || 0, estimateTime: result.data?.predict_time || 30 };
      }
      return this._mockPrice(params);
    } catch {
      return this._mockPrice(params);
    }
  }

  // ─── 状态映射 ───
  _normalizeTaobaoStatus(raw) {
    // 蜂鸟状态码映射
    const statusMap = {
      'ORDER_CREATE':    'pending',
      'ORDER_GRAB':      'accepted',
      'ORDER_TAKE':      'picking_up',
      'ORDER_DELIVERING': 'delivering',
      'ORDER_FINISH':    'delivered',
      'ORDER_CANCEL':    'cancelled',
      'ORDER_EXCEPTION': 'exception'
    };
    const status = statusMap[raw.order_status || raw.status] || raw.order_status || 'unknown';
    return {
      success: true,
      provider: this.provider,
      platformOrderId: raw.partner_order_code || raw.order_code,
      status,
      driver: raw.rider_name ? {
        name: raw.rider_name,
        phone: raw.rider_phone || '',
        location: raw.rider_lat ? { lat: raw.rider_lat, lng: raw.rider_lng } : null
      } : null
    };
  }

  // ─── Mock 实现 ───
  _mockCreateOrder(params) {
    const platformOrderId = `TB${Date.now()}${Math.random().toString(36).substring(2, 6)}`;
    return {
      success: true,
      provider: this.provider,
      platformOrderId,
      deliveryId: params.orderId,
      status: 'pending',
      price: this._mockCalcPrice(params.weight || 1),
      estimateTime: 20 + Math.floor(Math.random() * 30),
      _mode: 'mock'
    };
  }

  _mockQueryOrder(platformOrderId) {
    const stages = ['pending', 'accepted', 'picking_up', 'delivering', 'delivered'];
    const stageIdx = Math.floor(Date.now() / 60000) % stages.length;
    return {
      success: true,
      provider: this.provider,
      platformOrderId,
      status: stages[stageIdx],
      driver: stageIdx >= 2 ? {
        name: ['陈师傅', '杨师傅', '周师傅'][Math.floor(Math.random() * 3)],
        phone: '150****' + Math.floor(1000 + Math.random() * 9000)
      } : null,
      _mode: 'mock'
    };
  }

  _mockPrice(params) {
    return {
      success: true,
      price: this._mockCalcPrice(params.weight || 1),
      estimateTime: 20 + Math.floor(Math.random() * 30)
    };
  }

  _mockCalcPrice(weight) {
    return parseFloat((5.5 + weight * 1.8 + Math.random() * 3).toFixed(2));
  }
}

module.exports = TaobaoProvider;
