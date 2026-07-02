/**
 * 配送服务商基类
 * 提供统一的 HTTP 请求、签名、响应标准化能力
 * 四家服务商（美团/京东/淘宝/顺丰）继承此类
 */

const https = require('https');
const crypto = require('crypto');

class DeliveryProviderBase {
  constructor(config) {
    this.name = config.name || 'unknown';
    this.displayName = config.displayName || '未知服务商';
    this.apiBaseUrl = config.apiBaseUrl || '';
    this.credentials = config.credentials || {};
    this.timeout = config.timeout || 15000;
    // 是否有真实API密钥（为空则为mock模式）
    this.isMockMode = !this._hasCredentials();
  }

  /** 检查是否配置了有效凭证 */
  _hasCredentials() {
    const creds = this.credentials;
    return !!(creds.appId || creds.appKey || creds.appSecret || creds.customerId);
  }

  /** 获取运行模式标识 */
  getMode() {
    return this.isMockMode ? 'mock' : 'real';
  }

  /**
   * HTTPS 请求封装
   */
  httpRequest(method, path, data, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(this.apiBaseUrl + path);
      const body = data ? JSON.stringify(data) : '';

      const options = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(body),
          ...extraHeaders
        },
        timeout: this.timeout
      };

      const req = https.request(options, (res) => {
        let chunks = '';
        res.on('data', c => chunks += c);
        res.on('end', () => {
          try {
            resolve(JSON.parse(chunks));
          } catch {
            resolve({ _raw: chunks });
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`${this.displayName} API 请求超时`));
      });
      req.on('error', (err) => reject(err));

      if (body) req.write(body);
      req.end();
    });
  }

  /**
   * MD5 签名（美团/达达风格）
   */
  md5Sign(str) {
    return crypto.createHash('md5').update(str, 'utf8').digest('hex');
  }

  /**
   * HMAC-SHA256 签名
   */
  hmacSha256(key, data) {
    return crypto.createHmac('sha256', key).update(data).digest('hex');
  }

  /**
   * SHA256 签名（顺丰风格）
   */
  sha256Sign(str) {
    return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
  }

  /**
   * 参数按 key 排序拼接（通用签名方法）
   */
  sortedParams(params) {
    const keys = Object.keys(params).filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '').sort();
    return keys.map(k => `${k}=${params[k]}`).join('&');
  }

  // ─── 抽象接口（子类必须实现）───

  /** 生成请求签名 */
  generateSign(params) { throw new Error('子类必须实现 generateSign()'); }

  /** 创建配送订单 → 返回 { success, platformOrderId, deliveryId, status, price, ... } */
  async createOrder(params) { throw new Error('子类必须实现 createOrder()'); }

  /** 查询配送订单状态 → 返回 { success, status, driver, location, ... } */
  async queryOrder(platformOrderId) { throw new Error('子类必须实现 queryOrder()'); }

  /** 取消配送订单 → 返回 { success } */
  async cancelOrder(platformOrderId, reason) { throw new Error('子类必须实现 cancelOrder()'); }

  /** 查询配送价格 → 返回 { success, price, estimateTime } */
  async queryPrice(params) { throw new Error('子类必须实现 queryPrice()'); }
}

module.exports = DeliveryProviderBase;
