/**
 * 租赁订单模型
 * 支持双程跑腿：门店→用户（第一程）→ 用户→门店（第二程归还）
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// 订单状态枚举
const RENTAL_ORDER_STATUS = [
  'reserved',          // 已预约（待支付）
  'paid',              // 已支付（待发货）
  'shipped',           // 已发货（第一程配送中）
  'using',             // 使用中
  'due',               // 到期提醒
  'overdue',           // 已逾期
  'returning',         // 归还中（第二程配送）
  'returned',          // 已归还（待质检）
  'completed',         // 已完成
  'cancelled'          // 已取消
];

const rentalOrderSchema = new Schema({
  // 订单号
  orderNo: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  orderType: { 
    type: String, 
    default: 'rental',
    enum: ['rental']
  },
  
  // 关联
  userId: { 
    type: String, 
    required: true, 
    index: true 
  },
  storeId: { 
    type: String, 
    required: true, 
    index: true 
  },
  
  // 租赁商品列表
  items: [{
    itemId: { type: String, required: true },
    name: { type: String, required: true },
    image: { type: String },
    category: { type: String },
    dailyRate: { type: Number, required: true },
    depositMode: { type: String, required: true },
    depositAmount: { type: Number, default: 0 },
    quantity: { type: Number, default: 1, min: 1 },
    rentalDays: { type: Number, required: true },
    subtotal: { type: Number, required: true }
  }],
  
  // 金额明细
  amounts: {
    subtotal: { type: Number, default: 0 },      // 租金小计
    deposit: { type: Number, default: 0 },       // 押金
    total: { type: Number, default: 0 },         // 总计（租金+押金）
    discount: { type: Number, default: 0 },      // 优惠
    deliveryFee: { type: Number, default: 0 },   // 配送费
    overdueFee: { type: Number, default: 0 }     // 逾期费
  },
  
  // 租期
  rentalDays: { 
    type: Number, 
    required: true, 
    min: 1 
  },
  
  // 押金模式（取items中最严格的）
  depositMode: { 
    type: String, 
    enum: ['deposit', 'credit_free', 'both'],
    default: 'deposit'
  },
  depositPaid: { type: Boolean, default: false },
  depositRefunded: { type: Boolean, default: false },
  depositRecordId: { type: String },  // 关联押金记录
  
  // 订单状态
  status: { 
    type: String, 
    enum: RENTAL_ORDER_STATUS, 
    default: 'reserved',
    index: true 
  },
  
  // ========== 第一程配送（门店→用户）==========
  delivery: {
    type: { type: String, enum: ['courier', 'store_pickup'], default: 'courier' },
    address: { type: String },
    contactName: { type: String },
    contactPhone: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    courier: {
      provider: { type: String },
      name: { type: String },
      phone: { type: String },
      trackingNo: { type: String },
      status: { type: String },
      progress: { type: Number },
      eta: { type: Number }
    },
    deliveryOrderId: { type: String }  // 关联配送单ID
  },
  
  // ========== 第二程配送（用户→门店，归还）==========
  returnDelivery: {
    type: { type: String, enum: ['courier', 'store_pickup'], default: 'courier' },
    address: { type: String },
    contactName: { type: String },
    contactPhone: { type: String },
    courier: {
      provider: { type: String },
      name: { type: String },
      phone: { type: String },
      trackingNo: { type: String },
      status: { type: String }
    },
    deliveryOrderId: { type: String }
  },
  
  // ========== 时间线 ==========
  reservedAt: { type: Date },
  paidAt: { type: Date },
  shippedAt: { type: Date },
  receivedAt: { type: Date },      // 用户确认收货
  startedAt: { type: Date },       // 使用开始
  dueDate: { type: Date },         // 到期日
  returnRequestedAt: { type: Date }, // 归还请求时间
  returnedAt: { type: Date },      // 门店确认归还
  completedAt: { type: Date },
  cancelledAt: { type: Date },
  
  // ========== 逾期管理 ==========
  isOverdue: { type: Boolean, default: false },
  overdueDays: { type: Number, default: 0 },
  
  // ========== 归还质检 ==========
  damageCheck: { 
    type: String, 
    enum: ['none', 'minor', 'major', 'damaged'],
    default: 'none'
  },
  damageNote: { type: String, maxlength: 500 },
  damagePhotos: [{ type: String }],
  refundable: { type: Boolean, default: true },
  damagePenalty: { type: Number, default: 0 },
  
  // ========== 支付信息 ==========
  payment: {
    method: { type: String, enum: ['wechat', 'alipay', 'unionpay', 'balance'] },
    transactionId: { type: String },
    status: { type: String, enum: ['pending', 'paid', 'refunded', 'partial_refund'] },
    paidAt: { type: Date },
    refundedAt: { type: Date }
  },
  
  // ========== 状态历史 ==========
  statusHistory: [{
    status: { type: String },
    time: { type: Date, default: Date.now },
    note: { type: String },
    operator: { type: String }  // user/store/system
  }],
  
  // ========== 元数据 ==========
  remark: { type: String, maxlength: 200 },
  createdFrom: { 
    type: String, 
    enum: ['web', 'wechat', 'app', 'admin'],
    default: 'web'
  }
}, {
  timestamps: true,
  collection: 'rental_orders'
});

// 索引
rentalOrderSchema.index({ userId: 1, status: 1 });
rentalOrderSchema.index({ storeId: 1, status: 1 });
rentalOrderSchema.index({ dueDate: 1, status: 1 }); // 逾期扫描

// 虚拟字段
rentalOrderSchema.virtual('isUsing').get(function() {
  return this.status === 'using' || this.status === 'due';
});

rentalOrderSchema.virtual('daysRemaining').get(function() {
  if (!this.dueDate || !this.isUsing) return null;
  const now = new Date();
  const due = new Date(this.dueDate);
  const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
});

// 方法：添加状态历史
rentalOrderSchema.methods.addStatusHistory = function(status, note, operator) {
  this.statusHistory.push({
    status,
    time: new Date(),
    note: note || '',
    operator: operator || 'system'
  });
};

// 静态方法：查找逾期订单
rentalOrderSchema.statics.findOverdueOrders = function() {
  return this.find({
    status: { $in: ['using', 'due'] },
    dueDate: { $lt: new Date() }
  });
};

const RentalOrder = mongoose.model('RentalOrder', rentalOrderSchema);

module.exports = {
  RentalOrder,
  RENTAL_ORDER_STATUS
};
