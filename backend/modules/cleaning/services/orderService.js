/**
 * 干洗订单服务
 * 使用 MongoDB 存储
 */

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const paymentService = require('../../common/services/paymentService');
const notificationService = require('../../common/services/notificationService');
const db = require('../../../config');

// 导入门店 Schema 并获取 Store 模型
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
  }
});
const Store = mongoose.models.Store || mongoose.model('Store', storeSchema);

// 订单 Schema
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
    material: String,
    price: Number,
    quantity: Number,
    subtotal: Number,
    specialReq: String,
    pickupCode: String,
    status: { type: String, default: 'pending' }
  }],
  amounts: {
    subtotal: Number,
    discount: Number,
    deliveryFee: Number,
    total: Number
  },
  delivery: {
    type: { type: String, enum: ['pickup', 'delivery'], default: 'pickup' },
    address: { 
      type: String, 
      default: '',
      set: (v) => {
        // 确保是字符串，空数组或 undefined 转为空字符串
        if (Array.isArray(v)) return '';
        return typeof v === 'string' ? v : String(v || '');
      }
    },
    contactName: { 
      type: String, 
      default: '',
      set: (v) => {
        if (Array.isArray(v)) return '';
        return typeof v === 'string' ? v : String(v || '');
      }
    },
    contactPhone: { 
      type: String, 
      default: '',
      set: (v) => {
        if (Array.isArray(v)) return '';
        return typeof v === 'string' ? v : String(v || '');
      }
    },
    fee: { type: Number, default: 0 }
  },
  deliveryFeePaid: { type: Boolean, default: false },
  deliveryFeePaidAt: Date,
  courier: {
    provider: String,
    orderId: String,
    fee: Number,
    estimatedPickup: Date,
    actualPickup: Date,
    paidAt: Date
  },
  deliveryMethod: { type: String, enum: ['courier', 'store_pickup'], default: 'store_pickup' },
  selectedProvider: String,
  deliveryFee: Number,
  payment: {
    status: { type: String, enum: ['pending', 'paid', 'refunded'], default: 'pending' },
    method: String,
    transactionId: String,
    paidAt: Date
  },
  cleaning: {
    storeReceivedAt: Date,
    storeCompletedAt: Date,
    returnDate: Date,
    qualityCheckPassed: Boolean
  },
  status: { 
    type: String, 
    // 订单状态流程：
    // 1. pending - 待支付
    // 2. paid - 已支付，等待上门取件/送店
    // 3. delivering - 配送中（上门取件或配送）
    // 4. received - 已入库（服务网点）  
    // 5. processing - 处理中（清洗/熨烫/质检）
    // 6. cleaning - 清洗中（M端使用）
    // 7. cleaned - 清洗完成（M端使用）
    // 8. ready - 已完成，等待取件
    // 9. delivering_back - 配送中（送回用户）
    // 10. completed - 已完成
    // 11. cancelled - 已取消
    enum: ['pending', 'paid', 'delivering', 'received', 'processing', 'cleaning', 'cleaned', 'ready', 'delivering_back', 'completed', 'cancelled', 'awaiting_pickup_scan', 'awaiting_store_outbound'],
    default: 'pending',
    index: true
  },
  statusHistory: [{
    status: String,
    time: Date,
    actorId: String,
    note: String
  }],
  createdFrom: { type: String, default: 'app' },
  cancelReason: String,
  remark: String,
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: Date,
  deletedBy: String
}, { timestamps: true });

// 用户物品 Schema
const userItemSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  name: String,
  category: String,
  material: String,
  color: String,
  brand: String,
  purchaseDate: Date,
  photos: [String],
  careHistory: [{
    orderId: String,
    serviceType: String,
    date: Date,
    note: String
  }],
  specialMarks: String,
  preferredService: String
}, { timestamps: true });

// 提前注册模型，避免重复
const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
const UserItem = mongoose.models.UserItem || mongoose.model('UserItem', userItemSchema);

class OrderService {
  /**
   * 创建订单
   */
  async createOrder(params) {
    const { userId, storeId, items, delivery, amounts, deliveryMethod, selectedProvider } = params;
    
    // 预处理 deliveryMethod：将 'pickup' 转换为 'store_pickup'
    const normalizedDeliveryMethod = deliveryMethod === 'pickup' ? 'store_pickup' : (deliveryMethod || 'store_pickup');
    
    // 验证必填字段
    if (!items || items.length === 0) {
      throw new Error('订单物品不能为空');
    }
    if (!storeId) {
      throw new Error('门店ID不能为空');
    }
    
    const orderNo = this.generateOrderNo();
    console.log('[createOrder] 创建订单:', { orderNo, userId, storeId, items: items.length });

    const orderItems = items.map(item => ({
      itemId: 'ITEM-' + uuidv4(),
      name: item.name,
      itemType: 'dry_cleaning',
      serviceType: item.serviceType || 'dry_clean',
      material: item.material,
      price: item.price,
      quantity: item.quantity || 1,
      subtotal: item.price * (item.quantity || 1),
      specialReq: item.specialReq || '',
      pickupCode: this.generatePickupCode(),
      status: 'pending'
    }));

    // 处理跑腿服务商
    let courierProvider = null;
    if (selectedProvider) {
      const providerFees = {
        'meituan': 12,
        'sf': 15,
        'jd': 18,
        'taobao': 16
      };
      courierProvider = {
        provider: selectedProvider.id,
        name: selectedProvider.name || selectedProvider.id,
        fee: providerFees[selectedProvider.id] || 15
      };
    }

    const order = await Order.create({
      orderNo,
      orderType: 'cleaning',
      userId,
      storeId,
      items: orderItems,
      amounts: {
        subtotal: amounts?.subtotal || orderItems.reduce((s, i) => s + i.subtotal, 0),
        discount: amounts?.discount || 0,
        deliveryFee: amounts?.deliveryFee || 0,
        total: amounts?.total || (orderItems.reduce((s, i) => s + i.subtotal, 0) + (amounts?.deliveryFee || 0))
      },
      deliveryMethod: normalizedDeliveryMethod,
      selectedProvider: selectedProvider?.id || null,
      delivery: {
        type: delivery?.type || 'pickup',
        // 确保 address 是字符串，不是数组
        address: typeof delivery?.address === 'string' ? delivery.address : (Array.isArray(delivery?.address) ? '' : delivery?.address || ''),
        contactName: typeof delivery?.contactName === 'string' ? delivery.contactName : (delivery?.contactName || ''),
        contactPhone: typeof delivery?.contactPhone === 'string' ? delivery.contactPhone : (delivery?.contactPhone || ''),
        fee: typeof delivery?.fee === 'number' ? delivery.fee : 0
      },
      courier: courierProvider,
      payment: { status: 'pending' },
      cleaning: {
        returnDate: this.calculateReturnDate(),
        qualityCheckPassed: false
      },
      status: 'pending',
      statusHistory: [{
        status: 'pending',
        time: new Date(),
        actorId: userId,
        note: '订单创建'
      }],
      createdFrom: 'app'
    });

    // 异步发送通知（不阻塞响应）
    notificationService.send(userId, 'cleaning.order_created', { 
      orderNo: order.orderNo, 
      estimatedDays: 3 
    }).catch(e => console.error('[创建订单] 发送通知失败:', e.message));

    // 发布订单创建事件（实时同步到 m-index 和 admin）
    try {
      const orderEventService = require('../../../services/orderEventService');
      orderEventService.onOrderCreated(order);
    } catch (err) {
      console.error('[订单事件] 发布创建事件失败:', err.message);
    }

    return order;
  }

  /**
   * 获取订单列表
   */
  async getOrders(params) {
    const { userId, roles, page, pageSize, status, storeId, includeDeleted } = params;
    
    const filter = {};
    
    // 默认排除已删除的订单（除非显式请求包含）
    if (!includeDeleted) {
      filter.isDeleted = { $ne: true };
    }
    
    // 权限过滤 - 支持多种用户标识（id、openid、phone）
    if (userId) {
      // 使用$or支持多标识匹配，实现跨平台数据一致性
      // 订单的userId可能存储为MongoDB _id、openid、或phone
      filter.$or = [
        { userId: userId },
        { userId: String(userId) }
      ];
      
      // 如果userId看起来像openid（以字母开头），也尝试用_id匹配
      if (typeof userId === 'string' && /^[a-zA-Z]/.test(userId)) {
        filter.$or.push({ 'user._id': userId });
      }
    } else if (roles?.includes('customer')) {
      // 默认customer角色不过滤（需要配合req.user使用）
    } else if (roles?.includes('store_staff') || roles?.includes('store_owner')) {
      filter.storeId = storeId;
    }
    
    if (status) filter.status = status;
    
    const skip = (page - 1) * pageSize;
    
    const [list, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      Order.countDocuments(filter)
    ]);

    // 填充门店信息
    // 注意：订单的 storeId 实际上存储的是 storeNo（如 "ST001"），而不是 _id
    const storeNos = [...new Set(list.map(o => o.storeId).filter(Boolean))];
    const stores = await Store.find({ storeNo: { $in: storeNos } }).lean();
    const storeMap = {};
    stores.forEach(s => { storeMap[s.storeNo] = s; });

    // 添加门店信息到每个订单
    const enrichedList = list.map(order => {
      const store = storeMap[order.storeId];
      return {
        ...order,
        store: store ? {
          id: store._id,
          name: store.name,
          address: store.address,
          phone: store.phone,
          city: store.city,
          district: store.district,
          location: store.location,
          businessHours: store.businessHours
        } : null,
        storeName: store ? store.name : '系统分配',
        storeAddress: store ? store.address : ''
      };
    });

    return { list: enrichedList, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  /**
   * 获取订单详情
   * 支持通过 _id 或 orderNo 查询
   */
  async getOrderById(orderId, auth) {
    let order = null;
    
    // 判断ID格式：MongoDB ObjectId是24位hex字符串，orderNo通常以"ORD"开头
    const isObjectId = /^[a-f0-9]{24}$/i.test(orderId);
    const isOrderNo = /^ORD/i.test(orderId);
    
    if (isObjectId) {
      // 优先用 _id 查询（大多数轮询请求是这个格式）
      try {
        order = await Order.findById(orderId).lean();
      } catch (e) {
        // _id 格式错误时忽略
      }
    } else if (isOrderNo) {
      // orderNo格式，直接按orderNo查
      order = await Order.findOne({ orderNo: orderId }).lean();
    } else {
      // 不确定格式，先用_id尝试（带格式校验），失败再用orderNo
      if (/^[a-f0-9]{24}$/i.test(orderId)) {
        try {
          order = await Order.findById(orderId).lean();
        } catch (e) {}
      }
      if (!order) {
        order = await Order.findOne({ orderNo: orderId }).lean();
      }
    }
    
    // 仅在首次或调试时输出详细日志，轮询时压缩为一行
    const isPolling = auth && !auth.roles; // roles为空说明是C端轮询
    if (!isPolling) {
      console.log(`[getOrderById] ID:${orderId} | method:${isObjectId?'_id':isOrderNo?'orderNo':'both'} | found:${!!order}`);
    }
    
    if (!order) throw new Error('订单不存在');
    
    // 权限检查 - 如果没有角色信息或角色为空，跳过权限检查
    // 这允许前端直接通过 userId 参数查询订单
    if (auth && auth.roles && auth.roles.length > 0) {
      if (auth.roles.includes('customer') && order.userId !== auth.userId) {
        throw new Error('无权查看此订单');
      }
      
      if ((auth.roles.includes('store_staff') || auth.roles.includes('store_owner')) 
          && order.storeId !== auth.storeId) {
        throw new Error('无权查看此订单');
      }
    }
    
    // 填充门店信息
    // 注意：订单的 storeId 实际上存储的是 storeNo（如 "ST001"），而不是 _id
    if (order.storeId) {
      try {
        const store = await Store.findOne({ storeNo: order.storeId }).lean();
        if (store) {
          order.store = {
            id: store._id,
            name: store.name,
            address: store.address,
            phone: store.phone,
            city: store.city,
            district: store.district,
            location: store.location,
            businessHours: store.businessHours
          };
          order.storeName = store.name;
          order.storeAddress = store.address;
          order.storePhone = store.phone; // 添加门店电话
        }
      } catch (e) {
        // 门店查询失败不影响订单返回
        console.warn('获取门店信息失败:', e.message);
      }
    }
    
    // 添加状态描述
    const STATUS_DESCRIPTIONS = {
      pending: '请尽快完成支付，订单将等待处理',
      paid: '已支付成功，等待上门取件',
      delivering: '配送员正在取件中',
      received: '衣物已送达门店，正在安排处理',
      processing: '衣物处理中，请耐心等待',
      cleaning: '衣物清洗中',
      cleaned: '衣物清洗完成',
      ready: '衣物已处理完成，请选择取件方式',
      delivering_back: '衣物正在送回中',
      completed: '订单已完成，感谢您的使用',
      cancelled: '订单已取消',
      awaiting_pickup_scan: '等待门店扫码取件',
      awaiting_store_outbound: '等待门店出库'
    };
    order.statusDescription = STATUS_DESCRIPTIONS[order.status] || '订单处理中';
    
    // 添加最新动态（从 statusHistory 构建）
    if (order.statusHistory && order.statusHistory.length > 0) {
      const latest = order.statusHistory[order.statusHistory.length - 1];
      order.latestHistory = {
        note: latest.note || `订单状态更新为: ${latest.status}`,
        time: latest.time
      };
    } else {
      order.latestHistory = {
        note: order.statusDescription,
        time: order.createdAt
      };
    }
    
    // 兼容：确保 orderId 字段存在
    order.orderId = order._id.toString();
    
    // 兼容：如果没有 amounts.total，尝试计算
    if (!order.amounts) {
      order.amounts = {};
    }
    if (!order.amounts.total && order.items) {
      order.amounts.total = order.items.reduce((sum, item) => sum + (item.subtotal || item.price * item.quantity || 0), 0);
    }
    
    return order;
  }

  /**
   * 支付订单
   */
  async payOrder(orderId, auth, paymentData) {
    // 支持通过 _id 或 orderNo 查询订单
    const order = await Order.findOne({
      $or: [
        { _id: orderId },
        { orderNo: orderId }
      ]
    });
    
    if (!order) throw new Error('订单不存在');
    if (order.userId !== auth.userId) throw new Error('无权操作此订单');
    if (order.status !== 'pending') throw new Error('订单状态不允许支付');
    
    // 更新支付状态
    order.payment = {
      status: 'paid',
      method: paymentData.method || 'wechat',
      transactionId: paymentData.transactionId,
      paidAt: new Date()
    };
    order.status = 'paid';
    order.statusHistory.push({
      status: 'paid',
      time: new Date(),
      actorId: auth.userId,
      note: `使用${paymentData.method === 'wechat' ? '微信' : '支付宝'}支付`
    });
    
    await order.save();
    
    await notificationService.send(order.userId, 'cleaning.order_paid', { 
      orderNo: order.orderNo 
    });

    // 发布订单支付事件（实时同步到 m-index 和 admin）
    try {
      const orderEventService = require('../../../services/orderEventService');
      orderEventService.onOrderPaid(order);
    } catch (err) {
      console.error('[订单事件] 发布支付事件失败:', err.message);
    }

    return order;
  }

  /**
   * 取消订单
   */
  async cancelOrder(orderId, auth, reason) {
    const order = await Order.findById(orderId);
    
    if (!order) throw new Error('订单不存在');
    if (!['pending', 'paid'].includes(order.status)) {
      throw new Error('当前状态无法取消');
    }
    if (order.userId !== auth.userId && !auth.roles?.includes('admin')) {
      throw new Error('无权取消此订单');
    }
    
    order.status = 'cancelled';
    order.cancelReason = reason || '用户取消';
    order.statusHistory.push({
      status: 'cancelled',
      time: new Date(),
      actorId: auth.userId,
      note: reason || '用户取消'
    });
    
    await order.save();
    
    // 退款处理（如已支付）
    if (order.payment?.status === 'paid') {
      // TODO: 调用支付退款
      order.payment.status = 'refunded';
      await order.save();
    }
    
    // 发送取消通知（失败不影响订单取消）
    try {
      await notificationService.send(order.userId, 'cleaning.order_cancelled', { 
        orderNo: order.orderNo 
      });
    } catch (e) {
      console.error('[取消订单] 发送通知失败:', e.message);
    }

    // 发布订单取消事件（实时同步到 m-index 和 admin）
    try {
      const orderEventService = require('../../../services/orderEventService');
      orderEventService.onOrderCancelled(order);
    } catch (err) {
      console.error('[订单事件] 发布取消事件失败:', err.message);
    }

    return order;
  }

  /**
   * 删除订单记录（软删除）
   * 仅允许删除已完成/已取消/已取件的订单
   * 设置 isDeleted=true，从常规查询中隐藏
   */
  async deleteOrder(orderId, auth) {
    const order = await Order.findById(orderId);
    
    if (!order) throw new Error('订单不存在');
    
    // 只允许删除终态订单
    const deletableStatuses = ['completed', 'cancelled', 'delivered'];
    if (!deletableStatuses.includes(order.status)) {
      throw new Error('正在处理中的订单无法删除，请等待处理完成');
    }
    
    // 权限检查
    if (order.userId !== auth.userId && !auth.roles?.includes('admin')) {
      throw new Error('无权删除此订单');
    }
    
    order.isDeleted = true;
    order.deletedAt = new Date();
    order.deletedBy = auth.userId;
    order.statusHistory.push({
      status: order.status,
      time: new Date(),
      actorId: auth.userId,
      note: '用户删除订单记录'
    });
    
    await order.save();
    
    // 发布订单更新事件（通知 M端/Admin 同步删除）
    try {
      const orderEventService = require('../../../services/orderEventService');
      orderEventService.onOrderCancelled(order); // 复用取消事件通知数据变更
    } catch (err) {
      console.error('[订单事件] 发布删除事件失败:', err.message);
    }
    
    return order;
  }

  /**
   * 门店收件
   * 状态: paid -> received (已入库)
   * 支持通过 orderNo 或 _id 查询
   */
  async receiveOrder(orderId, auth, receiveData) {
    // 尝试通过 orderNo 查询
    let order = await Order.findOne({ orderNo: orderId });
    
    // 如果没找到，尝试通过 _id 查询
    if (!order) {
      try {
        order = await Order.findById(orderId);
      } catch (e) {
        // _id 格式错误时忽略
      }
    }
    
    if (!order) throw new Error('订单不存在');
    if (order.status !== 'paid' && order.status !== 'delivering') {
      throw new Error('订单状态不允许收件');
    }
    
    const oldStatus = order.status;
    order.status = 'received';
    order.cleaning.storeReceivedAt = new Date();
    order.statusHistory.push({
      status: 'received',
      time: new Date(),
      actorId: auth.staffId,
      note: '物品已入库，门店已收件'
    });
    
    for (const item of order.items) {
      item.status = 'received';
    }
    
    await order.save();
    
    await notificationService.send(order.userId, 'cleaning.order_received', { 
      orderNo: order.orderNo,
      storeName: '服务网点'
    });

    // 发布订单状态变更事件
    try {
      const orderEventService = require('../../../services/orderEventService');
      orderEventService.onOrderStatusChanged(order, oldStatus);
    } catch (err) {
      console.error('[订单事件] 发布收件事件失败:', err.message);
    }

    return order;
  }

  /**
   * 开始处理（清洗中）
   * 状态: received -> processing (处理中)
   */
  async startProcessing(orderId, auth, processingData) {
    const order = await Order.findById(orderId);
    
    if (!order) throw new Error('订单不存在');
    if (order.status !== 'received') {
      throw new Error('订单状态不允许开始处理');
    }
    
    const oldStatus = order.status;
    order.status = 'processing';
    order.statusHistory.push({
      status: 'processing',
      time: new Date(),
      actorId: auth.staffId,
      note: '衣物清洗处理中'
    });
    
    for (const item of order.items) {
      item.status = 'processing';
    }
    
    await order.save();
    
    await notificationService.send(order.userId, 'cleaning.order_processing', { 
      orderNo: order.orderNo
    });

    // 发布订单状态变更事件
    try {
      const orderEventService = require('../../../services/orderEventService');
      orderEventService.onOrderStatusChanged(order, oldStatus);
    } catch (err) {
      console.error('[订单事件] 发布处理事件失败:', err.message);
    }

    return order;
  }

  /**
   * 完成清洗
   * 状态: processing -> ready (待取件)
   */
  async completeOrder(orderId, auth, completeData) {
    const order = await Order.findById(orderId);
    
    if (!order) throw new Error('订单不存在');
    if (order.status !== 'processing') {
      throw new Error('订单状态不对');
    }
    
    const oldStatus = order.status;
    order.status = 'ready';
    order.cleaning.storeCompletedAt = new Date();
    order.cleaning.returnDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3天后取件
    order.cleaning.qualityCheckPassed = true;
    order.statusHistory.push({
      status: 'ready',
      time: new Date(),
      actorId: auth.staffId,
      note: '清洗完成，质检通过，待取件'
    });
    
    for (const item of order.items) {
      item.status = 'ready';
    }
    
    await order.save();
    
    await notificationService.send(order.userId, 'cleaning.order_completed', { 
      orderNo: order.orderNo,
      returnDate: order.cleaning.returnDate
    });

    // 发布订单状态变更事件
    try {
      const orderEventService = require('../../../services/orderEventService');
      orderEventService.onOrderStatusChanged(order, oldStatus);
    } catch (err) {
      console.error('[订单事件] 发布完成事件失败:', err.message);
    }

    return order;
  }

  /**
   * 用户取件确认
   * 状态: ready -> completed (已完成)
   */
  async pickupOrder(orderId, auth) {
    const order = await Order.findById(orderId);
    
    if (!order) throw new Error('订单不存在');
    if (order.userId !== auth.userId && !auth.roles?.includes('admin')) {
      throw new Error('无权操作此订单');
    }
    // 允许 ready / awaiting_pickup_scan / awaiting_store_outbound 状态下完成取件
    if (!['ready', 'awaiting_pickup_scan', 'awaiting_store_outbound'].includes(order.status)) {
      throw new Error(`订单状态不对（当前状态: ${order.status}）`);
    }
    
    const oldStatus = order.status;
    order.status = 'completed';
    order.cleaning.pickedUpAt = new Date();
    order.statusHistory.push({
      status: 'completed',
      time: new Date(),
      actorId: auth.userId,
      note: '用户已取件，订单完成'
    });
    
    await order.save();
    
    await notificationService.send(order.userId, 'cleaning.order_picked_up', { 
      orderNo: order.orderNo
    });

    // 发布订单状态变更事件
    try {
      const orderEventService = require('../../../services/orderEventService');
      orderEventService.onOrderStatusChanged(order, oldStatus);
    } catch (err) {
      console.error('[订单事件] 发布取件事件失败:', err.message);
    }

    return order;
  }

  /**
   * 通用更新订单状态（门店端使用）
   * 支持状态: cleaning, cleaned, ready, completed
   * 支持通过 orderNo 或 _id 查询
   */
  async updateOrderStatus(orderId, { status, note, items, userId, roles }) {
    // 尝试通过 orderNo 查询
    let order = await Order.findOne({ orderNo: orderId });
    
    // 如果没找到，尝试通过 _id 查询
    if (!order) {
      try {
        order = await Order.findById(orderId);
      } catch (e) {
        // _id 格式错误时忽略
      }
    }
    
    if (!order) throw new Error('订单不存在');
    
    // 权限检查 - 门店人员可以更新
    const isStoreStaff = roles?.includes('store_staff') || roles?.includes('store_owner');
    if (!isStoreStaff && order.userId !== userId) {
      throw new Error('无权操作此订单');
    }
    
    // 状态流转映射 - 放宽限制，支持更多状态转换（含M端操作流程）
    const statusFlow = {
      'received': { from: ['paid', 'pending', 'awaiting_store_confirm', 'out'], text: '已入库' },
      'cleaning': { from: ['paid', 'received', 'processing', 'pending', 'awaiting_store_confirm', 'out'], text: '清洗中' },
      'cleaned': { from: ['processing', 'cleaning', 'in_progress', 'received', 'out'], text: '清洗完成' },
      'ready': { from: ['processing', 'cleaned', 'cleaning', 'in_progress', 'received', 'out'], text: '待取件' },
      'completed': { from: ['ready', 'delivered', 'awaiting_pickup_scan', 'awaiting_store_outbound', 'delivering_back', 'cleaned', 'cleaning', 'received', 'out', 'pending'], text: '已完成' }
    };
    
    const flow = statusFlow[status];
    if (!flow) {
      throw new Error('不支持的状态更新');
    }
    
    if (!flow.from.includes(order.status)) {
      console.warn(`[状态更新] 非常规流转: ${order.status} -> ${status}，允许执行`);
      // 不再阻止非标准流转，仅记录日志
    }
    
    // 记录旧状态
    const oldStatus = order.status;

    // 更新状态
    order.status = status;
    order.statusHistory.push({
      status: status,
      time: new Date(),
      actorId: userId || 'system',
      note: note || flow.text
    });
    
    // 如果M端传入了物品数据，使用传入的物品数据（支持物品级别的状态更新）
    if (items && Array.isArray(items) && items.length > 0) {
      order.items = items.map(item => ({
        ...item,
        _id: item._id || new mongoose.Types.ObjectId()
      }));
    } else {
      // 否则统一更新所有物品状态为订单状态
      for (const item of order.items) {
        item.status = status;
      }
    }
    
    await order.save();
    console.log(`[updateOrderStatus] 订单状态已更新: ${order.orderNo} ${oldStatus}→${status}`);

    // 发布订单状态变更事件（实时同步到 m-index 和 admin）
    try {
      const orderEventService = require('../../../services/orderEventService');
      orderEventService.onOrderStatusChanged(order, oldStatus);
    } catch (err) {
      console.error('[订单事件] 发布状态变更事件失败:', err.message);
    }
    
    return order;
  }

  /**
   * 设置配送中状态
   * 状态: paid -> delivering (配送中)
   */
  async setDelivering(orderId, auth, deliveryInfo) {
    const order = await Order.findById(orderId);
    
    if (!order) throw new Error('订单不存在');
    if (!['paid', 'ready'].includes(order.status)) {
      throw new Error('订单状态不允许配送');
    }
    
    const oldStatus = order.status;
    order.status = order.status === 'paid' ? 'delivering' : 'delivering_back';
    order.delivery = {
      ...order.delivery,
      ...deliveryInfo,
      status: 'delivering'
    };
    order.statusHistory.push({
      status: order.status,
      time: new Date(),
      actorId: auth.userId,
      note: deliveryInfo.type === 'pickup' ? '配送员已出发取件' : '配送员已出发送件'
    });
    
    await order.save();
    
    await notificationService.send(order.userId, 'cleaning.order_delivering', { 
      orderNo: order.orderNo,
      driverName: deliveryInfo.driverName,
      driverPhone: deliveryInfo.driverPhone
    });

    // 发布订单状态变更事件
    try {
      const orderEventService = require('../../../services/orderEventService');
      orderEventService.onOrderStatusChanged(order, oldStatus);
    } catch (err) {
      console.error('[订单事件] 发布配送事件失败:', err.message);
    }

    return order;
  }

  /**
   * 获取用户物品列表
   */
  async getItems(params) {
    const { userId, page, pageSize, status } = params;
    const filter = { userId };
    
    if (status) filter['careHistory.status'] = status;
    
    const skip = (page - 1) * pageSize;
    
    const [list, total] = await Promise.all([
      UserItem.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      UserItem.countDocuments(filter)
    ]);

    return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  /**
   * 添加用户物品
   */
  async addItem(userId, itemData) {
    const item = await UserItem.create({
      userId,
      ...itemData
    });
    return item;
  }

  // ==================== 工具方法 ====================

  generateOrderNo() {
    const date = new Date();
    return 'CL' + date.getFullYear() + 
           String(date.getMonth() + 1).padStart(2, '0') + 
           String(date.getDate()).padStart(2, '0') +
           String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  }

  generatePickupCode() {
    return 'P' + String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  }

  calculateReturnDate() {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    return date;
  }

  // 门店统计
  async getStoreStats(storeId, startDate, endDate) {
    const filter = { storeId };
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const orders = await Order.find(filter).lean();
    
    return {
      totalOrders: orders.length,
      pendingOrders: orders.filter(o => o.status === 'pending').length,
      inProgressOrders: orders.filter(o => o.status === 'in_progress').length,
      completedOrders: orders.filter(o => ['completed', 'delivered'].includes(o.status)).length,
      cancelledOrders: orders.filter(o => o.status === 'cancelled').length,
      totalAmount: orders.reduce((sum, o) => sum + (o.amounts?.total || 0), 0),
      totalItems: orders.reduce((sum, o) => sum + o.items.length, 0)
    };
  }

  /**
   * 处理订单支付
   */
  async processPayment(orderId, paymentData) {
    // 尝试通过 orderNo 查询
    let order = await Order.findOne({ orderNo: orderId });
    
    // 如果没找到，尝试通过 _id 查询
    if (!order) {
      try {
        order = await Order.findById(orderId);
      } catch (e) {
        // _id 格式错误时忽略
      }
    }
    
    if (!order) {
      throw new Error('订单不存在');
    }
    
    if (order.status !== 'pending') {
      throw new Error('订单状态不允许支付');
    }
    
    // 更新支付信息和订单状态
    order.payment = {
      status: 'paid',
      method: paymentData.method || 'wechat',
      transactionId: paymentData.transactionId,
      paidAt: new Date()
    };
    order.status = 'paid';
    order.statusHistory.push({
      status: 'paid',
      time: new Date(),
      actorId: paymentData.userId,
      note: `使用${paymentData.method === 'alipay' ? '支付宝' : '微信'}支付`
    });
    
    await order.save();
    
    // 发送支付成功通知
    try {
      await notificationService.sendPaymentSuccessNotification(order);
    } catch (err) {
      console.error('支付通知发送失败:', err);
    }

    // 发布订单支付事件（实时同步到 m-index 和 admin）
    try {
      const orderEventService = require('../../../services/orderEventService');
      orderEventService.onOrderPaid(order);
    } catch (err) {
      console.error('[订单事件] 发布支付事件失败:', err.message);
    }
    
    return order;
  }

  /**
   * 更新支付状态
   */
  async updatePaymentStatus(orderNo, paymentData) {
    const order = await Order.findOneAndUpdate(
      { orderNo },
      { 
        $set: { 
          'payment.status': paymentData.status,
          'payment.transactionId': paymentData.transactionId,
          'payment.method': paymentData.method,
          'payment.paidAt': paymentData.paidAt,
          updatedAt: new Date()
        }
      },
      { new: true }
    );
    
    if (paymentData.status === 'paid') {
      order.status = 'paid';
      order.statusHistory.push({
        status: 'paid',
        time: new Date(),
        note: '支付成功'
      });
      await order.save();
    }
    
    return order;
  }

  /**
   * 更新配送状态
   */
  async updateDeliveryStatus(orderNo, deliveryData) {
    const updateData = {
      'delivery.status': deliveryData.status,
      updatedAt: new Date()
    };

    if (deliveryData.driverName) {
      updateData['delivery.driverName'] = deliveryData.driverName;
      updateData['delivery.driverPhone'] = deliveryData.driverPhone;
    }

    if (deliveryData.currentLocation) {
      updateData['delivery.currentLocation'] = deliveryData.currentLocation;
    }

    if (deliveryData.deliveredAt) {
      updateData['delivery.deliveredAt'] = deliveryData.deliveredAt;
      updateData.status = 'delivered';
      updateData.statusHistory.push({
        status: 'delivered',
        time: new Date(),
        note: '配送完成'
      });
    }

    const order = await Order.findOneAndUpdate(
      { orderNo },
      { $set: updateData },
      { new: true }
    );

    return order;
  }

  /**
   * 创建配送订单
   */
  async createDelivery(orderId, deliveryData) {
    const order = await Order.findById(orderId);
    
    if (!order) throw new Error('订单不存在');
    
    order.delivery = {
      ...order.delivery,
      type: 'delivery',
      deliveryId: deliveryData.deliveryId,
      provider: deliveryData.provider,
      status: 'creating',
      driverName: '',
      driverPhone: '',
      estimatedTime: deliveryData.estimatedTime,
      createdAt: new Date()
    };
    
    await order.save();
    
    return order;
  }

  /**
   * 选择取件方式（到店自提/配送到家）
   * @param {string} orderId - 订单ID或订单号
   * @param {object} auth - 认证信息
   * @param {object} pickupInfo - 取件信息 { method, address, contactName, contactPhone }
   */
  async selectPickupMethod(orderId, auth, pickupInfo) {
    let order = null;
    
    // 支持通过 orderNo 或 _id 查询订单
    // 先尝试 orderNo（用户友好格式）
    order = await Order.findOne({ orderNo: orderId });
    
    // 如果没找到，尝试 _id（但先检查格式）
    if (!order && orderId && /^[0-9a-fA-F]{24}$/.test(orderId)) {
      try {
        order = await Order.findById(orderId);
      } catch (e) {
        // ObjectId 格式错误时忽略
      }
    }
    
    if (!order) throw new Error('订单不存在');
    
    // 检查权限：订单所有者或管理员，或未登录但有有效订单
    const isOwner = !auth.userId || order.userId === auth.userId;
    const isAdmin = auth.roles?.includes('admin');
    
    if (!isOwner && !isAdmin) {
      throw new Error('无权操作此订单');
    }
    
    if (order.status !== 'ready') {
      throw new Error('订单状态不允许选择取件方式');
    }
    
    // 更新取件方式
    order.pickupMethod = pickupInfo.method;
    order.pickupAddress = pickupInfo.address || '';
    order.pickupContact = {
      name: pickupInfo.contactName || '',
      phone: pickupInfo.contactPhone || ''
    };
    
    // 如果选择配送到家，设置配送状态
    if (pickupInfo.method === 'home_delivery') {
      order.status = 'delivering_back';
      order.statusHistory.push({
        status: 'delivering_back',
        time: new Date(),
        actorId: auth.userId,
        note: '用户选择配送到家，等待配送员取件'
      });
      
      // 触发配送服务（传递 order._id 确保是 ObjectId 格式）
      await this.triggerDelivery(order._id, auth);
    } else {
      // 到店自提，触发智能灯条
      await this.triggerSmartLight(order.storeId, {
        orderIds: [order._id.toString()],
        priority: 'normal',
        action: 'customer_arrived'
      });
      
      order.statusHistory.push({
        status: order.status,
        time: new Date(),
        actorId: auth.userId,
        note: '用户选择到店自提'
      });
    }
    
    await order.save();
    
    await notificationService.send(order.userId, 'cleaning.pickup_method_selected', { 
      orderNo: order.orderNo,
      method: pickupInfo.method === 'home_delivery' ? '配送到家' : '到店自提'
    });
    
    return order;
  }

  /**
   * 支付配送费
   * @param {string} orderId - 订单ID或订单号
   * @param {object} auth - 认证信息
   * @param {object} paymentInfo - 支付信息 { provider, fee, payTime }
   */
  async payDeliveryFee(orderId, auth, paymentInfo) {
    let order = null;
    
    // 支持通过 orderNo 或 _id 查询订单
    // 先尝试 orderNo（用户友好格式）
    order = await Order.findOne({ orderNo: orderId });
    
    // 如果没找到，尝试 _id（但先检查格式）
    if (!order && orderId && /^[0-9a-fA-F]{24}$/.test(orderId)) {
      try {
        order = await Order.findById(orderId);
      } catch (e) {
        // ObjectId 格式错误时忽略
      }
    }
    
    if (!order) throw new Error('订单不存在');
    
    // 检查权限：订单所有者或管理员，或未登录但有有效订单
    // 注意：使用 optionalAuth，所以 auth.userId 可能为 undefined
    // 只要有有效的订单ID，就应该允许操作
    const isOwner = !auth.userId || order.userId === auth.userId;
    const isAdmin = auth.roles?.includes('admin');
    
    if (!isOwner && !isAdmin) {
      throw new Error('无权操作此订单');
    }
    
    // 检查是否是跑腿配送订单（允许旧订单或未设置 deliveryMethod 但有 selectedProvider 的订单）
    const isCourierOrder = order.deliveryMethod === 'courier' || 
                          order.selectedProvider || 
                          order.courier?.provider;
    
    if (!isCourierOrder) {
      throw new Error('此订单不需要支付配送费');
    }
    
    // 如果没有设置 deliveryMethod，自动设置为 courier
    if (order.deliveryMethod !== 'courier') {
      order.deliveryMethod = 'courier';
    }
    
    if (order.deliveryFeePaid) {
      throw new Error('配送费已支付');
    }
    
    // 更新配送费支付状态
    order.deliveryFeePaid = true;
    order.deliveryFeePaidAt = new Date(paymentInfo.payTime || Date.now());
    order.courier = order.courier || {};
    order.courier.paidAt = order.deliveryFeePaidAt;
    
    // 更新状态为等待骑手取件
    order.deliveryStatus = 'pending_pickup';
    order.statusHistory.push({
      status: order.status,
      time: new Date(),
      actorId: auth.userId,
      note: `配送费已支付，等待${paymentInfo.provider}骑手上门取件`
    });
    
    await order.save();
    
    // 发送通知给门店
    if (order.storeId) {
      await notificationService.send(order.storeId, 'cleaning.delivery_fee_paid', {
        orderNo: order.orderNo,
        provider: paymentInfo.provider,
        fee: paymentInfo.fee
      });
    }
    
    // 触发配送服务（传递 order._id 确保是 ObjectId 格式）
    await this.triggerDelivery(order._id, auth);
    
    return {
      orderId: order._id,
      status: order.status,
      deliveryStatus: order.deliveryStatus,
      paid: true
    };
  }

  /**
   * 用户扫码取件（C端）
   */
  async scanPickup(orderId, auth, scanInfo) {
    let order = null;
    
    // 支持通过 orderNo 或 _id 查询订单
    // 先尝试 orderNo（用户友好格式）
    order = await Order.findOne({ orderNo: orderId });
    
    // 如果没找到，尝试 _id（但先检查格式）
    if (!order && orderId && /^[0-9a-fA-F]{24}$/.test(orderId)) {
      try {
        order = await Order.findById(orderId);
      } catch (e) {
        // ObjectId 格式错误时忽略
      }
    }
    
    if (!order) throw new Error('订单不存在');
    
    // 检查权限：订单所有者或管理员，或未登录但有有效订单
    const isOwner = !auth.userId || order.userId === auth.userId;
    const isAdmin = auth.roles?.includes('admin');
    
    if (!isOwner && !isAdmin) {
      throw new Error('无权操作此订单');
    }
    
    // 检查订单状态：必须是 ready 或 awaiting_pickup_scan
    if (!['ready', 'awaiting_pickup_scan', 'awaiting_store_outbound'].includes(order.status)) {
      throw new Error('订单状态不允许扫码取件');
    }
    
    // 更新订单状态
    order.status = 'awaiting_store_outbound';
    order.pickupScannedAt = new Date(scanInfo.scanTime || Date.now());
    
    if (scanInfo.pickupMethod) {
      order.pickupMethod = scanInfo.pickupMethod;
    }
    
    order.statusHistory.push({
      status: order.status,
      time: new Date(),
      actorId: auth.userId,
      note: '用户已扫描取件二维码，等待店员出库'
    });
    
    await order.save();
    
    // 通知门店有新订单需要出库（触发灯条）
    if (order.storeId) {
      await notificationService.send(order.storeId, 'cleaning.pickup_scanned', {
        orderNo: order.orderNo,
        orderId: order.orderId
      });
    }
    
    return {
      orderId: order._id,
      status: order.status,
      pickupScannedAt: order.pickupScannedAt
    };
  }

  /**
   * 选择跑腿服务商（C端）
   */
  async selectCourierProvider(orderId, auth, providerInfo) {
    let order = null;
    
    // 支持通过 orderNo 或 _id 查询订单
    // 先尝试 orderNo（用户友好格式）
    order = await Order.findOne({ orderNo: orderId });
    
    // 如果没找到，尝试 _id（但先检查格式）
    if (!order && orderId && /^[0-9a-fA-F]{24}$/.test(orderId)) {
      try {
        order = await Order.findById(orderId);
      } catch (e) {
        // ObjectId 格式错误时忽略
      }
    }
    
    if (!order) throw new Error('订单不存在');
    
    // 检查权限：订单所有者或管理员，或未登录但有有效订单
    // 注意：使用 optionalAuth，所以 auth.userId 可能为 undefined
    // 只要有有效的订单ID，就应该允许操作
    const isOwner = !auth.userId || order.userId === auth.userId;
    const isAdmin = auth.roles?.includes('admin');
    
    if (!isOwner && !isAdmin) {
      throw new Error('无权操作此订单');
    }
    
    // 更新跑腿服务商
    order.deliveryMethod = 'courier';
    order.selectedProvider = providerInfo.provider;
    order.courier = order.courier || {};
    order.courier.provider = providerInfo.provider;
    
    // 设置配送费
    const providerFees = {
      'meituan': 12,
      'sf': 15,
      'jd': 18,
      'taobao': 16
    };
    order.deliveryFee = providerFees[providerInfo.provider] || 15;
    
    order.statusHistory.push({
      status: order.status,
      time: new Date(),
      actorId: auth.userId,
      note: `用户选择了${providerInfo.provider}跑腿服务`
    });
    
    await order.save();
    
    return {
      orderId: order._id,
      deliveryMethod: order.deliveryMethod,
      selectedProvider: order.selectedProvider,
      deliveryFee: order.deliveryFee
    };
  }

  /**
   * 触发配送服务
   */
  async triggerDelivery(orderId, auth) {
    // 支持 ObjectId 格式验证
    if (!orderId || !/^[0-9a-fA-F]{24}$/.test(orderId)) {
      throw new Error('订单ID格式无效');
    }
    
    let order;
    try {
      order = await Order.findById(orderId);
    } catch (e) {
      throw new Error('订单不存在');
    }
    
    if (!order) throw new Error('订单不存在');
    
    // TODO: 调用实际配送服务API（美团、达达、顺丰等）
    console.log(`[配送服务] 为订单 ${order.orderNo} 创建配送单`);
    
    return {
      success: true,
      deliveryId: `DL${Date.now()}`,
      message: '配送订单已创建'
    };
  }

  /**
   * 一键取货（批量操作）
   * @param {string} storeId - 门店ID
   * @param {object} auth - 认证信息
   */
  async batchPickup(storeId, auth) {
    // 查找该门店下所有待取件的订单（到店自提方式）
    const orders = await Order.find({
      storeId: storeId,
      status: 'ready',
      pickupMethod: 'store_pickup'
    }).lean();
    
    if (orders.length === 0) {
      return {
        successCount: 0,
        failedCount: 0,
        orderIds: []
      };
    }
    
    let successCount = 0;
    let failedCount = 0;
    let orderIds = [];
    
    for (const orderData of orders) {
      try {
        await Order.findByIdAndUpdate(orderData._id, {
          $set: {
            status: 'completed',
            'cleaning.pickedUpAt': new Date()
          },
          $push: {
            statusHistory: {
              status: 'completed',
              time: new Date(),
              actorId: auth.userId,
              note: '一键取货完成'
            }
          }
        });
        
        successCount++;
        orderIds.push(orderData._id.toString());
      } catch (error) {
        failedCount++;
        console.error(`订单 ${orderData.orderNo} 取货失败:`, error);
      }
    }
    
    // 关闭该门店所有待取货的智能灯条
    await this.triggerSmartLight(storeId, {
      orderIds: orderIds,
      action: 'pickup_complete'
    });
    
    return {
      successCount,
      failedCount,
      orderIds
    };
  }

  /**
   * 触发智能灯条
   * @param {string} storeId - 门店ID
   * @param {object} lightInfo - 灯条信息 { orderIds, priority, action }
   */
  async triggerSmartLight(storeId, lightInfo) {
    // TODO: 集成实际智能灯条硬件API（MQTT、WebSocket等）
    
    const lightConfig = {
      storeId,
      orders: lightInfo.orderIds || [],
      priority: lightInfo.priority || 'normal',
      action: lightInfo.action,
      triggeredAt: new Date()
    };
    
    console.log('[智能灯条] 触发取货信号:', JSON.stringify(lightConfig));
    
    // 模拟灯条响应
    return {
      success: true,
      lightId: `LIGHT_${storeId}_${Date.now()}`,
      status: 'active',
      message: lightInfo.action === 'pickup_ready' ? '取货灯已点亮' : '取货灯已关闭'
    };
  }

  /**
   * 获取智能灯条状态
   * @param {string} storeId - 门店ID
   */
  async getLightStatus(storeId) {
    // TODO: 查询实际灯条硬件状态
    
    return {
      storeId,
      active: true,
      lights: [
        { position: 'A1', status: 'off', orderCount: 0 },
        { position: 'A2', status: 'green', orderCount: 2 },
        { position: 'A3', status: 'yellow', orderCount: 1 },
        { position: 'A4', status: 'off', orderCount: 0 }
      ],
      totalPending: 3,
      lastUpdate: new Date()
    };
  }

  /**
   * 获取用户待取件订单列表
   * @param {string} userId - 用户ID
   */
  async getPendingPickupOrders(userId) {
    const orders = await Order.find({
      userId: userId,
      status: 'ready'
    }).sort({ createdAt: -1 }).lean();
    
    return orders;
  }

  /**
   * 获取同一网点的所有待取件订单（用于一键取货）
   * @param {string} storeId - 门店ID
   */
  async getStorePendingOrders(storeId) {
    const orders = await Order.find({
      storeId: storeId,
      status: 'ready'
    }).populate('userId', 'name phone').sort({ createdAt: -1 }).lean();
    
    return orders.map(order => ({
      orderId: order._id,
      orderNo: order.orderNo,
      userName: order.userId?.name || '未知',
      userPhone: order.userId?.phone || '',
      itemCount: order.items.length,
      // 返回完整的items对象数组，而不是只有name的字符串数组
      items: order.items.map(item => ({
        name: item.name,
        serviceName: item.name,
        price: item.price,
        quantity: item.quantity,
        status: item.status || 'pending',
        itemId: item.itemId
      })),
      pickupCode: order.cleaning?.pickupCode || '',
      createdAt: order.createdAt
    }));
  }
}

// 引用moduleGuard用于检查模块权限
const { isModuleEnabled } = require('../../common/middlewares/moduleGuard');

module.exports = new OrderService();
