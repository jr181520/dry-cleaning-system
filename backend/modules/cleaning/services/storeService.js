/**
 * 门店管理服务
 */

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const storeSchema = new mongoose.Schema({
  storeNo: { type: String, unique: true, index: true },
  name: { type: String, required: true },
  address: { type: String, required: true },
  city: String,
  district: String,
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] } // [lng, lat]
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

class StoreService {
  /**
   * 获取门店列表
   */
  async getStores(params) {
    const { page, pageSize, city, district, keyword, latitude, longitude, radius } = params;
    
    const filter = { status: 'active' };
    
    if (city) filter.city = city;
    if (district) filter.district = district;
    if (keyword) {
      filter.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { address: { $regex: keyword, $options: 'i' } }
      ];
    }
    
    // 地理位置搜索
    if (latitude && longitude && radius) {
      filter.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(radius) * 1000 // km -> m
        }
      };
    }
    
    const skip = (page - 1) * pageSize;
    
    const [list, total] = await Promise.all([
      Store.find(filter)
        .select('-staffIds')
        .skip(skip)
        .limit(pageSize)
        .lean(),
      Store.countDocuments(filter)
    ]);

    return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  /**
   * 获取门店详情
   */
  async getStoreById(storeId) {
    const store = await Store.findById(storeId)
      .populate('ownerId', 'name phone')
      .lean();
    
    if (!store) throw new Error('门店不存在');
    return store;
  }

  /**
   * 获取门店服务
   */
  async getStoreServices(storeId) {
    const store = await Store.findById(storeId).lean();
    if (!store) throw new Error('门店不存在');
    
    return {
      storeId: store._id,
      storeName: store.name,
      services: store.services.filter(s => s.enabled)
    };
  }

  /**
   * 创建门店
   */
  async createStore(ownerId, storeData) {
    const storeNo = 'ST' + String(Date.now()).slice(-8);
    
    const store = await Store.create({
      storeNo,
      ownerId,
      name: storeData.name,
      address: storeData.address,
      city: storeData.city,
      district: storeData.district,
      location: storeData.location,
      phone: storeData.phone,
      businessHours: storeData.businessHours,
      services: this.getDefaultServices(),
      images: storeData.images || [],
      description: storeData.description
    });

    return store;
  }

  /**
   * 更新门店信息
   */
  async updateStore(storeId, ownerId, updateData) {
    const store = await Store.findOne({ _id: storeId, ownerId });
    if (!store) throw new Error('门店不存在或无权修改');

    Object.assign(store, updateData);
    await store.save();
    
    return store;
  }

  /**
   * 门店添加员工
   */
  async addStaff(storeId, ownerId, staffId) {
    const store = await Store.findOne({ _id: storeId, ownerId });
    if (!store) throw new Error('门店不存在或无权操作');
    
    if (!store.staffIds.includes(staffId)) {
      store.staffIds.push(staffId);
      await store.save();
    }
    
    return store;
  }

  /**
   * 获取门店员工列表
   */
  async getStaffList(storeId, ownerId) {
    const store = await Store.findOne({ _id: storeId, ownerId }).lean();
    if (!store) throw new Error('门店不存在或无权操作');
    
    return store.staffIds;
  }

  /**
   * 获取默认服务列表
   */
  getDefaultServices() {
    return [
      { serviceId: 'dry_clean', name: '干洗', basePrice: 30, enabled: true },
      { serviceId: 'wet_clean', name: '水洗', basePrice: 25, enabled: true },
      { serviceId: 'iron_only', name: '熨烫', basePrice: 15, enabled: true },
      { serviceId: 'leather', name: '皮革护理', basePrice: 80, enabled: true },
      { serviceId: 'fur', name: '皮草护理', basePrice: 120, enabled: true }
    ];
  }

  /**
   * 获取老板的门店列表
   */
  async getOwnerStores(ownerId) {
    const stores = await Store.find({ ownerId }).lean();
    return stores;
  }
}

module.exports = new StoreService();
