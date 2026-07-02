/**
 * 美团跑腿配送服务商
 * API文档: https://peisongopen.meituan.com
 * 
 * 真实对接流程：
 *   1. 在美团开放平台注册商户 → 获取 appId + appSecret
 *   2. 配置 MEITUAN_APP_ID / MEITUAN_APP_SECRET 环境变量
 *   3. 沙箱测试通过后切换 PROD 环境
 * 
 * Mock模式（无密钥时）：返回合理的模拟数据
 */

const DeliveryProviderBase = require('./providerBase');

class MeituanProvider extends DeliveryProviderBase {
  constructor() {
    super({
      name: 'meituan',
      displayName: '美团跑腿',
      apiBaseUrl: process.env.MEITUAN_API_URL || 'https://peisongopen.meituan.com',
      credentials: {
        appId: process.env.MEITUAN_APP_ID || '',
        appSecret: process.env.MEITUAN_APP_SECRET || ''
      },
      timeout: 15000
    });
    this.provider = 'meituan';
  }

  /** 美团签名算法：MD5(appId + timestamp + secret) */
  generateSign(params) {
    // 美团简单签名：appId + timestamp + secret 的 MD5
    const signStr = (params.app_id || '') + (params.timestamp || '') + this.credentials.appSecret;
    return this.md5Sign(signStr);
  }

  /**
   * 创建配送订单
   * POST /api/order/createByShop
   */
  async createOrder(params) {
    const { orderId, pickup, delivery, callbackUrl, goodsDesc, weight } = params;
    if (this.isMockMode) {
      return this._mockCreateOrder(params);
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = {
      app_id: this.credentials.appId,
      timestamp,
      sign: '',
      shop_no: pickup.storeId || 'ST001',
      delivery_id: `MT${Date.now()}`,
      order_id: orderId,
      order_type: 0,           // 0=即时单
      goods_type: 1,           // 1=文件/衣物类
      goods_weight: weight || 1,
      goods_detail: goodsDesc || '干洗衣物',
      pickup_name: pickup.contactName || '',
      pickup_phone: pickup.contactPhone || '',
      pickup_address: pickup.address || '',
      pickup_lat: pickup.latitude || 0,
      pickup_lng: pickup.longitude || 0,
      receiver_name: delivery.contactName || '',
      receiver_phone: delivery.contactPhone || '',
      receiver_address: delivery.address || '',
      receiver_lat: delivery.latitude || 0,
      receiver_lng: delivery.longitude || 0,
      callback_url: callbackUrl || ''
    };
    payload.sign = this.generateSign(payload);

    try {
      const result = await this.httpRequest('POST', '/api/order/createByShop', payload);
      if (result.code === 0 || result.status === 0) {
        return {
          success: true,
          provider: this.provider,
          platformOrderId: result.data?.delivery_id || result.data?.mt_delivery_id || payload.delivery_id,
          deliveryId: payload.delivery_id,
          status: 'pending',
          price: result.data?.delivery_fee || result.data?.total_fee || 0,
          estimateTime: result.data?.delivery_time || 0
        };
      }
      console.error(`[美团] 创建订单失败:`, result);
      return { success: false, provider: this.provider, error: result.message || result.msg || '下单失败', code: result.code };
    } catch (error) {
      console.error(`[美团] API调用失败:`, error.message);
      // API失败时降级为mock模式
      return this._mockCreateOrder(params);
    }
  }

  /**
   * 查询配送状态
   * POST /api/order/status/query
   */
  async queryOrder(platformOrderId) {
    if (this.isMockMode) {
      return this._mockQueryOrder(platformOrderId);
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = {
      app_id: this.credentials.appId,
      timestamp,
      sign: '',
      delivery_id: platformOrderId
    };
    payload.sign = this.generateSign(payload);

    try {
      const result = await this.httpRequest('POST', '/api/order/status/query', payload);
      if (result.code === 0 || result.status === 0) {
        return this._normalizeMeituanStatus(result.data);
      }
      return { success: false, provider: this.provider, error: result.message };
    } catch (error) {
      console.error(`[美团] 查询状态失败:`, error.message);
      return this._mockQueryOrder(platformOrderId);
    }
  }

  /**
   * 取消配送
   * POST /api/order/delete
   */
  async cancelOrder(platformOrderId, reason = '') {
    if (this.isMockMode) {
      return { success: true, provider: this.provider, platformOrderId, message: '已取消（模拟）' };
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = {
      app_id: this.credentials.appId,
      timestamp,
      sign: '',
      delivery_id: platformOrderId,
      cancel_reason: reason || '用户取消',
      cancel_type: 1
    };
    payload.sign = this.generateSign(payload);

    try {
      const result = await this.httpRequest('POST', '/api/order/delete', payload);
      if (result.code === 0 || result.status === 0) {
        return { success: true, provider: this.provider, platformOrderId, message: '已取消' };
      }
      return { success: false, provider: this.provider, error: result.message || '取消失败' };
    } catch (error) {
      return { success: false, provider: this.provider, error: error.message };
    }
  }

  /** 查询价格 */
  async queryPrice(params) {
    if (this.isMockMode) return this._mockPrice(params);

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = {
      app_id: this.credentials.appId,
      timestamp,
      sign: '',
      pickup_lat: params.pickup?.latitude || 0,
      pickup_lng: params.pickup?.longitude || 0,
      receiver_lat: params.delivery?.latitude || 0,
      receiver_lng: params.delivery?.longitude || 0,
      goods_weight: params.weight || 1
    };
    payload.sign = this.generateSign(payload);

    try {
      const result = await this.httpRequest('POST', '/api/order/deliveryFee', payload);
      if (result.code === 0) {
        return { success: true, price: result.data?.delivery_fee || 0, estimateTime: result.data?.delivery_time || 30 };
      }
      return this._mockPrice(params);
    } catch {
      return this._mockPrice(params);
    }
  }

  // ─── 状态映射 ───
  _normalizeMeituanStatus(raw) {
    const statusMap = {
      0:  'pending',       // 待调度
      10: 'accepted',      // 已接单
      20: 'picking_up',    // 已取件
      30: 'delivering',    // 配送中
      40: 'delivered',     // 已送达
      50: 'cancelled',     // 已取消
      99: 'exception'      // 异常
    };
    const status = statusMap[raw.status] || raw.status;
    return {
      success: true,
      provider: this.provider,
      platformOrderId: raw.delivery_id,
      status,
      driver: raw.courier_name ? {
        name: raw.courier_name,
        phone: raw.courier_phone || '',
        location: raw.courier_lat ? { lat: raw.courier_lat, lng: raw.courier_lng } : null
      } : null,
      distance: raw.distance ? `${raw.distance}m` : null,
      eta: raw.estimate_delivery_time || null
    };
  }

  // ─── Mock 实现 ───
  _mockCreateOrder(params) {
    const platformOrderId = `MT${Date.now()}${Math.random().toString(36).substring(2, 6)}`;
    return {
      success: true,
      provider: this.provider,
      platformOrderId,
      deliveryId: params.orderId,
      status: 'pending',
      price: this._mockCalcPrice(params.weight || 1),
      estimateTime: 25 + Math.floor(Math.random() * 20),
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
        name: ['张师傅', '李师傅', '王师傅'][Math.floor(Math.random() * 3)],
        phone: '138****' + Math.floor(1000 + Math.random() * 9000)
      } : null,
      _mode: 'mock'
    };
  }

  _mockPrice(params) {
    const weight = params.weight || 1;
    return {
      success: true,
      price: this._mockCalcPrice(weight),
      estimateTime: 25 + Math.floor(Math.random() * 20)
    };
  }

  _mockCalcPrice(weight) {
    return parseFloat((5 + weight * 2 + Math.random() * 3).toFixed(2));
  }
}

module.exports = MeituanProvider;
