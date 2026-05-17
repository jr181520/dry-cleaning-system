/**
 * 订单-灯条绑定记录
 * 记录用户取件时灯条的点亮状态
 */

const mongoose = require('mongoose');

const lightBindingSchema = new mongoose.Schema({
  // 订单ID
  orderId: {
    type: String,
    required: true,
    index: true
  },
  
  // 门店ID
  storeId: {
    type: String,
    required: true,
    index: true
  },
  
  // 灯条ID
  lightId: {
    type: String,
    default: 'ALL' // 默认全部灯条
  },
  
  // 物品索引（支持一个订单绑定多个灯条，每个物品一个）
  itemIndex: {
    type: Number,
    default: null,
    index: true
  },
  
  // 灯条状态: active-激活, completed-已完成, cancelled-已取消
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active',
    index: true
  },
  
  // 绑定类型: pickup-取件, urgent-紧急查找, batch-批量提醒
  bindingType: {
    type: String,
    enum: ['pickup', 'urgent', 'batch'],
    default: 'pickup'
  },
  
  // 灯条颜色
  color: {
    type: String,
    default: 'green'
  },
  
  // 激活时间
  activatedAt: {
    type: Date,
    default: Date.now
  },
  
  // 完成时间
  completedAt: {
    type: Date,
    default: null
  },
  
  // 用户ID
  userId: {
    type: String,
    default: null
  },
  
  // 备注
  remark: {
    type: String,
    default: ''
  }
}, {
  timestamps: true // 自动添加 createdAt 和 updatedAt
});

// 索引优化查询
lightBindingSchema.index({ storeId: 1, status: 1 });
lightBindingSchema.index({ activatedAt: -1 });
lightBindingSchema.index({ orderId: 1, itemIndex: 1, status: 1 }); // 复合索引支持订单+物品查询

// 实例方法：完成绑定
lightBindingSchema.methods.complete = function() {
  this.status = 'completed';
  this.completedAt = new Date();
  return this.save();
};

// 实例方法：取消绑定
lightBindingSchema.methods.cancel = function() {
  this.status = 'cancelled';
  this.completedAt = new Date();
  return this.save();
};

// 静态方法：获取门店当前激活的绑定
lightBindingSchema.statics.getActiveByStore = function(storeId) {
  return this.find({ storeId, status: 'active' }).sort({ activatedAt: -1 });
};

// 静态方法：根据订单获取绑定
lightBindingSchema.statics.getByOrder = function(orderId) {
  return this.findOne({ orderId });
};

// 静态方法：根据订单和物品索引获取绑定
lightBindingSchema.statics.getByOrderAndItem = function(orderId, itemIndex) {
  return this.findOne({ orderId, itemIndex, status: 'active' });
};

// 静态方法：获取订单的所有活跃绑定
lightBindingSchema.statics.getAllActiveByOrder = function(orderId) {
  return this.find({ orderId, status: 'active' }).sort({ itemIndex: 1 });
};

module.exports = mongoose.model('LightBinding', lightBindingSchema);
