/**
 * 银联支付服务
 * 支持：银行卡支付、网关支付
 */

const crypto = require('crypto');
const axios = require('axios');
const config = require('./config');

class UnionpayService {
  constructor() {
    this.config = config.unionpay;
    this.apiUrl = this.config.apiUrl;
  }

  /**
   * 生成随机字符串
   */
  generateNonceStr(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 生成时间戳
   */
  getTimestamp() {
    return new Date().format('yyyyMMddHHmmss');
  }

  /**
   * 获取日期
   */
  getDate() {
    return new Date().format('yyyyMMdd');
  }

  /**
   * SHA256签名
   * @param {string} content - 待签名内容
   * @param {string} key - 密钥
   */
  sign(content, key) {
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(content, 'utf8');
    return hmac.digest('base64');
  }

  /**
   * 验证签名
   */
  verifySign(params, signature) {
    const content = this.getSignContent(params);
    const expectedSign = this.sign(content, this.config.signCertPwd);
    return signature === expectedSign;
  }

  /**
   * 获取签名内容
   */
  getSignContent(params) {
    const keys = Object.keys(params).sort();
    const signParts = keys
      .filter(key => params[key] !== undefined && params[key] !== '' && params[key] !== null)
      .map(key => `${key}=${params[key]}`)
      .join('&');
    return signParts;
  }

  /**
   * 创建网关支付订单（PC网页支付）
   * @param {Object} params - 订单参数
   */
  async createGatewayPayOrder(params) {
    const { orderId, amount, subject, returnUrl = '' } = params;

    const requestParams = {
      version: '5.1.0',           // 版本号
      encoding: 'utf-8',          // 编码
      certId: this.config.merchantId, // 商户号
      txnType: '01',              // 交易类型
      txnSubType: '01',           // 交易子类
      bizType: '000201',          // 业务类型
      frontUrl: returnUrl || `${config.server.host}/payment/unionpay/return`, // 前台回调
      backUrl: this.config.notifyUrl,   // 后台回调
      signMethod: '01',           // 签名方法
      channelType: '07',          // 渠道类型
      accessType: '0',             // 接入类型
      merId: this.config.merchantId,    // 商户代码
      orderId: orderId,            // 商户订单号
      txnTime: this.getTimestamp(),    // 订单时间
      txnAmt: Math.round(amount * 100).toString(), // 交易金额（分）
      currencyCode: '156',        // 交易币种
      defaultPayType: '01',        // 默认支付方式
      reqReserved: subject       // 订单描述
    };

    // 生成签名
    requestParams.signature = this.sign(this.getSignContent(requestParams), this.config.signCertPwd);

    try {
      // 构建表单
      const form = this.buildPaymentForm(requestParams, `${this.apiUrl}/gateway/api/frontTrans.do`);
      
      return {
        success: true,
        data: {
          orderId: orderId,
          form: form,
          payUrl: `${this.apiUrl}/gateway/api/frontTrans.do`
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 创建手机网页支付订单
   */
  async createWapPayOrder(params) {
    const { orderId, amount, subject, returnUrl = '' } = params;

    const requestParams = {
      version: '5.1.0',
      encoding: 'utf-8',
      certId: this.config.merchantId,
      txnType: '01',
      txnSubType: '02',           // 手机网页支付
      bizType: '000201',
      frontUrl: returnUrl,
      backUrl: this.config.notifyUrl,
      signMethod: '01',
      channelType: '08',          // 移动端
      accessType: '0',
      merId: this.config.merchantId,
      orderId: orderId,
      txnTime: this.getTimestamp(),
      txnAmt: Math.round(amount * 100).toString(),
      currencyCode: '156',
      reqReserved: subject
    };

    requestParams.signature = this.sign(this.getSignContent(requestParams), this.config.signCertPwd);

    return {
      success: true,
      data: {
        orderId: orderId,
        params: requestParams,
        payUrl: `${this.apiUrl}/gateway/api/frontTrans.do`
      }
    };
  }

  /**
   * 银行卡支付（无跳转直接扣款）
   */
  async createCardPayOrder(params) {
    const { orderId, amount, cardNo, cvn2, expiredDate, subject, customerName = '', phoneNo = '' } = params;

    // 参数验证
    if (!cardNo || !cvn2 || !expiredDate) {
      return {
        success: false,
        error: '缺少银行卡信息'
      };
    }

    const requestParams = {
      version: '5.1.0',
      encoding: 'utf-8',
      certId: this.config.merchantId,
      txnType: '01',
      txnSubType: '01',
      bizType: '000201',
      backUrl: this.config.notifyUrl,
      signMethod: '01',
      channelType: '07',
      accessType: '0',
      merId: this.config.merchantId,
      orderId: orderId,
      txnTime: this.getTimestamp(),
      txnAmt: Math.round(amount * 100).toString(),
      currencyCode: '156',
      reqReserved: subject,
      // 银行卡信息
      cardNo: cardNo,
      customerInfo: this.encryptCustomerInfo({ cvn2, expiredDate, customerName, phoneNo })
    };

    requestParams.signature = this.sign(this.getSignContent(requestParams), this.config.signCertPwd);

    try {
      const response = await axios.post(
        `${this.apiUrl}/gateway/api/backTrans.do`,
        this.buildFormData(requestParams),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const result = this.parseResponse(response.data);

      if (result['respCode'] === '00') {
        return {
          success: true,
          data: {
            orderId: result['orderId'],
            txnNo: result['queryId'],
            amount: parseInt(result['txnAmt']) / 100
          }
        };
      } else {
        return {
          success: false,
          error: result['respMsg'] || '支付失败',
          code: result['respCode']
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
   * 查询订单
   */
  async queryOrder(orderId) {
    const requestParams = {
      version: '5.1.0',
      encoding: 'utf-8',
      certId: this.config.merchantId,
      txnType: '00',
      txnSubType: '00',
      bizType: '000201',
      signMethod: '01',
      accessType: '0',
      merId: this.config.merchantId,
      orderId: orderId,
      txnTime: this.getTimestamp()
    };

    requestParams.signature = this.sign(this.getSignContent(requestParams), this.config.signCertPwd);

    try {
      const response = await axios.post(
        `${this.apiUrl}/gateway/api/queryTrans.do`,
        this.buildFormData(requestParams),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const result = this.parseResponse(response.data);

      if (result['origRespCode'] === '00') {
        return {
          success: true,
          data: {
            orderId: result['orderId'],
            txnNo: result['queryId'],
            txnAmt: parseInt(result['txnAmt']) / 100,
            status: this.convertStatus(result['origRespCode']),
            payTime: result['origTxnTime']
          }
        };
      } else {
        return {
          success: false,
          error: result['origRespMsg'] || '查询失败',
          code: result['origRespCode']
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
   * 交易撤销
   */
  async voidOrder(orderId, amount) {
    const requestParams = {
      version: '5.1.0',
      encoding: 'utf-8',
      certId: this.config.merchantId,
      txnType: '31',
      txnSubType: '00',
      bizType: '000201',
      backUrl: this.config.notifyUrl,
      signMethod: '01',
      channelType: '07',
      accessType: '0',
      merId: this.config.merchantId,
      orderId: orderId,
      txnTime: this.getTimestamp(),
      txnAmt: Math.round(amount * 100).toString(),
      currencyCode: '156'
    };

    requestParams.signature = this.sign(this.getSignContent(requestParams), this.config.signCertPwd);

    try {
      const response = await axios.post(
        `${this.apiUrl}/gateway/api/backTrans.do`,
        this.buildFormData(requestParams),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const result = this.parseResponse(response.data);

      if (result['respCode'] === '00') {
        return {
          success: true,
          data: {
            orderId: result['orderId'],
            amount: parseInt(result['txnAmt']) / 100
          }
        };
      } else {
        return {
          success: false,
          error: result['respMsg'] || '撤销失败',
          code: result['respCode']
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
   * 退款
   */
  async refund(orderId, amount, origTxnTime) {
    const requestParams = {
      version: '5.1.0',
      encoding: 'utf-8',
      certId: this.config.merchantId,
      txnType: '04',
      txnSubType: '00',
      bizType: '000201',
      backUrl: this.config.notifyUrl,
      signMethod: '01',
      channelType: '07',
      accessType: '0',
      merId: this.config.merchantId,
      orderId: `REFUND${Date.now()}`,
      txnTime: this.getTimestamp(),
      txnAmt: Math.round(amount * 100).toString(),
      currencyCode: '156',
      origOrderId: orderId,
      origTxnTime: origTxnTime
    };

    requestParams.signature = this.sign(this.getSignContent(requestParams), this.config.signCertPwd);

    try {
      const response = await axios.post(
        `${this.apiUrl}/gateway/api/backTrans.do`,
        this.buildFormData(requestParams),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const result = this.parseResponse(response.data);

      if (result['respCode'] === '00') {
        return {
          success: true,
          data: {
            orderId: result['orderId'],
            refundAmount: parseInt(result['txnAmt']) / 100
          }
        };
      } else {
        return {
          success: false,
          error: result['respMsg'] || '退款失败',
          code: result['respCode']
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
   * 构建HTML表单
   */
  buildPaymentForm(params, action) {
    let html = `<form id="paymentForm" action="${action}" method="post">`;
    for (const key in params) {
      html += `<input type="hidden" name="${key}" value="${params[key]}" />`;
    }
    html += '</form><script>document.getElementById("paymentForm").submit();</script>';
    return html;
  }

  /**
   * 构建表单数据
   */
  buildFormData(params) {
    const parts = [];
    for (const key in params) {
      parts.push(`${key}=${encodeURIComponent(params[key])}`);
    }
    return parts.join('&');
  }

  /**
   * 解析响应数据
   */
  parseResponse(data) {
    const result = {};
    const pairs = data.split('&');
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      result[key] = decodeURIComponent(value || '');
    }
    return result;
  }

  /**
   * 加密客户信息
   */
  encryptCustomerInfo(info) {
    const { cvn2, expiredDate, customerName, phoneNo } = info;
    const data = `${cvn2}|${expiredDate}|${customerName}|${phoneNo}`;
    // 使用公钥加密（实际需要从银联获取）
    return Buffer.from(data).toString('base64');
  }

  /**
   * 转换状态码
   */
  convertStatus(respCode) {
    const statusMap = {
      '00': 'success',      // 成功
      '03': 'processing',   // 处理中
      '04': 'processing',   // 处理中
      '05': 'processing',   // 处理中
      '01': 'failed',       // 失败
      '02': 'failed'        // 失败
    };
    return statusMap[respCode] || 'unknown';
  }

  /**
   * 验证回调签名
   */
  verifyNotifySign(params) {
    const signature = params.signature;
    delete params.signature;
    delete params.signMethod;
    return this.verifySign(params, signature);
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

module.exports = new UnionpayService();
