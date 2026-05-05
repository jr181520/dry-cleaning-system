/**
 * 测试环境配置文件
 * 不需要真实API密钥，使用模拟数据测试支付流程
 */

module.exports = {
  // 服务器配置
  server: {
    port: 3002,
    host: 'localhost',
    testMode: true // 开启测试模式
  },

  // 微信支付配置（测试模式）
  wechat: {
    enabled: true,
    testMode: true, // 使用模拟支付
    miniapp: {
      appId: 'test_wxappid_1234567890',
      appSecret: 'test_secret_1234567890',
      mchId: '1234567890',
      apiKey: 'test_api_key_1234567890',
      notifyUrl: 'http://localhost:3002/api/payment/wechat/notify'
    },
    h5: {
      appId: 'test_h5_appid_1234567890',
      appSecret: 'test_h5_secret_1234567890',
      mchId: '1234567890',
      apiKey: 'test_api_key_1234567890',
      notifyUrl: 'http://localhost:3002/api/payment/wechat/h5notify'
    },
    apiBaseUrl: 'https://api.mch.weixin.qq.com'
  },

  // 支付宝配置（测试模式）
  alipay: {
    enabled: true,
    testMode: true, // 使用模拟支付
    appId: 'test_alipay_appid_2021001234567890',
    privateKey: 'test_private_key_1234567890',
    alipayPublicKey: 'test_alipay_public_key_1234567890',
    gateway: 'https://openapi.alipay.com/gateway.do',
    notifyUrl: 'http://localhost:3002/api/payment/alipay/notify'
  },

  // 银联支付配置（测试模式）
  unionpay: {
    enabled: true,
    testMode: true, // 使用模拟支付
    merchantId: '898340183988823',
    signCertPath: '',
    signCertPwd: 'test_password',
    notifyUrl: 'http://localhost:3002/api/payment/unionpay/notify',
    apiUrl: 'https://gateway.95516.com'
  },

  // 平台账户配置
  platform: {
    serviceFeeRate: 0.05, // 5%服务费
    settlementCycle: 7,   // T+7结算
    minWithdrawAmount: 100 // 最低提现100元
  },

  // 数据库模拟配置
  database: {
    type: 'memory'
  }
};
