/**
 * 达达/京东秒送服务商实现
 */

const crypto = require('crypto');

class DadaProvider {
  constructor(config, isProduction = false) {
    this.config = isProduction ? config.production : config.test;
    this.env = isProduction ? 'prod' : 'test';
    this.name = 'dada';
    this.displayName = '京东秒送';
  }

  /**
   * 生成签名
   * @param {Object} params - 请求参数
   * @returns {string} - 签名字符串
   */
  generateSign(params) {
    const appSecret = this.config.appSecret;
    const sortedKeys = Object.keys(params).sort();
    let signStr = '';
    
    for (const key of sortedKeys) {
      if (params[key] !== undefined && params[key] !== null) {
        signStr += key + params[key];
      }
    }
    
    signStr += appSecret;
    
    return crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();
  }

  /**
   * 询价接口 - 查询配送费用
   * @param {Object} params - 询价参数
   * @returns {Promise<Object>} - 询价结果
   */
  async queryPrice(params) {
    const { pickupAddress, dropoffAddress, weight = 1, cityName = '北京' } = params;
    
    const requestParams = {
      app_key: this.config.appKey,
      timestamp: Math.floor(Date.now() / 1000),
      version: '1.0',
      city_name: cityName,
      pickup_address: pickupAddress,
      delivery_address: dropoffAddress,
      cargo_weight: weight
    };
    
    requestParams.signature = this.generateSign(requestParams);
    
    try {
      // 实际对接时调用真实API
      // const response = await this.httpRequest('/api/order/queryDeliveryPrice', requestParams);
      
      return {
        success: true,
        provider: this.name,
        providerName: this.displayName,
        price: this.mockPrice(weight),
        estimateTime: this.mockTime(),
        distance: params.distance || '4.0km'
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
      app_key: this.config.appKey,
      timestamp: Math.floor(Date.now() / 1000),
      version: '1.0',
      order_id: orderId || `DD${Date.now()}`,
      shop_no: params.shopNo || '',
      pickup_address: pickupAddress,
      pickup_contact_name: shopName,
      pickup_contact_phone: shopPhone,
      delivery_address: dropoffAddress,
      delivery_contact_name: customerName,
      delivery_contact_phone: customerPhone,
      cargo_weight: weight,
      cargo_name: goodsDesc || '衣物'
    };
    
    requestParams.signature = this.generateSign(requestParams);
    
    try {
      // 实际对接时调用真实API
      // const response = await this.httpRequest('/api/order/add', requestParams);
      
      return {
        success: true,
        provider: this.name,
        providerName: this.displayName,
        orderId: requestParams.order_id,
        platformOrderId: `DD${Date.now()}${Math.random().toString(36).substr(2, 6)}`,
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
      app_key: this.config.appKey,
      timestamp: Math.floor(Date.now() / 1000),
      order_id: platformOrderId
    };
    
    requestParams.signature = this.generateSign(requestParams);
    
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
      app_key: this.config.appKey,
      timestamp: Math.floor(Date.now() / 1000),
      order_id: platformOrderId,
      cancel_reason_id: 2, // 用户取消
      cancel_reason: reason
    };
    
    requestParams.signature = this.generateSign(requestParams);
    
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
    const basePrice = 10;
    const weightFee = (weight - 1) * 1.5;
    return parseFloat((basePrice + weightFee + Math.random() * 4).toFixed(2));
  }

  mockTime() {
    return Math.floor(35 + Math.random() * 35); // 35-70分钟
  }

  mockStatus() {
    const statuses = ['pending', 'pickedup', 'delivering', 'delivered'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }

  mockDriver() {
    if (Math.random() > 0.5) {
      return {
        name: ['赵师傅', '孙师傅', '周师傅'][Math.floor(Math.random() * 3)],
        phone: `15${Math.floor(Math.random() * 1000000000 + 9000000000)}`,
        location: { lat: 39.9 + Math.random() * 0.1, lng: 116.4 + Math.random() * 0.1 }
      };
    }
    return null;
  }
}

module.exports = DadaProvider;
