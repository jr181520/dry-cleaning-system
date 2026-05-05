/**
 * 配送服务
 * 支持美团配送、达达、顺丰同城等
 */

const https = require('https');
const crypto = require('crypto');

// 配送配置
const DELIVERY_CONFIG = {
  meituan: {
    appId: process.env.MEITUAN_APP_ID || '',
    appKey: process.env.MEITUAN_APP_KEY || '',
    secret: process.env.MEITUAN_SECRET || '',
    url: 'https://peisongopen.meituan.com'
  },
  dada: {
    appKey: process.env.DADA_APP_KEY || '',
    appSecret: process.env.DADA_APP_SECRET || '',
    url: 'https://openapi-imind.dada.cn'
  },
  shunfeng: {
    customerId: process.env.SF_CUSTOMER_ID || '',
    checkWord: process.env.SF_CHECK_WORD || '',
    url: 'https://open-sandbox.sfsy.com'
  }
};

class DeliveryService {
  constructor() {
    this.providers = ['meituan', 'dada', 'shunfeng'];
  }

  /**
   * 创建配送订单
   * @param {Object} params
   * @param {string} params.provider - 配送平台
   * @param {string} params.orderId - 业务订单ID
   * @param {Object} params.pickup - 取货信息
   * @param {Object} params.delivery - 配送信息
   * @param {string} params.callbackUrl - 状态回调地址
   */
  async createDelivery(params) {
    const { provider, orderId, pickup, delivery, callbackUrl } = params;
    
    switch (provider) {
      case 'meituan':
        return await this.createMeituanOrder(orderId, pickup, delivery, callbackUrl);
      case 'dada':
        return await this.createDadaOrder(orderId, pickup, delivery, callbackUrl);
      case 'shunfeng':
        return await this.createShunfengOrder(orderId, pickup, delivery, callbackUrl);
      default:
        throw new Error('不支持的配送平台');
    }
  }

  /**
   * 美团配送下单
   */
  async createMeituanOrder(orderId, pickup, delivery, callbackUrl) {
    const config = DELIVERY_CONFIG.meituan;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    // 生成签名
    const signStr = config.appId + timestamp + config.secret;
    const sign = crypto.createHash('md5').update(signStr).digest('hex');

    const payload = {
      app_id: config.appId,
      timestamp,
      sign,
      shop_no: pickup.storeId || '',
      delivery_id: Date.now().toString(),
      order_id: orderId,
      order_type: 1, // 1=外卖订单
      pickup: {
        name: pickup.contactName || '',
        phone: pickup.contactPhone || '',
        address: pickup.address || '',
        lat: pickup.latitude || 0,
        lng: pickup.longitude || 0
      },
      dropoff: {
        name: delivery.contactName || '',
        phone: delivery.contactPhone || '',
        address: delivery.address || '',
        lat: delivery.latitude || 0,
        lng: delivery.longitude || 0
      },
      callback: callbackUrl || ''
    };

    try {
      const result = await this.httpRequest(config.url + '/api/delivery/create', 'POST', payload);
      
      if (result.code === 0) {
        return {
          success: true,
          provider: 'meituan',
          data: {
            deliveryId: result.data.delivery_id,
            orderId: result.data.order_id,
            status: result.data.status,
            driverName: '',
            driverPhone: '',
            estimatedTime: result.data.estimated_pickup_time
          }
        };
      }
      return { success: false, error: result.message };
    } catch (error) {
      console.error('[配送] 美团下单失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 达达配送下单
   */
  async createDadaOrder(orderId, pickup, delivery, callbackUrl) {
    const config = DELIVERY_CONFIG.dada;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    const body = {
      appkey: config.appKey,
      order_id: orderId,
      shop_no: pickup.storeId || '',
      cargo_type: 1,
      cargo_weight: 1,
      pickup_code: pickup.pickupCode || '',
      dropoff_code: '',
      callback: callbackUrl || '',
      pickup: {
        name: pickup.contactName,
        phone: pickup.contactPhone,
        address: pickup.address,
        lat: pickup.latitude,
        lng: pickup.longitude
      },
      dropoff: {
        name: delivery.contactName,
        phone: delivery.contactPhone,
        address: delivery.address,
        lat: delivery.latitude,
        lng: delivery.longitude
      }
    };

    try {
      const result = await this.httpRequest(config.url + '/api/dada/send', 'POST', body);
      
      if (result.success) {
        return {
          success: true,
          provider: 'dada',
          data: {
            deliveryId: result.deliveryId,
            orderId: result.orderId,
            status: result.status,
            driverName: result.driverName || '',
            driverPhone: result.driverPhone || ''
          }
        };
      }
      return { success: false, error: result.errorMsg };
    } catch (error) {
      console.error('[配送] 达达下单失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 顺丰同城下单
   */
  async createShunfengOrder(orderId, pickup, delivery, callbackUrl) {
    const config = DELIVERY_CONFIG.shunfeng;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    // 生成签名
    const signStr = timestamp + config.checkWord;
    const sign = crypto.createHash('md5').update(signStr).digest('hex');

    const payload = {
      customer_id: config.customerId,
      request_id: timestamp,
      order_id: orderId,
      order_type: 1,
      pay_type: 1,
      pickup: {
        name: pickup.contactName,
        phone: pickup.contactPhone,
        address: pickup.address,
        lat: pickup.latitude,
        lng: pickup.longitude
      },
      dropoff: {
        name: delivery.contactName,
        phone: delivery.contactPhone,
        address: delivery.address,
        lat: delivery.latitude,
        lng: delivery.longitude
      },
      callback_url: callbackUrl || ''
    };

    try {
      const result = await this.httpRequest(config.url + '/api/shunfeng/create', 'POST', payload, {
        'security-sign': sign
      });
      
      if (result.success) {
        return {
          success: true,
          provider: 'shunfeng',
          data: {
            deliveryId: result.deliveryId,
            orderId: result.orderId,
            status: result.status,
            driverName: result.driverName || '',
            driverPhone: result.driverPhone || ''
          }
        };
      }
      return { success: false, error: result.errorMsg };
    } catch (error) {
      console.error('[配送] 顺丰下单失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 查询配送状态
   */
  async queryDelivery(deliveryId, provider) {
    switch (provider) {
      case 'meituan':
        return await this.queryMeituanDelivery(deliveryId);
      case 'dada':
        return await this.queryDadaDelivery(deliveryId);
      case 'shunfeng':
        return await this.queryShunfengDelivery(deliveryId);
      default:
        throw new Error('不支持的配送平台');
    }
  }

  /**
   * 查询美团配送状态
   */
  async queryMeituanDelivery(deliveryId) {
    // 模拟实现
    return {
      success: true,
      provider: 'meituan',
      data: {
        status: 'delivering',
        driverName: '张师傅',
        driverPhone: '138****1234',
        estimatedTime: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      }
    };
  }

  /**
   * 查询达达配送状态
   */
  async queryDadaDelivery(deliveryId) {
    return {
      success: true,
      provider: 'dada',
      data: {
        status: 'delivering',
        driverName: '李师傅',
        driverPhone: '139****5678',
        estimatedTime: new Date(Date.now() + 25 * 60 * 1000).toISOString()
      }
    };
  }

  /**
   * 查询顺丰配送状态
   */
  async queryShunfengDelivery(deliveryId) {
    return {
      success: true,
      provider: 'shunfeng',
      data: {
        status: 'delivering',
        driverName: '王师傅',
        driverPhone: '137****9012',
        estimatedTime: new Date(Date.now() + 20 * 60 * 1000).toISOString()
      }
    };
  }

  /**
   * 取消配送
   */
  async cancelDelivery(deliveryId, provider, reason) {
    switch (provider) {
      case 'meituan':
        return await this.cancelMeituanDelivery(deliveryId, reason);
      case 'dada':
        return await this.cancelDadaDelivery(deliveryId, reason);
      case 'shunfeng':
        return await this.cancelShunfengDelivery(deliveryId, reason);
      default:
        throw new Error('不支持的配送平台');
    }
  }

  /**
   * 取消美团配送
   */
  async cancelMeituanDelivery(deliveryId, reason) {
    return { success: true, message: '取消成功' };
  }

  /**
   * 取消达达配送
   */
  async cancelDadaDelivery(deliveryId, reason) {
    return { success: true, message: '取消成功' };
  }

  /**
   * 取消顺丰配送
   */
  async cancelShunfengDelivery(deliveryId, reason) {
    return { success: true, message: '取消成功' };
  }

  /**
   * 估算配送费用
   */
  async estimateFee(params) {
    const { provider, pickup, delivery } = params;
    
    // 根据距离计算（简化版）
    const distance = this.calculateDistance(
      pickup.latitude, pickup.longitude,
      delivery.latitude, delivery.longitude
    );
    
    // 各平台计价规则
    const pricing = {
      meituan: { base: 5, perKm: 2, min: 8 },
      dada: { base: 4, perKm: 1.5, min: 7 },
      shunfeng: { base: 6, perKm: 2.5, min: 10 }
    };
    
    const config = pricing[provider] || pricing.meituan;
    const fee = Math.max(config.min, config.base + distance * config.perKm);
    
    return {
      success: true,
      data: {
        provider,
        distance: Math.round(distance * 100) / 100,
        distanceUnit: 'km',
        fee: Math.round(fee * 100) / 100,
        currency: 'CNY',
        estimatedMinutes: Math.round(distance * 3) + 15
      }
    };
  }

  /**
   * 计算两点间距离（简化版）
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // 地球半径(km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * HTTP请求封装
   */
  httpRequest(url, method, data, headers = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(body);
          }
        });
      });

      req.on('error', reject);
      if (data) req.write(JSON.stringify(data));
      req.end();
    });
  }

  /**
   * 获取支持的配送平台
   */
  getAvailableProviders() {
    return this.providers.map(p => ({
      code: p,
      name: p === 'meituan' ? '美团配送' : p === 'dada' ? '达达' : '顺丰同城',
      enabled: !!DELIVERY_CONFIG[p].appId || !!DELIVERY_CONFIG[p].appKey || !!DELIVERY_CONFIG[p].customerId
    }));
  }
}

module.exports = new DeliveryService();
