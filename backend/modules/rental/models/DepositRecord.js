/**
 * 押金/信用免押记录模型
 * 支持三种模式：纯押金、信用免押、商家自选
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// 押金模式
const DEPOSIT_MODE = ['deposit', 'credit_free', 'both'];

// 押金状态
const DEPOSIT_STATUS = [
  'pending',    // 待支付
  'paid',       // 已支付（押金已收）
  'frozen',     // 已冻结（信用免押）
  'refunded',   // 已退还
  'deducted',   // 已扣除（物品损坏）
  'partial_refund' // 部分退还
];

const depositRecordSchema = new Schema({
  // 关联
  userId: { 
    type: String, 
    required: true, 
    index: true 
  },
  orderNo: { 
    type: String, 
    required: true, 
    index: true 
  },
  storeId: { 
    type: String, 
    required: true, 
    index: true 
  },
  
  // 押金模式
  mode: { 
    type: String, 
    required: true, 
    enum: DEPOSIT_MODE 
  },
  
  // 金额
  depositAmount: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  frozenAmount: { 
    type: Number, 
    default: 0 
  },
  refundedAmount: { 
    type: Number, 
    default: 0 
  },
  deductedAmount: { 
    type: Number, 
    default: 0 
  },
  
  // 状态
  status: { 
    type: String, 
    enum: DEPOSIT_STATUS, 
    default: 'pending',
    index: true 
  },
  
  // 支付信息
  paymentMethod: { 
    type: String, 
    enum: ['wechat', 'alipay', 'unionpay', 'balance'] 
  },
  paymentTransactionId: { type: String },
  paidAt: { type: Date },
  
  // 退款信息
  refundTransactionId: { type: String },
  refundedAt: { type: Date },
  refundReason: { type: String },
  
  // 信用评估（信用免押模式）
  creditScore: { 
    type: Number, 
    min: 0, 
    max: 1000 
  },
  creditLevel: { 
    type: String, 
    enum: ['excellent', 'good', 'normal', 'poor'] 
  },
  creditThreshold: { 
    type: Number 
  },
  creditCheckAt: { type: Date },
  
  // 微信支付分（如果对接）
  wechatCreditOrder: {
    orderId: { type: String },
    state: { type: String },
    stateDescription: { type: String }
  },
  
  // 扣除原因
  deductReason: { type: String },
  deductProof: [{ type: String }], // 照片证据
  
  // 元数据
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'deposit_records'
});

// 索引
depositRecordSchema.index({ userId: 1, status: 1 });
depositRecordSchema.index({ orderNo: 1 });

// 静态方法：检查用户信用资格
depositRecordSchema.statics.checkCreditEligibility = async function(userId, threshold) {
  const stats = await this.aggregate([
    {
      $match: {
        userId,
        status: { $in: ['refunded', 'deducted'] }
      }
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        deductedCount: {
          $sum: { $cond: [{ $eq: ['$status', 'deducted'] }, 1, 0] }
        },
        avgDeposit: { $avg: '$depositAmount' }
      }
    }
  ]);
  
  if (stats.length === 0) {
    // 新用户，默认信用良好
    return {
      eligible: threshold <= 600,
      score: 600,
      level: 'normal',
      reason: '新用户默认信用分600'
    };
  }
  
  const { totalOrders, deductedCount } = stats[0];
  
  // 计算信用分（简化算法）
  let score = 600;
  score += Math.min(totalOrders * 10, 100); // 订单数加分
  score -= deductedCount * 50; // 扣除扣分
  
  const level = score >= 800 ? 'excellent' : 
                score >= 700 ? 'good' : 
                score >= 600 ? 'normal' : 'poor';
  
  return {
    eligible: score >= threshold,
    score,
    level,
    totalOrders,
    deductedCount,
    reason: `信用分${score}，${score >= threshold ? '符合' : '不符合'}免押条件`
  };
};

// 静态方法：创建押金记录
depositRecordSchema.statics.createDeposit = async function(data) {
  const record = new this(data);
  await record.save();
  return record;
};

// 方法：退还押金
depositRecordSchema.methods.refund = async function(amount, reason) {
  if (this.status === 'refunded') {
    throw new Error('押金已退还');
  }
  
  this.refundedAmount = amount || this.depositAmount;
  this.refundedAt = new Date();
  this.refundReason = reason || '正常归还退还';
  this.status = this.refundedAmount < this.depositAmount ? 'partial_refund' : 'refunded';
  
  await this.save();
  return this;
};

// 方法：扣除押金
depositRecordSchema.methods.deduct = async function(amount, reason, proof) {
  if (this.status === 'deducted') {
    throw new Error('押金已扣除');
  }
  
  this.deductedAmount = amount || this.depositAmount;
  this.deductReason = reason || '物品损坏扣款';
  this.deductProof = proof || [];
  this.status = 'deducted';
  
  await this.save();
  return this;
};

const DepositRecord = mongoose.model('DepositRecord', depositRecordSchema);

module.exports = {
  DepositRecord,
  DEPOSIT_MODE,
  DEPOSIT_STATUS
};
