/**
 * 支付宝支付服务
 */

const crypto = require('crypto');
const axios = require('axios');
const config = require('./config');

class AlipayService {
  constructor() {
    this.config = config.alipay;
    this.gateway = this.config.gateway;
  }

  /**
   * RSA2签名
   * @param {string} content - 待签名字符串
   * @param {string} privateKey - 私钥
   */
  sign(content, privateKey) {
    const sign = crypto
      .createSign('RSA-SHA256')
      .update(content, 'utf8')
      .sign(privateKey, 'base64');
    return sign;
  }

  /**
   * RSA2验签
   * @param {string} content - 待验签内容
   * @param {string} sign - 签名
   * @param {string} publicKey - 公钥
   */
  verify(content, sign, publicKey) {
    const verifier = crypto.createVerify('RSA-SHA256');
    return verifier.update(content, 'utf8').verify(publicKey, sign, 'base64');
  }

  /**
   * URL编码（支付宝需要）
   */
  encodeParams(params) {
    return Object.keys(params)
      .sort()
      .map(key => `${key}=${encodeURIComponent(params[key])}`)
      .join('&');
  }

  /**
   * 生成签名参数
   * @param {Object} params - 业务参数
   */
  signParams(params) {
    const signContent = this.encodeParams(params);
    const sign = this.sign(signContent, this.config.privateKey);
    
    return {
      ...params,
      sign: sign,
      sign_type: 'RSA2'
    };
  }

  /**
   * 电脑网站支付（网页跳转）
   * @param {Object} params - 支付参数
   */
  async createWebPayOrder(params) {
    const { orderId, amount, subject, body = '', returnUrl = '' } = params;

    const bizContent = {
      out_trade_no: orderId,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      total_amount: amount.toFixed(2),
      subject: subject,
      body: body
    };

    const requestParams = {
      app_id: this.config.appId,
      method: 'alipay.trade.page.pay',
      format: 'JSON',
      charset: 'utf-8',
      timestamp: new Date().format('yyyy-MM-dd HH:mm:ss'),
      version: '1.0',
      biz_content: JSON.stringify(bizContent),
      return_url: returnUrl || `${config.server.host}/payment/alipay/return`,
      notify_url: this.config.notifyUrl
    };

    const signedParams = this.signParams(requestParams);
    
    // 生成支付链接
    const payUrl = `${this.gateway}?${this.encodeParams(signedParams)}`;

    return {
      success: true,
      data: {
        orderId: orderId,
        payUrl: payUrl,
        qrCode: '' // 可以通过二维码生成库生成二维码
      }
    };
  }

  /**
   * 手机网站支付（移动端网页跳转）
   */
  async createWapPayOrder(params) {
    const { orderId, amount, subject, body = '', returnUrl = '' } = params;

    const bizContent = {
      out_trade_no: orderId,
      product_code: 'QUICK_WAP_WAY',
      total_amount: amount.toFixed(2),
      subject: subject,
      body: body
    };

    const requestParams = {
      app_id: this.config.appId,
      method: 'alipay.trade.wap.pay',
      format: 'JSON',
      charset: 'utf-8',
      timestamp: new Date().format('yyyy-MM-dd HH:mm:ss'),
      version: '1.0',
      biz_content: JSON.stringify(bizContent),
      return_url: returnUrl,
      notify_url: this.config.notifyUrl
    };

    const signedParams = this.signParams(requestParams);
    const payUrl = `${this.gateway}?${this.encodeParams(signedParams)}`;

    return {
      success: true,
      data: {
        orderId: orderId,
        payUrl: payUrl
      }
    };
  }

  /**
   * 统一收单交易查询
   */
  async queryOrder(orderId) {
    const bizContent = {
      out_trade_no: orderId
    };

    const requestParams = {
      app_id: this.config.appId,
      method: 'alipay.trade.query',
      format: 'JSON',
      charset: 'utf-8',
      timestamp: new Date().format('yyyy-MM-dd HH:mm:ss'),
      version: '1.0',
      biz_content: JSON.stringify(bizContent)
    };

    const signedParams = this.signParams(requestParams);

    try {
      const response = await axios.post(
        this.gateway,
        this.encodeParams(signedParams),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const result = response.data.alipay_trade_query_response;

      if (result.code === '10000') {
        return {
          success: true,
          data: {
            orderId: result.out_trade_no,
            tradeNo: result.trade_no,
            tradeStatus: result.trade_status,
            totalAmount: parseFloat(result.total_amount),
            buyerPayAmount: parseFloat(result.buyer_pay_amount || 0),
            receiptAmount: parseFloat(result.receipt_amount || 0),
            gmtPayment: result.gmt_payment
          }
        };
      } else {
        return {
          success: false,
          error: result.sub_msg || result.msg,
          code: result.code
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 交易关闭
   */
  async closeOrder(orderId) {
    const bizContent = {
      out_trade_no: orderId
    };

    const requestParams = {
      app_id: this.config.appId,
      method: 'alipay.trade.close',
      format: 'JSON',
      charset: 'utf-8',
      timestamp: new Date().format('yyyy-MM-dd HH:mm:ss'),
      version: '1.0',
      biz_content: JSON.stringify(bizContent)
    };

    const signedParams = this.signParams(requestParams);

    try {
      const response = await axios.post(
        this.gateway,
        this.encodeParams(signedParams),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const result = response.data.alipay_trade_close_response;

      if (result.code === '10000') {
        return { success: true };
      } else {
        return {
          success: false,
          error: result.sub_msg || result.msg
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 统一收单交易退款
   */
  async refund(orderId, refundAmount, refundReason = '') {
    const bizContent = {
      out_trade_no: orderId,
      refund_amount: refundAmount.toFixed(2),
      refund_reason: refundReason
    };

    const requestParams = {
      app_id: this.config.appId,
      method: 'alipay.trade.refund',
      format: 'JSON',
      charset: 'utf-8',
      timestamp: new Date().format('yyyy-MM-dd HH:mm:ss'),
      version: '1.0',
      biz_content: JSON.stringify(bizContent)
    };

    const signedParams = this.signParams(requestParams);

    try {
      const response = await axios.post(
        this.gateway,
        this.encodeParams(signedParams),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const result = response.data.alipay_trade_refund_response;

      if (result.code === '10000') {
        return {
          success: true,
          data: {
            orderId: result.out_trade_no,
            tradeNo: result.trade_no,
            refundAmount: parseFloat(result.refund_fee)
          }
        };
      } else {
        return {
          success: false,
          error: result.sub_msg || result.msg
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 验证回调签名
   */
  verifyNotifySign(postData) {
    const { sign, ...params } = postData;
    const signContent = this.encodeParams(params);
    return this.verify(signContent, sign, this.config.alipayPublicKey);
  }
}

// Date格式化扩展
Date.prototype.format = function(fmt) {
  const o = {
    'M+': this.getMonth() + 1,
    'd+': this.getDate(),
    'H+': this.getHours(),
    'm+': this.getMinutes(),
    's+': this.getSeconds(),
    'q+': Math.floor((this.getMonth() + 3) / 3),
    'S': this.getMilliseconds()
  };
  
  if (/(y+)/.test(fmt)) {
    fmt = fmt.replace(RegExp.$1, (this.getFullYear() + '').substr(4 - RegExp.$1.length));
  }
  
  for (const k in o) {
    if (new RegExp('(' + k + ')').test(fmt)) {
      fmt = fmt.replace(RegExp.$1, (RegExp.$1.length === 1) ? (o[k]) : (('00' + o[k]).substr(('' + o[k]).length)));
    }
  }
  
  return fmt;
};

module.exports = new AlipayService();
