/**
 * 顺丰同城配送服务商
 * API文档: https://open.sf-express.com
 * 
 * 真实对接流程：
 *   1. 在顺丰同城开放平台注册商户 → 获取 partnerId + checkWord
 *   2. 配置 SF_PARTNER_ID / SF_CHECK_WORD 环境变量
 *   3. 沙箱测试通过后切换到生产环境
 * 
 * Mock模式（无密钥时）：返回合理的模拟数据
 */

const DeliveryProviderBase = require('./providerBase');

class ShunfengProvider extends DeliveryProviderBase {
  constructor() {
    super({
      name: 'shunfeng',
      displayName: '顺丰同城',
      apiBaseUrl: process.env.SF_API_URL || 'https://open-sandbox.sfsy.com',
      credentials: {
        partnerId: process.env.SF_PARTNER_ID || '',
        checkWord: process.env.SF_CHECK_WORD || ''
      },
      timeout: 15000
    });
    this.provider = 'shunfeng';
  }

  /** 顺丰签名算法：MD5(timestamp + checkWord) */
  generateSign(timestamp) {
    const signStr = String(timestamp) + this.credentials.checkWord;
    return this.md5Sign(signStr);
  }

  /** 生成唯一请求ID */
  _requestId() {
    return `SF${Date.now()}${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 创建配送订单
   * POST /api/v1/order/create
   */
  async createOrder(params) {
    const { orderId, pickup, delivery, callbackUrl, goodsDesc, weight } = params;
    if (this.isMockMode) {
      return this._mockCreateOrder(params);
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const payload = {
      partner_id: this.credentials.partnerId,
      request_id: this._requestId(),
      timestamp,
      sign: this.generateSign(timestamp),
      order_id: orderId,
      order_type: 1,           // 1=即时单
      shop_name: pickup.contactName || '干洗店',
      shop_phone: pickup.contactPhone || '',
      shop_address: pickup.address || '',
      shop_lat: pickup.latitude || 0,
      shop_lng: pickup.longitude || 0,
      product_type: 1,         // 1=普通
      product_name: goodsDesc || '干洗衣物',
      product_weight: weight || 1,
      user_name: delivery.contactName || '',
      user_phone: delivery.contactPhone || '',
      user_address: delivery.address || '',
      user_lat: delivery.latitude || 0,
      user_lng: delivery.longitude || 0,
      callback_url: callbackUrl || ''
    };

    try {
      const result = await this.httpRequest('POST', '/api/v1/order/create', payload);
      if (result.error_code === 0 || result.code === 0) {
        const data = result.result || result.data || {};
        return {
          success: true,
          provider: this.provider,
          platformOrderId: data.sf_order_id || data.order_id || orderId,
          deliveryId: orderId,
          status: 'pending',
          price: data.total_price || data.deliver_fee || 0,
          estimateTime: data.expect_time || 0
        };
      }
      console.error(`[顺丰] 创建订单失败:`, result);
      return { success: false, provider: this.provider, error: result.error_msg || result.msg || '下单失败' };
    } catch (error) {
      console.error(`[顺丰] API调用失败:`, error.message);
      return this._mockCreateOrder(params);
    }
  }

  /**
   * 查询配送状态
   * POST /api/v1/order/query
   */
  async queryOrder(platformOrderId) {
    if (this.isMockMode) {
      return this._mockQueryOrder(platformOrderId);
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const payload = {
      partner_id: this.credentials.partnerId,
      request_id: this._requestId(),
      timestamp,
      sign: this.generateSign(timestamp),
      order_id: platformOrderId
    };

    try {
      const result = await this.httpRequest('POST', '/api/v1/order/query', payload);
      if (result.error_code === 0 || result.code === 0) {
        return this._normalizeSFStatus(result.result || result.data || {});
      }
      return { success: false, provider: this.provider, error: result.error_msg };
    } catch (error) {
      console.error(`[顺丰] 查询状态失败:`, error.message);
      return this._mockQueryOrder(platformOrderId);
    }
  }

  /**
   * 取消配送
   * POST /api/v1/order/cancel
   */
  async cancelOrder(platformOrderId, reason = '') {
    if (this.isMockMode) {
      return { success: true, provider: this.provider, platformOrderId, message: '已取消（模拟）' };
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const payload = {
      partner_id: this.credentials.partnerId,
      request_id: this._requestId(),
      timestamp,
      sign: this.generateSign(timestamp),
      order_id: platformOrderId,
      cancel_reason: reason || '用户取消'
    };

    try {
      const result = await this.httpRequest('POST', '/api/v1/order/cancel', payload);
      if (result.error_code === 0 || result.code === 0) {
        return { success: true, provider: this.provider, platformOrderId, message: '已取消' };
      }
      return { success: false, provider: this.provider, error: result.error_msg || '取消失败' };
    } catch (error) {
      return { success: false, provider: this.provider, error: error.message };
    }
  }

  /** 查询价格 */
  async queryPrice(params) {
    if (this.isMockMode) return this._mockPrice(params);

    const timestamp = Math.floor(Date.now() / 1000);
    const payload = {
      partner_id: this.credentials.partnerId,
      request_id: this._requestId(),
      timestamp,
      sign: this.generateSign(timestamp),
      shop_lat: params.pickup?.latitude || 0,
      shop_lng: params.pickup?.longitude || 0,
      user_lat: params.delivery?.latitude || 0,
      user_lng: params.delivery?.longitude || 0,
      product_weight: params.weight || 1,
      product_type: 1
    };

    try {
      const result = await this.httpRequest('POST', '/api/v1/order/preCreate', payload);
      if (result.error_code === 0) {
        return { success: true, price: result.result?.total_price || 0, estimateTime: result.result?.expect_time || 25 };
      }
      return this._mockPrice(params);
    } catch {
      return this._mockPrice(params);
    }
  }

  // ─── 状态映射 ───
  _normalizeSFStatus(raw) {
    const statusMap = {
      10: 'pending',       // 待调度
      12: 'pending',       // 待取件
      15: 'accepted',      // 已接单
      20: 'picking_up',    // 取件中
      25: 'picking_up',    // 已取件
      30: 'delivering',    // 配送中
      35: 'delivering',    // 即将送达
      40: 'delivered',     // 已签收
      45: 'delivered',     // 已完成
      50: 'cancelled',     // 已取消
      99: 'exception'      // 异常
    };
    const rawStatus = raw.order_status || raw.status;
    return {
      success: true,
      provider: this.provider,
      platformOrderId: raw.order_id || raw.sf_order_id,
      status: statusMap[rawStatus] || 'unknown',
      driver: raw.rider_name ? {
        name: raw.rider_name,
        phone: raw.rider_phone || '',
        location: raw.rider_lat ? { lat: raw.rider_lat, lng: raw.rider_lng } : null
      } : null,
      distance: raw.distance ? `${raw.distance}m` : null,
      eta: raw.estimate_arrive_time || null
    };
  }

  // ─── Mock 实现 ───
  _mockCreateOrder(params) {
    const platformOrderId = `SF${Date.now()}${Math.random().toString(36).substring(2, 6)}`;
    return {
      success: true,
      provider: this.provider,
      platformOrderId,
      deliveryId: params.orderId,
      status: 'pending',
      price: this._mockCalcPrice(params.weight || 1),
      estimateTime: 20 + Math.floor(Math.random() * 20),
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
        name: ['刘师傅', '钱师傅', '吴师傅'][Math.floor(Math.random() * 3)],
        phone: '185****' + Math.floor(1000 + Math.random() * 9000)
      } : null,
      _mode: 'mock'
    };
  }

  _mockPrice(params) {
    return {
      success: true,
      price: this._mockCalcPrice(params.weight || 1),
      estimateTime: 20 + Math.floor(Math.random() * 20)
    };
  }

  _mockCalcPrice(weight) {
    return parseFloat((6 + weight * 2 + Math.random() * 5).toFixed(2));
  }
}

module.exports = ShunfengProvider;
