/**
 * 模块开关配置
 * 控制各业务模块的启用/禁用
 * 
 * 多品类双向配送架构：
 *   服务类：取件(用户→门店) → 服务处理 → 送回(门店→用户)
 *   租赁类：发货(门店→用户) → 使用中 → 归还(用户→门店)
 *   回收类：上门(门店→用户) → 估价 → 回收(用户→门店)
 */

module.exports = {
  // 当前版本配置
  VERSION: '2.0.0',
  
  // 模块配置
  modules: {
    // ========== 已启用的核心服务 ==========
    cleaning: {
      enabled: true,
      version: '1.0.0',
      name: '衣物干洗',
      nameEn: 'Dry Cleaning',
      category: 'service',
      icon: '👔',
      message: null
    },
    
    // ========== V2 服务品类（可启用） ==========
    shoe_care: {
      enabled: true,
      version: '2.0.0',
      name: '鞋类洗护',
      nameEn: 'Shoe Care',
      category: 'service',
      icon: '👟',
      message: null
    },
    luxury_care: {
      enabled: true,
      version: '2.0.0',
      name: '奢侈品护理',
      nameEn: 'Luxury Care',
      category: 'service',
      icon: '👜',
      message: null
    },
    pet_grooming: {
      enabled: true,
      version: '2.0.0',
      name: '宠物清洗',
      nameEn: 'Pet Grooming',
      category: 'service',
      icon: '🐕',
      message: null
    },
    electronics_repair: {
      enabled: true,
      version: '2.0.0',
      name: '电子产品维修',
      nameEn: 'Electronics Repair',
      category: 'service',
      icon: '📱',
      message: null
    },
    
    // ========== V3 租赁品类（可启用） ==========
    rental: {
      enabled: true,
      version: '2.0.0',
      name: '服饰租赁',
      nameEn: 'Fashion Rental',
      category: 'rental',
      icon: '👘',
      message: null
    },
    rental_leisure: {
      enabled: true,
      version: '2.0.0',
      name: '小件商品租赁',
      nameEn: 'Leisure Rental',
      category: 'rental',
      icon: '🎮',
      message: null
    },
    
    // ========== V2 回收品类（预留） ==========
    recycle: {
      enabled: false,
      version: null,
      name: '旧衣回收',
      nameEn: 'Clothing Recycling',
      category: 'recycle',
      icon: '♻',
      message: '即将上线，敬请期待',
      launchDate: '2026-Q3'
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
      'order.created', 'order.paid', 'order.processing',
      'order.completed', 'order.picked_up'
    ],
    shoe_care: [
      'order.created', 'order.paid', 'order.processing',
      'order.completed', 'order.picked_up'
    ],
    luxury_care: [
      'order.created', 'order.paid', 'order.processing',
      'order.completed', 'order.picked_up'
    ],
    pet_grooming: [
      'order.created', 'order.paid', 'order.processing',
      'order.completed', 'order.picked_up'
    ],
    electronics_repair: [
      'order.created', 'order.paid', 'order.received',
      'order.diagnosing', 'order.repairing', 'order.completed', 'order.picked_up'
    ],
    recycle: [
      'recycle.submitted', 'recycle.assessed', 'recycle.confirmed',
      'recycle.collected', 'recycle.settled'
    ],
    rental: [
      'rental.reserved', 'rental.shipped', 'rental.started',
      'rental.reminder', 'rental.due', 'rental.overdue',
      'rental.returning', 'rental.returned'
    ],
    rental_leisure: [
      'rental.reserved', 'rental.shipped', 'rental.started',
      'rental.reminder', 'rental.due', 'rental.overdue',
      'rental.returning', 'rental.returned'
    ]
  }
};
