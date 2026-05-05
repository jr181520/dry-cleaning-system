/**
 * 微信支付服务
 */

const crypto = require('crypto');
const axios = require('axios');
const xml2js = require('xml2js');
const config = require('./config');

class WechatPayService {
  constructor() {
    this.config = config.wechat.miniapp;
    this.apiUrl = config.wechat.apiBaseUrl;
  }

  /**
   * 生成随机字符串
   */
  generateNonceStr() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * 生成签名
   * @param {Object} params - 签名参数
   * @param {string} key - API密钥
   */
  generateSign(params, key) {
    // 按字典序排序参数
    const sortedKeys = Object.keys(params).sort();
    const signStr = sortedKeys
      .filter(key => params[key] !== undefined && params[key] !== '' && params[key] !== null)
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    const sign = crypto
      .createHash('md5')
      .update(signStr + `&key=${key}`)
      .digest('hex')
      .toUpperCase();
    
    return sign;
  }

  /**
   * 解析XML
   */
  async parseXML(xml) {
    return xml2js.parseStringPromise(xml, { explicitArray: false });
  }

  /**
   * 生成订单对象（统一下单）
   * @param {Object} params - 订单参数
   */
  async createOrder(params) {
    const { orderId, amount, description, openid, notifyUrl, tradeType = 'JSAPI' } = params;

    // 构建请求参数
    const requestParams = {
      appid: this.config.appId,
      mch_id: this.config.mchId,
      nonce_str: this.generateNonceStr(),
      body: description,
      out_trade_no: orderId,
      total_fee: Math.round(amount * 100), // 金额单位为分
      spbill_create_ip: params.clientIp || '127.0.0.1',
      notify_url: notifyUrl || this.config.notifyUrl,
      trade_type: tradeType
    };

    // 添加用户openid（小程序和JSAPI支付必须）
    if (openid && (tradeType === 'JSAPI' || tradeType === 'MWEB')) {
      requestParams.openid = openid;
    }

    // 生成签名
    requestParams.sign = this.generateSign(requestParams, this.config.apiKey);

    // 转换为XML
    const xmlBuilder = new xml2js.Builder({ rootName: 'xml', cdata: false });
    const xmlData = xmlBuilder.buildObject(requestParams);

    try {
      // 发送请求
      const response = await axios.post(
        `${this.apiUrl}/pay/unifiedorder`,
        xmlData,
        { headers: { 'Content-Type': 'text/xml' } }
      );

      // 解析响应
      const result = await this.parseXML(response.data);

      if (result.xml && result.xml.return_code === 'SUCCESS') {
        if (result.xml.result_code === 'SUCCESS') {
          return {
            success: true,
            data: {
              orderId: result.xml.out_trade_no,
              transactionId: result.xml.transaction_id,
              prepayId: result.xml.prepay_id,
              codeUrl: result.xml.code_url, //扫码支付
              mwebUrl: result.xml.mweb_url // H5支付
            }
          };
        } else {
          return {
            success: false,
            error: result.xml.err_code_des || result.xml.errmsg,
            code: result.xml.err_code
          };
        }
      } else {
        return {
          success: false,
          error: result.xml?.return_msg || '微信支付下单失败'
        };
      }
    } catch (error) {
      console.error('微信支付下单失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 查询订单
   */
  async queryOrder(transactionId, orderId) {
    const requestParams = {
      appid: this.config.appId,
      mch_id: this.config.mchId,
      nonce_str: this.generateNonceStr(),
      transaction_id: transactionId,
      out_trade_no: orderId
    };

    // 移除空的transaction_id
    if (!transactionId) delete requestParams.transaction_id;
    if (!orderId) delete requestParams.out_trade_no;

    requestParams.sign = this.generateSign(requestParams, this.config.apiKey);

    const xmlBuilder = new xml2js.Builder({ rootName: 'xml' });
    const xmlData = xmlBuilder.buildObject(requestParams);

    try {
      const response = await axios.post(
        `${this.apiUrl}/pay/orderquery`,
        xmlData,
        { headers: { 'Content-Type': 'text/xml' } }
      );

      const result = await this.parseXML(response.data);

      if (result.xml && result.xml.return_code === 'SUCCESS' && result.xml.result_code === 'SUCCESS') {
        return {
          success: true,
          data: {
            orderId: result.xml.out_trade_no,
            transactionId: result.xml.transaction_id,
            tradeState: result.xml.trade_state,
            tradeStateDesc: result.xml.trade_state_desc,
            totalFee: parseInt(result.xml.total_fee) / 100,
            cashFee: parseInt(result.xml.cash_fee) / 100,
            timeEnd: result.xml.time_end
          }
        };
      } else {
        return {
          success: false,
          error: result.xml?.err_code_des || '查询失败'
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
   * 关闭订单
   */
  async closeOrder(orderId) {
    const requestParams = {
      appid: this.config.appId,
      mch_id: this.config.mchId,
      nonce_str: this.generateNonceStr(),
      out_trade_no: orderId
    };

    requestParams.sign = this.generateSign(requestParams, this.config.apiKey);

    const xmlBuilder = new xml2js.Builder({ rootName: 'xml' });
    const xmlData = xmlBuilder.buildObject(requestParams);

    try {
      const response = await axios.post(
        `${this.apiUrl}/pay/closeorder`,
        xmlData,
        { headers: { 'Content-Type': 'text/xml' } }
      );

      const result = await this.parseXML(response.data);

      if (result.xml && result.xml.return_code === 'SUCCESS' && result.xml.result_code === 'SUCCESS') {
        return { success: true };
      } else {
        return {
          success: false,
          error: result.xml?.err_code_des || '关闭失败'
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
   * 申请退款
   */
  async refund(orderId, totalAmount, refundAmount, refundReason = '') {
    const requestParams = {
      appid: this.config.appId,
      mch_id: this.config.mchId,
      nonce_str: this.generateNonceStr(),
      transaction_id: orderId,
      out_refund_no: `REFUND${Date.now()}`,
      total_fee: Math.round(totalAmount * 100),
      refund_fee: Math.round(refundAmount * 100),
      refund_desc: refundReason
    };

    requestParams.sign = this.generateSign(requestParams, this.config.apiKey);

    const xmlBuilder = new xml2js.Builder({ rootName: 'xml' });
    const xmlData = xmlBuilder.buildObject(requestParams);

    try {
      const response = await axios.post(
        `${this.apiUrl}/secapi/pay/refund`,
        xmlData,
        { 
          headers: { 'Content-Type': 'text/xml' },
          // 退款需要双向SSL认证（生产环境）
          httpsAgent: false
        }
      );

      const result = await this.parseXML(response.data);

      if (result.xml && result.xml.return_code === 'SUCCESS' && result.xml.result_code === 'SUCCESS') {
        return {
          success: true,
          data: {
            refundId: result.xml.refund_id,
            refundFee: parseInt(result.xml.refund_fee) / 100
          }
        };
      } else {
        return {
          success: false,
          error: result.xml?.err_code_des || '退款失败'
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
  verifyNotifySign(params) {
    const sign = params.sign;
    delete params.sign;
    const calculatedSign = this.generateSign(params, this.config.apiKey);
    return sign === calculatedSign;
  }

  /**
   * 生成小程序调起支付的参数
   */
  generateAppPayParams(prepayId) {
    const params = {
      appId: this.config.appId,
      timeStamp: Math.floor(Date.now() / 1000).toString(),
      nonceStr: this.generateNonceStr(),
      package: `prepay_id=${prepayId}`,
      signType: 'MD5'
    };
    
    const paySign = this.generateSign(params, this.config.apiKey);
    
    return {
      ...params,
      paySign
    };
  }
}

module.exports = new WechatPayService();
