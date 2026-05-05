/**
 * 微信支付服务
 * 使用微信支付V3 API
 */

const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

// 微信支付配置
const WXPAY_CONFIG = {
  appId: process.env.WX_APP_ID || '',
  mchId: process.env.WX_MCH_ID || '',
  apiKey: process.env.WX_API_KEY || '',
  serialNo: process.env.WX_SERIAL_NO || '',
  privateKey: process.env.WX_PRIVATE_KEY || '',
  callbackUrl: process.env.WX_CALLBACK_URL || 'http://localhost:3000/api/payments/wechat/callback'
};

class WechatPayService {
  constructor() {
    this.config = WXPAY_CONFIG;
    this.baseUrl = 'https://api.mch.weixin.qq.com';
  }

  /**
   * 签名算法
   */
  sign(params, signType = 'HMAC-SHA256') {
    const sortedKeys = Object.keys(params).sort();
    const signStr = sortedKeys.map(key => `${key}=${params[key]}`).join('&') + '&key=' + this.config.apiKey;
    
    if (signType === 'HMAC-SHA256') {
      return crypto.createHmac('sha256', this.config.apiKey).update(signStr).digest('hex').toUpperCase();
    }
    return crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();
  }

  /**
   * 生成随机字符串
   */
  generateNonceStr() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * 生成商户订单号
   */
  generateOutTradeNo() {
    const date = new Date().toISOString().replace(/[-T:\.Z]/g, '').substring(0, 14);
    const random = Math.random().toString(36).substring(2, 10).toUpperCase();
    return `${date}${random}`;
  }

  /**
   * 发送HTTP请求
   */
  async request(endpoint, method, data = null, needCert = false) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.mch.weixin.qq.com',
        port: 443,
        path: endpoint,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'WechatPay/v3'
        }
      };

      // 需要证书的请求（退款等）
      if (needCert) {
        options.key = fs.readFileSync(this.config.certPath);
        options.cert = fs.readFileSync(this.config.certPath);
      }

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(body);
            resolve(result);
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
   * JSAPI统一下单
   * 用于小程序和公众号支付
   */
  async createJsapiOrder(params) {
    const { orderId, amount, description, openid, notifyUrl } = params;
    
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = this.generateNonceStr();
    const outTradeNo = orderId || this.generateOutTradeNo();
    
    // 金额转换：元转分
    const totalFee = Math.round(amount * 100);
    
    const payload = {
      appid: this.config.appId,
      mchid: this.config.mchId,
      description: description,
      out_trade_no: outTradeNo,
      time_expire: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30分钟过期
      amount: {
        total: totalFee,
        currency: 'CNY'
      },
      payer: {
        openid: openid
      },
      notify_url: notifyUrl || this.config.callbackUrl
    };

    try {
      const result = await this.request('/v3/pay/transactions/jsapi', 'POST', payload);
      
      if (result.prepay_id) {
        // 生成前端调起支付的签名
        const paySignParams = {
          appId: this.config.appId,
          timeStamp: timeStamp,
          nonceStr: nonceStr,
          package: `prepay_id=${result.prepay_id}`
        };
        
        // V3签名
        const signStr = `${paySignParams.appId}\n${paySignParams.timeStamp}\n${paySignParams.nonceStr}\n${paySignParams.package}\n`;
        const paySign = crypto
          .createSign('RSA-SHA256')
          .update(signStr)
          .sign(this.config.privateKey, 'base64');

        return {
          success: true,
          data: {
            prepayId: result.prepay_id,
            orderNo: outTradeNo,
            paySign: paySign,
            timeStamp: timeStamp,
            nonceStr: nonceStr,
            package: paySignParams.package
          }
        };
      }
      
      return { success: false, error: result };
    } catch (error) {
      console.error('[微信支付] JSAPI下单失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * APP支付统一下单
   * 用于APP端支付
   */
  async createAppOrder(params) {
    const { orderId, amount, description, notifyUrl } = params;
    
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = this.generateNonceStr();
    const outTradeNo = orderId || this.generateOutTradeNo();
    const totalFee = Math.round(amount * 100);
    
    const payload = {
      appid: this.config.appId,
      mchid: this.config.mchId,
      description: description,
      out_trade_no: outTradeNo,
      time_expire: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      amount: {
        total: totalFee,
        currency: 'CNY'
      },
      notify_url: notifyUrl || this.config.callbackUrl
    };

    try {
      const result = await this.request('/v3/pay/transactions/app', 'POST', payload);
      
      if (result.prepay_id) {
        const signStr = `${this.config.appId}\n${timeStamp}\n${nonceStr}\n${result.prepay_id}\n`;
        const paySign = crypto
          .createSign('RSA-SHA256')
          .update(signStr)
          .sign(this.config.privateKey, 'base64');

        return {
          success: true,
          data: {
            prepayId: result.prepay_id,
            orderNo: outTradeNo,
            appid: this.config.appId,
            partnerid: this.config.mchId,
            prepayid: result.prepay_id,
            package: 'Sign=WXPay',
            timestamp: timeStamp,
            noncestr: nonceStr,
            sign: paySign
          }
        };
      }
      
      return { success: false, error: result };
    } catch (error) {
      console.error('[微信支付] APP下单失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * H5支付统一下单
   * 用于网页端支付
   */
  async createH5Order(params) {
    const { orderId, amount, description, notifyUrl } = params;
    
    const outTradeNo = orderId || this.generateOutTradeNo();
    const totalFee = Math.round(amount * 100);
    
    const payload = {
      appid: this.config.appId,
      mchid: this.config.mchId,
      description: description,
      out_trade_no: outTradeNo,
      time_expire: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      amount: {
        total: totalFee,
        currency: 'CNY'
      },
      scene_info: {
        payer_client_ip: '127.0.0.1',
        device_id: 'WEB',
        scene_type: 'MWeb'
      },
      notify_url: notifyUrl || this.config.callbackUrl
    };

    try {
      const result = await this.request('/v3/pay/transactions/h5', 'POST', payload);
      
      if (result.h5_url) {
        return {
          success: true,
          data: {
            orderNo: outTradeNo,
            h5Url: result.h5_url
          }
        };
      }
      
      return { success: false, error: result };
    } catch (error) {
      console.error('[微信支付] H5下单失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 查询订单
   */
  async queryOrder(transactionId) {
    try {
      const result = await this.request(`/v3/pay/transactions/id/${transactionId}?mchid=${this.config.mchId}`, 'GET');
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 查询订单（通过商户订单号）
   */
  async queryOrderByOutTradeNo(outTradeNo) {
    try {
      const result = await this.request(`/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${this.config.mchId}`, 'GET');
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 关闭订单
   */
  async closeOrder(outTradeNo) {
    try {
      const result = await this.request(`/v3/pay/transactions/out-trade-no/${outTradeNo}/close`, 'POST', {
        mchid: this.config.mchId
      });
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 申请退款
   */
  async refund(params) {
    const { transactionId, refundId, amount, reason } = params;
    
    const payload = {
      transaction_id: transactionId,
      out_refund_no: refundId || 'ref' + Date.now(),
      amount: {
        refund: Math.round(amount * 100),
        total: Math.round(amount * 100),
        currency: 'CNY'
      },
      reason: reason || '用户申请退款'
    };

    try {
      const result = await this.request('/v3/refund/domestic/refunds', 'POST', payload, true);
      return { success: true, data: result };
    } catch (error) {
      console.error('[微信支付] 退款失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 验证回调签名
   */
  verifyCallback(headers, body) {
    const signature = headers['wechatpay-signature'];
    const timestamp = headers['wechatpay-timestamp'];
    const nonce = headers['wechatpay-nonce'];
    
    if (!signature || !timestamp || !nonce) {
      return false;
    }

    const message = `${timestamp}\n${nonce}\n${body}\n`;
    const expectedSign = crypto
      .createHmac('sha256', this.config.apiKey)
      .update(message)
      .digest('hex');

    return signature === expectedSign;
  }

  /**
   * 解密回调通知
   */
  decryptCallback(encryptData) {
    try {
      const key = crypto.createCipheriv('aes-256-gcm', 
        Buffer.from(this.config.apiKey.padEnd(32).substring(0, 32)), 
        Buffer.alloc(12, 0)
      );
      
      let decrypted = key.update(encryptData, 'hex', 'utf8');
      decrypted += key.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('[微信支付] 解密失败:', error);
      return null;
    }
  }

  /**
   * 发送支付成功通知
   */
  async sendPaymentNotify(orderId, openid, amount) {
    // 这里可以调用微信消息模板通知
    const notificationService = require('./notificationService');
    await notificationService.send({
      type: 'payment_success',
      userId: openid,
      data: {
        orderId,
        amount,
        paidAt: new Date().toISOString()
      }
    });
  }
}

module.exports = new WechatPayService();
