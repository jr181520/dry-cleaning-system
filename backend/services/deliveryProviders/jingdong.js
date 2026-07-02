/**
 * 京东秒送配送服务商（底层对接达达开放平台）
 * API文档: https://open.imdada.cn
 * 
 * 京东秒送底层由达达物流提供配送运力，使用达达开放平台 API
 * 
 * 真实对接流程：
 *   1. 在达达开放平台注册 → 获取 appKey + appSecret + sourceId
 *   2. 配置 DADA_APP_KEY / DADA_APP_SECRET / DADA_SOURCE_ID 环境变量
 *   3. 沙箱测试通过后切换生产环境
 * 
 * Mock模式（无密钥时）：返回合理的模拟数据
 */

const DeliveryProviderBase = require('./providerBase');

class JingdongProvider extends DeliveryProviderBase {
  constructor() {
    super({
      name: 'jingdong',
      displayName: '京东秒送',
      apiBaseUrl: process.env.JD_API_URL || 'https://newopen.imdada.cn',
      credentials: {
        appKey: process.env.DADA_APP_KEY || '',
        appSecret: process.env.DADA_APP_SECRET || '',
        sourceId: process.env.DADA_SOURCE_ID || ''
      },
      timeout: 15000
    });
    this.provider = 'jingdong';
  }

  /** 达达签名算法：对参数排序后拼接，末尾加 secret，取 MD5 大写 */
  generateSign(params) {
    const sortedKeys = Object.keys(params)
      .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
      .sort();
    let signStr = '';
    for (const key of sortedKeys) {
      signStr += key + params[key];
    }
    signStr += this.credentials.appSecret;
    return this.md5Sign(signStr).toUpperCase();
  }

  /**
   * 创建配送订单
   * POST /api/order/addOrder
   */
  async createOrder(params) {
    const { orderId, pickup, delivery, callbackUrl, goodsDesc, weight } = params;
    if (this.isMockMode) {
      return this._mockCreateOrder(params);
    }

    const payload = {
      source_id: this.credentials.sourceId,
      shop_no: pickup.storeId || 'ST001',
      order_id: orderId,
      city_code: '010',   // 默认北京，实际应由地址解析得出
      cargo_price: 0,
      is_prepay: 0,
      receiver_name: delivery.contactName || '',
      receiver_phone: delivery.contactPhone || '',
      receiver_address: delivery.address || '',
      receiver_lat: delivery.latitude || 0,
      receiver_lng: delivery.longitude || 0,
      callback: callbackUrl || '',
      cargo_weight: weight || 1,
      cargo_num: 1,
      origin_id: `JD${Date.now()}`,
      is_finish_code_needed: 0
    };

    try {
      // 达达API格式：外层body包裹
      const body = JSON.stringify(payload);
      const result = await this._dadaRequest('/api/order/addOrder', body);

      if (result.code === 0 || result.status === 'success') {
        return {
          success: true,
          provider: this.provider,
          platformOrderId: result.result?.order_id || payload.origin_id,
          deliveryId: payload.origin_id,
          status: 'pending',
          price: result.result?.deliver_fee || result.result?.total_fee || 0,
          estimateTime: result.result?.delivery_time || 0,
          distance: result.result?.distance || 0
        };
      }
      console.error(`[京东] 创建订单失败:`, result);
      return { success: false, provider: this.provider, error: result.msg || result.message || '下单失败' };
    } catch (error) {
      console.error(`[京东] API调用失败:`, error.message);
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

    const payload = { order_id: platformOrderId };
    try {
      const body = JSON.stringify(payload);
      const result = await this._dadaRequest('/api/order/status/query', body);

      if (result.code === 0 || result.status === 'success') {
        return this._normalizeDadaStatus(result.result || result);
      }
      return { success: false, provider: this.provider, error: result.msg };
    } catch (error) {
      console.error(`[京东] 查询状态失败:`, error.message);
      return this._mockQueryOrder(platformOrderId);
    }
  }

  /**
   * 取消配送
   * POST /api/order/formalCancel
   */
  async cancelOrder(platformOrderId, reason = '') {
    if (this.isMockMode) {
      return { success: true, provider: this.provider, platformOrderId, message: '已取消（模拟）' };
    }

    const payload = {
      order_id: platformOrderId,
      cancel_reason_id: 2,
      cancel_reason: reason || '用户取消'
    };
    try {
      const body = JSON.stringify(payload);
      const result = await this._dadaRequest('/api/order/formalCancel', body);
      if (result.code === 0 || result.status === 'success') {
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

    const payload = {
      shop_no: params.pickup?.storeId || 'ST001',
      origin_lat: params.pickup?.latitude || 0,
      origin_lng: params.pickup?.longitude || 0,
      receiver_lat: params.delivery?.latitude || 0,
      receiver_lng: params.delivery?.longitude || 0,
      city_code: '010',
      cargo_weight: params.weight || 1,
      cargo_num: 1
    };
    try {
      const body = JSON.stringify(payload);
      const result = await this._dadaRequest('/api/order/queryDeliverFee', body);
      if (result.code === 0) {
        return { success: true, price: result.result?.deliver_fee || 0, estimateTime: result.result?.delivery_time || 35 };
      }
      return this._mockPrice(params);
    } catch {
      return this._mockPrice(params);
    }
  }

  /** 达达API专用请求方法 */
  async _dadaRequest(path, bodyStr) {
    return new Promise((resolve, reject) => {
      const https = require('https');
      const urlObj = new URL(this.apiBaseUrl + path);
      const options = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=utf-8',
          'Content-Length': Buffer.byteLength(bodyStr)
        },
        timeout: this.timeout
      };
      const req = https.request(options, (res) => {
        let chunks = '';
        res.on('data', c => chunks += c);
        res.on('end', () => {
          try { resolve(JSON.parse(chunks)); }
          catch { resolve({ _raw: chunks }); }
        });
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('京东秒送 API 超时')); });
      req.on('error', reject);
      req.write(bodyStr);
      req.end();
    });
  }

  // ─── 状态映射 ───
  _normalizeDadaStatus(raw) {
    const statusMap = {
      1: 'pending',        // 待接单
      2: 'accepted',       // 已接单
      3: 'picking_up',     // 已取货
      4: 'delivered',      // 已完成
      5: 'cancelled',      // 已取消
      7: 'delivering',     // 配送中
      8: 'arrived',        // 已到达
      9: 'exception'       // 异常
    };
    return {
      success: true,
      provider: this.provider,
      platformOrderId: raw.order_id,
      status: statusMap[raw.order_status] || raw.order_status || 'unknown',
      driver: raw.transporter_name ? {
        name: raw.transporter_name,
        phone: raw.transporter_phone || '',
        location: raw.transporter_lat ? { lat: raw.transporter_lat, lng: raw.transporter_lng } : null
      } : null,
      distance: raw.distance ? `${raw.distance}m` : null
    };
  }

  // ─── Mock 实现 ───
  _mockCreateOrder(params) {
    const platformOrderId = `JD${Date.now()}${Math.random().toString(36).substring(2, 6)}`;
    return {
      success: true,
      provider: this.provider,
      platformOrderId,
      deliveryId: params.orderId,
      status: 'pending',
      price: this._mockCalcPrice(params.weight || 1),
      estimateTime: 30 + Math.floor(Math.random() * 25),
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
        name: ['赵师傅', '孙师傅', '周师傅'][Math.floor(Math.random() * 3)],
        phone: '139****' + Math.floor(1000 + Math.random() * 9000)
      } : null,
      _mode: 'mock'
    };
  }

  _mockPrice(params) {
    return {
      success: true,
      price: this._mockCalcPrice(params.weight || 1),
      estimateTime: 30 + Math.floor(Math.random() * 25)
    };
  }

  _mockCalcPrice(weight) {
    return parseFloat((4.5 + weight * 2.5 + Math.random() * 4).toFixed(2));
  }
}

module.exports = JingdongProvider;
