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
  // 连锁门店相关字段
  chainId: { type: String, index: true }, // 所属连锁ID
  businessCategory: { type: String, default: 'cleaning' }, // 业务品类
  storeType: { type: String, enum: ['self', 'franchise', 'joint'], default: 'self' }, // 门店类型: self-自营, franchise-加盟, joint-联营
  terminalSettlementEnabled: { type: Boolean, default: true }, // 终端结算功能开关
  settlementRatio: { type: Number, default: 0.7 }, // 结算比例（0-1）
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
    const { page, pageSize, city, district, keyword, latitude, longitude, radius, businessCategory } = params;
    
    const filter = { status: 'active' };
    
    if (city) filter.city = city;
    if (district) filter.district = district;
    if (businessCategory) {
      // cleaning 为默认品类，也匹配未设置 businessCategory 的门店
      if (businessCategory === 'cleaning') {
        filter.$and = filter.$and || [];
        filter.$and.push({
          $or: [
            { businessCategory: 'cleaning' },
            { businessCategory: { $exists: false } },
            { businessCategory: null },
            { businessCategory: '' }
          ]
        });
      } else {
        filter.businessCategory = businessCategory;
      }
    }
    if (keyword) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { name: { $regex: keyword, $options: 'i' } },
          { address: { $regex: keyword, $options: 'i' } }
        ]
      });
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
   * 创建门店员工账户（注册新用户并绑定到门店）
   * @param {string} storeId - 门店ID
   * @param {string} ownerId - 操作者（必须是store_owner）
   * @param {object} staffData - { phone, password, name, role }
   */
  async createStaffAccount(storeId, ownerId, staffData) {
    const { phone, password, name, role } = staffData;
    
    // 验证权限：只有owner或admin可以创建员工
    const store = await Store.findOne({ _id: storeId }).lean();
    if (!store) throw new Error('门店不存在');
    
    const User = mongoose.models.User;
    const operator = await User.findById(ownerId);
    if (!operator) throw new Error('操作者不存在');
    if (!operator.roles.includes('store_owner') && !operator.roles.includes('admin')) {
      throw new Error('只有门店老板或管理员可以创建员工账户');
    }
    
    // 检查手机号是否已注册
    let user = await User.findOne({ phone });
    if (user) {
      // 已存在：更新角色和门店关联
      if (!user.roles.includes(role || 'store_staff')) {
        user.roles = [...new Set([...user.roles, role || 'store_staff'])];
      }
      if (!user.storeId) {
        user.storeId = storeId;
      }
      await user.save();
    } else {
      // 创建新用户
      const { v4: uuidv4 } = require('uuid');
      user = await User.create({
        userNo: 'S' + Date.now().toString(36).toUpperCase(),
        phone,
        password, // pre-save hook 会自动hash
        name: name || phone.slice(-4),
        roles: [role || 'store_staff'],
        storeId,
        createdFrom: 'store_admin'
      });
    }
    
    // 添加到门店staffIds
    await Store.updateOne(
      { _id: storeId },
      { $addToSet: { staffIds: user._id.toString() } }
    );
    
    return { success: true, staffId: user._id, name: user.name, phone: user.phone, roles: user.roles };
  }

  /**
   * 移除门店员工
   */
  async removeStaffAccount(storeId, ownerId, staffId) {
    const store = await Store.findOne({ _id: storeId });
    if (!store) throw new Error('门店不存在');
    
    const User = mongoose.models.User;
    const operator = await User.findById(ownerId);
    if (!operator || (!operator.roles.includes('store_owner') && !operator.roles.includes('admin'))) {
      throw new Error('只有门店老板或管理员可以移除员工');
    }
    
    // 从门店staffIds中移除
    await Store.updateOne(
      { _id: storeId },
      { $pull: { staffIds: staffId } }
    );
    
    // 更新用户：清除storeId和门店角色
    const staff = await User.findById(staffId);
    if (staff) {
      staff.storeId = null;
      staff.roles = staff.roles.filter(r => r !== 'store_staff' && r !== 'store_owner');
      if (staff.roles.length === 0) staff.roles = ['customer'];
      await staff.save();
    }
    
    return { success: true };
  }

  /**
   * 更新员工角色
   */
  async updateStaffRole(storeId, ownerId, staffId, newRole) {
    const store = await Store.findOne({ _id: storeId });
    if (!store) throw new Error('门店不存在');
    
    const User = mongoose.models.User;
    const operator = await User.findById(ownerId);
    if (!operator || (!operator.roles.includes('store_owner') && !operator.roles.includes('admin'))) {
      throw new Error('只有门店老板或管理员可以修改员工角色');
    }
    
    if (!['store_staff', 'store_owner'].includes(newRole)) {
      throw new Error('无效的角色类型');
    }
    
    const staff = await User.findById(staffId);
    if (!staff) throw new Error('员工不存在');
    if (!store.staffIds.map(id => id.toString()).includes(staffId.toString())) {
      throw new Error('该员工不属于此门店');
    }
    
    // 移除旧门店角色，添加新角色
    staff.roles = staff.roles.filter(r => r !== 'store_staff' && r !== 'store_owner');
    staff.roles.push(newRole);
    staff.storeId = storeId;
    await staff.save();
    
    return { success: true, roles: staff.roles };
  }

  /**
   * 获取门店员工列表（含详细信息）
   */
  async getStaffListDetailed(storeId, requestUserId) {
    const store = await Store.findOne({ _id: storeId }).lean();
    if (!store) throw new Error('门店不存在');
    
    const User = mongoose.models.User;
    const requestUser = await User.findById(requestUserId).lean();
    const isAdmin = requestUser && requestUser.roles && requestUser.roles.includes('admin');
    const isOwner = requestUser && requestUser.roles && requestUser.roles.includes('store_owner');
    
    // store_staff 只能查看列表（不能修改）
    
    const staffUsers = await User.find(
      { _id: { $in: store.staffIds.map(id => mongoose.Types.ObjectId.isValid(id) ? id : null).filter(Boolean) } }
    ).select('-password').lean();
    
    // 也查找所有storeId等于此门店的用户（可能没在staffIds里）
    const storeUsers = await User.find(
      { storeId: storeId.toString(), roles: { $in: ['store_staff', 'store_owner'] } }
    ).select('-password').lean();
    
    // 合并去重
    const allStaff = [];
    const seen = new Set();
    for (const u of [...staffUsers, ...storeUsers]) {
      const uid = u._id.toString();
      if (!seen.has(uid)) {
        seen.add(uid);
        allStaff.push({
          id: uid,
          userNo: u.userNo,
          phone: u.phone,
          name: u.name,
          roles: u.roles,
          lastLoginAt: u.lastLoginAt || null,
          status: u.status,
          createdAt: u.createdAt
        });
      }
    }
    
    return {
      storeId,
      storeName: store.name,
      storeNo: store.storeNo,
      staff: allStaff,
      canManage: isAdmin || isOwner
    };
  }

  /**
   * 获取门店员工列表（仅ID，兼容旧接口）
   */
  async getStaffList(storeId, requestUserId) {
    const store = await Store.findOne({ _id: storeId }).lean();
    if (!store) throw new Error('门店不存在或无权操作');
    
    return store.staffIds || [];
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
