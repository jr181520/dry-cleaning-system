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
  }

  // 获取用户模型
  getUserModel() {
    const userSchema = new mongoose.Schema({
      phone: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      name: String,
      avatar: String,
      roles: [{ type: String, enum: ['customer', 'store_staff', 'store_owner', 'recycler', 'appraiser', 'brand_admin', 'admin'], default: 'customer' }],
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
    storeSchema.index({ status: 1 });
    
    return mongoose.models.Store || mongoose.model('Store', storeSchema);
  }

  /**
   * 获取仪表盘统计
   */
  async getDashboard() {
    try {
      // 今日数据
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const [users, orders, stores, todayOrders] = await Promise.all([
        this.User.countDocuments({ roles: 'customer' }),
        this.Order.countDocuments(),
        this.Store.countDocuments({ status: 'active' }),
        this.Order.countDocuments({ createdAt: { $gte: today } })
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
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
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

      return {
        success: true,
        data: {
          overview: {
            totalUsers: users,
            totalOrders: orders,
            totalStores: stores,
            todayOrders: todayOrders
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
          orderTrend
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
      const { page = 1, pageSize = 20, keyword, role, status } = params;
      
      const filter = {};
      if (keyword) {
        filter.$or = [
          { name: { $regex: keyword, $options: 'i' } },
          { phone: { $regex: keyword, $options: 'i' } }
        ];
      }
      if (role) filter.roles = role;
      if (status) filter.status = status;

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
}

module.exports = new AdminService();
