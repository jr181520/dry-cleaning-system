/**
 * 管理员服务
 * 提供系统管理、用户管理、门店管理等功能
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

class AdminService {
  constructor() {
    this.User = this.getUserModel();
    this.Order = this.getOrderModel();
    this.Store = this.getStoreModel();
    this.Chain = this.getChainModel();
    this.BDTeam = this.getBDTeamModel();
    this.ServiceTicket = this.getServiceTicketModel();
    this.SystemSettings = this.getSystemSettingsModel();
    this.SettlementRequest = this.getSettlementRequestModel();
    this.InvoiceRequest = this.getInvoiceRequestModel();
  }

  // 获取用户模型
  getUserModel() {
    const userSchema = new mongoose.Schema({
      userNo: { type: String, index: true },
      phone: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      name: String,
      avatar: String,
      openid: { type: String, sparse: true, index: true },
      roles: [{ type: String, enum: ['customer', 'store_staff', 'store_owner', 'recycler', 'appraiser', 'brand_admin', 'chain_admin', 'admin', 'merchant'], default: 'customer' }],
      status: { type: String, enum: ['active', 'disabled', 'inactive', 'banned'], default: 'active' },
      memberLevel: { type: String, enum: ['normal', 'silver', 'gold', 'platinum'], default: 'normal' },
      balance: { type: Number, default: 0 },
      points: { type: Number, default: 0 },
      storeId: String,
      chainId: { type: String, index: true },
      creditScore: { type: Number, default: 100 },
      registrationSource: { type: String, default: 'unknown' },
      createdFrom: { type: String, default: 'app' },
      lastLoginAt: Date,
      addresses: [{
        name: String,
        phone: String,
        address: String,
        isDefault: Boolean
      }],
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    });
    
    userSchema.index({ phone: 1 });
    userSchema.index({ roles: 1 });
    
    return mongoose.models.User || mongoose.model('User', userSchema);
  }

  // 获取订单模型
  getOrderModel() {
    const orderSchema = new mongoose.Schema({
      orderNo: { type: String, unique: true, index: true },
      orderType: { type: String, default: 'cleaning' },
      userId: { type: String, required: true, index: true },
      storeId: { type: String, required: true, index: true },
      items: [{
        itemId: String,
        name: String,
        itemType: String,
        serviceType: String,
        price: Number,
        quantity: Number,
        subtotal: Number,
        status: String
      }],
      amounts: {
        subtotal: Number,
        discount: Number,
        deliveryFee: Number,
        total: Number
      },
      delivery: {
        type: String,
        address: String,
        contactName: String,
        contactPhone: String,
        fee: Number
      },
      payment: {
        status: String,
        method: String,
        transactionId: String,
        paidAt: Date
      },
      status: { type: String, enum: ['pending', 'paid', 'processing', 'completed', 'cancelled', 'refunded'], default: 'pending' },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    });
    
    orderSchema.index({ userId: 1, createdAt: -1 });
    orderSchema.index({ storeId: 1, createdAt: -1 });
    orderSchema.index({ status: 1 });
    orderSchema.index({ createdAt: -1 });
    
    return mongoose.models.Order || mongoose.model('Order', orderSchema);
  }

  // 获取门店模型
  getStoreModel() {
    const storeSchema = new mongoose.Schema({
      storeNo: { type: String, unique: true },
      name: { type: String, required: true },
      ownerId: { type: String, required: true },
      chainId: { type: String, index: true },
      businessCategory: { type: String, default: 'cleaning' }, // 业务品类
      phone: String,
      address: { type: String, required: true },
      city: String,
      district: String,
      lat: Number,
      lng: Number,
      businessHours: { start: String, end: String },
      services: [{ type: String }],
      status: { type: String, enum: ['active', 'pending', 'disabled'], default: 'pending' },
      bdUserId: { type: String, index: true }, // BD人员关联ID
      stats: {
        totalOrders: { type: Number, default: 0 },
        totalAmount: { type: Number, default: 0 },
        rating: { type: Number, default: 5.0 },
        completedOrders: { type: Number, default: 0 }
      },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    });
    
    storeSchema.index({ ownerId: 1 });
    storeSchema.index({ chainId: 1 });
    storeSchema.index({ status: 1 });
    
    return mongoose.models.Store || mongoose.model('Store', storeSchema);
  }

  // 获取连锁模型
  getChainModel() {
    const chainSchema = new mongoose.Schema({
      chainNo: { type: String, unique: true, index: true },
      name: { type: String, required: true },
      shortName: String,
      adminId: { type: String, index: true },
      adminPhone: String,
      contactPerson: String,
      contactPhone: String,
      address: String,
      logo: String,
      description: String,
      status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
      subscription: {
        plan: { type: String, enum: ['free', 'basic', 'pro', 'enterprise'], default: 'basic' },
        maxStores: { type: Number, default: 5 },
        expiredAt: Date
      },
      stats: {
        totalStores: { type: Number, default: 0 },
        activeStores: { type: Number, default: 0 },
        totalOrders: { type: Number, default: 0 },
        totalRevenue: { type: Number, default: 0 },
        monthlyOrders: { type: Number, default: 0 },
        monthlyRevenue: { type: Number, default: 0 },
        totalUsers: { type: Number, default: 0 },  // 累计用户数
        monthlyUsers: { type: Number, default: 0 },  // 月度新增用户
        dailyUsers: { type: Number, default: 0 },  // 日新增用户
        todayNewUsers: { type: Number, default: 0 },  // 今日新增用户
        todayOrders: { type: Number, default: 0 },  // 今日订单
        todayRevenue: { type: Number, default: 0 }  // 今日收入
      },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    });
    
    chainSchema.index({ adminId: 1 });
    chainSchema.index({ status: 1 });
    
    return mongoose.models.Chain || mongoose.model('Chain', chainSchema);
  }

  /**
   * 获取仪表盘统计
   */
  async getDashboard() {
    try {
      // 今日数据
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 本周起始
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);

      // 本月起始（30天内）
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      monthAgo.setHours(0, 0, 0, 0);

      // 用户统计：总用户、日活、月活、新增用户
      const [totalUsers, orders, stores, todayOrders, dauUsers, mauUsers, todayNewUsers, weekNewUsers, monthNewUsers, userSourceStats] = await Promise.all([
        // 总消费者用户：只要有手机号的角色为 customer 的用户（C端+微信小程序）
        this.User.countDocuments({ roles: 'customer', phone: { $exists: true, $ne: '', $type: 'string' } }),
        this.Order.countDocuments(),
        this.Store.countDocuments({ status: 'active' }),
        this.Order.countDocuments({ createdAt: { $gte: today } }),
        // 日活用户：今日登录过的消费者
        this.User.countDocuments({ roles: 'customer', lastLoginAt: { $gte: today } }),
        // 月活用户：30天内登录过的消费者
        this.User.countDocuments({ roles: 'customer', lastLoginAt: { $gte: monthAgo } }),
        // 今日新增用户：今日注册的用户
        this.User.countDocuments({ roles: 'customer', createdAt: { $gte: today } }),
        // 本周新增用户：本周注册的用户
        this.User.countDocuments({ roles: 'customer', createdAt: { $gte: weekAgo } }),
        // 本月新增用户：本月注册的用户
        this.User.countDocuments({ roles: 'customer', createdAt: { $gte: monthAgo } }),
        // 按来源统计的用户数据
        this.User.aggregate([
          {
            $match: {
              roles: 'customer',
              phone: { $exists: true, $ne: '', $type: 'string' }
            }
          },
          {
            $group: {
              _id: '$registrationSource',
              total: { $sum: 1 },
              today: {
                $sum: {
                  $cond: [{ $gte: ['$createdAt', today] }, 1, 0]
                }
              },
              week: {
                $sum: {
                  $cond: [{ $gte: ['$createdAt', weekAgo] }, 1, 0]
                }
              },
              month: {
                $sum: {
                  $cond: [{ $gte: ['$createdAt', monthAgo] }, 1, 0]
                }
              }
            }
          }
        ])
      ]);

      // 金额统计
      const orderStats = await this.Order.aggregate([
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amounts.total' },
            todayAmount: {
              $sum: {
                $cond: [{ $gte: ['$createdAt', today] }, '$amounts.total', 0]
              }
            },
            avgOrderAmount: { $avg: '$amounts.total' }
          }
        }
      ]);

      // 订单状态分布
      const orderStatus = await this.Order.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      // 最近7天订单趋势
      const orderTrend = await this.Order.aggregate([
        { $match: { createdAt: { $gte: weekAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            amount: { $sum: '$amounts.total' }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // 处理用户来源统计数据
      const userSourceData = {
        total: 0,
        sources: {}
      };
      
      // 处理聚合结果
      userSourceStats.forEach(source => {
        const sourceKey = source._id || 'unknown';
        userSourceData.sources[sourceKey] = {
          total: source.total || 0,
          today: source.today || 0,
          week: source.week || 0,
          month: source.month || 0
        };
        userSourceData.total += source.total || 0;
      });

      return {
        success: true,
        data: {
          overview: {
            totalUsers,
            totalOrders: orders,
            totalStores: stores,
            todayOrders,
            dauUsers,
            mauUsers,
            todayNewUsers,
            weekNewUsers,
            monthNewUsers
          },
          finance: {
            totalAmount: orderStats[0]?.totalAmount || 0,
            todayAmount: orderStats[0]?.todayAmount || 0,
            avgOrderAmount: Math.round((orderStats[0]?.avgOrderAmount || 0) * 100) / 100
          },
          orderStatus: orderStatus.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
          }, {}),
          orderTrend,
          userSourceStats: userSourceData
        }
      };
    } catch (error) {
      console.error('[管理员] 获取仪表盘失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 用户管理
   */
  async getUsers(params) {
    try {
      const { page = 1, pageSize = 20, keyword, role, status, registrationSource } = params;
      
      const filter = {};
      if (keyword) {
        filter.$or = [
          { name: { $regex: keyword, $options: 'i' } },
          { phone: { $regex: keyword, $options: 'i' } }
        ];
      }
      if (role) filter.roles = role;
      if (status) filter.status = status;
      if (registrationSource) filter.registrationSource = registrationSource;

      const [users, total] = await Promise.all([
        this.User.find(filter)
          .select('-password')
          .sort({ createdAt: -1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize),
        this.User.countDocuments(filter)
      ]);

      return {
        success: true,
        data: {
          list: users,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
          }
        }
      };
    } catch (error) {
      console.error('[管理员] 获取用户列表失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取用户详情
   */
  async getUserById(userId) {
    try {
      const user = await this.User.findById(userId).select('-password');
      
      if (!user) {
        return { success: false, error: '用户不存在' };
      }

      // 获取用户订单统计
      const orderStats = await this.Order.aggregate([
        { $match: { userId: userId } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalAmount: { $sum: '$amounts.total' },
            completedOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            }
          }
        }
      ]);

      return {
        success: true,
        data: {
          ...user.toObject(),
          orderStats: orderStats[0] || { totalOrders: 0, totalAmount: 0, completedOrders: 0 }
        }
      };
    } catch (error) {
      console.error('[管理员] 获取用户详情失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 更新用户状态
   */
  async updateUserStatus(userId, status) {
    try {
      const user = await this.User.findByIdAndUpdate(
        userId,
        { status, updatedAt: new Date() },
        { new: true }
      ).select('-password');

      if (!user) {
        return { success: false, error: '用户不存在' };
      }

      return { success: true, data: user };
    } catch (error) {
      console.error('[管理员] 更新用户状态失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 门店管理
   */
  async getStores(params) {
    try {
      const { page = 1, pageSize = 20, keyword, status, businessCategory, bdUserId, bdManagerId } = params;
      
      const filter = {};
      if (keyword) {
        filter.$or = [
          { name: { $regex: keyword, $options: 'i' } },
          { storeNo: { $regex: keyword, $options: 'i' } }
        ];
      }
      if (status) filter.status = status;
      if (businessCategory) filter.businessCategory = businessCategory;
      if (bdUserId) filter.bdUserId = bdUserId; // 基层BD数据隔离
      // BD主管: 查找团队所有下级BD的门店
      if (bdManagerId && !bdUserId) {
        try {
          const teamBDs = await this.BDTeam.find({ parentBdId: bdManagerId });
          const teamBdIds = teamBDs.map(b => b.bdNo || b._id.toString());
          teamBdIds.push(bdManagerId); // 包含主管自己
          filter.bdUserId = { $in: teamBdIds };
        } catch (e) { /* BDTeam模型不存在时忽略 */ }
      }

      const [stores, total] = await Promise.all([
        this.Store.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize),
        this.Store.countDocuments(filter)
      ]);

      return {
        success: true,
        data: {
          list: stores,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
          }
        }
      };
    } catch (error) {
      console.error('[管理员] 获取门店列表失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 更新门店状态
   */
  async updateStoreStatus(storeId, status) {
    try {
      const store = await this.Store.findByIdAndUpdate(
        storeId,
        { status, updatedAt: new Date() },
        { new: true }
      );

      if (!store) {
        return { success: false, error: '门店不存在' };
      }

      return { success: true, data: store };
    } catch (error) {
      console.error('[管理员] 更新门店状态失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 创建门店（开发模式）
   */
  async createStore(storeData) {
    try {
      const storeNo = 'ST' + String(Date.now()).slice(-8);
      
      // 使用 mongoose.connection.db 直接操作，确保字段正确写入
      const db = mongoose.connection.db;
      const collection = db.collection('stores');
      
      const storeDoc = {
        storeNo,
        name: storeData.name,
        address: storeData.address,
        city: storeData.city || '',
        district: storeData.district || '',
        location: storeData.location || {
          type: 'Point',
          coordinates: [0, 0]
        },
        phone: storeData.phone,
        businessHours: {
          open: storeData.businessHours?.open || '09:00',
          close: storeData.businessHours?.close || '21:00',
          holidays: []
        },
        services: [
          { serviceId: 'dry_clean', name: '干洗', basePrice: 30, enabled: true },
          { serviceId: 'wet_clean', name: '水洗', basePrice: 25, enabled: true },
          { serviceId: 'iron_only', name: '熨烫', basePrice: 15, enabled: true },
          { serviceId: 'leather', name: '皮革护理', basePrice: 80, enabled: true },
          { serviceId: 'fur', name: '皮草护理', basePrice: 120, enabled: true }
        ],
        images: storeData.images || [],
        description: storeData.description || '',
        businessCategory: storeData.businessCategory || 'cleaning',
        rating: 5.0,
        orderCount: 0,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await collection.insertOne(storeDoc);
      storeDoc._id = result.insertedId;

      console.log('[管理员] 门店创建成功:', storeDoc.storeNo, storeDoc.name, 'category:', storeDoc.businessCategory);
      return storeDoc;
    } catch (error) {
      console.error('[管理员] 创建门店失败:', error);
      throw error;
    }
  }

  /**
   * 批量导入门店
   * @param {Array} storesData - 门店数据数组
   * @returns {Object} - 导入结果
   */
  async importStores(storesData) {
    try {
      const results = {
        total: storesData.length,
        success: 0,
        failed: 0,
        errors: [],
        created: []
      };

      // 生成门店编号前缀
      const prefix = 'ST' + String(Date.now()).slice(-6);

      for (let i = 0; i < storesData.length; i++) {
        const storeData = storesData[i];
        try {
          // 验证必填字段
          if (!storeData.name || !storeData.phone || !storeData.address) {
            throw new Error('门店名称、电话、地址为必填字段');
          }

          const storeNo = prefix + String(i + 1).padStart(2, '0');
          
          const store = await this.Store.create({
            storeNo,
            name: storeData.name,
            address: storeData.address,
            city: storeData.city || '',
            district: storeData.district || '',
            location: {
              type: 'Point',
              coordinates: [0, 0]
            },
            phone: storeData.phone,
            businessHours: {
              open: storeData.businessHoursOpen || storeData.businessHours?.open || '09:00',
              close: storeData.businessHoursClose || storeData.businessHours?.close || '21:00',
              holidays: []
            },
            services: [
              { serviceId: 'dry_clean', name: '干洗', basePrice: 30, enabled: true },
              { serviceId: 'wet_clean', name: '水洗', basePrice: 25, enabled: true },
              { serviceId: 'iron_only', name: '熨烫', basePrice: 15, enabled: true },
              { serviceId: 'leather', name: '皮革护理', basePrice: 80, enabled: true },
              { serviceId: 'fur', name: '皮草护理', basePrice: 120, enabled: true }
            ],
            images: [],
            description: storeData.description || '',
            rating: 5.0,
            orderCount: 0,
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
          });

          results.success++;
          results.created.push({
            storeNo: store.storeNo,
            name: store.name
          });

          console.log(`[管理员] 批量导入门店 ${store.storeNo} ${store.name} 成功`);
        } catch (err) {
          results.failed++;
          results.errors.push({
            row: i + 2, // Excel行号（从2开始，第1行是表头）
            data: storeData,
            error: err.message
          });
          console.error(`[管理员] 批量导入第${i + 2}行门店失败:`, err.message);
        }
      }

      console.log(`[管理员] 批量导入完成: 总计${results.total}条, 成功${results.success}条, 失败${results.failed}条`);
      return {
        success: true,
        data: results
      };
    } catch (error) {
      console.error('[管理员] 批量导入门店失败:', error);
      throw error;
    }
  }

  /**
   * 门店入驻申请管理
   */
  
  // 获取申请模型
  getApplicationModel() {
    const applicationSchema = new mongoose.Schema({
      applicationId: { type: String, unique: true, index: true },
      applicantName: { type: String, required: true },
      applicantPhone: { type: String, required: true },
      storeName: { type: String, required: true },
      storeAddress: { type: String, required: true },
      city: String,
      district: String,
      businessHours: {
        open: { type: String, default: '09:00' },
        close: { type: String, default: '21:00' }
      },
      businessLicense: String,
      legalPerson: String,
      businessCategory: { type: String, default: 'cleaning' }, // 业务品类：cleaning/shoe_care/luxury_care/pet_grooming/electronics_repair/rental/rental_leisure
      description: String,
      bdName: String,
      bdPhone: String,
      status: { 
        type: String, 
        enum: ['pending', 'processing', 'approved', 'rejected'], 
        default: 'pending' 
      },
      storeId: String,
      approvalHistory: [{
        action: String,
        time: Date,
        operator: String,
        note: String
      }],
      messages: [{
        from: { type: String, enum: ['admin', 'bd', 'system'] },
        content: String,
        time: { type: Date, default: Date.now }
      }],
      createTime: { type: Date, default: Date.now },
      updateTime: { type: Date, default: Date.now }
    }, { timestamps: true });
    
    applicationSchema.index({ status: 1, createTime: -1 });
    
    return mongoose.models.StoreApplication || mongoose.model('StoreApplication', applicationSchema);
  }

  // 获取申请列表
  async getStoreApplications(params) {
    try {
      const { status, keyword, page = 1, pageSize = 50 } = params;
      
      const filter = {};
      if (status) filter.status = status;
      if (keyword) {
        filter.$or = [
          { applicationId: { $regex: keyword, $options: 'i' } },
          { storeName: { $regex: keyword, $options: 'i' } },
          { applicantName: { $regex: keyword, $options: 'i' } }
        ];
      }
      
      const Application = this.getApplicationModel();
      const [applications, total] = await Promise.all([
        Application.find(filter)
          .sort({ createTime: -1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .lean(),
        Application.countDocuments(filter)
      ]);
      
      return {
        success: true,
        data: applications,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      console.error('[管理员] 获取申请列表失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 创建申请
  async createStoreApplication(data) {
    try {
      const Application = this.getApplicationModel();
      const applicationId = 'APP' + Date.now();
      
      const application = await Application.create({
        ...data,
        applicationId,
        status: 'pending'
      });
      
      console.log('[管理员] 新增门店申请:', applicationId, data.storeName);
      
      return { success: true, data: application };
    } catch (error) {
      console.error('[管理员] 创建申请失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 更新申请
  async updateStoreApplication(applicationId, data) {
    try {
      const Application = this.getApplicationModel();
      
      const application = await Application.findOneAndUpdate(
        { applicationId },
        { ...data, updateTime: new Date() },
        { new: true }
      );
      
      if (!application) {
        return { success: false, error: '申请不存在' };
      }
      
      console.log('[管理员] 更新申请状态:', applicationId, data.status);
      
      return { success: true, data: application };
    } catch (error) {
      console.error('[管理员] 更新申请失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 获取申请详情
  async getStoreApplicationById(applicationId) {
    try {
      const Application = this.getApplicationModel();
      const application = await Application.findOne({ applicationId }).lean();
      
      if (!application) {
        return { success: false, error: '申请不存在' };
      }
      
      return { success: true, data: application };
    } catch (error) {
      console.error('[管理员] 获取申请详情失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 添加沟通消息
  async addApplicationMessage(applicationId, message) {
    try {
      const Application = this.getApplicationModel();
      
      const application = await Application.findOneAndUpdate(
        { applicationId },
        { 
          $push: { messages: message },
          updateTime: new Date()
        },
        { new: true }
      );
      
      if (!application) {
        return { success: false, error: '申请不存在' };
      }
      
      return { success: true, data: application.messages };
    } catch (error) {
      console.error('[管理员] 添加消息失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 获取沟通消息
  async getApplicationMessages(applicationId) {
    try {
      const Application = this.getApplicationModel();
      const application = await Application.findOne({ applicationId }).lean();
      
      if (!application) {
        return { success: false, error: '申请不存在' };
      }
      
      return { success: true, data: application.messages || [] };
    } catch (error) {
      console.error('[管理员] 获取消息失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 查询申请状态（商家自助查询）
  async getApplicationStatus({ phone, applicationId }) {
    try {
      const Application = this.getApplicationModel();
      const filter = {};
      if (applicationId) {
        filter.applicationId = applicationId;
      } else if (phone) {
        filter.applicantPhone = phone;
      }
      
      const application = await Application.findOne(filter)
        .sort({ createTime: -1 })
        .lean();
      
      if (!application) {
        return {
          success: true,
          data: {
            hasApplication: false,
            status: null,
            needsApplication: true
          }
        };
      }
      
      return {
        success: true,
        data: {
          hasApplication: true,
          applicationId: application.applicationId,
          storeName: application.storeName,
          status: application.status,
          storeId: application.storeId || null,
          createTime: application.createTime,
          updateTime: application.updateTime,
          needsApplication: application.status !== 'approved'
        }
      };
    } catch (error) {
      console.error('[入驻申请] 查询状态失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 订单管理
   */
  async getOrders(params) {
    try {
      const { page = 1, pageSize = 20, keyword, status, orderType, startDate, endDate, bdUserId, bdManagerId } = params;
      
      const filter = {};
      if (keyword) {
        filter.$or = [
          { orderNo: { $regex: keyword, $options: 'i' } },
          { 'delivery.contactPhone': { $regex: keyword, $options: 'i' } }
        ];
      }
      if (status) filter.status = status;
      if (orderType) filter.orderType = orderType;
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }
      // BD数据隔离：只查询BD管理的门店的订单
      let effectiveBdUserId = bdUserId;
      if (bdManagerId && !bdUserId) {
        try {
          const teamBDs = await this.BDTeam.find({ parentBdId: bdManagerId });
          const teamBdIds = teamBDs.map(b => b.bdNo || b._id.toString());
          teamBdIds.push(bdManagerId);
          const teamStores = await this.Store.find({ bdUserId: { $in: teamBdIds } }).select('_id storeNo').lean();
          filter.storeId = { $in: teamStores.map(s => s._id.toString()) };
        } catch (e) { /* 忽略 */ }
      } else if (effectiveBdUserId) {
        const bdStores = await this.Store.find({ bdUserId }).select('_id storeNo').lean();
        const storeNos = bdStores.map(s => s.storeNo);
        filter.storeId = { $in: bdStores.map(s => s._id.toString()) };
        if (storeNos.length > 0) {
          filter.$or = filter.$or || [];
          filter.$or.push({ storeNo: { $in: storeNos } });
        }
      }

      const [orders, total] = await Promise.all([
        this.Order.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize),
        this.Order.countDocuments(filter)
      ]);

      return {
        success: true,
        data: {
          list: orders,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
          }
        }
      };
    } catch (error) {
      console.error('[管理员] 获取订单列表失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取订单详情
   */
  async getOrderById(orderId) {
    try {
      const order = await this.Order.findById(orderId);

      if (!order) {
        return { success: false, error: '订单不存在' };
      }

      // 获取用户和门店信息
      const [user, store] = await Promise.all([
        this.User.findById(order.userId).select('-password'),
        this.Store.findById(order.storeId)
      ]);

      return {
        success: true,
        data: {
          ...order.toObject(),
          user,
          store
        }
      };
    } catch (error) {
      console.error('[管理员] 获取订单详情失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 创建管理员账户
   */
  async createAdmin(data) {
    try {
      const { phone, password, name } = data;

      // 检查是否已存在
      const existing = await this.User.findOne({ phone });
      if (existing) {
        return { success: false, error: '手机号已被使用' };
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 10);

      const admin = new this.User({
        phone,
        password: hashedPassword,
        name: name || '管理员',
        roles: ['admin'],
        status: 'active'
      });

      await admin.save();

      return {
        success: true,
        data: {
          id: admin._id,
          phone: admin.phone,
          name: admin.name,
          roles: admin.roles
        }
      };
    } catch (error) {
      console.error('[管理员] 创建管理员失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取门店待取件订单列表
   */
  /**
   * 获取门店所有订单（M端使用）
   */
  async getStoreOrders(storeId, params = {}) {
    try {
      const { page = 1, pageSize = 50, status } = params;
      
      const filter = { storeId };
      if (status) filter.status = status;

      const [orders, total] = await Promise.all([
        this.Order.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize),
        this.Order.countDocuments(filter)
      ]);

      return {
        success: true,
        data: {
          list: orders,
          pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
        }
      };
    } catch (error) {
      console.error('[管理员] 获取门店订单失败:', error);
      return { success: false, error: error.message };
    }
  }

  async getStorePendingOrders(storeId) {
    try {
      const orders = await this.Order.find({
        storeId,
        status: 'ready'
      })
        .populate('userId', 'name phone')
        .sort({ createdAt: -1 });

      const pendingOrders = orders.map(order => ({
        orderId: order._id,
        orderNo: order.orderNo,
        userName: order.userId?.name || '未知',
        userPhone: order.userId?.phone || '',
        itemCount: order.items.length,
        items: order.items.map(item => item.name),
        pickupCode: order.cleaning?.pickupCode || '',
        pickupMethod: order.pickupMethod || 'store_pickup',
        createdAt: order.createdAt
      }));

      return {
        success: true,
        data: {
          storeId,
          totalCount: pendingOrders.length,
          orders: pendingOrders
        }
      };
    } catch (error) {
      console.error('[管理员] 获取待取件订单失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 一键取货（批量完成）
   */
  async batchPickupOrders(storeId, auth) {
    try {
      const orders = await this.Order.find({
        storeId,
        status: 'ready',
        pickupMethod: 'store_pickup'
      });

      if (orders.length === 0) {
        return {
          success: true,
          data: {
            successCount: 0,
            failedCount: 0,
            message: '没有待取件的订单'
          }
        };
      }

      let successCount = 0;
      let failedCount = 0;

      for (const order of orders) {
        try {
          order.status = 'completed';
          order.cleaning.pickedUpAt = new Date();
          order.statusHistory.push({
            status: 'completed',
            time: new Date(),
            actorId: auth.id,
            note: '门店一键取货完成'
          });
          await order.save();
          successCount++;
        } catch (err) {
          failedCount++;
          console.error(`订单 ${order.orderNo} 取货失败:`, err);
        }
      }

      return {
        success: true,
        data: {
          successCount,
          failedCount,
          message: `成功完成 ${successCount} 个订单`
        }
      };
    } catch (error) {
      console.error('[管理员] 一键取货失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取智能灯条状态
   */
  async getLightStatus(storeId) {
    try {
      // 模拟灯条状态数据
      const lightStatus = {
        storeId,
        active: true,
        lights: [
          { position: 'A1', status: 'off', color: '#cccccc', orderCount: 0 },
          { position: 'A2', status: 'green', color: '#4caf50', orderCount: 2 },
          { position: 'A3', status: 'yellow', color: '#ff9800', orderCount: 1 },
          { position: 'A4', status: 'red', color: '#f44336', orderCount: 1 },
          { position: 'B1', status: 'off', color: '#cccccc', orderCount: 0 },
          { position: 'B2', status: 'green', color: '#4caf50', orderCount: 1 }
        ],
        totalPending: 4,
        lastUpdate: new Date()
      };

      return {
        success: true,
        data: lightStatus
      };
    } catch (error) {
      console.error('[管理员] 获取灯条状态失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 点亮取货灯
   */
  async triggerLightUp(storeId, lightInfo) {
    try {
      console.log('[智能灯条] 点亮灯条:', { storeId, ...lightInfo });

      // 发送MQTT命令
      let mqttSent = false;
      try {
        const lightService = require('../../../services/lightService');
        const topic = `dryclean/prod/${storeId}/light`;
        const command = {
          action: 'on',
          lightIds: lightInfo.orderIds || [],
          color: lightInfo.color || 'green',
          priority: lightInfo.priority || 'normal',
          timestamp: Date.now()
        };
        lightService.publish(topic, command);
        console.log('[MQTT] 发送点亮命令:', command);
        mqttSent = lightService.isConnected();
      } catch (mqttErr) {
        console.log('[MQTT] 警告: 无法发送MQTT消息:', mqttErr.message);
      }

      return {
        success: true,
        data: {
          storeId,
          lightsActivated: lightInfo.orderIds?.length || 0,
          priority: lightInfo.priority || 'normal',
          message: mqttSent ? '取货灯已点亮（MQTT已发送）' : '取货灯已点亮（模拟模式）',
          mqttConnected: mqttSent
        }
      };
    } catch (error) {
      console.error('[管理员] 点亮灯条失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 关闭取货灯
   */
  async triggerLightOff(storeId, lightInfo) {
    try {
      console.log('[智能灯条] 关闭灯条:', { storeId, ...lightInfo });

      // 发送MQTT命令
      let mqttSent = false;
      try {
        const lightService = require('../../../services/lightService');
        const topic = `dryclean/prod/${storeId}/light`;
        const command = {
          action: 'off',
          lightIds: lightInfo.orderIds || [],
          timestamp: Date.now()
        };
        lightService.publish(topic, command);
        console.log('[MQTT] 发送关闭命令:', command);
        mqttSent = lightService.isConnected();
      } catch (mqttErr) {
        console.log('[MQTT] 警告: 无法发送MQTT消息:', mqttErr.message);
      }

      return {
        success: true,
        data: {
          storeId,
          lightsDeactivated: lightInfo.orderIds?.length || 'all',
          message: mqttSent ? '取货灯已关闭（MQTT已发送）' : '取货灯已关闭（模拟模式）',
          mqttConnected: mqttSent
        }
      };
    } catch (error) {
      console.error('[管理员] 关闭灯条失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 关闭全部灯条
   */
  async triggerAllLightOff(storeId) {
    try {
      console.log('[智能灯条] 关闭全部灯条:', { storeId });

      // 发送MQTT命令
      let mqttSent = false;
      try {
        const lightService = require('../../../services/lightService');
        const topic = `dryclean/prod/${storeId}/light`;
        const command = {
          action: 'all_off',
          timestamp: Date.now()
        };
        lightService.publish(topic, command);
        console.log('[MQTT] 发送全关命令:', command);
        mqttSent = lightService.isConnected();
      } catch (mqttErr) {
        console.log('[MQTT] 警告: 无法发送MQTT消息:', mqttErr.message);
      }

      return {
        success: true,
        data: {
          storeId,
          message: mqttSent ? '全部灯条已关闭（MQTT已发送）' : '全部灯条已关闭（模拟模式）',
          mqttConnected: mqttSent
        }
      };
    } catch (error) {
      console.error('[管理员] 关闭全部灯条失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取门店的 MQTT 连接配置
   */
  async getStoreMqttConfig(storeId) {
    try {
      const store = await this.Store.findOne({ storeNo: storeId }).lean();
      
      if (!store) {
        return { success: false, error: '门店不存在' };
      }

      const mqttConfig = {
        storeId: store.storeNo,
        storeName: store.name,
        mqttEndpoint: {
          broker: process.env.MQTT_BROKER || 'mqtt://localhost:1883',  // EMQX
          port: 1883,
          wsPort: 8083,  // EMQX WebSocket
          topic: `dryclean/prod/${store.storeNo}/light`,
          clientId: `light_${store.storeNo}_001`
        },
        supportedActions: [
          'light_on',
          'light_off',
          'light_blink',
          'light_pulse',
          'light_all_off'
        ],
        lightColors: {
          green: '#4CAF50',
          orange: '#FF9800',
          red: '#F44336',
          blue: '#2196F3',
          purple: '#9C27B0',
          yellow: '#FFEB3B'
        },
        maxLights: store.services?.length || 8,
        status: 'active'
      };

      return {
        success: true,
        data: mqttConfig
      };
    } catch (error) {
      console.error('[管理员] 获取MQTT配置失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查门店灯条终端连接状态
   */
  async checkLightConnection(storeId) {
    try {
      let connectionStatus = {
        storeId,
        mqttConnected: false,
        terminalOnline: false,
        lastHeartbeat: null,
        mode: 'simulation'
      };

      try {
        const lightService = require('../../../services/lightService');
        // 真正检查MQTT连接状态
        connectionStatus.mqttConnected = lightService.isConnected();
        connectionStatus.mode = connectionStatus.mqttConnected ? 'production' : 'simulation';
      } catch (e) {
        // 灯条服务未加载
      }

      return {
        success: true,
        data: connectionStatus
      };
    } catch (error) {
      console.error('[管理员] 检查灯条连接失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取配送订单列表
   */
  async getDeliveryOrders(filter) {
    try {
      const query = {};
      if (filter.status) query['delivery.status'] = filter.status;
      if (filter.storeId) query.storeId = filter.storeId;

      const orders = await this.Order.find({
        ...query,
        delivery: { $exists: true }
      })
        .populate('userId', 'name phone')
        .sort({ createdAt: -1 })
        .limit(100);

      const deliveryOrders = orders.map(order => ({
        orderId: order._id,
        orderNo: order.orderNo,
        userName: order.userId?.name || '未知',
        userPhone: order.userId?.phone || '',
        status: order.status,
        deliveryStatus: order.delivery?.status || 'pending',
        driverName: order.delivery?.driverName || '',
        driverPhone: order.delivery?.driverPhone || '',
        createdAt: order.createdAt
      }));

      return {
        success: true,
        data: deliveryOrders
      };
    } catch (error) {
      console.error('[管理员] 获取配送订单失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 创建配送订单
   */
  async createDeliveryOrder(deliveryData, auth) {
    try {
      const order = await this.Order.findById(deliveryData.orderId);

      if (!order) {
        return { success: false, error: '订单不存在' };
      }

      // 更新配送信息
      order.delivery = {
        ...order.delivery,
        type: 'delivery',
        status: 'pending',
        address: deliveryData.address,
        contactName: deliveryData.contactName,
        contactPhone: deliveryData.contactPhone,
        createdAt: new Date()
      };

      // 更新订单状态为配送中
      order.status = 'delivering_back';
      order.statusHistory.push({
        status: 'delivering_back',
        time: new Date(),
        actorId: auth.id,
        note: '创建配送订单，等待骑手接单'
      });

      await order.save();

      return {
        success: true,
        data: {
          orderId: order._id,
          orderNo: order.orderNo,
          deliveryId: `DL${Date.now()}`,
          message: '配送订单已创建'
        }
      };
    } catch (error) {
      console.error('[管理员] 创建配送订单失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取会员列表（所有用户含会员等级）
   */
  async getMembers(params) {
    try {
      const { page = 1, pageSize = 20, keyword, level } = params;
      const filter = { roles: 'customer' };
      if (keyword) {
        filter.$or = [
          { name: { $regex: keyword, $options: 'i' } },
          { phone: { $regex: keyword, $options: 'i' } }
        ];
      }

      const [users, total] = await Promise.all([
        this.User.find(filter).select('-password').sort({ creditScore: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
        this.User.countDocuments(filter)
      ]);

      // 计算每个用户的会员等级和订单数
      const memberList = await Promise.all(users.map(async (user) => {
        const orderCount = await this.Order.countDocuments({ userId: String(user._id) });
        const totalSpent = await this.Order.aggregate([
          { $match: { userId: String(user._id), status: { $ne: 'cancelled' } } },
          { $group: { _id: null, total: { $sum: '$amounts.total' } } }
        ]);
        
        const points = user.creditScore || 0;
        let memberLevel = 'normal';
        let memberName = '普通会员';
        if (points >= 10000) { memberLevel = 'platinum'; memberName = '铂金会员'; }
        else if (points >= 5000) { memberLevel = 'gold'; memberName = '黄金会员'; }
        else if (points >= 2000) { memberLevel = 'silver'; memberName = '白银会员'; }

        return {
          userId: user._id,
          userNo: user.userNo,
          name: user.name,
          phone: user.phone,
          avatar: user.avatar,
          memberLevel,
          memberName,
          points,
          orderCount,
          totalSpent: totalSpent[0]?.total || 0,
          status: user.status,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt
        };
      }));

      // 按等级筛选（如果指定）
      let filteredList = memberList;
      if (level) {
        filteredList = memberList.filter(m => m.memberLevel === level);
      }

      return {
        success: true,
        data: {
          list: filteredList,
          pagination: { page, pageSize, total: filteredList.length, totalPages: Math.ceil(filteredList.length / pageSize) },
          stats: {
            normal: memberList.filter(m => m.memberLevel === 'normal').length,
            silver: memberList.filter(m => m.memberLevel === 'silver').length,
            gold: memberList.filter(m => m.memberLevel === 'gold').length,
            platinum: memberList.filter(m => m.memberLevel === 'platinum').length
          }
        }
      };
    } catch (error) {
      console.error('[管理员] 获取会员列表失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取会员详情
   */
  async getMemberDetail(userId) {
    try {
      const user = await this.User.findById(userId).select('-password').lean();
      if (!user) return { success: false, error: '用户不存在' };

      const orders = await this.Order.find({ userId: String(user._id) })
        .sort({ createdAt: -1 }).limit(20).lean();

      const orderStats = await this.Order.aggregate([
        { $match: { userId: String(user._id), status: { $ne: 'cancelled' } } },
        { $group: { _id: null, totalOrders: { $sum: 1 }, totalSpent: { $sum: '$amounts.total' } } }
      ]);

      return {
        success: true,
        data: {
          user,
          orderStats: orderStats[0] || { totalOrders: 0, totalSpent: 0 },
          recentOrders: orders
        }
      };
    } catch (error) {
      console.error('[管理员] 获取会员详情失败:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // 多品类业务管理
  // ============================================

  // 获取所有启用的业务品类配置
  getBusinessCategories() {
    const MODULE_CONFIG = require('../../../config/modules');
    const enabledCategories = [];
    for (const [key, cfg] of Object.entries(MODULE_CONFIG.modules)) {
      if (cfg.enabled) {
        enabledCategories.push({
          id: key,
          name: cfg.name,
          nameEn: cfg.nameEn,
          icon: cfg.icon,
          category: cfg.category,
          version: cfg.version
        });
      }
    }
    return enabledCategories;
  }

  /**
   * 获取品类的订单列表（按 orderType 过滤）
   */
  async getCategoryOrders(category, params = {}) {
    try {
      const { page = 1, pageSize = 20, status, startDate, endDate, keyword } = params;
      const filter = { orderType: category };

      if (status) filter.status = status;
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }
      if (keyword) {
        filter.$or = [
          { orderNo: { $regex: keyword, $options: 'i' } },
          { 'delivery.contactName': { $regex: keyword, $options: 'i' } },
          { 'delivery.contactPhone': { $regex: keyword, $options: 'i' } }
        ];
      }

      const [orders, total] = await Promise.all([
        this.Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
        this.Order.countDocuments(filter)
      ]);

      return {
        success: true,
        data: { list: orders, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } }
      };
    } catch (error) {
      console.error(`[管理员] 获取${category}品类订单失败:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取品类的客户列表（在此品类下过单的用户）
   */
  async getCategoryCustomers(category, params = {}) {
    try {
      const { page = 1, pageSize = 20, keyword } = params;

      // 先找出此品类下所有订单的 userId
      const userIds = await this.Order.distinct('userId', { orderType: category });
      const userFilter = { _id: { $in: userIds.map(id => { try { return new mongoose.Types.ObjectId(id); } catch { return id; } }) } };

      if (keyword) {
        userFilter.$or = [
          { name: { $regex: keyword, $options: 'i' } },
          { phone: { $regex: keyword, $options: 'i' } }
        ];
      }

      const [users, total] = await Promise.all([
        this.User.find(userFilter).select('-password').sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
        this.User.countDocuments(userFilter)
      ]);

      // 为每个用户计算此品类下的订单统计
      const customerList = await Promise.all(users.map(async (user) => {
        const orderCount = await this.Order.countDocuments({ userId: String(user._id), orderType: category });
        const orderStats = await this.Order.aggregate([
          { $match: { userId: String(user._id), orderType: category, status: { $ne: 'cancelled' } } },
          { $group: { _id: null, totalSpent: { $sum: '$amounts.total' }, lastOrder: { $max: '$createdAt' } } }
        ]);
        return {
          userId: user._id,
          name: user.name || '未知',
          phone: user.phone || '',
          avatar: user.avatar,
          orderCount,
          totalSpent: orderStats[0]?.totalSpent || 0,
          lastOrderAt: orderStats[0]?.lastOrder || null,
          status: user.status
        };
      }));

      return {
        success: true,
        data: {
          list: customerList,
          pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
        }
      };
    } catch (error) {
      console.error(`[管理员] 获取${category}品类客户失败:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取品类的会员列表（在此品类下过单的用户 + 会员等级）
   */
  async getCategoryMembers(category, params = {}) {
    try {
      const { page = 1, pageSize = 20, level, keyword } = params;

      const userIds = await this.Order.distinct('userId', { orderType: category });
      const userFilter = { _id: { $in: userIds.map(id => { try { return new mongoose.Types.ObjectId(id); } catch { return id; } }) } };

      if (keyword) {
        userFilter.$or = [
          { name: { $regex: keyword, $options: 'i' } },
          { phone: { $regex: keyword, $options: 'i' } }
        ];
      }

      const users = await this.User.find(userFilter).select('-password').lean();
      const memberList = await Promise.all(users.map(async (user) => {
        const orderCount = await this.Order.countDocuments({ userId: String(user._id), orderType: category });
        const totalSpentResult = await this.Order.aggregate([
          { $match: { userId: String(user._id), orderType: category, status: { $ne: 'cancelled' } } },
          { $group: { _id: null, total: { $sum: '$amounts.total' } } }
        ]);

        const points = user.creditScore || 0;
        let memberLevel = 'normal', memberName = '普通会员';
        if (points >= 10000) { memberLevel = 'platinum'; memberName = '铂金会员'; }
        else if (points >= 5000) { memberLevel = 'gold'; memberName = '黄金会员'; }
        else if (points >= 2000) { memberLevel = 'silver'; memberName = '白银会员'; }

        return {
          userId: user._id,
          name: user.name || '未知',
          phone: user.phone || '',
          memberLevel, memberName, points,
          categoryOrderCount: orderCount,
          categoryTotalSpent: totalSpentResult[0]?.total || 0,
          status: user.status,
          createdAt: user.createdAt
        };
      }));

      let filtered = memberList;
      if (level) filtered = memberList.filter(m => m.memberLevel === level);

      const start = (page - 1) * pageSize;
      const paged = filtered.slice(start, start + pageSize);

      return {
        success: true,
        data: {
          list: paged,
          pagination: { page, pageSize, total: filtered.length, totalPages: Math.ceil(filtered.length / pageSize) },
          stats: {
            normal: memberList.filter(m => m.memberLevel === 'normal').length,
            silver: memberList.filter(m => m.memberLevel === 'silver').length,
            gold: memberList.filter(m => m.memberLevel === 'gold').length,
            platinum: memberList.filter(m => m.memberLevel === 'platinum').length
          }
        }
      };
    } catch (error) {
      console.error(`[管理员] 获取${category}品类会员失败:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取品类的业务统计概览
   */
  async getCategoryStats(category) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [totalOrders, todayOrders, pendingOrders, completedOrders] = await Promise.all([
        this.Order.countDocuments({ orderType: category }),
        this.Order.countDocuments({ orderType: category, createdAt: { $gte: today } }),
        this.Order.countDocuments({ orderType: category, status: { $in: ['pending', 'paid', 'processing'] } }),
        this.Order.countDocuments({ orderType: category, status: 'completed' })
      ]);

      const revenue = await this.Order.aggregate([
        { $match: { orderType: category, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, totalRevenue: { $sum: '$amounts.total' }, todayRevenue: { $sum: { $cond: [{ $gte: ['$createdAt', today] }, '$amounts.total', 0] } } } }
      ]);

      const uniqueCustomers = (await this.Order.distinct('userId', { orderType: category })).length;
      const uniqueStores = (await this.Order.distinct('storeId', { orderType: category })).length;

      return {
        success: true,
        data: {
          totalOrders,
          todayOrders,
          pendingOrders,
          completedOrders,
          totalRevenue: revenue[0]?.totalRevenue || 0,
          todayRevenue: revenue[0]?.todayRevenue || 0,
          uniqueCustomers,
          uniqueStores
        }
      };
    } catch (error) {
      console.error(`[管理员] 获取${category}品类统计失败:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 全量数据完整性检查
   */
  async checkDataIntegrity() {
    try {
      const checks = {};
      const issues = [];

      // 1. 用户数据
      checks.users = await this.User.countDocuments();
      const usersWithNoPhone = await this.User.countDocuments({ phone: { $in: [null, ''] } });
      if (usersWithNoPhone > 0) issues.push({ type: 'users', issue: `${usersWithNoPhone}个用户缺少手机号` });

      // 2. 订单数据
      checks.orders = await this.Order.countDocuments();
      checks.ordersNotDeleted = await this.Order.countDocuments({ isDeleted: { $ne: true } });
      checks.ordersDeleted = await this.Order.countDocuments({ isDeleted: true });
      
      const paidOrders = await this.Order.countDocuments({ 'payment.status': 'paid' });
      const orphanOrders = await this.Order.countDocuments({ userId: '' });
      if (orphanOrders > 0) issues.push({ type: 'orders', issue: `${orphanOrders}个订单无用户ID` });

      // 3. 门店数据
      checks.stores = await this.Store.countDocuments();
      checks.storesActive = await this.Store.countDocuments({ status: 'active' });
      const storesInactive = checks.stores - checks.storesActive;
      if (storesInactive > 0) issues.push({ type: 'stores', issue: `${storesInactive}个门店未激活` });

      // 4. 关联性检查
      checks.ordersWithValidStore = await this.Order.countDocuments({ storeId: { $ne: '' } });
      checks.ordersWithoutStore = checks.orders - checks.ordersWithValidStore;
      if (checks.ordersWithoutStore > 0) issues.push({ type: 'orders', issue: `${checks.ordersWithoutStore}个订单缺少门店关联` });

      // 5. 入驻申请
      const Application = this.getApplicationModel();
      checks.storeApplications = await Application.countDocuments();
      checks.pendingApplications = await Application.countDocuments({ status: 'pending' });

      // 6. 金额校验
      const amounts = await this.Order.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: null, totalRevenue: { $sum: '$amounts.total' }, paidRevenue: { $sum: { $cond: [{ $eq: ['$payment.status', 'paid'] }, '$amounts.total', 0] } } } }
      ]);
      checks.finance = amounts[0] || { totalRevenue: 0, paidRevenue: 0 };

      return {
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          summary: checks,
          issues: issues.length > 0 ? issues : [],
          status: issues.length === 0 ? 'healthy' : 'warning',
          message: issues.length === 0 ? '✅ 全部数据完整，无异常' : `⚠️ 发现${issues.length}个潜在问题`
        }
      };
    } catch (error) {
      console.error('[管理员] 数据完整性检查失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 数据导出（全量或按类型）
   */
  async exportData(type) {
    try {
      const result = { exportedAt: new Date().toISOString(), type };

      if (type === 'all' || type === 'users') {
        result.users = await this.User.find({}).select('-password').lean();
      }
      if (type === 'all' || type === 'orders') {
        result.orders = await this.Order.find({}).lean();
      }
      if (type === 'all' || type === 'stores') {
        result.stores = await this.Store.find({}).lean();
      }
      if (type === 'all' || type === 'applications') {
        const Application = this.getApplicationModel();
        result.applications = await Application.find({}).lean();
      }

      result.counts = {
        users: result.users?.length || 0,
        orders: result.orders?.length || 0,
        stores: result.stores?.length || 0,
        applications: result.applications?.length || 0
      };

      return { success: true, data: result };
    } catch (error) {
      console.error('[管理员] 数据导出失败:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // 连锁企业管理（chain_admin / admin 可访问）
  // ============================================

  /**
   * 创建连锁企业
   */
  async createChain(data, adminId) {
    try {
      const existing = await this.Chain.findOne({ $or: [{ name: data.name }, { adminPhone: data.adminPhone }] });
      if (existing) throw new Error('连锁品牌或管理员手机号已存在');

      const chain = await this.Chain.create({
        ...data,
        chainNo: 'CH' + Date.now().toString(36).toUpperCase(),
        adminId,
        stats: { totalStores: 0, activeStores: 0, totalOrders: 0, totalRevenue: 0, monthlyOrders: 0, monthlyRevenue: 0 }
      });

      // 更新管理员用户角色（adminId 必须是有效 ObjectId 才执行）
      if (adminId && mongoose.Types.ObjectId.isValid(adminId)) {
        await this.User.findByIdAndUpdate(adminId, { $addToSet: { roles: 'chain_admin' } });
      }

      console.log('[连锁管理] 创建连锁:', chain.name, chain.chainNo);
      return { success: true, data: chain };
    } catch (error) {
      console.error('[连锁管理] 创建失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取连锁企业列表
   */
  async getChains(params) {
    try {
      const { page = 1, pageSize = 20, keyword, status, adminId } = params;
      const filter = {};
      if (keyword) {
        filter.$or = [
          { name: { $regex: keyword, $options: 'i' } },
          { chainNo: { $regex: keyword, $options: 'i' } },
          { contactPerson: { $regex: keyword, $options: 'i' } }
        ];
      }
      if (status) filter.status = status;
      if (adminId) filter.adminId = adminId;

      const [chains, total] = await Promise.all([
        this.Chain.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
        this.Chain.countDocuments(filter)
      ]);

      // 为每个连锁补充门店数量
      const enriched = await Promise.all(chains.map(async (chain) => {
        const storeCount = await this.Store.countDocuments({ chainId: chain._id.toString() });
        const activeStoreCount = await this.Store.countDocuments({ chainId: chain._id.toString(), status: 'active' });
        return { ...chain, _storeCount: storeCount, _activeStoreCount: activeStoreCount };
      }));

      return {
        success: true,
        data: { list: enriched, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
      };
    } catch (error) {
      console.error('[连锁管理] 获取列表失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取连锁企业详情
   */
  async getChainDetail(chainId) {
    try {
      const chain = await this.Chain.findOne({
        $or: [{ _id: mongoose.Types.ObjectId.isValid(chainId) ? chainId : null }, { chainNo: chainId }]
      }).lean();
      if (!chain) throw new Error('连锁企业不存在');

      // 获取下属门店
      const stores = await this.Store.find({ chainId: chain._id.toString() }).sort({ createdAt: -1 }).lean();

      // 获取管理员信息（仅当 adminId 为有效 ObjectId 时查询）
      let admin = null;
      if (chain.adminId && mongoose.Types.ObjectId.isValid(chain.adminId)) {
        admin = await this.User.findById(chain.adminId).select('-password').lean();
      }

      // 聚合统计
      const storeIds = stores.map(s => s._id.toString());
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);

      const [totalOrders, todayOrders, monthOrders] = await Promise.all([
        this.Order.countDocuments({ storeId: { $in: storeIds } }),
        this.Order.countDocuments({ storeId: { $in: storeIds }, createdAt: { $gte: today } }),
        this.Order.countDocuments({ storeId: { $in: storeIds }, createdAt: { $gte: monthAgo } })
      ]);

      const revenue = await this.Order.aggregate([
        { $match: { storeId: { $in: storeIds }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$amounts.total' } } }
      ]);

      return {
        success: true,
        data: {
          chain,
          admin: admin ? { id: admin._id, name: admin.name, phone: admin.phone } : null,
          stores,
          stats: {
            totalStores: stores.length,
            activeStores: stores.filter(s => s.status === 'active').length,
            totalOrders,
            todayOrders,
            monthOrders,
            totalRevenue: revenue[0]?.total || 0
          }
        }
      };
    } catch (error) {
      console.error('[连锁管理] 获取详情失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 更新连锁企业信息
   */
  async updateChain(chainId, data) {
    try {
      const chain = await this.Chain.findOneAndUpdate(
        { $or: [{ _id: mongoose.Types.ObjectId.isValid(chainId) ? chainId : null }, { chainNo: chainId }] },
        { ...data, updatedAt: new Date() },
        { new: true }
      );
      if (!chain) throw new Error('连锁企业不存在');
      return { success: true, data: chain };
    } catch (error) {
      console.error('[连锁管理] 更新失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 删除连锁企业
   */
  async deleteChain(chainId) {
    try {
      const chain = await this.Chain.findOneAndDelete({
        $or: [{ _id: mongoose.Types.ObjectId.isValid(chainId) ? chainId : null }, { chainNo: chainId }]
      });
      if (!chain) throw new Error('连锁企业不存在');

      // 移除所有门店的chainId关联
      await this.Store.updateMany({ chainId: chain._id.toString() }, { $set: { chainId: null } });

      // 移除管理员chain_admin角色（adminId 必须是有效 ObjectId 才执行）
      if (chain.adminId && mongoose.Types.ObjectId.isValid(chain.adminId)) {
        await this.User.findByIdAndUpdate(chain.adminId, { $pull: { roles: 'chain_admin' } });
      }

      return { success: true, message: '连锁企业已删除' };
    } catch (error) {
      console.error('[连锁管理] 删除失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 门店加入/移出连锁
   */
  async setStoreToChain(storeId, chainId) {
    try {
      const chain = await this.Chain.findOne({
        $or: [{ _id: mongoose.Types.ObjectId.isValid(chainId) ? chainId : null }, { chainNo: chainId }]
      });
      if (!chain) throw new Error('连锁企业不存在');

      // 查找门店
      let store = null;
      if (mongoose.Types.ObjectId.isValid(storeId)) {
        store = await this.Store.findById(storeId);
      }
      if (!store) {
        store = await this.Store.findOne({ storeNo: storeId });
      }
      if (!store) throw new Error('门店不存在');

      // 使用 mongoose.connection.db 直接操作原生集合
      const storeDocId = store._id;
      const chainIdStr = chain._id.toString();
      const db = mongoose.connection.db;
      const collection = db.collection('stores');
      
      const updateResult = await collection.updateOne(
        { _id: storeDocId },
        { $set: { chainId: chainIdStr } }
      );

      // 直接用原生查询确认
      const verifyDoc = await collection.findOne({ _id: storeDocId });

      // 更新连锁统计
      const storeCount = await collection.countDocuments({ chainId: chainIdStr });
      const activeCount = await collection.countDocuments({ chainId: chainIdStr, status: 'active' });
      await this.Chain.findByIdAndUpdate(chain._id, {
        $set: { 'stats.totalStores': storeCount, 'stats.activeStores': activeCount, updatedAt: new Date() }
      });

      return { success: true, data: verifyDoc, message: `门店 ${verifyDoc.name} 已加入连锁 ${chain.name}` };
    } catch (error) {
      console.error('[连锁管理] 门店加入失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 门店移出连锁
   */
  async removeStoreFromChain(storeId) {
    try {
      let store = null;
      if (mongoose.Types.ObjectId.isValid(storeId)) {
        store = await this.Store.findById(storeId);
      }
      if (!store) {
        store = await this.Store.findOne({ storeNo: storeId });
      }
      if (!store) throw new Error('门店不存在');

      const oldChainId = store.chainId;
      // 使用 mongoose.connection.db 直接操作
      const db = mongoose.connection.db;
      const collection = db.collection('stores');
      await collection.updateOne(
        { _id: store._id },
        { $set: { chainId: '', updatedAt: new Date() } }
      );

      // 如果之前有chainId，更新连锁统计
      if (oldChainId) {
        const storeCount = await collection.countDocuments({ chainId: oldChainId });
        const activeCount = await collection.countDocuments({ chainId: oldChainId, status: 'active' });
        await this.Chain.findByIdAndUpdate(oldChainId, {
          $set: { 'stats.totalStores': storeCount, 'stats.activeStores': activeCount, updatedAt: new Date() }
        });
      }

      return { success: true, data: store, message: `门店 ${store.name} 已移出连锁` };
    } catch (error) {
      console.error('[连锁管理] 门店移出失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 连锁企业仪表盘数据
   */
  async getChainDashboard(chainId) {
    try {
      const chain = await this.Chain.findOne({
        $or: [{ _id: mongoose.Types.ObjectId.isValid(chainId) ? chainId : null }, { chainNo: chainId }]
      }).lean();
      if (!chain) throw new Error('连锁企业不存在');

      const storeIds = (await this.Store.find({ chainId: chain._id.toString() }).lean()).map(s => s._id.toString());

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);

      const [
        totalStores, activeStores,
        totalOrders, todayOrders, weekOrders, monthOrders,
        pendingOrders, completedOrders, cancelledOrders,
        totalUsers, todayNewUsers, weekNewUsers, monthNewUsers
      ] = await Promise.all([
        this.Store.countDocuments({ chainId: chain._id.toString() }),
        this.Store.countDocuments({ chainId: chain._id.toString(), status: 'active' }),
        this.Order.countDocuments({ storeId: { $in: storeIds } }),
        this.Order.countDocuments({ storeId: { $in: storeIds }, createdAt: { $gte: today } }),
        this.Order.countDocuments({ storeId: { $in: storeIds }, createdAt: { $gte: weekAgo } }),
        this.Order.countDocuments({ storeId: { $in: storeIds }, createdAt: { $gte: monthAgo } }),
        this.Order.countDocuments({ storeId: { $in: storeIds }, status: { $in: ['pending', 'paid', 'processing'] } }),
        this.Order.countDocuments({ storeId: { $in: storeIds }, status: 'completed' }),
        this.Order.countDocuments({ storeId: { $in: storeIds }, status: 'cancelled' }),
        // 新增用户统计：统计通过连锁企业订单的用户
        this.User.countDocuments({ 
          _id: { 
            $in: await this.Order.distinct('userId', { storeId: { $in: storeIds } })
              .then(ids => ids.map(id => {
                try { return new mongoose.Types.ObjectId(id); } catch { return id; }
              }))
          },
          roles: 'customer'
        }),
        // 今日新增用户：今日通过连锁企业下单的用户
        this.User.countDocuments({ 
          _id: { 
            $in: await this.Order.distinct('userId', { 
              storeId: { $in: storeIds },
              createdAt: { $gte: today }
            })
              .then(ids => ids.map(id => {
                try { return new mongoose.Types.ObjectId(id); } catch { return id; }
              }))
          },
          roles: 'customer'
        }),
        // 本周新增用户
        this.User.countDocuments({ 
          _id: { 
            $in: await this.Order.distinct('userId', { 
              storeId: { $in: storeIds },
              createdAt: { $gte: weekAgo }
            })
              .then(ids => ids.map(id => {
                try { return new mongoose.Types.ObjectId(id); } catch { return id; }
              }))
          },
          roles: 'customer'
        }),
        // 本月新增用户
        this.User.countDocuments({ 
          _id: { 
            $in: await this.Order.distinct('userId', { 
              storeId: { $in: storeIds },
              createdAt: { $gte: monthAgo }
            })
              .then(ids => ids.map(id => {
                try { return new mongoose.Types.ObjectId(id); } catch { return id; }
              }))
          },
          roles: 'customer'
        })
      ]);

      const revenue = await this.Order.aggregate([
        { $match: { storeId: { $in: storeIds }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$amounts.total' }, todayRevenue: { $sum: { $cond: [{ $gte: ['$createdAt', today] }, '$amounts.total', 0] } }, monthRevenue: { $sum: { $cond: [{ $gte: ['$createdAt', monthAgo] }, '$amounts.total', 0] } } } }
      ]);

      // 各门店汇总
      const storeStats = await this.Order.aggregate([
        { $match: { storeId: { $in: storeIds }, status: { $ne: 'cancelled' } } },
        { $group: { _id: '$storeId', orders: { $sum: 1 }, revenue: { $sum: '$amounts.total' }, todayOrders: { $sum: { $cond: [{ $gte: ['$createdAt', today] }, 1, 0] } } } },
        { $sort: { revenue: -1 } }
      ]);

      // 补充门店名称
      const storesMap = {};
      (await this.Store.find({ chainId: chain._id.toString() }).select('name storeNo status').lean()).forEach(s => { storesMap[s._id.toString()] = s; });

      const storeList = storeStats.map(s => ({
        storeId: s._id,
        storeName: storesMap[s._id]?.name || '未知',
        storeNo: storesMap[s._id]?.storeNo || '',
        status: storesMap[s._id]?.status || '',
        orders: s.orders,
        revenue: s.revenue,
        todayOrders: s.todayOrders
      }));

      // 最近7天趋势
      const dailyStats = [];
      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date(); dayStart.setDate(dayStart.getDate() - i); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
        const count = await this.Order.countDocuments({ storeId: { $in: storeIds }, createdAt: { $gte: dayStart, $lt: dayEnd } });
        dailyStats.push({ date: dayStart.toISOString().slice(0, 10), orders: count });
      }

      return {
        success: true,
        data: {
          chain: { id: chain._id, chainNo: chain.chainNo, name: chain.name, status: chain.status },
          stats: {
            totalStores, activeStores,
            totalOrders, todayOrders, weekOrders, monthOrders,
            pendingOrders, completedOrders, cancelledOrders,
            totalUsers, todayNewUsers, weekNewUsers, monthNewUsers,
            totalRevenue: revenue[0]?.total || 0,
            todayRevenue: revenue[0]?.todayRevenue || 0,
            monthRevenue: revenue[0]?.monthRevenue || 0
          },
          storeList,
          dailyStats,
          subscription: chain.subscription || { plan: 'basic', maxStores: 5 }
        }
      };
    } catch (error) {
      console.error('[连锁管理] 仪表盘失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 连锁企业订单列表（聚合所有下属门店）
   */
  async getChainOrders(chainId, params) {
    try {
      const chain = await this.Chain.findOne({
        $or: [{ _id: mongoose.Types.ObjectId.isValid(chainId) ? chainId : null }, { chainNo: chainId }]
      }).lean();
      if (!chain) throw new Error('连锁企业不存在');

      const storeIds = (await this.Store.find({ chainId: chain._id.toString() }).lean()).map(s => s._id.toString());

      const { page = 1, pageSize = 20, keyword, status, storeId, startDate, endDate } = params;
      const filter = { storeId: { $in: storeIds } };
      if (keyword) {
        filter.$or = [
          { orderNo: { $regex: keyword, $options: 'i' } },
          { 'delivery.contactPhone': { $regex: keyword, $options: 'i' } }
        ];
      }
      if (status) filter.status = status;
      if (storeId) filter.storeId = storeId;
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }

      const [orders, total] = await Promise.all([
        this.Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
        this.Order.countDocuments(filter)
      ]);

      // 补充门店名称
      const storesMap = {};
      (await this.Store.find({ chainId: chain._id.toString() }).select('name storeNo').lean()).forEach(s => { storesMap[s._id.toString()] = s; });
      const enriched = orders.map(o => ({ ...o, storeName: storesMap[o.storeId]?.name || '未知' }));

      return { success: true, data: { list: enriched, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
    } catch (error) {
      console.error('[连锁管理] 获取订单失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取连锁企业未关联门店列表（用于加入连锁）
   */
  async getUnchainedStores() {
    try {
      const stores = await this.Store.find({ $or: [{ chainId: null }, { chainId: '' }, { chainId: { $exists: false } }] })
        .select('name storeNo address city district status').sort({ createdAt: -1 }).lean();
      return { success: true, data: stores };
    } catch (error) {
      console.error('[连锁管理] 获取未关联门店失败:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // 资金管理
  // ============================================

  /**
   * 获取连锁资金概览
   */
  async getChainFinanceOverview(chainId) {
    try {
      const chain = await this.Chain.findOne({
        $or: [{ _id: mongoose.Types.ObjectId.isValid(chainId) ? chainId : null }, { chainNo: chainId }]
      }).lean();
      if (!chain) throw new Error('连锁企业不存在');

      const storeIds = (await this.Store.find({ chainId: chain._id.toString() }).lean()).map(s => s._id.toString());
      
      // 获取总订单统计
      const orderStats = await this.Order.aggregate([
        { $match: { storeId: { $in: storeIds }, status: { $ne: 'cancelled' } } },
        { $group: { 
          _id: null, 
          totalRevenue: { $sum: '$amounts.total' },
          totalOrders: { $sum: 1 },
          completedRevenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$amounts.total', 0] } },
          pendingRevenue: { $sum: { $cond: [{ $in: ['$status', ['pending', 'paid', 'processing']] }, '$amounts.total', 0] } }
        } }
      ]);

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);

      const [todayStats, weekStats, monthStats] = await Promise.all([
        this.Order.aggregate([
          { $match: { storeId: { $in: storeIds }, createdAt: { $gte: today }, status: { $ne: 'cancelled' } } },
          { $group: { _id: null, revenue: { $sum: '$amounts.total' }, orders: { $sum: 1 } } }
        ]),
        this.Order.aggregate([
          { $match: { storeId: { $in: storeIds }, createdAt: { $gte: weekAgo }, status: { $ne: 'cancelled' } } },
          { $group: { _id: null, revenue: { $sum: '$amounts.total' }, orders: { $sum: 1 } } }
        ]),
        this.Order.aggregate([
          { $match: { storeId: { $in: storeIds }, createdAt: { $gte: monthAgo }, status: { $ne: 'cancelled' } } },
          { $group: { _id: null, revenue: { $sum: '$amounts.total' }, orders: { $sum: 1 } } }
        ])
      ]);

      return {
        success: true,
        data: {
          chain: { id: chain._id, chainNo: chain.chainNo, name: chain.name },
          overview: {
            totalAmount: orderStats[0]?.totalRevenue || 0,
            totalOrders: orderStats[0]?.totalOrders || 0,
            completedRevenue: orderStats[0]?.completedRevenue || 0,
            pendingAmount: orderStats[0]?.pendingRevenue || 0,
            settledAmount: orderStats[0]?.completedRevenue || 0,
            todayChange: todayStats[0]?.revenue || 0,
            todayRevenue: todayStats[0]?.revenue || 0,
            todayOrders: todayStats[0]?.orders || 0,
            weekRevenue: weekStats[0]?.revenue || 0,
            weekOrders: weekStats[0]?.orders || 0,
            monthRevenue: monthStats[0]?.revenue || 0,
            monthOrders: monthStats[0]?.orders || 0
          }
        }
      };
    } catch (error) {
      console.error('[资金管理] 获取概览失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取连锁资金流水记录
   */
  async getChainFinanceRecords(chainId, params) {
    try {
      const chain = await this.Chain.findOne({
        $or: [{ _id: mongoose.Types.ObjectId.isValid(chainId) ? chainId : null }, { chainNo: chainId }]
      }).lean();
      if (!chain) throw new Error('连锁企业不存在');

      const storeIds = (await this.Store.find({ chainId: chain._id.toString() }).lean()).map(s => s._id.toString());
      
      const { page = 1, pageSize = 10, type, startDate, endDate } = params;
      const filter = { storeId: { $in: storeIds }, status: { $ne: 'cancelled' } };
      
      if (type) {
        if (type === 'income') filter['payment.status'] = 'paid';
        else if (type === 'pending') filter.status = { $in: ['pending', 'paid', 'processing'] };
        else if (type === 'completed') filter.status = 'completed';
      }
      
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }

      const [orders, total] = await Promise.all([
        this.Order.find(filter)
          .select('orderNo storeId userId amounts.total payment.status status createdAt')
          .populate('userId', 'name phone')
          .populate('storeId', 'name storeNo')
          .sort({ createdAt: -1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .lean(),
        this.Order.countDocuments(filter)
      ]);

      // 计算累计余额
      let runningBalance = 0;
      const records = orders.map(order => {
        const amount = order.amounts?.total || 0;
        let type = 'order'; // 默认是订单收入
        
        // 根据订单状态和支付状态确定类型
        if (order.status === 'completed' && order.payment?.status === 'paid') {
          type = 'order'; // 订单收入
        } else if (order.status === 'refunded') {
          type = 'refund'; // 退款
        } else if (order.settlementId) {
          // 如果有settlementId字段，说明已结算
          type = 'settlement'; // 结算出账
        }
        
        // 模拟余额计算（在实际应用中应该从专门的资金流水表获取）
        runningBalance += type === 'settlement' || type === 'refund' ? -amount : amount;
        
        return {
          id: order._id,
          orderNo: order.orderNo,
          storeName: order.storeId?.name || '未知',
          storeNo: order.storeId?.storeNo || '',
          customerName: order.userId?.name || '未知',
          customerPhone: order.userId?.phone || '',
          amount: type === 'settlement' || type === 'refund' ? -amount : amount,
          type: type,
          remark: type === 'order' ? '订单收入' : type === 'settlement' ? '门店结算' : type === 'refund' ? '订单退款' : '系统调整',
          balance: runningBalance,
          createdAt: order.createdAt
        };
      });

      return {
        success: true,
        data: {
          list: records,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
          }
        }
      };
    } catch (error) {
      console.error('[资金管理] 获取流水记录失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取连锁门店资金统计
   */
  async getChainStoreFinance(chainId) {
    try {
      const chain = await this.Chain.findOne({
        $or: [{ _id: mongoose.Types.ObjectId.isValid(chainId) ? chainId : null }, { chainNo: chainId }]
      }).lean();
      if (!chain) throw new Error('连锁企业不存在');

      const stores = await this.Store.find({ chainId: chain._id.toString() }).lean();
      const storeIds = stores.map(s => s._id.toString());

      // 获取每个门店的订单统计
      const storeStats = await this.Order.aggregate([
        { $match: { storeId: { $in: storeIds }, status: { $ne: 'cancelled' } } },
        { $group: { 
          _id: '$storeId', 
          totalRevenue: { $sum: '$amounts.total' },
          totalOrders: { $sum: 1 },
          completedRevenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$amounts.total', 0] } },
          pendingRevenue: { $sum: { $cond: [{ $in: ['$status', ['pending', 'paid', 'processing']] }, '$amounts.total', 0] } }
        } }
      ]);

      const storeStatsMap = {};
      storeStats.forEach(stat => {
        storeStatsMap[stat._id] = stat;
      });

      const result = stores.map(store => ({
        storeId: store._id,
        storeNo: store.storeNo,
        storeName: store.name,
        status: store.status,
        totalRevenue: storeStatsMap[store._id]?.totalRevenue || 0,
        totalOrders: storeStatsMap[store._id]?.totalOrders || 0,
        completedRevenue: storeStatsMap[store._id]?.completedRevenue || 0,
        pendingRevenue: storeStatsMap[store._id]?.pendingRevenue || 0,
        settlementRatio: store.settlementRatio || 0.7, // 默认结算比例70%
        settlementAmount: Math.round((storeStatsMap[store._id]?.completedRevenue || 0) * (store.settlementRatio || 0.7) * 100) / 100
      }));

      // 按营收排序
      result.sort((a, b) => b.totalRevenue - a.totalRevenue);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('[资金管理] 获取门店资金失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取连锁资金趋势
   */
  async getChainFinanceTrend(chainId) {
    try {
      const chain = await this.Chain.findOne({
        $or: [{ _id: mongoose.Types.ObjectId.isValid(chainId) ? chainId : null }, { chainNo: chainId }]
      }).lean();
      if (!chain) throw new Error('连锁企业不存在');

      const storeIds = (await this.Store.find({ chainId: chain._id.toString() }).lean()).map(s => s._id.toString());

      // 最近30天趋势
      const trendData = [];
      const today = new Date();
      
      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const stats = await this.Order.aggregate([
          { 
            $match: { 
              storeId: { $in: storeIds },
              status: { $ne: 'cancelled' },
              createdAt: { $gte: date, $lt: nextDate }
            } 
          },
          { 
            $group: { 
              _id: null, 
              revenue: { $sum: '$amounts.total' },
              orders: { $sum: 1 }
            } 
          }
        ]);

        trendData.push({
          date: date.toISOString().slice(0, 10),
          revenue: stats[0]?.revenue || 0,
          orders: stats[0]?.orders || 0
        });
      }

      // 月度趋势（最近12个月）
      const monthlyTrend = [];
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      
      for (let i = 11; i >= 0; i--) {
        const month = (currentMonth - i + 12) % 12;
        const year = currentYear + Math.floor((currentMonth - i) / 12);
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 1);

        const stats = await this.Order.aggregate([
          { 
            $match: { 
              storeId: { $in: storeIds },
              status: { $ne: 'cancelled' },
              createdAt: { $gte: startDate, $lt: endDate }
            } 
          },
          { 
            $group: { 
              _id: null, 
              revenue: { $sum: '$amounts.total' },
              orders: { $sum: 1 }
            } 
          }
        ]);

        monthlyTrend.push({
          month: `${year}-${String(month + 1).padStart(2, '0')}`,
          revenue: stats[0]?.revenue || 0,
          orders: stats[0]?.orders || 0
        });
      }

      return {
        success: true,
        data: {
          dailyTrend: trendData,
          monthlyTrend: monthlyTrend
        }
      };
    } catch (error) {
      console.error('[资金管理] 获取趋势失败:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // 结算中心
  // ============================================

  /**
   * 获取结算概览
   */
  async getChainSettlementOverview(chainId) {
    try {
      const chain = await this.Chain.findOne({
        $or: [{ _id: mongoose.Types.ObjectId.isValid(chainId) ? chainId : null }, { chainNo: chainId }]
      }).lean();
      if (!chain) throw new Error('连锁企业不存在');

      const storeIds = (await this.Store.find({ chainId: chain._id.toString() }).lean()).map(s => s._id.toString());

      // 获取已结算和待结算金额
      // 注意：由于Order模型没有settlementStatus字段，我们先假设所有完成的订单都是待结算状态
      const settlementStats = await this.Order.aggregate([
        { $match: { storeId: { $in: storeIds }, status: 'completed' } },
        { 
          $group: { 
            _id: null, 
            totalCompletedRevenue: { $sum: '$amounts.total' },
            settledRevenue: { $sum: 0 }, // 暂时设为0，因为没有结算状态字段
            pendingRevenue: { $sum: '$amounts.total' } // 所有完成的订单都视为待结算
          } 
        }
      ]);

      // 获取最近结算记录
      const recentSettlements = await this.getSettlementModel().find({ chainId: chain._id.toString() })
        .sort({ settlementDate: -1 })
        .limit(5)
        .populate('storeId', 'name storeNo')
        .lean();

      // 获取待结算的门店（所有已完成的订单都视为待结算）
      const pendingSettlementStores = await this.Order.aggregate([
        { $match: { storeId: { $in: storeIds }, status: 'completed' } },
        { 
          $group: { 
            _id: '$storeId', 
            pendingAmount: { $sum: '$amounts.total' },
            orderCount: { $sum: 1 }
          } 
        },
        { $sort: { pendingAmount: -1 } }
      ]);

      // 获取结算单统计
      const Settlement = this.getSettlementModel();
      const [pendingCount, completedCount] = await Promise.all([
        Settlement.countDocuments({ chainId: chain._id.toString(), status: 'pending' }),
        Settlement.countDocuments({ chainId: chain._id.toString(), status: 'completed' })
      ]);

      return {
        success: true,
        data: {
          overview: {
            pendingCount,
            completedCount,
            totalAmount: settlementStats[0]?.totalCompletedRevenue || 0,
            totalCompletedRevenue: settlementStats[0]?.totalCompletedRevenue || 0,
            settledRevenue: settlementStats[0]?.settledRevenue || 0,
            pendingRevenue: settlementStats[0]?.pendingRevenue || 0,
            pendingStores: pendingSettlementStores.length
          },
          recentSettlements: recentSettlements.map(s => ({
            id: s._id,
            settlementNo: s.settlementNo,
            storeName: s.storeId?.name || '未知',
            amount: s.amount,
            status: s.status,
            settlementDate: s.settlementDate
          })),
          pendingStores: pendingSettlementStores.map(s => ({
            storeId: s._id,
            pendingAmount: s.pendingAmount,
            orderCount: s.orderCount
          }))
        }
      };
    } catch (error) {
      console.error('[结算中心] 获取概览失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取结算单列表
   */
  async getChainSettlements(chainId, params) {
    try {
      const chain = await this.Chain.findOne({
        $or: [{ _id: mongoose.Types.ObjectId.isValid(chainId) ? chainId : null }, { chainNo: chainId }]
      }).lean();
      if (!chain) throw new Error('连锁企业不存在');

      const { page = 1, pageSize = 10, status } = params;
      const filter = { chainId: chain._id.toString() };
      if (status) filter.status = status;

      const Settlement = this.getSettlementModel();
      const [settlements, total] = await Promise.all([
        Settlement.find(filter)
          .populate('storeId', 'name storeNo')
          .sort({ settlementDate: -1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .lean(),
        Settlement.countDocuments(filter)
      ]);

      return {
        success: true,
        data: {
          list: settlements.map(s => ({
            id: s._id,
            settlementNo: s.settlementNo,
            storeName: s.storeId?.name || '未知',
            storeNo: s.storeId?.storeNo || '',
            period: s.period,
            amount: s.amount,
            ratio: s.ratio,
            status: s.status,
            settlementDate: s.settlementDate,
            remark: s.remark,
            createdAt: s.createdAt
          })),
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
          }
        }
      };
    } catch (error) {
      console.error('[结算中心] 获取结算单列表失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 创建结算单
   */
  async createChainSettlement(chainId, data, user) {
    try {
      const chain = await this.Chain.findOne({
        $or: [{ _id: mongoose.Types.ObjectId.isValid(chainId) ? chainId : null }, { chainNo: chainId }]
      }).lean();
      if (!chain) throw new Error('连锁企业不存在');

      const store = await this.Store.findOne({
        $or: [{ _id: mongoose.Types.ObjectId.isValid(data.storeId) ? data.storeId : null }, { storeNo: data.storeId }]
      }).lean();
      if (!store) throw new Error('门店不存在');

      // 获取待结算的订单（所有已完成的订单）
      const pendingOrders = await this.Order.find({
        storeId: store._id.toString(),
        status: 'completed'
      }).lean();

      if (pendingOrders.length === 0) {
        return { success: false, error: '该门店没有待结算的订单' };
      }

      // 计算结算金额
      const totalAmount = pendingOrders.reduce((sum, order) => sum + (order.amounts?.total || 0), 0);
      const settlementAmount = Math.round(totalAmount * (data.ratio || 0.7) * 100) / 100;

      // 创建结算单
      const Settlement = this.getSettlementModel();
      const settlement = await Settlement.create({
        settlementNo: 'SET' + Date.now().toString(36).toUpperCase(),
        chainId: chain._id.toString(),
        storeId: store._id.toString(),
        period: data.period,
        amount: settlementAmount,
        ratio: data.ratio || 0.7,
        status: 'pending',
        remark: data.remark || '',
        createdBy: user.id,
        createdAt: new Date(),
        settlementDate: new Date(),
        orders: pendingOrders.map(order => ({
          orderId: order._id,
          orderNo: order.orderNo,
          amount: order.amounts?.total || 0,
          orderDate: order.createdAt
        }))
      });

      // 注意：Order模型目前没有settlementStatus和settlementId字段
      // 如果需要标记订单为已结算，需要先为Order模型添加这些字段
      // await this.Order.updateMany(
      //   { _id: { $in: pendingOrders.map(o => o._id) } },
      //   { $set: { settlementStatus: 'settled', settlementId: settlement._id } }
      // );

      console.log(`[结算中心] 创建结算单: ${settlement.settlementNo}, 金额: ${settlementAmount}, 订单数: ${pendingOrders.length}`);

      return {
        success: true,
        data: {
          settlementNo: settlement.settlementNo,
          storeName: store.name,
          period: settlement.period,
          amount: settlement.amount,
          ratio: settlement.ratio,
          orderCount: pendingOrders.length,
          remark: settlement.remark
        }
      };
    } catch (error) {
      console.error('[结算中心] 创建结算单失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取结算模型
   */
  getSettlementModel() {
    const settlementSchema = new mongoose.Schema({
      settlementNo: { type: String, unique: true, index: true },
      chainId: { type: String, required: true, index: true },
      storeId: { type: String, required: true, index: true },
      period: { type: String, required: true }, // 结算周期，如 "2024-01"
      amount: { type: Number, required: true },
      ratio: { type: Number, required: true, default: 0.7 }, // 结算比例
      status: { type: String, enum: ['pending', 'paid', 'cancelled'], default: 'pending' },
      remark: String,
      createdBy: String, // 创建人ID
      createdAt: { type: Date, default: Date.now },
      settlementDate: { type: Date, default: Date.now },
      paidAt: Date,
      orders: [{
        orderId: String,
        orderNo: String,
        amount: Number,
        orderDate: Date
      }]
    });

    settlementSchema.index({ chainId: 1, storeId: 1 });
    settlementSchema.index({ settlementDate: -1 });
    settlementSchema.index({ status: 1 });

    return mongoose.models.Settlement || mongoose.model('Settlement', settlementSchema);
  }

  /**
   * 获取连锁门店结算配置列表
   */
  async getSettlementStores(chainId) {
    try {
      const chain = await this.Chain.findOne({
        $or: [{ _id: mongoose.Types.ObjectId.isValid(chainId) ? chainId : null }, { chainNo: chainId }]
      }).lean();
      if (!chain) throw new Error('连锁企业不存在');

      // 获取连锁下的所有门店
      const stores = await this.Store.find({ chainId: chain._id.toString() })
        .sort({ name: 1 })
        .lean();

      // 获取每个门店的订单统计
      const storeIds = stores.map(s => s._id.toString());
      const storeStats = await this.Order.aggregate([
        { $match: { storeId: { $in: storeIds }, status: { $ne: 'cancelled' } } },
        { $group: { 
          _id: '$storeId', 
          totalRevenue: { $sum: '$amounts.total' },
          totalOrders: { $sum: 1 },
          pendingOrders: { $sum: { $cond: [{ $in: ['$status', ['pending', 'paid', 'processing']] }, 1, 0] } },
          completedOrders: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
        } }
      ]);

      const statsMap = {};
      storeStats.forEach(stat => {
        statsMap[stat._id.toString()] = stat;
      });

      const result = stores.map(store => {
        const stats = statsMap[store._id.toString()] || {};
        const storeTypeMap = { self: '自营', franchise: '加盟', joint: '联营' };
        
        return {
          id: store._id,
          storeNo: store.storeNo,
          name: store.name,
          address: store.address,
          status: store.status,
          storeType: store.storeType || 'self',
          storeTypeText: storeTypeMap[store.storeType] || '自营',
          terminalSettlementEnabled: store.terminalSettlementEnabled !== false, // 默认开启
          settlementRatio: store.settlementRatio || 0.7,
          totalRevenue: stats.totalRevenue || 0,
          totalOrders: stats.totalOrders || 0,
          pendingOrders: stats.pendingOrders || 0,
          completedOrders: stats.completedOrders || 0,
          lastOrderDate: store.updatedAt
        };
      });

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('[结算权限] 获取门店列表失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 更新门店结算配置
   */
  async updateStoreSettlementConfig(chainId, storeId, config) {
    try {
      const chain = await this.Chain.findOne({
        $or: [{ _id: mongoose.Types.ObjectId.isValid(chainId) ? chainId : null }, { chainNo: chainId }]
      }).lean();
      if (!chain) throw new Error('连锁企业不存在');

      // 验证门店属于该连锁
      const store = await this.Store.findOne({ 
        _id: mongoose.Types.ObjectId.isValid(storeId) ? storeId : null,
        chainId: chain._id.toString() 
      });
      
      if (!store) throw new Error('门店不存在或不属于该连锁');

      // 根据门店类型自动设置终端结算权限
      let terminalSettlementEnabled = config.terminalSettlementEnabled;
      
      // 逻辑规则：
      // 1. 自营门店：连锁端默认关闭终端结算功能
      // 2. 加盟门店：连锁端默认开启终端结算功能
      // 3. 联营门店：连锁端可自行选择开启/关闭
      if (config.storeType === 'self') {
        terminalSettlementEnabled = false; // 自营门店关闭终端结算
      } else if (config.storeType === 'franchise') {
        terminalSettlementEnabled = true; // 加盟门店开启终端结算
      }
      // 联营门店保持用户设置的值

      // 更新门店配置
      store.storeType = config.storeType || store.storeType;
      store.terminalSettlementEnabled = terminalSettlementEnabled;
      store.settlementRatio = config.settlementRatio || store.settlementRatio;
      await store.save();

      return {
        success: true,
        data: {
          storeId: store._id,
          storeNo: store.storeNo,
          name: store.name,
          storeType: store.storeType,
          terminalSettlementEnabled: store.terminalSettlementEnabled,
          settlementRatio: store.settlementRatio,
          message: '门店结算配置更新成功'
        }
      };
    } catch (error) {
      console.error('[结算权限] 更新门店配置失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 批量更新门店结算配置
   */
  async batchUpdateStoreSettlementConfig(chainId, storeIds, config) {
    try {
      const chain = await this.Chain.findOne({
        $or: [{ _id: mongoose.Types.ObjectId.isValid(chainId) ? chainId : null }, { chainNo: chainId }]
      }).lean();
      if (!chain) throw new Error('连锁企业不存在');

      // 验证所有门店属于该连锁
      const stores = await this.Store.find({ 
        _id: { $in: storeIds.map(id => mongoose.Types.ObjectId.isValid(id) ? id : null).filter(Boolean) },
        chainId: chain._id.toString() 
      });

      if (stores.length !== storeIds.length) {
        throw new Error('部分门店不存在或不属于该连锁');
      }

      const updatedStores = [];
      
      for (const store of stores) {
        // 根据门店类型自动设置终端结算权限
        let terminalSettlementEnabled = config.terminalSettlementEnabled;
        
        if (config.storeType === 'self') {
          terminalSettlementEnabled = false; // 自营门店关闭终端结算
        } else if (config.storeType === 'franchise') {
          terminalSettlementEnabled = true; // 加盟门店开启终端结算
        }
        // 联营门店保持用户设置的值，如果没有设置则保持原状
        else if (config.storeType === 'joint' && terminalSettlementEnabled === undefined) {
          terminalSettlementEnabled = store.terminalSettlementEnabled;
        }

        // 更新门店配置
        if (config.storeType) store.storeType = config.storeType;
        if (terminalSettlementEnabled !== undefined) store.terminalSettlementEnabled = terminalSettlementEnabled;
        if (config.settlementRatio !== undefined) store.settlementRatio = config.settlementRatio;
        
        await store.save();
        updatedStores.push({
          storeId: store._id,
          storeNo: store.storeNo,
          name: store.name,
          storeType: store.storeType,
          terminalSettlementEnabled: store.terminalSettlementEnabled,
          settlementRatio: store.settlementRatio
        });
      }

      return {
        success: true,
        data: {
          count: updatedStores.length,
          stores: updatedStores,
          message: `批量更新了 ${updatedStores.length} 家门店的结算配置`
        }
      };
    } catch (error) {
      console.error('[结算权限] 批量更新门店配置失败:', error);
      return { success: false, error: error.message };
    }
  }

  // ========== BD管理模型与方法 ==========

  getBDTeamModel() {
    const bdSchema = new mongoose.Schema({
      bdNo: { type: String, unique: true, index: true },
      name: { type: String, required: true },
      phone: { type: String, required: true, unique: true },
      region: String,
      level: { type: String, enum: ['junior', 'senior', 'manager', 'director'], default: 'junior' },
      teamName: String,
      parentBdId: String,
      children: [{ type: String }],
      status: { type: String, enum: ['active', 'inactive'], default: 'active' },
      storeCount: { type: Number, default: 0 },
      totalOrders: { type: Number, default: 0 },
      stats: {
        monthlyNewStores: { type: Number, default: 0 },
        monthlyOrders: { type: Number, default: 0 }
      },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    });
    bdSchema.index({ parentBdId: 1 });
    bdSchema.index({ status: 1 });
    return mongoose.models.BDTeam || mongoose.model('BDTeam', bdSchema);
  }

  async getBDTeamList(params) {
    try {
      const { page = 1, pageSize = 50, keyword, status, level, parentBdId } = params;
      const filter = {};
      if (keyword) {
        filter.$or = [
          { name: { $regex: keyword, $options: 'i' } },
          { phone: { $regex: keyword, $options: 'i' } },
          { bdNo: { $regex: keyword, $options: 'i' } }
        ];
      }
      if (status) filter.status = status;
      if (level) filter.level = level;
      if (parentBdId) filter.parentBdId = parentBdId; // BD主管只看团队下级

      const [list, total] = await Promise.all([
        this.BDTeam.find(filter).sort({ level: 1, createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
        this.BDTeam.countDocuments(filter)
      ]);
      return { success: true, data: { list, total, page, pageSize } };
    } catch (error) {
      console.error('[BD管理] 获取BD列表失败:', error);
      return { success: false, error: error.message };
    }
  }

  async getActiveBDList() {
    try {
      const list = await this.BDTeam.find({ status: 'active' }).sort({ level: -1, name: 1 });
      return { success: true, data: list };
    } catch (error) {
      console.error('[BD管理] 获取活跃BD失败:', error);
      return { success: false, error: error.message };
    }
  }

  async getBDById(id) {
    try {
      const bd = await this.BDTeam.findById(id);
      if (!bd) return { success: false, error: 'BD不存在' };
      // 获取下级BD
      const children = await this.BDTeam.find({ parentBdId: id });
      return { success: true, data: { ...bd.toObject(), childrenList: children } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async createBD(data) {
    try {
      const bdNo = 'BD' + String(Date.now()).slice(-8);
      const bd = new this.BDTeam({ ...data, bdNo });
      await bd.save();
      // 维护上级children列表
      if (data.parentBdId) {
        await this.BDTeam.findByIdAndUpdate(data.parentBdId, { $addToSet: { children: bd._id.toString() } });
      }
      return { success: true, data: bd };
    } catch (error) {
      console.error('[BD管理] 创建BD失败:', error);
      return { success: false, error: error.message };
    }
  }

  async updateBD(id, data) {
    try {
      const bd = await this.BDTeam.findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true });
      if (!bd) return { success: false, error: 'BD不存在' };
      return { success: true, data: bd };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteBD(id) {
    try {
      const bd = await this.BDTeam.findByIdAndUpdate(id, { status: 'inactive', updatedAt: new Date() }, { new: true });
      if (!bd) return { success: false, error: 'BD不存在' };
      return { success: true, data: bd };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getBDStats() {
    try {
      const [total, active, levels] = await Promise.all([
        this.BDTeam.countDocuments(),
        this.BDTeam.countDocuments({ status: 'active' }),
        this.BDTeam.aggregate([{ $group: { _id: '$level', count: { $sum: 1 } } }])
      ]);
      const levelMap = {};
      levels.forEach(l => levelMap[l._id] = l.count);
      return { success: true, data: { total, active, levelDistribution: levelMap } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ========== 客服中心模型与方法 ==========

  getServiceTicketModel() {
    const ticketSchema = new mongoose.Schema({
      ticketNo: { type: String, unique: true, index: true },
      orderId: String,
      orderNo: String,
      storeId: String,
      storeName: String,
      customerId: String,
      customerName: String,
      customerPhone: String,
      category: { type: String, enum: ['order_status', 'quality', 'refund', 'delivery', 'payment', 'complaint', 'other'], default: 'other' },
      priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
      title: String,
      description: String,
      status: { type: String, enum: ['open', 'processing', 'resolved', 'closed'], default: 'open' },
      assignedTo: { type: String, default: 'ai_agent' },
      resolution: String,
      conversations: [{
        sender: { type: String, enum: ['customer', 'ai_agent', 'human_agent', 'system'] },
        content: String,
        time: { type: Date, default: Date.now }
      }],
      source: { type: String, enum: ['admin', 'c_end', 'auto'], default: 'admin' },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    });
    ticketSchema.index({ status: 1, priority: -1, createdAt: -1 });
    ticketSchema.index({ customerId: 1 });
    ticketSchema.index({ orderId: 1 });
    return mongoose.models.ServiceTicket || mongoose.model('ServiceTicket', ticketSchema);
  }

  async getTickets(params) {
    try {
      const { page = 1, pageSize = 20, status, priority, keyword, storeId } = params;
      const filter = {};
      if (status) filter.status = status;
      if (priority) filter.priority = priority;
      if (storeId) filter.storeId = storeId;
      if (keyword) {
        filter.$or = [
          { ticketNo: { $regex: keyword, $options: 'i' } },
          { title: { $regex: keyword, $options: 'i' } },
          { customerName: { $regex: keyword, $options: 'i' } },
          { customerPhone: { $regex: keyword, $options: 'i' } }
        ];
      }
      const [list, total] = await Promise.all([
        this.ServiceTicket.find(filter).sort({ priority: -1, createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
        this.ServiceTicket.countDocuments(filter)
      ]);
      return { success: true, data: { list, total, page, pageSize } };
    } catch (error) {
      console.error('[客服中心] 获取工单失败:', error);
      return { success: false, error: error.message };
    }
  }

  async getTicketById(id) {
    try {
      const ticket = await this.ServiceTicket.findById(id);
      if (!ticket) return { success: false, error: '工单不存在' };
      return { success: true, data: ticket };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async createTicket(data) {
    try {
      const ticketNo = 'TK' + String(Date.now()).slice(-10);
      const ticket = new this.ServiceTicket({
        ...data,
        ticketNo,
        assignedTo: 'ai_agent',
        status: 'open'
      });
      // 智能体自动首次响应
      const aiReply = this._aiAgentGenerateReply(data.description || data.title || '', null);
      ticket.conversations.push({
        sender: 'ai_agent',
        content: aiReply,
        time: new Date()
      });
      ticket.status = 'processing';
      await ticket.save();
      return { success: true, data: ticket };
    } catch (error) {
      console.error('[客服中心] 创建工单失败:', error);
      return { success: false, error: error.message };
    }
  }

  async submitTicketFromC(data) {
    try {
      const ticketNo = 'TK' + String(Date.now()).slice(-10);
      // 尝试关联订单信息
      let orderInfo = {};
      if (data.orderId) {
        const order = await this.Order.findById(data.orderId);
        if (order) {
          orderInfo = {
            orderId: order._id.toString(),
            orderNo: order.orderNo,
            storeId: order.storeId
          };
        }
      }
      const ticket = new this.ServiceTicket({
        ...data,
        ...orderInfo,
        ticketNo,
        source: 'c_end',
        assignedTo: 'ai_agent',
        status: 'open'
      });
      const aiReply = this._aiAgentGenerateReply(data.description || data.title || '', orderInfo.orderNo ? { orderNo: orderInfo.orderNo } : null);
      ticket.conversations.push({ sender: 'ai_agent', content: aiReply, time: new Date() });
      ticket.status = 'processing';
      await ticket.save();
      return { success: true, data: ticket };
    } catch (error) {
      console.error('[客服中心] C端提交工单失败:', error);
      return { success: false, error: error.message };
    }
  }

  async getMyTickets(customerId) {
    try {
      const list = await this.ServiceTicket.find({ customerId }).sort({ createdAt: -1 }).limit(50);
      return { success: true, data: list };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async aiAgentRespond(ticketId, userMessage) {
    try {
      const ticket = await this.ServiceTicket.findById(ticketId);
      if (!ticket) return { success: false, error: '工单不存在' };
      // 添加用户消息
      ticket.conversations.push({ sender: 'customer', content: userMessage, time: new Date() });
      // 查询订单上下文
      let orderContext = null;
      if (ticket.orderId || ticket.orderNo) {
        const q = ticket.orderId ? { _id: ticket.orderId } : { orderNo: ticket.orderNo };
        orderContext = await this.Order.findOne(q).lean();
      }
      // 智能体生成回复
      const aiReply = this._aiAgentGenerateReply(userMessage, orderContext);
      ticket.conversations.push({ sender: 'ai_agent', content: aiReply, time: new Date() });
      // 投诉类自动升级
      if (this._isComplaint(userMessage)) {
        ticket.priority = 'urgent';
        ticket.assignedTo = 'human_agent';
      }
      ticket.updatedAt = new Date();
      await ticket.save();
      return { success: true, data: ticket };
    } catch (error) {
      console.error('[智能体] 响应失败:', error);
      return { success: false, error: error.message };
    }
  }

  _isComplaint(text) {
    const keywords = ['投诉', '不满', '差评', '举报', '工商', '消协', '律师'];
    return keywords.some(k => text.includes(k));
  }

  _aiAgentGenerateReply(message, orderContext) {
    const msg = (message || '').toLowerCase();
    // 订单状态查询
    if (/订单|状态|进度|到哪了|什么时候|多久/.test(msg)) {
      if (orderContext) {
        const statusMap = { pending: '待支付', paid: '已支付待处理', processing: '处理中', completed: '已完成', cancelled: '已取消' };
        return `您好！我是客服智能体小洁✨。\n\n您的订单 ${orderContext.orderNo || ''} 当前状态为：【${statusMap[orderContext.status] || orderContext.status}】。\n\n如有疑问请继续咨询，我将竭诚为您服务！`;
      }
      return '您好！我是客服智能体小洁✨。\n\n请提供您的订单号，我将为您查询最新订单状态。您可以在“我的订单”页面查看订单编号。';
    }
    // 退款问题
    if (/退款|退钱|退还|退费|退还/.test(msg)) {
      return '您好！我是客服智能体小洁✨。\n\n关于退款流程：\n1. 退款申请提交后，我们将在1-3个工作日内审核\n2. 审核通过后，退款将在3-5个工作日内原路返回\n3. 如超时未收到，请联系人工客服进一步处理\n\n如需提交退款申请，请提供订单号，我将为您记录并加速处理。';
    }
    // 配送问题
    if (/配送|快递|取件|送货|物流|骑手/.test(msg)) {
      return '您好！我是客服智能体小洁✨。\n\n关于取件/配送：\n- 门店自提：请在门店营业时间内前往取件，到店后扫描取件码即可\n- 上门取件：已为您安排快递员，预计30分钟内到达\n- 如需修改取件方式，请提供订单号，我将为您更新。';
    }
    // 支付问题
    if (/支付|付款|扣款|充值|余额/.test(msg)) {
      return '您好！我是客服智能体小洁✨。\n\n关于支付问题：\n- 微信支付/支付宝：实时到账，如有延迟请稍后刷新\n- 余额支付：请确认账户余额充足\n- 如需查询支付状态，请提供订单号\n\n充值问题请在“我的钱包”中查看充值记录。';
    }
    // 投诉
    if (this._isComplaint(msg)) {
      return '非常抱歉给您带来不好的体验！我已将您的问题标记为紧急事项，将立即转接人工客服为您处理。\n\n请您稍等，人工客服将在5分钟内与您联系。再次为给您造成的不便表示诚挚的歉意！🙏';
    }
    // 质量问题
    if (/质量|破损|损坏|污渍|洗坏|褪色/.test(msg)) {
      return '您好！我是客服智能体小洁✨。\n\n非常抱歉听到您的物品出现问题。请您：\n1. 拍照保存问题物品的照片\n2. 提供订单号，我将为您创建质量问题工单\n3. 我们将安排专人跟进处理\n\n我们承诺对质量问题负责到底，请您放心！';
    }
    // 兜底回复
    return '您好！我是客服智能体小洁✨。\n\n已收到您的问题，我已为您记录。如需更精准的帮助，请告诉我：\n- 订单号（查询订单状态）\n- 具体问题类型（退款/配送/支付/质量等）\n\n如问题较为复杂，我将为您转接人工客服。感谢您的耐心等待！';
  }

  async updateTicket(id, data) {
    try {
      const ticket = await this.ServiceTicket.findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true });
      if (!ticket) return { success: false, error: '工单不存在' };
      return { success: true, data: ticket };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getTicketStats() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [total, open, processing, resolved, todayCount, urgentCount] = await Promise.all([
        this.ServiceTicket.countDocuments(),
        this.ServiceTicket.countDocuments({ status: 'open' }),
        this.ServiceTicket.countDocuments({ status: 'processing' }),
        this.ServiceTicket.countDocuments({ status: { $in: ['resolved', 'closed'] } }),
        this.ServiceTicket.countDocuments({ createdAt: { $gte: today } }),
        this.ServiceTicket.countDocuments({ priority: 'urgent', status: { $ne: 'closed' } })
      ]);
      return { success: true, data: { total, open, processing, resolved, todayCount, urgentCount } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // SystemSettings 模型
  // ============================================
  getSystemSettingsModel() {
    const schema = new mongoose.Schema({
      key: { type: String, required: true, unique: true },
      value: mongoose.Schema.Types.Mixed,
      category: { type: String, default: 'general' },
      label: String,
      description: String,
      updatedAt: { type: Date, default: Date.now }
    });
    return mongoose.models.SystemSettings || mongoose.model('SystemSettings', schema);
  }

  // 获取全部系统设置
  async getSystemSettings() {
    try {
      const docs = await this.SystemSettings.find().lean();
      const settings = {};
      docs.forEach(d => { settings[d.key] = d.value; });
      // 默认值填充
      const defaults = {
        settlementAutoThreshold: 5000,
        settlementCycle: 7,
        settlementAutoEnabled: true,
        invoiceAutoEnabled: true,
        invoiceTemplate: 'default',
        bdRecruitApproval: 'manual',
        platformServiceFeeRatio: 10,
        backupCycle: 'daily'
      };
      Object.keys(defaults).forEach(k => {
        if (settings[k] === undefined) settings[k] = defaults[k];
      });
      return { success: true, data: settings };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 更新系统设置
  async updateSystemSettings(updates) {
    try {
      for (const [key, value] of Object.entries(updates)) {
        await this.SystemSettings.findOneAndUpdate(
          { key },
          { value, updatedAt: new Date() },
          { upsert: true, new: true }
        );
      }
      return { success: true, message: '设置已更新' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // SettlementRequest 模型
  // ============================================
  getSettlementRequestModel() {
    const schema = new mongoose.Schema({
      settlementNo: { type: String, unique: true, index: true },
      storeId: { type: String, required: true, index: true },
      storeName: String,
      amount: { type: Number, required: true },
      serviceFee: { type: Number, default: 0 },
      netAmount: Number,
      orderCount: Number,
      periodStart: Date,
      periodEnd: Date,
      status: { type: String, enum: ['pending', 'auto_approved', 'pending_review', 'approved', 'rejected', 'settled'], default: 'pending' },
      reviewType: { type: String, enum: ['auto', 'manual'], default: 'auto' },
      reviewer: String,
      reviewNote: String,
      reviewedAt: Date,
      settledAt: Date,
      createdAt: { type: Date, default: Date.now }
    });
    schema.index({ status: 1, createdAt: -1 });
    return mongoose.models.SettlementRequest || mongoose.model('SettlementRequest', schema);
  }

  // 获取结算申请列表
  async getSettlementRequests({ page = 1, pageSize = 20, status, storeId } = {}) {
    try {
      const filter = {};
      if (status) filter.status = status;
      if (storeId) filter.storeId = storeId;
      const total = await this.SettlementRequest.countDocuments(filter);
      const list = await this.SettlementRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean();
      return { success: true, data: { list, total, page, pageSize } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 审核结算申请（智能审核引擎）
  async reviewSettlement(id, action, reviewer, note) {
    try {
      const req = await this.SettlementRequest.findById(id);
      if (!req) return { success: false, error: '结算申请不存在' };
      if (!['pending', 'pending_review'].includes(req.status)) {
        return { success: false, error: '当前状态不可审核' };
      }
      if (action === 'approve') {
        req.status = 'approved';
        req.reviewer = reviewer;
        req.reviewNote = note || '审核通过';
        req.reviewedAt = new Date();
      } else {
        req.status = 'rejected';
        req.reviewer = reviewer;
        req.reviewNote = note || '审核拒绝';
        req.reviewedAt = new Date();
      }
      await req.save();
      // 审核通过后自动创建发票申请
      if (action === 'approve') {
        await this._autoCreateInvoiceRequest(req);
      }
      return { success: true, data: req };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 创建结算申请（模拟门店发起结算）
  async createSettlementRequest(data) {
    try {
      const settings = await this.getSystemSettings();
      const threshold = settings.data.settlementAutoThreshold || 5000;
      const autoEnabled = settings.data.settlementAutoEnabled !== false;

      const no = 'ST' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
      const serviceFee = Math.round((data.amount || 0) * ((settings.data.platformServiceFeeRatio || 10) / 100) * 100) / 100;
      const doc = await this.SettlementRequest.create({
        settlementNo: no,
        storeId: data.storeId,
        storeName: data.storeName || '',
        amount: data.amount,
        serviceFee,
        netAmount: data.amount - serviceFee,
        orderCount: data.orderCount || 0,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        status: (autoEnabled && data.amount <= threshold) ? 'auto_approved' : 'pending_review',
        reviewType: (autoEnabled && data.amount <= threshold) ? 'auto' : 'manual',
        reviewer: (autoEnabled && data.amount <= threshold) ? '系统自动审核' : null
      });
      // 自动审核通过时也创建发票申请
      if (doc.status === 'auto_approved') {
        await this._autoCreateInvoiceRequest(doc);
      }
      return { success: true, data: doc };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 结算统计
  async getSettlementStats() {
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const [pending, todayApproved, monthTotal, autoCount, manualCount] = await Promise.all([
        this.SettlementRequest.countDocuments({ status: { $in: ['pending', 'pending_review'] } }),
        this.SettlementRequest.countDocuments({ status: 'approved', reviewedAt: { $gte: today } }),
        this.SettlementRequest.aggregate([
          { $match: { status: { $in: ['approved', 'settled', 'auto_approved'] }, createdAt: { $gte: monthStart } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        this.SettlementRequest.countDocuments({ reviewType: 'auto' }),
        this.SettlementRequest.countDocuments({ reviewType: 'manual' })
      ]);
      const totalReviewed = autoCount + manualCount;
      return {
        success: true,
        data: {
          pending,
          todayApproved,
          monthTotal: monthTotal[0]?.total || 0,
          autoRatio: totalReviewed > 0 ? Math.round(autoCount / totalReviewed * 100) : 0
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // InvoiceRequest 模型
  // ============================================
  getInvoiceRequestModel() {
    const schema = new mongoose.Schema({
      invoiceNo: { type: String, unique: true, index: true },
      applicantType: { type: String, enum: ['store', 'user', 'chain'], default: 'store' },
      applicantId: String,
      applicantName: String,
      invoiceType: { type: String, enum: ['normal', 'special'], default: 'normal' },
      amount: { type: Number, required: true },
      taxNo: String,
      status: { type: String, enum: ['pending', 'issued', 'sent', 'rejected'], default: 'pending' },
      settlementId: String,
      issuedAt: Date,
      sentAt: Date,
      sendMethod: String,
      createdAt: { type: Date, default: Date.now }
    });
    schema.index({ status: 1, createdAt: -1 });
    return mongoose.models.InvoiceRequest || mongoose.model('InvoiceRequest', schema);
  }

  // 获取发票申请列表
  async getInvoiceRequests({ page = 1, pageSize = 20, status } = {}) {
    try {
      const filter = {};
      if (status) filter.status = status;
      const total = await this.InvoiceRequest.countDocuments(filter);
      const list = await this.InvoiceRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean();
      return { success: true, data: { list, total, page, pageSize } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 结算审核后自动创建发票申请（内部辅助方法）
  async _autoCreateInvoiceRequest(settlementDoc) {
    try {
      const settings = await this.getSystemSettings();
      if (settings.data.invoiceAutoEnabled === false) return; // 自动开票关闭则跳过
      const invoiceNo = 'INV' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
      await this.InvoiceRequest.create({
        invoiceNo,
        applicantType: 'store',
        applicantId: settlementDoc.storeId,
        applicantName: settlementDoc.storeName || settlementDoc.storeId,
        invoiceType: 'normal',
        amount: settlementDoc.amount,
        taxNo: '',
        status: 'pending',
        settlementId: settlementDoc.settlementNo
      });
      console.log(`[发票] 结算${settlementDoc.settlementNo}自动创建发票申请 ${invoiceNo}`);
    } catch (e) {
      console.error('[发票] 自动创建发票申请失败:', e.message);
    }
  }

  // 开具电子发票（桩函数）
  async issueInvoice(id) {
    try {
      const req = await this.InvoiceRequest.findById(id);
      if (!req) return { success: false, error: '发票申请不存在' };
      if (req.status !== 'pending') return { success: false, error: '当前状态不可开具' };
      req.invoiceNo = 'INV' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
      req.status = 'issued';
      req.issuedAt = new Date();
      await req.save();
      return { success: true, data: req };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 发送发票（桩函数）
  async sendInvoice(id, method) {
    try {
      const req = await this.InvoiceRequest.findById(id);
      if (!req) return { success: false, error: '发票申请不存在' };
      if (req.status !== 'issued') return { success: false, error: '发票尚未开具' };
      req.status = 'sent';
      req.sentAt = new Date();
      req.sendMethod = method || 'email';
      await req.save();
      console.log(`[发票] 模拟发送发票 ${req.invoiceNo} 给 ${req.applicantName} via ${req.sendMethod}`);
      return { success: true, data: req };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 发票统计
  async getInvoiceStats() {
    try {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const [pending, monthIssued, totalAmount, electronicCount] = await Promise.all([
        this.InvoiceRequest.countDocuments({ status: 'pending' }),
        this.InvoiceRequest.countDocuments({ status: { $in: ['issued', 'sent'] }, issuedAt: { $gte: monthStart } }),
        this.InvoiceRequest.aggregate([
          { $match: { status: { $in: ['issued', 'sent'] }, createdAt: { $gte: monthStart } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        this.InvoiceRequest.countDocuments({ status: { $in: ['issued', 'sent'] } })
      ]);
      const totalIssued = await this.InvoiceRequest.countDocuments({ status: { $in: ['issued', 'sent', 'pending'] } });
      return {
        success: true,
        data: {
          pending,
          monthIssued,
          monthAmount: totalAmount[0]?.total || 0,
          electronicRatio: totalIssued > 0 ? Math.round(electronicCount / totalIssued * 100) : 100
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // 角色专属仪表盘
  // ============================================
  async getRoleDashboardStats(roleKey, user) {
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

      switch (roleKey) {
        case 'finance_admin': {
          const [pendingSettlement, pendingInvoice, monthSettlement, monthServiceFee] = await Promise.all([
            this.SettlementRequest.countDocuments({ status: { $in: ['pending', 'pending_review'] } }),
            this.InvoiceRequest.countDocuments({ status: 'pending' }),
            this.SettlementRequest.aggregate([
              { $match: { status: { $in: ['approved', 'settled', 'auto_approved'] }, createdAt: { $gte: monthStart } } },
              { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            this.SettlementRequest.aggregate([
              { $match: { status: { $in: ['approved', 'settled', 'auto_approved'] }, createdAt: { $gte: monthStart } } },
              { $group: { _id: null, total: { $sum: '$serviceFee' } } }
            ])
          ]);
          return {
            cards: [
              { label: '待审核结算', value: pendingSettlement, icon: 'fa-gavel', color: 'orange' },
              { label: '待开票', value: pendingInvoice, icon: 'fa-file-text-o', color: 'purple' },
              { label: '本月结算总额', value: '¥' + ((monthSettlement[0]?.total || 0) / 100).toFixed(0), icon: 'fa-money', color: 'green' },
              { label: '平台服务费收入', value: '¥' + ((monthServiceFee[0]?.total || 0) / 100).toFixed(0), icon: 'fa-percent', color: 'blue' }
            ]
          };
        }
        case 'bd_user': {
          const bdUserId = user?.bdUserId;
          const storeFilter = bdUserId ? { bdUserId } : {};
          const myStores = await this.Store.find(storeFilter).select('_id storeNo').lean();
          const storeIds = myStores.map(s => s._id.toString());
          const storeNos = myStores.map(s => s.storeNo);
          const monthNewStores = await this.Store.countDocuments({ ...storeFilter, createdAt: { $gte: monthStart } });
          const orderFilter = storeIds.length > 0
            ? { $or: [{ storeId: { $in: storeIds } }, { storeNo: { $in: storeNos } }] }
            : { storeId: { $in: [] } };
          const orderCount = await this.Order.countDocuments(orderFilter);
          return {
            cards: [
              { label: '我的门店', value: myStores.length, icon: 'fa-building', color: 'green' },
              { label: '本月新增门店', value: monthNewStores, icon: 'fa-plus-circle', color: 'blue' },
              { label: '门店总订单数', value: orderCount, icon: 'fa-file-text', color: 'purple' }
            ]
          };
        }
        case 'bd_manager': case 'bd_director': {
          const [totalBD, totalStores, monthNewStores] = await Promise.all([
            this.BDTeam.countDocuments({ status: 'active' }),
            this.Store.countDocuments({ status: 'active' }),
            this.Store.countDocuments({ createdAt: { $gte: monthStart } })
          ]);
          return {
            cards: [
              { label: roleKey === 'bd_director' ? '全国BD总数' : '团队BD数', value: totalBD, icon: 'fa-id-badge', color: 'blue' },
              { label: roleKey === 'bd_director' ? '全国门店总数' : '团队门店总数', value: totalStores, icon: 'fa-building', color: 'green' },
              { label: '本月新增门店', value: monthNewStores, icon: 'fa-plus-circle', color: 'orange' }
            ]
          };
        }
        case 'customer_service': {
          const [todayTickets, openTickets, resolvedTickets] = await Promise.all([
            this.ServiceTicket.countDocuments({ createdAt: { $gte: today } }),
            this.ServiceTicket.countDocuments({ status: 'open' }),
            this.ServiceTicket.countDocuments({ status: { $in: ['resolved', 'closed'] } })
          ]);
          const satisfaction = resolvedTickets > 0 ? Math.round(resolvedTickets / Math.max(resolvedTickets + openTickets, 1) * 100) : 100;
          return {
            cards: [
              { label: '今日新工单', value: todayTickets, icon: 'fa-ticket', color: 'orange' },
              { label: '待处理工单', value: openTickets, icon: 'fa-exclamation-circle', color: 'red' },
              { label: '已解决', value: resolvedTickets, icon: 'fa-check-circle', color: 'green' },
              { label: '好评率', value: satisfaction + '%', icon: 'fa-thumbs-up', color: 'blue' }
            ]
          };
        }
        case 'ops_engineer': {
          return {
            cards: [
              { label: '服务状态', value: '运行中', icon: 'fa-heartbeat', color: 'green' },
              { label: 'MongoDB', value: '已连接', icon: 'fa-database', color: 'blue' },
              { label: 'Node进程', value: '正常', icon: 'fa-server', color: 'purple' },
              { label: 'MQTT', value: '已连接', icon: 'fa-wifi', color: 'teal' }
            ]
          };
        }
        case 'marketing': {
          const [totalMembers, monthNewMembers] = await Promise.all([
            this.User.countDocuments({ memberLevel: { $ne: 'normal' } }),
            this.User.countDocuments({ memberLevel: { $ne: 'normal' }, createdAt: { $gte: monthStart } })
          ]);
          return {
            cards: [
              { label: '会员总数', value: totalMembers, icon: 'fa-user-circle', color: 'purple' },
              { label: '月新增会员', value: monthNewMembers, icon: 'fa-user-plus', color: 'blue' },
              { label: '营销活动', value: 0, icon: 'fa-bullhorn', color: 'orange' },
              { label: '优惠券核销率', value: '0%', icon: 'fa-ticket', color: 'green' }
            ]
          };
        }
        case 'region_admin': {
          const [regionStores, regionOrders] = await Promise.all([
            this.Store.countDocuments({ status: 'active' }),
            this.Order.countDocuments()
          ]);
          const revenueAgg = await this.Order.aggregate([
            { $group: { _id: null, total: { $sum: '$amounts.total' } } }
          ]);
          return {
            cards: [
              { label: '区域门店数', value: regionStores, icon: 'fa-building', color: 'green' },
              { label: '区域订单数', value: regionOrders, icon: 'fa-file-text', color: 'blue' },
              { label: '区域营收', value: '¥' + ((revenueAgg[0]?.total || 0) / 100).toFixed(0), icon: 'fa-cny', color: 'orange' },
              { label: '平均评分', value: '4.8', icon: 'fa-star', color: 'yellow' }
            ]
          };
        }
        default:
          return { cards: [] };
      }
    } catch (error) {
      console.error('[角色仪表盘] 失败:', error);
      return { cards: [] };
    }
  }

  // 角色待办事项
  async getRoleTodos(roleKey, user) {
    try {
      const todos = [];
      switch (roleKey) {
        case 'finance_admin': {
          const pendingSettlement = await this.SettlementRequest.find({ status: { $in: ['pending', 'pending_review'] } }).sort({ createdAt: -1 }).limit(5).lean();
          pendingSettlement.forEach(s => {
            todos.push({ type: 'settlement', title: `${s.storeName || s.storeId} 结算申请 ¥${s.amount}`, id: s._id, time: s.createdAt });
          });
          const pendingInvoice = await this.InvoiceRequest.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(3).lean();
          pendingInvoice.forEach(inv => {
            todos.push({ type: 'invoice', title: `${inv.applicantName || '商家'} 发票申请 ¥${inv.amount}`, id: inv._id, time: inv.createdAt });
          });
          break;
        }
        case 'customer_service': {
          const openTickets = await this.ServiceTicket.find({ status: 'open' }).sort({ createdAt: -1 }).limit(5).lean();
          openTickets.forEach(t => {
            todos.push({ type: 'ticket', title: `工单 #${t.ticketNo}: ${t.subject || t.category}`, id: t._id, time: t.createdAt });
          });
          break;
        }
        case 'bd_user': case 'bd_manager': case 'bd_director': {
          // BD待办可以加门店申请审批等
          break;
        }
      }
      return { success: true, data: todos };
    } catch (error) {
      return { success: true, data: [] };
    }
  }
}

module.exports = new AdminService();
