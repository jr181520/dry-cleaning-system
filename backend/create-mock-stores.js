/**
 * 批量创建模拟门店
 */

const mongoose = require('mongoose');

// 定义Store Schema
const storeSchema = new mongoose.Schema({
  storeNo: { type: String, unique: true, index: true },
  name: { type: String, required: true },
  address: { type: String, required: true },
  city: String,
  district: String,
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }
  },
  phone: { type: String, required: true },
  businessHours: {
    open: { type: String, default: '09:00' },
    close: { type: String, default: '21:00' },
    holidays: [String]
  },
  services: [{
    serviceId: String,
    name: String,
    basePrice: Number,
    enabled: { type: Boolean, default: true }
  }],
  status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
  images: [String],
  description: String,
  rating: { type: Number, default: 5.0 },
  orderCount: { type: Number, default: 0 },
  ownerId: String,
  staffIds: [String],
  createdAt: Date,
  updatedAt: Date
}, { timestamps: true });

storeSchema.index({ location: '2dsphere' });
storeSchema.index({ status: 1, city: 1 });

const Store = mongoose.models.Store || mongoose.model('Store', storeSchema);

const mockStores = [
  {
    name: '干洗连锁-上海旗舰店',
    storeNo: 'ST001',
    phone: '021-12345678',
    address: '上海市浦东新区陆家嘴金融中心',
    city: '上海市',
    district: '浦东新区',
    location: { type: 'Point', coordinates: [121.5441, 31.2214] },
    businessHours: { open: '08:00', close: '22:00', holidays: [] },
    services: [
      { serviceId: 'dry_clean', name: '干洗', basePrice: 30, enabled: true },
      { serviceId: 'wet_clean', name: '水洗', basePrice: 25, enabled: true },
      { serviceId: 'iron_only', name: '熨烫', basePrice: 15, enabled: true },
      { serviceId: 'leather', name: '皮革护理', basePrice: 80, enabled: true },
      { serviceId: 'fur', name: '皮草护理', basePrice: 120, enabled: true }
    ],
    description: '上海首家旗舰店，位于陆家嘴金融核心区，提供高端干洗服务',
    rating: 5.0,
    orderCount: 0,
    status: 'active'
  },
  {
    name: '干洗连锁-北京中关村店',
    storeNo: 'ST002',
    phone: '010-87654321',
    address: '北京市海淀区中关村大街1号',
    city: '北京市',
    district: '海淀区',
    location: { type: 'Point', coordinates: [116.3074, 39.9835] },
    businessHours: { open: '09:00', close: '21:00', holidays: [] },
    services: [
      { serviceId: 'dry_clean', name: '干洗', basePrice: 32, enabled: true },
      { serviceId: 'wet_clean', name: '水洗', basePrice: 27, enabled: true },
      { serviceId: 'iron_only', name: '熨烫', basePrice: 18, enabled: true },
      { serviceId: 'leather', name: '皮革护理', basePrice: 85, enabled: true },
      { serviceId: 'fur', name: '皮草护理', basePrice: 130, enabled: true }
    ],
    description: '北京中关村核心区域门店，为科技精英提供专业干洗服务',
    rating: 4.9,
    orderCount: 0,
    status: 'active'
  },
  {
    name: '干洗连锁-深圳南山店',
    storeNo: 'ST003',
    phone: '0755-22334455',
    address: '深圳市南山区科技园南区高新南七道',
    city: '深圳市',
    district: '南山区',
    location: { type: 'Point', coordinates: [113.9308, 22.5333] },
    businessHours: { open: '08:30', close: '21:30', holidays: [] },
    services: [
      { serviceId: 'dry_clean', name: '干洗', basePrice: 35, enabled: true },
      { serviceId: 'wet_clean', name: '水洗', basePrice: 28, enabled: true },
      { serviceId: 'iron_only', name: '熨烫', basePrice: 20, enabled: true },
      { serviceId: 'leather', name: '皮革护理', basePrice: 90, enabled: true },
      { serviceId: 'fur', name: '皮草护理', basePrice: 150, enabled: true }
    ],
    description: '深圳南山科技园门店，为创业者和科技人才提供便捷干洗服务',
    rating: 4.8,
    orderCount: 0,
    status: 'active'
  }
];

async function createMockStores() {
  try {
    // 连接数据库
    const dbConfig = require('./config');
    await dbConfig.initDatabase();
    console.log('✓ 数据库连接成功');

    // 检查是否已存在门店
    const existingStores = await Store.countDocuments();
    if (existingStores > 0) {
      console.log(`\n⚠️  数据库中已有 ${existingStores} 个门店`);
      console.log('强制重新创建...\n');
      
      // 删除所有现有门店
      await Store.deleteMany({});
      console.log('✓ 已删除所有现有门店');
    }

    // 批量创建门店
    console.log('\n开始创建模拟门店...\n');
    
    for (const storeData of mockStores) {
      try {
        const store = await Store.create(storeData);
        console.log(`✓ 门店创建成功: ${store.storeNo} - ${store.name}`);
      } catch (error) {
        if (error.code === 11000) {
          console.log(`⚠️  门店已存在: ${storeData.storeNo} - ${storeData.name}`);
        } else {
          console.error(`✗ 创建失败: ${storeData.name}`, error.message);
        }
      }
    }

    console.log('\n✓ 批量创建完成！');
    
    // 显示创建的所有门店
    const allStores = await Store.find({});
    console.log('\n当前所有门店：');
    allStores.forEach(store => {
      console.log(`  ${store.storeNo} - ${store.name} (${store.city} ${store.district})`);
    });

    await dbConfig.closeDatabase();
  } catch (error) {
    console.error('脚本执行失败:', error);
    process.exit(1);
  }
}

createMockStores();
