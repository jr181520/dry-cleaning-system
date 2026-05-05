/**
 * 模块开关配置
 * 控制各业务模块的启用/禁用
 * 
 * 升级策略：
 * V1: cleaning = true, recycle = false, rental = false
 * V2: cleaning = true, recycle = true, rental = false
 * V3: cleaning = true, recycle = true, rental = true
 */

module.exports = {
  // 当前版本配置
  VERSION: '1.0.0',
  
  // 模块配置
  modules: {
    cleaning: {
      enabled: true,
      version: '1.0.0',
      name: '干洗服务',
      nameEn: 'Dry Cleaning Service',
      icon: 'icon-dry-clean',
      message: null  // null 表示已开放
    },
    recycle: {
      enabled: false,
      version: null,
      name: '旧衣回收',
      nameEn: 'Clothing Recycling',
      icon: 'icon-recycle',
      message: '即将上线，敬请期待',
      launchDate: '2026-Q2'  // 预计上线时间
    },
    rental: {
      enabled: false,
      version: null,
      name: '服饰租赁',
      nameEn: 'Fashion Rental',
      icon: 'icon-rental',
      message: '即将上线，敬请期待',
      launchDate: '2026-Q3'  // 预计上线时间
    }
  },
  
  // 功能开关
  features: {
    // 配送
    delivery: {
      enabled: true,
      providers: ['meituan', 'dada', 'shunfeng']
    },
    
    // 会员体系
    membership: {
      enabled: true,
      levels: ['normal', 'silver', 'gold', 'platinum']
    },
    
    // 积分
    points: {
      enabled: true,
      exchangeRate: 100  // 100积分 = 1元
    },
    
    // 优惠券
    coupon: {
      enabled: true
    },
    
    // 押金功能（为租赁准备）
    deposit: {
      enabled: false,  // V2再开启
      minDeposit: 100
    },
    
    // 信用评估（为租赁准备）
    credit: {
      enabled: true,  // V1就要记录，为租赁打基础
      minScore: 60
    }
  },
  
  // 支付配置
  payment: {
    // 分账接收方
    receivers: {
      platform: {
        id: 'PLATFORM',
        name: '平台',
        ratio: 0.06  // 平台抽成6%
      },
      store: {
        ratio: 0.94  // 门店94%
      }
    },
    
    // 回收分账（V2）
    recycle: {
      user: 0.90,      // 用户90%
      platform: 0.10  // 平台10%
    },
    
    // 租赁分账（V3）
    rental: {
      owner: 0.70,     // 物品所有者70%
      brand: 0.15,    // 品牌方15%
      platform: 0.15  // 平台15%
    }
  },
  
  // 消息模板
  notifications: {
    cleaning: [
      'order.created',
      'order.paid',
      'order.processing',
      'order.completed',
      'order.picked_up'
    ],
    recycle: [
      'recycle.submitted',
      'recycle.assessed',
      'recycle.confirmed',
      'recycle.collected',
      'recycle.settled'
    ],
    rental: [
      'rental.reserved',
      'rental.started',
      'rental.reminder',
      'rental.due',
      'rental.overdue',
      'rental.returned'
    ]
  }
};
