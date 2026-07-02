/**
 * 多态数据模型定义
 * 支持干洗/回收/租赁三大业务模块
 * 
 * 设计原则：
 * 1. itemType/orderType 通过枚举扩展新业务
 * 2. ownerType 支持多角色所有权
 * 3. status 使用状态机模式便于扩展
 * 4. 业务特定字段通过 JSON 字段隔离
 */

// ============================================
// 枚举定义
// ============================================

const ENUMS = {
  // 物品类型
  ITEM_TYPE: {
    DRY_CLEANING: 'dry_cleaning',   // 干洗物品
    RECYCLE: 'recycle',               // 回收物品
    RENTAL: 'rental'                  // 租赁物品
  },

  // 所有者类型
  OWNER_TYPE: {
    USER: 'user',                     // 普通用户
    STORE: 'store',                   // 门店
    BRAND: 'brand',                   // 品牌方
    RECYCLE_SHOP: 'recycle_shop'     // 回收店
  },

  // 订单类型
  ORDER_TYPE: {
    CLEANING: 'cleaning',             // 清洗订单
    RECYCLE: 'recycle',               // 回收订单
    RENTAL: 'rental',                 // 租赁订单
    DEPOSIT: 'deposit'                // 押金单
  },

  // 物品状态（通用）
  ITEM_STATUS: {
    PENDING: 'pending',               // 待处理
    IN_PROGRESS: 'in_progress',       // 处理中
    READY: 'ready',                   // 已完成/可取
    DELIVERING: 'delivering',         // 配送中
    DELIVERED: 'delivered',           // 已送达
    CANCELLED: 'cancelled'           // 已取消
  },

  // 订单状态（通用）
  ORDER_STATUS: {
    PENDING: 'pending',               // 待支付
    PAID: 'paid',                     // 已支付
    IN_PROGRESS: 'in_progress',       // 处理中
    COMPLETED: 'completed',           // 已完成
    CANCELLED: 'cancelled',           // 已取消
    REFUNDED: 'refunded'              // 已退款
  },

  // 干洗物品状态
  CLEANING_STATUS: {
    RECEIVED: 'received',             // 已收件
    WASHING: 'washing',               // 清洗中
    IRONING: 'ironing',              // 熨烫中
    QUALITY_CHECK: 'quality_check',   // 质检中
    READY: 'ready',                  // 可取件
    PICKED_UP: 'picked_up'           // 已取件
  },

  // 回收物品状态
  RECYCLE_STATUS: {
    SUBMITTED: 'submitted',           // 已提交
    ASSESSING: 'assessing',          // 估价中
    PRICE_CONFIRMED: 'price_confirmed', // 价格已确认
    COLLECTED: 'collected',          // 已回收
    SETTLED: 'settled'               // 已结算
  },

  // 租赁物品状态
  RENTAL_STATUS: {
    AVAILABLE: 'available',           // 可租
    RESERVED: 'reserved',            // 已预约
    RENTED: 'rented',                // 已出租
    RETURNED: 'returned',            // 已归还
    OVERDUE: 'overdue',              // 已逾期
    DAMAGED: 'damaged'               // 损坏
  },

  // 用户角色
  USER_ROLE: {
    CUSTOMER: 'customer',             // 普通客户
    STORE_STAFF: 'store_staff',       // 门店员工
    STORE_OWNER: 'store_owner',       // 门店老板
    RECYCLER: 'recycler',             // 回收员
    APPRAISER: 'appraiser',           // 鉴定师
    BRAND_ADMIN: 'brand_admin',       // 品牌管理员
    ADMIN: 'admin'                    // 系统管理员
  },

  // 支付状态
  PAYMENT_STATUS: {
    PENDING: 'pending',
    PAID: 'paid',
    REFUNDING: 'refunding',
    REFUNDED: 'refunded'
  },

  // 支付方式
  PAYMENT_METHOD: {
    WECHAT: 'wechat',
    ALIPAY: 'alipay',
    UNIONPAY: 'unionpay',
    BALANCE: 'balance'
  },

  // 配送类型
  DELIVERY_TYPE: {
    NONE: 'none',                     // 无需配送
    PICKUP: 'pickup',                 // 用户自取
    DELIVERY: 'delivery'              // 配送到家
  },

  // 配送方式
  COURIER_TYPE: {
    SOLO: 'solo',                     // 一对一
    SHARED: 'shared'                  // 拼单
  }
};

// ============================================
// 数据模型定义
// ============================================

/**
 * 物品/商品模型（多态）
 */
const ItemModel = {
  // 通用字段
  id: { type: 'string', required: true, unique: true },
  name: { type: 'string', required: true, maxLength: 100 },
  description: { type: 'string', maxLength: 500 },
  
  // 多态标识
  itemType: { type: 'enum', enum: ENUMS.ITEM_TYPE, required: true },
  ownerType: { type: 'enum', enum: ENUMS.OWNER_TYPE, required: true },
  ownerId: { type: 'string', required: true },
  
  // 物品属性
  attributes: {
    type: 'object',
    schema: {
      brand: { type: 'string', maxLength: 50 },      // 品牌
      category: { type: 'string', maxLength: 30 },     // 分类
      material: { type: 'string', maxLength: 50 },    // 材质
      color: { type: 'string', maxLength: 20 },       // 颜色
      size: { type: 'string', maxLength: 10 },        // 尺码
      retailPrice: { type: 'number' },                // 零售价（回收估价参考）
      originalCost: { type: 'number' },               // 原价
      weight: { type: 'number' },                    // 重量(kg)
      condition: { 
        type: 'enum', 
        enum: ['new', 'like_new', 'good', 'fair', 'poor'] 
      },  // 成色
      images: { type: 'array', items: 'string' },      // 图片URL列表
      tags: { type: 'array', items: 'string' }        // 标签
    }
  },
  
  // 状态机
  status: { type: 'enum', enum: ENUMS.ITEM_STATUS, default: 'pending' },
  statusHistory: {
    type: 'array',
    items: {
      status: 'string',
      time: 'datetime',
      actorId: 'string',
      actorType: 'string',
      note: 'string'
    }
  },
  
  // 业务特定字段（JSON，按 itemType 启用）
  cleaning: {
    type: 'object',
    schema: {
      serviceType: { type: 'enum', enum: ['dry_clean', 'wet_clean', 'iron_only'] },
      stains: { type: 'array', items: 'string' },
      specialReq: { type: 'string' },
      estimatedDays: { type: 'number' }
    }
  },
  
  recycle: {
    type: 'object',
    schema: {
      estimatedPrice: { type: 'number' },
      finalPrice: { type: 'number' },
      weight: { type: 'number' },
      category: { type: 'string' },
      recyclable: { type: 'boolean' },
      certified: { type: 'boolean' },
      certificationNo: { type: 'string' }
    }
  },
  
  rental: {
    type: 'object',
    schema: {
      deposit: { type: 'number' },
      dailyRate: { type: 'number' },
      weeklyRate: { type: 'number' },
      monthlyRate: { type: 'number' },
      minRentalDays: { type: 'number', default: 1 },
      availableFrom: { type: 'date' },
      availableTo: { type: 'date' },
      brandId: { type: 'string' },
      brandName: { type: 'string' },
      authenticity: { type: 'boolean' }  // 是否保真
    }
  },
  
  // 元数据
  createdAt: { type: 'datetime', default: 'now' },
  updatedAt: { type: 'datetime', default: 'now' },
  createdBy: { type: 'string' }
};

/**
 * 订单模型（多态）
 */
const OrderModel = {
  // 通用字段
  id: { type: 'string', required: true, unique: true },
  orderNo: { type: 'string', required: true, unique: true },  // 展示用订单号
  
  // 多态标识
  orderType: { type: 'enum', enum: ENUMS.ORDER_TYPE, required: true },
  
  // 关联
  userId: { type: 'string', required: true },
  storeId: { type: 'string' },          // 门店ID
  recyclerId: { type: 'string' },        // 回收员ID
  deliveryOrderId: { type: 'string' },   // 配送单ID
  
  // 物品列表
  items: {
    type: 'array',
    items: {
      itemId: { type: 'string' },
      name: { type: 'string', required: true },
      itemType: { type: 'enum', enum: ENUMS.ITEM_TYPE },
      
      // 通用字段
      price: { type: 'number' },
      quantity: { type: 'number', default: 1 },
      subtotal: { type: 'number' },
      
      // 业务特定字段
      // 干洗
      serviceType: { type: 'string' },
      specialReq: { type: 'string' },
      pickupCode: { type: 'string' },    // 取件码
      // 回收
      offeredPrice: { type: 'number' },   // 用户出价
      finalPrice: { type: 'number' },
      weight: { type: 'number' },
      // 租赁
      dailyRate: { type: 'number' },
      rentalDays: { type: 'number' },
      deposit: { type: 'number' }
    }
  },
  
  // 金额明细
  amounts: {
    type: 'object',
    schema: {
      subtotal: { type: 'number', default: 0 },
      discount: { type: 'number', default: 0 },
      couponId: { type: 'string' },
      deliveryFee: { type: 'number', default: 0 },
      deposit: { type: 'number', default: 0 },  // 押金
      serviceFee: { type: 'number', default: 0 },
      total: { type: 'number', default: 0 }
    }
  },
  
  // 收货信息
  delivery: {
    type: 'object',
    schema: {
      type: { type: 'enum', enum: ENUMS.DELIVERY_TYPE },
      courierType: { type: 'enum', enum: ENUMS.COURIER_TYPE },
      provider: { type: 'string' },           // 配送服务商
      pickupAddress: {
        contactName: 'string',
        contactPhone: 'string',
        address: 'string',
        latitude: 'number',
        longitude: 'number'
      },
      deliveryAddress: {
        contactName: 'string',
        contactPhone: 'string',
        address: 'string',
        latitude: 'number',
        longitude: 'number'
      },
      estimatedTime: { type: 'number' },       // 预计分钟数
      actualTime: { type: 'datetime' }
    }
  },
  
  // 支付信息
  payment: {
    type: 'object',
    schema: {
      status: { type: 'enum', enum: ENUMS.PAYMENT_STATUS },
      method: { type: 'enum', enum: ENUMS.PAYMENT_METHOD },
      transactionId: { type: 'string' },
      paidAt: { type: 'datetime' },
      // 分账记录
      splits: {
        type: 'array',
        items: {
          type: { type: 'string' },           // store/platform/brand/recycle_shop
          accountId: { type: 'string' },
          accountName: { type: 'string' },
          amount: { type: 'number' },
          settled: { type: 'boolean' },
          settledAt: { type: 'datetime' }
        }
      }
    }
  },
  
  // 状态机
  status: { type: 'enum', enum: ENUMS.ORDER_STATUS, default: 'pending' },
  statusHistory: {
    type: 'array',
    items: {
      status: 'string',
      time: 'datetime',
      actorId: 'string',
      actorType: 'string',
      note: 'string'
    }
  },
  
  // 业务特定字段
  cleaning: {
    type: 'object',
    schema: {
      returnDate: { type: 'date' },
      storeReceivedAt: { type: 'datetime' },
      storeCompletedAt: { type: 'datetime' },
      qualityCheckPassed: { type: 'boolean' }
    }
  },
  
  recycle: {
    type: 'object',
    schema: {
      assessorId: { type: 'string' },
      assessedAt: { type: 'datetime' },
      userConfirmed: { type: 'boolean' },
      userConfirmedAt: { type: 'datetime' },
      collectedAt: { type: 'datetime' },
      settlementStatus: { type: 'string' }
    }
  },
  
  rental: {
    type: 'object',
    schema: {
      startDate: { type: 'date' },
      dueDate: { type: 'date' },
      actualReturnDate: { type: 'date' },
      overdueDays: { type: 'number' },
      overdueFee: { type: 'number' },
      depositStatus: { type: 'enum', enum: ['held', 'refunded', 'forfeited'] },
      damagePenalty: { type: 'number' }
    }
  },
  
  // 备注
  remark: { type: 'string' },
  
  // 元数据
  createdAt: { type: 'datetime', default: 'now' },
  updatedAt: { type: 'datetime', default: 'now' },
  createdFrom: { type: 'string' }  // app/wechat/web/admin
};

/**
 * 用户模型（支持多角色）
 */
const UserModel = {
  // 基础信息
  id: { type: 'string', required: true, unique: true },
  openId: { type: 'string', index: true },    // 微信OpenID
  unionId: { type: 'string' },                 // 微信UnionID
  phone: { type: 'string', required: true, unique: true },
  email: { type: 'string' },
  
  // 认证信息
  auth: {
    type: 'object',
    schema: {
      password: { type: 'string' },            // 加密存储
      wechatBound: { type: 'boolean' },
      alipayBound: { type: 'boolean' }
    }
  },
  
  // 角色（支持多角色）
  roles: {
    type: 'array',
    items: { type: 'enum', enum: ENUMS.USER_ROLE },
    default: ['customer']
  },
  
  // 个人资料
  profile: {
    type: 'object',
    schema: {
      name: { type: 'string', maxLength: 50 },
      avatar: { type: 'string' },
      gender: { type: 'enum', enum: ['male', 'female', 'unknown'] },
      birthday: { type: 'date' }
    }
  },
  
  // 地址管理
  addresses: {
    type: 'array',
    items: {
      id: { type: 'string' },
      name: { type: 'string' },
      phone: { type: 'string' },
      province: { type: 'string' },
      city: { type: 'string' },
      district: { type: 'string' },
      address: { type: 'string' },
      latitude: { type: 'number' },
      longitude: { type: 'number' },
      tag: { type: 'string' },  // home/work/other
      isDefault: { type: 'boolean' }
    }
  },
  
  // 会员体系
  member: {
    type: 'object',
    schema: {
      level: { type: 'enum', enum: ['normal', 'silver', 'gold', 'platinum'] },
      points: { type: 'number', default: 0 },
      totalSpent: { type: 'number', default: 0 },
      memberSince: { type: 'date' }
    }
  },
  
  // 信用体系（V1就埋下，为未来租赁准备）
  credit: {
    type: 'object',
    schema: {
      // 履约记录
      fulfillmentScore: { type: 'number', default: 100, min: 0, max: 100 },
      completedOrders: { type: 'number', default: 0 },
      cancelledOrders: { type: 'number', default: 0 },
      lateReturns: { type: 'number', default: 0 },      // 租赁逾期次数
      complaints: { type: 'number', default: 0 },
      
      // 押金/信用额度
      depositBalance: { type: 'number', default: 0 },   // 已冻结押金
      creditLimit: { type: 'number', default: 0 },      // 信用额度
      
      // 风控
      blacklisted: { type: 'boolean', default: false },
      blackReason: { type: 'string' },
      blackAt: { type: 'datetime' }
    }
  },
  
  // 资产（用户的物品）
  assets: {
    type: 'object',
    schema: {
      itemIds: { type: 'array', items: 'string' },  // 物品ID列表
      totalValue: { type: 'number', default: 0 }
    }
  },
  
  // 账户余额
  balance: {
    type: 'object',
    schema: {
      available: { type: 'number', default: 0 },
      frozen: { type: 'number', default: 0 }
    }
  },
  
  // 偏好设置
  preferences: {
    type: 'object',
    schema: {
      notificationEnabled: { type: 'boolean', default: true },
      channels: { type: 'array', items: 'string' }  // wechat/sms/push
    }
  },
  
  // 关联门店（门店员工/老板）
  storeId: { type: 'string' },
  
  // 数据来源和层级关系
  registrationSource: { 
    type: 'enum', 
    enum: ['web_customer', 'wechat_mini', 'store_app', 'admin_system', 'unknown'],
    default: 'unknown'
  },  // 注册来源：C端网页、微信小程序、门店APP、后台系统
  sourcePlatform: { type: 'string' },  // 来源平台标识
  chainId: { type: 'string', index: true },  // 所属连锁ID（通过门店关联）
  
  // 元数据
  createdAt: { type: 'datetime', default: 'now' },
  updatedAt: { type: 'datetime', default: 'now' },
  lastLoginAt: { type: 'datetime' },
  status: { type: 'enum', enum: ['active', 'inactive', 'banned'], default: 'active' }
};

/**
 * 门店模型
 */
const StoreModel = {
  id: { type: 'string', required: true, unique: true },
  name: { type: 'string', required: true },
  code: { type: 'string', unique: true },  // 门店编码
  
  // 关联信息
  ownerId: { type: 'string', required: true },  // 老板用户ID
  staffIds: { type: 'array', items: 'string' },  // 员工用户ID列表
  
  // 基本信息
  business: {
    type: 'object',
    schema: {
      licenseNo: { type: 'string' },
      contactPhone: { type: 'string' },
      description: { type: 'string' }
    }
  },
  
  // 地址
  location: {
    type: 'object',
    schema: {
      province: { type: 'string' },
      city: { type: 'string' },
      district: { type: 'string' },
      address: { type: 'string' },
      latitude: { type: 'number' },
      longitude: { type: 'number' }
    }
  },
  
  // 营业时间
  hours: {
    type: 'object',
    schema: {
      monday: { open: '09:00', close: '21:00' },
      tuesday: { open: '09:00', close: '21:00' },
      // ...
      holidays: { type: 'string' }  // 节假日特别说明
    }
  },
  
  // 服务配置
  services: {
    type: 'array',
    items: {
      serviceId: { type: 'string' },
      name: { type: 'string' },
      price: { type: 'number' },
      enabled: { type: 'boolean' }
    }
  },
  
  // 配送配置
  delivery: {
    type: 'object',
    schema: {
      enabled: { type: 'boolean', default: false },
      freeThreshold: { type: 'number' },
      fee: { type: 'number' },
      providers: { type: 'array', items: 'string' }  // 启用的配送商
    }
  },
  
  // 运营数据
  stats: {
    type: 'object',
    schema: {
      totalOrders: { type: 'number', default: 0 },
      monthlyOrders: { type: 'number', default: 0 },
      totalUsers: { type: 'number', default: 0 },  // 累计用户数
      monthlyUsers: { type: 'number', default: 0 },  // 月度新增用户
      dailyUsers: { type: 'number', default: 0 },  // 日新增用户
      rating: { type: 'number', default: 5.0 },
      ratingCount: { type: 'number', default: 0 }
    }
  },
  
  // 财务
  settlement: {
    type: 'object',
    schema: {
      balance: { type: 'number', default: 0 },
      frozenBalance: { type: 'number', default: 0 },
      pendingSettlement: { type: 'number', default: 0 }
    }
  },
  
  // 元数据
  createdAt: { type: 'datetime', default: 'now' },
  updatedAt: { type: 'datetime', default: 'now' },
  status: { type: 'enum', enum: ['pending', 'active', 'suspended', 'closed'], default: 'pending' }
};

/**
 * 配送单模型
 */
const DeliveryOrderModel = {
  id: { type: 'string', required: true, unique: true },
  orderId: { type: 'string', required: true },  // 关联业务订单
  
  // 配送类型
  type: { type: 'enum', enum: ENUMS.DELIVERY_TYPE, required: true },
  courierType: { type: 'enum', enum: ENUMS.COURIER_TYPE },
  
  // 服务商
  provider: { type: 'string', required: true },  // meituan/dada/shunfeng
  providerOrderId: { type: 'string' },            // 服务商订单号
  
  // 地址信息
  pickupAddress: {
    type: 'object',
    schema: {
      contactName: 'string',
      contactPhone: 'string',
      address: 'string',
      latitude: 'number',
      longitude: 'number'
    }
  },
  deliveryAddress: {
    type: 'object',
    schema: {
      contactName: 'string',
      contactPhone: 'string',
      address: 'string',
      latitude: 'number',
      longitude: 'number'
    }
  },
  
  // 费用
  fee: { type: 'number' },
  distance: { type: 'number' },  // 公里
  
  // 骑手信息
  courier: {
    type: 'object',
    schema: {
      name: 'string',
      phone: 'string',
      avatar: 'string',
      latitude: 'number',
      longitude: 'number',
      estimatedArrival: 'number'  // 预计到达分钟数
    }
  },
  
  // 状态
  status: {
    type: 'enum',
    enum: ['pending', 'assigned', 'picking', 'delivering', 'delivered', 'cancelled', 'failed']
  },
  
  // 轨迹
  track: {
    type: 'array',
    items: {
      status: 'string',
      time: 'datetime',
      location: { latitude: 'number', longitude: 'number' },
      description: 'string'
    }
  },
  
  // 元数据
  createdAt: { type: 'datetime', default: 'now' },
  updatedAt: { type: 'datetime', default: 'now' },
  deliveredAt: { type: 'datetime' }
};

/**
 * 消息模板
 */
const MessageTemplateModel = {
  id: { type: 'string', required: true },
  type: { type: 'string', required: true },  // cleaning/recycle/rental/system
  event: { type: 'string', required: true }, // 事件标识
  
  content: {
    type: 'object',
    schema: {
      title: { type: 'string' },
      body: { type: 'string' },  // 支持模板变量 {name} {orderNo} 等
      data: { type: 'object' }   // 模板变量定义
    }
  },
  
  channels: { type: 'array', items: 'string' },  // wechat/sms/push
  
  enabled: { type: 'boolean', default: true },
  
  createdAt: { type: 'datetime', default: 'now' },
  updatedAt: { type: 'datetime', default: 'now' }
};

// ============================================
// 权限定义
// ============================================

const PERMISSIONS = {
  // 通用
  'user.view': ['admin'],
  'user.edit': ['admin'],
  'user.blacklist': ['admin'],
  
  // 订单
  'order.create': ['customer', 'store_staff', 'store_owner'],
  'order.view.own': ['*'],  // 所有人看自己的
  'order.view.store': ['store_staff', 'store_owner'],
  'order.view.all': ['admin'],
  'order.process': ['store_staff', 'store_owner'],
  'order.cancel': ['customer', 'admin'],
  'order.refund': ['store_owner', 'admin'],
  
  // 物品
  'item.create': ['customer', 'store_staff'],
  'item.view.own': ['*'],
  'item.assess': ['appraiser', 'admin'],
  'item.certify': ['appraiser', 'admin'],
  
  // 回收
  'recycle.view': ['customer', 'recycler', 'admin'],
  'recycle.assess': ['recycler', 'appraiser'],
  'recycle.confirm': ['recycler', 'admin'],
  
  // 租赁
  'rental.view': ['customer', 'brand_admin'],
  'rental.manage': ['brand_admin', 'admin'],
  'rental.deposit': ['customer'],
  
  // 门店
  'store.view': ['store_staff', 'store_owner', 'admin'],
  'store.manage': ['store_owner', 'admin'],
  'store.config': ['store_owner'],
  
  // 结算
  'settlement.view': ['store_owner', 'brand_admin', 'admin'],
  'settlement.withdraw': ['store_owner', 'brand_admin'],
  
  // 模块管理
  'module.manage': ['admin']
};

// ============================================
// 导出
// ============================================

module.exports = {
  ENUMS,
  PERMISSIONS,
  models: {
    Item: ItemModel,
    Order: OrderModel,
    User: UserModel,
    Store: StoreModel,
    DeliveryOrder: DeliveryOrderModel,
    MessageTemplate: MessageTemplateModel
  }
};
