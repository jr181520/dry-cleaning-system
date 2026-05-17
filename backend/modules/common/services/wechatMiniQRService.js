/**
 * 微信小程序码生成服务
 * 用于生成门店专属的小程序码，实现微信小程序引流
 */

const https = require('https');
const request = require('request');

// 微信小程序配置
const WX_MINI_CONFIG = {
  appId: process.env.WX_MINI_APP_ID || process.env.WX_APP_ID || '',
  appSecret: process.env.WX_MINI_APP_SECRET || process.env.WX_APP_SECRET || '',
  // 小程序首页路径
  defaultPage: 'pages/order/detail/index'
};

class WechatMiniQRService {
  constructor() {
    this.config = WX_MINI_CONFIG;
    this.tokenCache = null;
    this.tokenExpireTime = 0;
  }

  /**
   * 获取access_token
   */
  async getAccessToken() {
    // 检查缓存
    if (this.tokenCache && Date.now() < this.tokenExpireTime) {
      return this.tokenCache;
    }

    return new Promise((resolve, reject) => {
      const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.config.appId}&secret=${this.config.appSecret}`;
      
      request(url, { json: true }, (error, response, body) => {
        if (error) {
          console.error('[小程序码] 获取access_token失败:', error);
          reject(error);
          return;
        }

        if (body.access_token) {
          this.tokenCache = body.access_token;
          this.tokenExpireTime = Date.now() + (body.expires_in - 200) * 1000;
          resolve(body.access_token);
        } else {
          console.error('[小程序码] access_token响应异常:', body);
          reject(new Error(body.errmsg || '获取access_token失败'));
        }
      });
    });
  }

  /**
   * 生成无限制小程序码
   * @param {string} scene - 场景参数，如 "id=xxx&storeId=xxx"
   * @param {string} page - 页面路径，如 "pages/order/detail/index"
   * @param {number} width - 二维码宽度，默认430
   * @param {object} options - 其他选项
   */
  async createWxaCodeUnlimit(scene, page, width = 430, options = {}) {
    try {
      const accessToken = await this.getAccessToken();
      const url = `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${accessToken}`;
      
      const payload = {
        scene: scene,  // 最大32个可见字符
        page: page || this.config.defaultPage,
        width: width,
        auto_color: false,
        line_color: { r: 102, g: 126, b: 234 }, // 紫色，与品牌色一致
        env_version: options.env_version || 'trial' // release/trial/develop（测试时用trial）
      };

      return new Promise((resolve, reject) => {
        request({
          url: url,
          method: 'POST',
          body: payload,
          json: true
        }, (error, response, body) => {
          if (error) {
            console.error('[小程序码] 生成失败:', error);
            reject(error);
            return;
          }

          // 检查是否返回错误
          if (body.errcode && body.errcode !== 0) {
            console.error('[小程序码] 微信API错误:', body);
            reject(new Error(body.errmsg || `错误码: ${body.errcode}`));
            return;
          }

          // body是Buffer（二进制图片）
          if (Buffer.isBuffer(body)) {
            resolve({
              success: true,
              buffer: body,
              contentType: 'image/png'
            });
          } else {
            // 可能是JSON响应（错误情况）
            resolve({
              success: false,
              error: body.errmsg || '生成失败'
            });
          }
        });
      });
    } catch (error) {
      console.error('[小程序码] 生成异常:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 生成带参数的小程序码URL（用于生成二维码图片）
   * @param {string} orderId - 订单ID
   * @param {string} storeId - 门店ID
   * @param {number} amount - 订单金额
   */
  buildSceneParams(orderId, storeId, amount) {
    // scene参数最大32字符，需要精简
    // 格式: id_storeAmt 或直接用订单ID
    const params = {
      id: orderId,
      s: storeId,
      a: amount
    };
    return JSON.stringify(params);
  }

  /**
   * 生成订单支付小程序码
   * @param {string} orderId - 订单ID
   * @param {string} storeId - 门店ID
   * @param {number} amount - 订单金额
   */
  async generateOrderPayQR(orderId, storeId, amount) {
    // scene参数最大32个可见字符，使用精简格式
    // 格式: orderId  (小程序通过API获取其他信息)
    // 为了兼容，保留订单ID即可，让小程序端查询详情
    const scene = orderId;  // 直接使用订单ID作为scene参数
    
    // 生成小程序码
    // 注意：page路径不能带扩展名，且必须是已配置的页面
    const result = await this.createWxaCodeUnlimit(
      scene,
      'pages/orders/index',  // 使用已配置的页面路径（不带扩展名）
      430
    );

    if (result.success) {
      // 将Buffer转为base64
      return {
        success: true,
        data: {
          imageData: result.buffer.toString('base64'),
          contentType: 'image/png',
          scene: scene
        }
      };
    }

    return result;
  }

  /**
   * 生成门店二维码
   * @param {string} storeId - 门店ID
   */
  async generateStoreQR(storeId) {
    const scene = `store=${storeId}`;
    
    const result = await this.createWxaCodeUnlimit(
      scene,
      'pages/index/index',
      430
    );

    if (result.success) {
      return {
        success: true,
        data: {
          imageData: result.buffer.toString('base64'),
          contentType: 'image/png'
        }
      };
    }

    return result;
  }
}

module.exports = new WechatMiniQRService();
