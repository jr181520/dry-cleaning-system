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
  }

  // 获取用户模型
  getUserModel() {
    const userSchema = new mongoose.Schema({
      phone: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      name: String,
      avatar: String,
      roles: [{ type: String, enum: ['customer', 'store_staff', 'store_owner', 'recycler', 'appraiser', 'brand_admin', 'chain_admin', 'admin'], default: 'customer' }],
      status: { type: String, enum: ['active', 'disabled'], default: 'active' },
      memberLevel: { type: String, enum: ['normal', 'silver', 'gold', 'platinum'], default: 'normal' },
      balance: { type: Number, default: 0 },
      points: { type: Number, default: 0 },
      addresses: [{
        name: String,
        phone: String,
        address: String,
        isDefault: Boolean
      }],
      lastLoginAt: Date,
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
      phone: String,
      address: { type: String, required: true },
      city: String,
      district: String,
      lat: Number,
      lng: Number,
      businessHours: { start: String, end: String },
      services: [{ type: String }],
      status: { type: String, enum: ['active', 'pending', 'disabled'], default: 'pending' },
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
      const { page = 1, pageSize = 20, keyword, status } = params;
      
      const filter = {};
      if (keyword) {
        filter.$or = [
          { name: { $regex: keyword, $options: 'i' } },
          { storeNo: { $regex: keyword, $options: 'i' } }
        ];
      }
      if (status) filter.status = status;

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
      
      const store = await this.Store.create({
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
        rating: 5.0,
        orderCount: 0,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log('[管理员] 门店创建成功:', store.storeNo, store.name);
      return store;
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

  /**
   * 订单管理
   */
  async getOrders(params) {
    try {
      const { page = 1, pageSize = 20, keyword, status, orderType, startDate, endDate } = params;
      
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

      // 更新管理员用户角色
      if (adminId) {
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

      // 获取管理员信息
      let admin = null;
      if (chain.adminId) {
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

      // 移除管理员chain_admin角色
      if (chain.adminId) {
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

      const store = await this.Store.findOneAndUpdate(
        { $or: [{ _id: mongoose.Types.ObjectId.isValid(storeId) ? storeId : null }, { storeNo: storeId }] },
        { $set: { chainId: chain._id.toString() }, $set: { updatedAt: new Date() } },
        { new: true }
      );
      if (!store) throw new Error('门店不存在');

      // 更新连锁统计
      const storeCount = await this.Store.countDocuments({ chainId: chain._id.toString() });
      const activeCount = await this.Store.countDocuments({ chainId: chain._id.toString(), status: 'active' });
      await this.Chain.findByIdAndUpdate(chain._id, {
        $set: { 'stats.totalStores': storeCount, 'stats.activeStores': activeCount, updatedAt: new Date() }
      });

      return { success: true, data: store, message: `门店 ${store.name} 已加入连锁 ${chain.name}` };
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
      const store = await this.Store.findOneAndUpdate(
        { $or: [{ _id: mongoose.Types.ObjectId.isValid(storeId) ? storeId : null }, { storeNo: storeId }] },
        { $set: { chainId: null }, $set: { updatedAt: new Date() } },
        { new: true }
      );
      if (!store) throw new Error('门店不存在');

      // 如果之前有chainId，更新连锁统计
      if (store.chainId) {
        const storeCount = await this.Store.countDocuments({ chainId: store.chainId });
        const activeCount = await this.Store.countDocuments({ chainId: store.chainId, status: 'active' });
        await this.Chain.findByIdAndUpdate(store.chainId, {
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
}

module.exports = new AdminService();
