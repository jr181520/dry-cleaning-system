/**
 * 租赁商品模型
 * 支持全品类租物：服饰、数码、户外、电子、母婴、轻奢等
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// 租赁品类枚举
const RENTAL_CATEGORIES = [
  'clothing',      // 服饰（礼服、汉服、演出服等）
  'digital',       // 数码（相机、无人机、游戏机等）
  'outdoor',       // 户外（露营装备、滑雪装备等）
  'electronics',   // 电子（投影仪、音响等）
  'baby',          // 母婴（婴儿车、安全座椅等）
  'luxury',        // 轻奢（名牌包、手表等）
  'sports',        // 运动（健身器材、球类等）
  'tools',         // 工具（电钻、清洁设备等）
  'other'          // 其他
];

// 押金模式
const DEPOSIT_MODES = [
  'deposit',       // 纯押金模式
  'credit_free',   // 信用免押模式
  'both'           // 商家自选（用户可选押金或免押）
];

// 商品状态
const ITEM_STATUS = [
  'on_sale',       // 上架中
  'off_sale',      // 已下架
  'out_of_stock'   // 库存不足
];

const rentalItemSchema = new Schema({
  // 所属门店
  storeId: { 
    type: String, 
    required: true, 
    index: true 
  },
  
  // 基本信息
  name: { 
    type: String, 
    required: true, 
    trim: true, 
    maxlength: 100 
  },
  category: { 
    type: String, 
    required: true, 
    enum: RENTAL_CATEGORIES,
    index: true 
  },
  subCategory: { 
    type: String, 
    trim: true, 
    maxlength: 50 
  },
  description: { 
    type: String, 
    maxlength: 2000 
  },
  
  // 图片（最多9张）
  images: [{ 
    type: String 
  }],
  
  // 定价
  dailyRate: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  depositMode: { 
    type: String, 
    required: true, 
    enum: DEPOSIT_MODES, 
    default: 'deposit' 
  },
  depositAmount: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  creditThreshold: { 
    type: Number, 
    min: 0, 
    max: 1000,
    default: 600 
  },
  
  // 库存
  availableStock: { 
    type: Number, 
    required: true, 
    min: 0, 
    default: 1 
  },
  totalStock: { 
    type: Number, 
    required: true, 
    min: 1, 
    default: 1 
  },
  
  // 租期设置
  rentalPeriodMin: { 
    type: Number, 
    required: true, 
    min: 1, 
    default: 1 
  },
  rentalPeriodMax: { 
    type: Number, 
    required: true, 
    min: 1, 
    default: 30 
  },
  overdueRatePerDay: { 
    type: Number, 
    min: 0,
    default: 0 
  },
  
  // 规格属性
  size: { type: String, trim: true, maxlength: 20 },
  brand: { type: String, trim: true, maxlength: 50 },
  color: { type: String, trim: true, maxlength: 30 },
  material: { type: String, trim: true, maxlength: 50 },
  
  // 状态
  status: { 
    type: String, 
    enum: ITEM_STATUS, 
    default: 'on_sale',
    index: true 
  },
  
  // 标签
  tags: [{ 
    type: String, 
    trim: true 
  }],
  
  // 排序
  sortWeight: { 
    type: Number, 
    default: 0 
  },
  
  // 销量统计
  totalRented: { 
    type: Number, 
    default: 0 
  },
  
  // 元数据
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true,
  collection: 'rental_items'
});

// 索引
rentalItemSchema.index({ storeId: 1, status: 1 });
rentalItemSchema.index({ category: 1, status: 1 });
rentalItemSchema.index({ name: 'text', description: 'text' });

// 虚拟字段：计算总费用
rentalItemSchema.virtual('totalRentalCost').get(function() {
  return this.dailyRate * (this.rentalPeriodMin || 1);
});

// 预保存钩子：更新库存状态
rentalItemSchema.pre('save', function(next) {
  if (this.availableStock <= 0 && this.status === 'on_sale') {
    this.status = 'out_of_stock';
  } else if (this.availableStock > 0 && this.status === 'out_of_stock') {
    this.status = 'on_sale';
  }
  next();
});

const RentalItem = mongoose.model('RentalItem', rentalItemSchema);

module.exports = {
  RentalItem,
  RENTAL_CATEGORIES,
  DEPOSIT_MODES,
  ITEM_STATUS
};
