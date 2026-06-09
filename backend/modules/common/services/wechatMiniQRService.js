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
    // 开发模式：直接返回文本信息，不调用微信API
    if (process.env.NODE_ENV !== 'production') {
      console.log('[小程序码] 开发模式，返回模拟数据');
      return this.generateDevQR(orderId, storeId, amount, 'order_pay');
    }

    // scene参数最大32个可见字符，使用精简格式
    const scene = orderId;
    
    const result = await this.createWxaCodeUnlimit(
      scene,
      'pages/orders/index',
      430
    );

    if (result.success) {
      return {
        success: true,
        data: {
          imageData: result.buffer.toString('base64'),
          contentType: 'image/png',
          scene: scene
        }
      };
    }

    // 生成失败时降级到开发模式
    console.log('[小程序码] 正式生成失败，降级到开发模式');
    return this.generateDevQR(orderId, storeId, amount, 'order_pay');
  }

  /**
   * 生成门店二维码
   * @param {string} storeId - 门店ID
   */
  async generateStoreQR(storeId) {
    // 开发模式降级
    if (process.env.NODE_ENV !== 'production') {
      return this.generateDevQR('', storeId, 0, 'store');
    }

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

    return this.generateDevQR('', storeId, 0, 'store');
  }

  /**
   * 开发模式：生成模拟二维码数据（不依赖微信API）
   * 返回一个简单的占位图，让前端可以正常显示
   */
  generateDevQR(orderId, storeId, amount, type) {
    // 生成一个1x1像素的PNG作为占位
    // 或者生成包含文本信息的SVG格式图片
    const info = type === 'order_pay' 
      ? `订单:${orderId}|门店:${storeId}|金额:${amount}`
      : `门店:${storeId}`;
    
    // 生成简易SVG二维码占位图
    const svg = this.generateSimpleSVG(orderId || storeId, info);
    const imageData = Buffer.from(svg).toString('base64');
    
    return {
      success: true,
      data: {
        imageData: imageData,
        contentType: 'image/svg+xml',
        scene: orderId || `store=${storeId}`,
        isDevMode: true
      }
    };
  }

  /**
   * 生成简易SVG占位图
   */
  generateSimpleSVG(title, subtitle) {
    // 创建一个简单的二维码样式SVG
    const size = 430;
    const cellSize = Math.floor(size / 25);
    
    // 生成伪随机二维码图案（仅用于占位显示）
    let cells = '';
    const seed = (title || 'default').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    for (let y = 0; y < 25; y++) {
      for (let x = 0; x < 25; x++) {
        // 三个定位角
        const isCorner = (x < 7 && y < 7) || (x >= 18 && y < 7) || (x < 7 && y >= 18);
        const isCornerBorder = isCorner && (x === 0 || x === 6 || y === 0 || y === 6 || 
                              (x >= 18 && (x === 18 || x === 24)) || (y >= 18 && (y === 18 || y === 24)));
        const isCornerInner = isCorner && ((x >= 2 && x <= 4 && y >= 2 && y <= 4) || 
                              (x >= 20 && x <= 22 && y >= 2 && y <= 4) || (x >= 2 && x <= 4 && y >= 20 && y <= 22));
        
        const filled = isCornerBorder || isCornerInner || ((seed * (x + 1) * (y + 1)) % 3 === 0);
        if (filled) {
          cells += `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="#1e40af"/>`;
        }
      }
    }
    
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="white"/>
      ${cells}
      <text x="${size/2}" y="${size - 20}" text-anchor="middle" font-size="14" fill="#6b7280">${subtitle || title || '扫码支付'}</text>
    </svg>`;
  }
}

module.exports = new WechatMiniQRService();
