/**
 * 美团配送服务商实现
 */

const crypto = require('crypto');

class MeituanProvider {
  constructor(config, isProduction = false) {
    this.config = isProduction ? config.production : config.test;
    this.env = isProduction ? 'prod' : 'test';
    this.name = 'meituan';
    this.displayName = '美团跑腿';
  }

  /**
   * 生成签名
   * @param {Object} params - 请求参数
   * @returns {string} - 签名字符串
   */
  generateSign(params) {
    // 美团配送签名算法
    const secret = this.config.secret;
    const sortedKeys = Object.keys(params).sort();
    let signStr = '';
    
    for (const key of sortedKeys) {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        signStr += key + '=' + params[key] + '&';
      }
    }
    
    signStr = signStr.slice(0, -1); // 移除最后一个&
    signStr += secret;
    
    return crypto.createHash('md5').update(signStr).digest('hex');
  }

  /**
   * 询价接口 - 查询配送费用
   * @param {Object} params - 询价参数
   * @returns {Promise<Object>} - 询价结果
   */
  async queryPrice(params) {
    const { pickupAddress, dropoffAddress, weight = 1 } = params;
    
    // 构造请求参数
    const requestParams = {
      app_id: this.config.appId,
      timestamp: Math.floor(Date.now() / 1000),
      version: '1.0',
      city_name: params.cityName || '北京',
      pickup_address: pickupAddress,
      dropoff_address: dropoffAddress,
      weight: weight
    };
    
    // 生成签名
    requestParams.sign = this.generateSign(requestParams);
    
    try {
      // 实际对接时，这里应该调用真实API
      // const response = await this.httpRequest('/api/order/address/query', requestParams);
      
      // 模拟响应数据
      return {
        success: true,
        provider: this.name,
        providerName: this.displayName,
        price: this.mockPrice(weight),
        estimateTime: this.mockTime(),
        distance: params.distance || '3.5km'
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
    const { pickupAddress, dropoffAddress, customerName, customerPhone, goodsDesc = '', weight = 1 } = params;
    
    const requestParams = {
      app_id: this.config.appId,
      timestamp: Math.floor(Date.now() / 1000),
      order_id: params.orderId || `MT${Date.now()}`,
      pickup_address: pickupAddress,
      pickup_contact_name: params.shopName || '干洗店',
      pickup_contact_phone: params.shopPhone || '',
      dropoff_address: dropoffAddress,
      dropoff_contact_name: customerName,
      dropoff_contact_phone: customerPhone,
      goods_desc: goodsDesc,
      weight: weight
    };
    
    requestParams.sign = this.generateSign(requestParams);
    
    try {
      // 实际对接时调用真实API
      // const response = await this.httpRequest('/api/order/address/add', requestParams);
      
      // 模拟成功响应
      return {
        success: true,
        provider: this.name,
        providerName: this.displayName,
        orderId: requestParams.order_id,
        platformOrderId: `MT${Date.now()}${Math.random().toString(36).substr(2, 6)}`,
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
      timestamp: Math.floor(Date.now() / 1000),
      order_id: platformOrderId
    };
    
    requestParams.sign = this.generateSign(requestParams);
    
    try {
      // 模拟查询结果
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
      timestamp: Math.floor(Date.now() / 1000),
      order_id: platformOrderId,
      cancel_reason: reason
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
    const basePrice = 12;
    const weightFee = (weight - 1) * 2;
    return parseFloat((basePrice + weightFee + Math.random() * 3).toFixed(2));
  }

  mockTime() {
    return Math.floor(30 + Math.random() * 30); // 30-60分钟
  }

  mockStatus() {
    const statuses = ['pending', 'pickedup', 'delivering', 'delivered'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }

  mockDriver() {
    if (Math.random() > 0.5) {
      return {
        name: ['张师傅', '李师傅', '王师傅'][Math.floor(Math.random() * 3)],
        phone: `13${Math.floor(Math.random() * 1000000000 + 9000000000)}`,
        location: { lat: 39.9 + Math.random() * 0.1, lng: 116.4 + Math.random() * 0.1 }
      };
    }
    return null;
  }
}

module.exports = MeituanProvider;
