/**
 * 顺丰同城配送服务商实现
 */

const crypto = require('crypto');
const https = require('https');

class ShunfengProvider {
  constructor(config, isProduction = false) {
    this.config = isProduction ? config.production : config.test;
    this.env = isProduction ? 'prod' : 'test';
    this.name = 'shunfeng';
    this.displayName = '顺丰跑腿';
  }

  /**
   * 生成签名
   * @param {Object} params - 请求参数
   * @returns {string} - 签名字符串
   */
  generateSign(params) {
    const secret = this.config.secret;
    const sortedKeys = Object.keys(params).sort();
    let signStr = '';
    
    for (const key of sortedKeys) {
      if (params[key] !== undefined && params[key] !== null) {
        signStr += key + '=' + params[key] + '&';
      }
    }
    
    signStr = signStr.slice(0, -1) + secret;
    
    return crypto.createHash('sha256').update(signStr).digest('hex');
  }

  /**
   * 生成请求ID
   * @returns {string}
   */
  generateRequestId() {
    return `SF${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 询价接口 - 查询配送费用
   * @param {Object} params - 询价参数
   * @returns {Promise<Object>} - 询价结果
   */
  async queryPrice(params) {
    const { pickupAddress, dropoffAddress, weight = 1, cityName = '北京' } = params;
    
    const requestParams = {
      app_id: this.config.appId,
      app_key: this.config.appKey,
      timestamp: Math.floor(Date.now() / 1000),
      request_id: this.generateRequestId(),
      version: '1.0',
      city_name: cityName,
      pickup_address: pickupAddress,
      dropoff_address: dropoffAddress,
      weight: weight,
      product_type: 1 // 1=顺丰同城配送
    };
    
    requestParams.sign = this.generateSign(requestParams);
    
    try {
      // 实际对接时调用真实API
      // const response = await this.httpRequest('/api/order/queryPrice', requestParams);
      
      return {
        success: true,
        provider: this.name,
        providerName: this.displayName,
        price: this.mockPrice(weight),
        estimateTime: this.mockTime(),
        distance: params.distance || '3.8km'
      };
    } catch (error) {
      return {
        success: false,
        provider: this.name,
        providerName: this.displayName,
        error: error.message
      };
    }
  }

  /**
   * 创建配送订单
   * @param {Object} params - 订单参数
   * @returns {Promise<Object>} - 创建结果
   */
  async createOrder(params) {
    const {
      pickupAddress,
      dropoffAddress,
      customerName,
      customerPhone,
      shopName = '干洗店',
      shopPhone = '',
      goodsDesc = '',
      weight = 1,
      orderId
    } = params;
    
    const requestParams = {
      app_id: this.config.appId,
      app_key: this.config.appKey,
      timestamp: Math.floor(Date.now() / 1000),
      request_id: this.generateRequestId(),
      version: '1.0',
      order_id: orderId || `SF${Date.now()}`,
      city_name: params.cityName || '北京',
      pickup_address: pickupAddress,
      pickup_contact_name: shopName,
      pickup_contact_phone: shopPhone,
      dropoff_address: dropoffAddress,
      dropoff_contact_name: customerName,
      dropoff_contact_phone: customerPhone,
      goods_desc: goodsDesc || '衣物',
      weight: weight,
      product_type: 1,
      pay_type: 1 // 月结
    };
    
    requestParams.sign = this.generateSign(requestParams);
    
    try {
      // 实际对接时调用真实API
      // const response = await this.httpRequest('/api/order/create', requestParams);
      
      return {
        success: true,
        provider: this.name,
        providerName: this.displayName,
        orderId: requestParams.order_id,
        platformOrderId: `SF${Date.now()}${Math.random().toString(36).substr(2, 6)}`,
        status: 'pending',
        price: this.mockPrice(weight),
        message: '订单创建成功'
      };
    } catch (error) {
      return {
        success: false,
        provider: this.name,
        providerName: this.displayName,
        error: error.message
      };
    }
  }

  /**
   * 查询订单状态
   * @param {string} platformOrderId - 平台订单号
   * @returns {Promise<Object>} - 订单状态
   */
  async queryOrder(platformOrderId) {
    const requestParams = {
      app_id: this.config.appId,
      app_key: this.config.appKey,
      timestamp: Math.floor(Date.now() / 1000),
      request_id: this.generateRequestId(),
      order_id: platformOrderId
    };
    
    requestParams.sign = this.generateSign(requestParams);
    
    try {
      return {
        success: true,
        provider: this.name,
        providerName: this.displayName,
        orderId: platformOrderId,
        status: this.mockStatus(),
        driver: this.mockDriver(),
        message: '查询成功'
      };
    } catch (error) {
      return {
        success: false,
        provider: this.name,
        providerName: this.displayName,
        error: error.message
      };
    }
  }

  /**
   * 取消订单
   * @param {string} platformOrderId - 平台订单号
   * @param {string} reason - 取消原因
   * @returns {Promise<Object>} - 取消结果
   */
  async cancelOrder(platformOrderId, reason = '') {
    const requestParams = {
      app_id: this.config.appId,
      app_key: this.config.appKey,
      timestamp: Math.floor(Date.now() / 1000),
      request_id: this.generateRequestId(),
      order_id: platformOrderId,
      cancel_reason: reason || '用户取消'
    };
    
    requestParams.sign = this.generateSign(requestParams);
    
    try {
      return {
        success: true,
        provider: this.name,
        providerName: this.displayName,
        orderId: platformOrderId,
        status: 'cancelled',
        message: '订单已取消'
      };
    } catch (error) {
      return {
        success: false,
        provider: this.name,
        providerName: this.displayName,
        error: error.message
      };
    }
  }

  // 模拟数据方法
  mockPrice(weight) {
    const basePrice = 15;
    const weightFee = (weight - 1) * 2.5;
    return parseFloat((basePrice + weightFee + Math.random() * 5).toFixed(2));
  }

  mockTime() {
    return Math.floor(25 + Math.random() * 25); // 25-50分钟，顺丰速度较快
  }

  mockStatus() {
    const statuses = ['pending', 'pickedup', 'delivering', 'delivered'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }

  mockDriver() {
    if (Math.random() > 0.5) {
      return {
        name: ['钱师傅', '刘师傅', '陈师傅'][Math.floor(Math.random() * 3)],
        phone: `18${Math.floor(Math.random() * 1000000000 + 9000000000)}`,
        location: { lat: 39.9 + Math.random() * 0.1, lng: 116.4 + Math.random() * 0.1 }
      };
    }
    return null;
  }
}

module.exports = ShunfengProvider;
