/**
 * 支付系统配置文件
 */

module.exports = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3002,
    host: process.env.HOST || 'localhost'
  },

  // 微信支付配置
  wechat: {
    enabled: true,
    // 小程序支付配置
    miniapp: {
      appId: process.env.WECHAT_MINIAPP_APPID || '',
      appSecret: process.env.WECHAT_MINIAPP_SECRET || '',
      mchId: process.env.WECHAT_MCH_ID || '',        // 商户号
      apiKey: process.env.WECHAT_API_KEY || '',       // API密钥
      notifyUrl: process.env.WECHAT_NOTIFY_URL || 'http://localhost:3002/api/payment/wechat/notify'
    },
    // H5支付配置（用于跳转支付）
    h5: {
      appId: process.env.WECHAT_H5_APPID || '',
      appSecret: process.env.WECHAT_H5_SECRET || '',
      mchId: process.env.WECHAT_MCH_ID || '',
      apiKey: process.env.WECHAT_API_KEY || '',
      notifyUrl: process.env.WECHAT_H5_NOTIFY_URL || 'http://localhost:3002/api/payment/wechat/h5notify'
    },
    // API请求地址
    apiBaseUrl: process.env.WECHAT_API_URL || 'https://api.mch.weixin.qq.com'
  },

  // 支付宝配置
  alipay: {
    enabled: true,
    appId: process.env.ALIPAY_APP_ID || '',
    // RSA2私钥（用于签名）
    privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
    // 支付宝公钥（用于验签）
    alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || '',
    // 网关地址
    gateway: process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do',
    // 回调地址
    notifyUrl: process.env.ALIPAY_NOTIFY_URL || 'http://localhost:3002/api/payment/alipay/notify'
  },

  // 银联支付配置
  unionpay: {
    enabled: true,
    // 商户号
    merchantId: process.env.UNIONPAY_MERCHANT_ID || '',
    // 签名证书路径
    signCertPath: process.env.UNIONPAY_SIGN_CERT_PATH || '',
    // 签名证书密码
    signCertPwd: process.env.UNIONPAY_SIGN_CERT_PWD || '',
    // 回调地址
    notifyUrl: process.env.UNIONPAY_NOTIFY_URL || 'http://localhost:3002/api/payment/unionpay/notify',
    // API地址
    apiUrl: process.env.UNIONPAY_API_URL || 'https://gateway.95516.com'
  },

  // 平台账户配置
  platform: {
    // 平台服务费比例（例如 10%）
    serviceFeeRate: 0.10,
    // 结算周期（天）
    settlementCycle: 7,
    // 最低提现金额
    minWithdrawAmount: 100
  },

  // 数据库模拟配置
  database: {
    // 使用内存数据库模拟
    type: 'memory'
  }
};
