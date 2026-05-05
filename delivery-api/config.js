/**
 * 聚合配送系统 - 配置文件
 * 统一管理三家配送服务商的API配置
 */

module.exports = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3001
  },

  // 美团配送配置
  meituan: {
    enabled: true,
    // 测试环境
    test: {
      appId: process.env.MEITUAN_TEST_APP_ID || '',
      secret: process.env.MEITUAN_TEST_SECRET || '',
      url: 'https://peisongopen-sandbox.dianping.com'
    },
    // 生产环境
    production: {
      appId: process.env.MEITUAN_PROD_APP_ID || '',
      secret: process.env.MEITUAN_PROD_SECRET || '',
      url: 'https://peisongopen.meituan.com'
    }
  },

  // 达达/京东秒送配置
  dada: {
    enabled: true,
    // 测试环境
    test: {
      appKey: process.env.DADA_TEST_APP_KEY || '',
      appSecret: process.env.DADA_TEST_APP_SECRET || '',
      url: 'https://tsapi.每次.com'
    },
    // 生产环境
    production: {
      appKey: process.env.DADA_PROD_APP_KEY || '',
      appSecret: process.env.DADA_PROD_APP_SECRET || '',
      url: 'https://api.imdada.cn'
    }
  },

  // 顺丰同城配置
  shunfeng: {
    enabled: true,
    // 测试环境
    test: {
      appId: process.env.SHUNFENG_TEST_APP_ID || '',
      appKey: process.env.SHUNFENG_TEST_APP_KEY || '',
      secret: process.env.SHUNFENG_TEST_SECRET || '',
      url: 'https://test-sd.itdo.com'
    },
    // 生产环境
    production: {
      appId: process.env.SHUNFENG_PROD_APP_ID || '',
      appKey: process.env.SHUNFENG_PROD_APP_KEY || '',
      secret: process.env.SHUNFENG_PROD_SECRET || '',
      url: 'https://sd.itdo.com'
    }
  },

  // 聚合配送配置
  aggregator: {
    // 默认选择策略: 'lowest_price'(最低价), 'fastest'(最快), 'recommended'(推荐)
    defaultStrategy: 'recommended',
    // 失败重试次数
    retryTimes: 2,
    // 超时时间(ms)
    timeout: 10000
  },

  // 回调配置
  callbacks: {
    // 回调URL（需要公网可访问）
    baseUrl: process.env.CALLBACK_BASE_URL || 'http://your-domain.com:3001',
    // 回调验证Token
    token: process.env.CALLBACK_TOKEN || 'your-secret-token'
  }
};
