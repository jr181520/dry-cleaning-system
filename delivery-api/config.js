/**
 * 聚合配送系统 - 配置文件 v2
 * 统一管理四家配送服务商的API配置（美团/京东/淘宝/顺丰）
 * 
 * 注意：delivery-api 为独立服务，而主后端 backend/ 通过
 *       backend/services/deliveryProviders/ 直接调用服务商API。
 *       本配置用于 delivery-api 独立运行场景（如作为微服务部署）。
 */

module.exports = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3001
  },

  // 美团跑腿配送
  meituan: {
    enabled: true,
    test: {
      appId: process.env.MEITUAN_TEST_APP_ID || '',
      secret: process.env.MEITUAN_TEST_SECRET || '',
      url: 'https://peisongopen-sandbox.dianping.com'
    },
    production: {
      appId: process.env.MEITUAN_PROD_APP_ID || process.env.MEITUAN_APP_ID || '',
      secret: process.env.MEITUAN_PROD_SECRET || process.env.MEITUAN_APP_SECRET || '',
      url: 'https://peisongopen.meituan.com'
    }
  },

  // 京东秒送（达达开放平台）
  jingdong: {
    enabled: true,
    test: {
      appKey: process.env.DADA_TEST_APP_KEY || '',
      appSecret: process.env.DADA_TEST_APP_SECRET || '',
      url: 'https://tsapi.imdada.cn'
    },
    production: {
      appKey: process.env.DADA_PROD_APP_KEY || process.env.DADA_APP_KEY || '',
      appSecret: process.env.DADA_PROD_APP_SECRET || process.env.DADA_APP_SECRET || '',
      sourceId: process.env.DADA_SOURCE_ID || '',
      url: 'https://newopen.imdada.cn'
    }
  },

  // 淘宝闪送（蜂鸟即配）
  taobao: {
    enabled: true,
    test: {
      appId: process.env.TAOBAO_FENGNIAO_TEST_APP_ID || '',
      secret: process.env.TAOBAO_FENGNIAO_TEST_SECRET || '',
      url: 'https://open-sandbox.ele.me'
    },
    production: {
      appId: process.env.TAOBAO_FENGNIAO_APP_ID || '',
      secret: process.env.TAOBAO_FENGNIAO_SECRET || '',
      merchantId: process.env.TAOBAO_MERCHANT_ID || '',
      url: 'https://open-anmp.ele.me'
    }
  },

  // 顺丰同城
  shunfeng: {
    enabled: true,
    test: {
      appId: process.env.SF_TEST_APP_ID || '',
      appKey: process.env.SF_TEST_APP_KEY || '',
      secret: process.env.SF_TEST_SECRET || '',
      url: 'https://open-sandbox.sfsy.com'
    },
    production: {
      appId: process.env.SF_APP_ID || '',
      partnerId: process.env.SF_PARTNER_ID || '',
      checkWord: process.env.SF_CHECK_WORD || '',
      url: 'https://open.sf-express.com'
    }
  },

  // 聚合配送策略
  aggregator: {
    defaultStrategy: 'recommended',   // 'lowest_price' | 'fastest' | 'recommended'
    retryTimes: 2,
    timeout: 10000
  },

  // 服务商回调配置（需公网可访问）
  callbacks: {
    baseUrl: process.env.CALLBACK_BASE_URL || 'http://your-domain.com:3000',
    token: process.env.CALLBACK_TOKEN || 'your-secret-token'
  }
};
