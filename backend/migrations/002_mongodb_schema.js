/**
 * NoSQL (MongoDB) 数据库模型设计
 * 适合灵活的数据结构和快速迭代
 * 
 * 使用 mongoose 作为 ODM
 */

const mongoose = require('mongoose');

// ============================================
// 枚举常量
// ============================================

const ITEM_TYPES = ['dry_cleaning', 'recycle', 'rental'];
const OWNER_TYPES = ['user', 'store', 'brand', 'recycle_shop'];
const ORDER_TYPES = ['cleaning', 'recycle', 'rental', 'deposit'];
const USER_ROLES = ['customer', 'store_staff', 'store_owner', 'recycler', 'appraiser', 'brand_admin', 'admin'];
const ORDER_STATUSES = ['pending', 'paid', 'delivering', 'delivering_back', 'received', 'processing', 'ready', 'in_progress', 'completed', 'cancelled', 'refunded', 'awaiting_pickup_scan', 'awaiting_store_outbound'];
const PAYMENT_METHODS = ['wechat', 'alipay', 'unionpay', 'balance'];

// ============================================
// 用户模型
// ============================================

const userSchema = new mongoose.Schema({
  // 基础信息
  phone: { type: String, required: true, unique: true, index: true },
  openId: { type: String, sparse: true, index: true },
  unionId: String,
  email: String,
  password: String,
  
  // 角色（支持多角色）
  roles: { 
    type: [String], 
    enum: USER_ROLES, 
    default: ['customer'] 
  },
  
  // 个人资料
  profile: {
    name: String,
    avatar: String,
    gender: { type: String, enum: ['male', 'female', 'unknown'] },
    birthday: Date
  },
  
  // 地址管理
  addresses: [{
    _id: mongoose.Schema.Types.ObjectId,
    name: String,
    phone: String,
    province: String,
    city: String,
    district: String,
    address: String,
    latitude: Number,
    longitude: Number,
    tag: { type: String, enum: ['home', 'work', 'other'], default: 'other' },
    isDefault: { type: Boolean, default: false }
  }],
  
  // 会员体系
  member: {
    level: { type: String, enum: ['normal', 'silver', 'gold', 'platinum'], default: 'normal' },
    points: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    memberSince: Date
  },
  
  // 信用体系（V1就埋下）
  credit: {
    fulfillmentScore: { type: Number, default: 100, min: 0, max: 100 },
    completedOrders: { type: Number, default: 0 },
    cancelledOrders: { type: Number, default: 0 },
    lateReturns: { type: Number, default: 0 },
    complaints: { type: Number, default: 0 },
    depositBalance: { type: Number, default: 0 },
    creditLimit: { type: Number, default: 0 },
    blacklisted: { type: Boolean, default: false },
    blackReason: String,
    blackAt: Date
  },
  
  // 资产
  assets: {
    itemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }],
    totalValue: { type: Number, default: 0 }
  },
  
  // 余额
  balance: {
    available: { type: Number, default: 0 },
    frozen: { type: Number, default: 0 }
  },
  
  // 关联门店
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
  
  // 状态
  status: { type: String, enum: ['active', 'inactive', 'banned'], default: 'active' },
  lastLoginAt: Date
}, { timestamps: true });

userSchema.index({ roles: 1 });

// ============================================
// 门店模型
// ============================================

const storeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, unique: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  staffIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  business: {
    licenseNo: String,
    contactPhone: String,
    description: String
  },
  
  location: {
    province: String,
    city: String,
    district: String,
    address: String,
    latitude: Number,
    longitude: Number
  },
  
  hours: {
    monday: { open: String, close: String },
    tuesday: { open: String, close: String },
    wednesday: { open: String, close: String },
    thursday: { open: String, close: String },
    friday: { open: String, close: String },
    saturday: { open: String, close: String },
    sunday: { open: String, close: String },
    holidays: String
  },
  
  services: [{
    id: String,
    name: String,
    price: Number,
    enabled: { type: Boolean, default: true }
  }],
  
  delivery: {
    enabled: { type: Boolean, default: false },
    freeThreshold: Number,
    fee: Number,
    providers: [String]
  },
  
  stats: {
    totalOrders: { type: Number, default: 0 },
    monthlyOrders: { type: Number, default: 0 },
    rating: { type: Number, default: 5.0 },
    ratingCount: { type: Number, default: 0 }
  },
  
  settlement: {
    balance: { type: Number, default: 0 },
    frozenBalance: { type: Number, default: 0 },
    pendingSettlement: { type: Number, default: 0 }
  },
  
  status: { 
    type: String, 
    enum: ['pending', 'active', 'suspended', 'closed'], 
    default: 'pending' 
  }
}, { timestamps: true });

storeSchema.index({ ownerId: 1 });
storeSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
storeSchema.index({ status: 1 });

// ============================================
// 物品/商品模型（多态）
// ============================================

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true, maxLength: 100 },
  description: String,
  
  // 多态标识
  itemType: { 
    type: String, 
    enum: ITEM_TYPES, 
    required: true, 
    index: true 
  },
  ownerType: { 
    type: String, 
    enum: OWNER_TYPES, 
    required: true 
  },
  ownerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true, 
    index: true 
  },
  
  // 物品属性
  attributes: {
    brand: String,
    category: String,
    material: String,
    color: String,
    size: String,
    retailPrice: Number,
    originalCost: Number,
    weight: Number,
    condition: { 
      type: String, 
      enum: ['new', 'like_new', 'good', 'fair', 'poor'] 
    },
    images: [String],
    tags: [String]
  },
  
  // 状态机
  status: { 
    type: String, 
    enum: ['pending', 'in_progress', 'ready', 'delivering', 'delivered', 'cancelled'],
    default: 'pending',
    index: true
  },
  statusHistory: [{
    status: String,
    time: Date,
    actorId: mongoose.Schema.Types.ObjectId,
    actorType: String,
    note: String
  }],
  
  // 业务特定字段（按 itemType 启用）
  cleaning: {
    serviceType: { type: String, enum: ['dry_clean', 'wet_clean', 'iron_only'] },
    stains: [String],
    specialReq: String,
    estimatedDays: Number
  },
  
  recycle: {
    estimatedPrice: Number,
    finalPrice: Number,
    weight: Number,
    category: String,
    recyclable: Boolean,
    certified: Boolean,
    certificationNo: String
  },
  
  rental: {
    deposit: Number,
    dailyRate: Number,
    weeklyRate: Number,
    monthlyRate: Number,
    minRentalDays: { type: Number, default: 1 },
    availableFrom: Date,
    availableTo: Date,
    brandId: mongoose.Schema.Types.ObjectId,
    brandName: String,
    authenticity: Boolean
  },
  
  createdBy: mongoose.Schema.Types.ObjectId
}, { timestamps: true });

// 复合索引
itemSchema.index({ itemType: 1, ownerId: 1 });
itemSchema.index({ itemType: 1, status: 1 });

// ============================================
// 订单模型（多态）
// ============================================

const orderSchema = new mongoose.Schema({
  orderNo: { type: String, required: true, unique: true },
  
  // 多态标识
  orderType: { 
    type: String, 
    enum: ORDER_TYPES, 
    required: true, 
    index: true 
  },
  
  // 关联
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
  recyclerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deliveryOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryOrder' },
  
  // 物品列表
  items: [{
    itemId: mongoose.Schema.Types.ObjectId,
    name: { type: String, required: true },
    itemType: { type: String, enum: ITEM_TYPES },
    
    // 通用字段
    price: Number,
    quantity: { type: Number, default: 1 },
    subtotal: Number,
    
    // 干洗
    serviceType: String,
    specialReq: String,
    pickupCode: String,
    
    // 回收
    offeredPrice: Number,
    finalPrice: Number,
    weight: Number,
    
    // 租赁
    dailyRate: Number,
    rentalDays: Number,
    deposit: Number
  }],
  
  // 金额明细
  amounts: {
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    couponId: mongoose.Schema.Types.ObjectId,
    deliveryFee: { type: Number, default: 0 },
    deposit: { type: Number, default: 0 },
    serviceFee: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  
  // 收货信息
  delivery: {
    type: { type: String, enum: ['none', 'pickup', 'delivery'], default: 'pickup' },
    courierType: { type: String, enum: ['solo', 'shared'] },
    provider: String,
    pickupAddress: {
      contactName: String,
      contactPhone: String,
      address: String,
      latitude: Number,
      longitude: Number
    },
    deliveryAddress: {
      contactName: String,
      contactPhone: String,
      address: String,
      latitude: Number,
      longitude: Number
    },
    estimatedTime: Number,
    actualTime: Date
  },
  
  // 支付信息
  payment: {
    status: { type: String, enum: ['pending', 'paid', 'refunding', 'refunded'], default: 'pending' },
    method: { type: String, enum: PAYMENT_METHODS },
    transactionId: String,
    paidAt: Date,
    splits: [{
      type: String,
      accountId: String,
      accountName: String,
      amount: Number,
      settled: { type: Boolean, default: false },
      settledAt: Date
    }]
  },
  
  // 状态机
  status: { 
    type: String, 
    enum: ORDER_STATUSES, 
    default: 'pending',
    index: true
  },
  
  // 配送方式：courier=跑腿配送, store_pickup=到店自提
  deliveryMethod: { 
    type: String, 
    enum: ['courier', 'store_pickup'],
    default: 'store_pickup'
  },
  
  // 配送费支付状态
  deliveryFeePaid: { type: Boolean, default: false },
  deliveryFeePaidAt: Date,
  
  // 配送费
  deliveryFee: { type: Number, default: 0 },
  
  // 跑腿配送信息
  courier: {
    provider: String,           // 服务商：meituan/sf/jd/taobao
    fee: Number,                // 配送费
    paidAt: Date,               // 支付时间
    status: String              // pending/picking/delivering/delivered
  },
  
  // 已选择的服务商（用于前端显示）
  selectedProvider: String,
  statusHistory: [{
    status: String,
    time: Date,
    actorId: mongoose.Schema.Types.ObjectId,
    actorType: String,
    note: String
  }],
  
  // 业务特定
  cleaning: {
    returnDate: Date,
    storeReceivedAt: Date,
    storeCompletedAt: Date,
    qualityCheckPassed: Boolean
  },
  
  recycle: {
    assessorId: mongoose.Schema.Types.ObjectId,
    assessedAt: Date,
    userConfirmed: Boolean,
    userConfirmedAt: Date,
    collectedAt: Date,
    settlementStatus: String
  },
  
  rental: {
    startDate: Date,
    dueDate: Date,
    actualReturnDate: Date,
    overdueDays: Number,
    overdueFee: Number,
    depositStatus: { type: String, enum: ['held', 'refunded', 'forfeited'] },
    damagePenalty: Number
  },
  
  remark: String,
  createdFrom: { type: String, enum: ['app', 'wechat', 'web', 'admin'], default: 'app' }
}, { timestamps: true });

// 索引
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ storeId: 1, createdAt: -1 });
orderSchema.index({ orderType: 1, status: 1 });
orderSchema.index({ 'payment.status': 1 });

// 生成订单号
orderSchema.pre('save', function(next) {
  if (!this.orderNo) {
    const date = new Date();
    const prefix = 'ORD' + date.getFullYear() + String(date.getMonth() + 1).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
    this.orderNo = prefix + random;
  }
  next();
});

// ============================================
// 配送单模型
// ============================================

const deliveryOrderSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  type: { type: String, enum: ['none', 'pickup', 'delivery'], required: true },
  courierType: { type: String, enum: ['solo', 'shared'] },
  provider: { type: String, required: true },
  providerOrderId: String,
  
  pickupAddress: {
    contactName: String,
    contactPhone: String,
    address: String,
    latitude: Number,
    longitude: Number
  },
  deliveryAddress: {
    contactName: String,
    contactPhone: String,
    address: String,
    latitude: Number,
    longitude: Number
  },
  
  fee: { type: Number, default: 0 },
  distance: Number,
  
  courier: {
    name: String,
    phone: String,
    avatar: String,
    latitude: Number,
    longitude: Number,
    estimatedArrival: Number
  },
  
  status: { 
    type: String, 
    enum: ['pending', 'assigned', 'picking', 'delivering', 'delivered', 'cancelled', 'failed'],
    default: 'pending',
    index: true
  },
  
  track: [{
    status: String,
    time: Date,
    latitude: Number,
    longitude: Number,
    description: String
  }],
  
  deliveredAt: Date
}, { timestamps: true });

deliveryOrderSchema.index({ provider: 1, status: 1 });

// ============================================
// 消息模板模型
// ============================================

const messageTemplateSchema = new mongoose.Schema({
  type: { type: String, required: true },
  event: { type: String, required: true },
  content: {
    title: String,
    body: String,
    data: mongoose.Schema.Types.Mixed
  },
  channels: [String],
  enabled: { type: Boolean, default: true }
}, { timestamps: true });

messageTemplateSchema.index({ type: 1, event: 1 }, { unique: true });

// ============================================
// 信用记录模型
// ============================================

const creditRecordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  behavior: { type: String, required: true },
  scoreChange: { type: Number, required: true },
  oldScore: Number,
  newScore: Number,
  context: mongoose.Schema.Types.Mixed
}, { timestamps: true });

creditRecordSchema.index({ userId: 1, createdAt: -1 });

// ============================================
// 导出模型
// ============================================

const User = mongoose.model('User', userSchema);
const Store = mongoose.model('Store', storeSchema);
const Item = mongoose.model('Item', itemSchema);
const Order = mongoose.model('Order', orderSchema);
const DeliveryOrder = mongoose.model('DeliveryOrder', deliveryOrderSchema);
const MessageTemplate = mongoose.model('MessageTemplate', messageTemplateSchema);
const CreditRecord = mongoose.model('CreditRecord', creditRecordSchema);

module.exports = {
  User,
  Store,
  Item,
  Order,
  DeliveryOrder,
  MessageTemplate,
  CreditRecord
};
