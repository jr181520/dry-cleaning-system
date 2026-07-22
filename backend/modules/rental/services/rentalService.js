/**
 * 租赁模块服务 - MongoDB持久化版本
 * 
 * 租赁双向跑腿模型：
 *   发货（第一程）：门店 → 跑腿配送 → 用户收到 → 开始使用
 *   归还（第二程）：用户 → 跑腿配送 → 门店收到 → 检查 → 退押金
 */

const { RentalItem, RENTAL_CATEGORIES, DEPOSIT_MODES, ITEM_STATUS } = require('../models/RentalItem');
const { RentalOrder, RENTAL_ORDER_STATUS } = require('../models/RentalOrder');
const { DepositRecord, DEPOSIT_MODE, DEPOSIT_STATUS } = require('../models/DepositRecord');

// ============================================
// 商品管理
// ============================================

/**
 * 创建租赁商品
 */
async function createItem(data) {
  const item = new RentalItem(data);
  await item.save();
  return item;
}

/**
 * 更新商品信息
 */
async function updateItem(itemId, data) {
  const item = await RentalItem.findByIdAndUpdate(
    itemId,
    { $set: data },
    { new: true, runValidators: true }
  );
  if (!item) throw new Error('商品不存在');
  return item;
}

/**
 * 删除/下架商品
 */
async function deleteItem(itemId) {
  const item = await RentalItem.findByIdAndUpdate(
    itemId,
    { $set: { status: 'off_sale' } },
    { new: true }
  );
  if (!item) throw new Error('商品不存在');
  return item;
}

/**
 * 获取商品详情
 */
async function getItemDetail(itemId) {
  const item = await RentalItem.findById(itemId).lean();
  return item;
}

/**
 * 商品列表（C端/小程序浏览）
 */
async function listItems({ category, storeId, keyword, status = 'on_sale', page = 1, limit = 20, sortBy = 'sortWeight', sortOrder = -1 }) {
  const filter = {};
  if (category && category !== 'all') filter.category = category;
  if (storeId) filter.storeId = storeId;
  if (status) filter.status = status;
  if (keyword) {
    filter.$or = [
      { name: { $regex: keyword, $options: 'i' } },
      { description: { $regex: keyword, $options: 'i' } },
      { brand: { $regex: keyword, $options: 'i' } }
    ];
  }

  const total = await RentalItem.countDocuments(filter);
  const items = await RentalItem.find(filter)
    .sort({ [sortBy]: sortOrder, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return { items, total, page, limit };
}

/**
 * 商家本店商品列表
 */
async function listItemsByStore(storeId, { status, page = 1, limit = 20 }) {
  const filter = { storeId };
  if (status) filter.status = status;

  const total = await RentalItem.countDocuments(filter);
  const items = await RentalItem.find(filter)
    .sort({ updatedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return { items, total, page, limit };
}

/**
 * 更新库存
 */
async function updateStock(itemId, quantity) {
  const item = await RentalItem.findById(itemId);
  if (!item) throw new Error('商品不存在');

  item.availableStock = quantity;
  await item.save();
  return item;
}

/**
 * 扣减库存（下单时）
 */
async function decreaseStock(itemId, quantity = 1) {
  const result = await RentalItem.findOneAndUpdate(
    { _id: itemId, availableStock: { $gte: quantity } },
    { $inc: { availableStock: -quantity } },
    { new: true }
  );
  if (!result) throw new Error('库存不足');
  return result;
}

/**
 * 恢复库存（取消订单时）
 */
async function increaseStock(itemId, quantity = 1) {
  const result = await RentalItem.findByIdAndUpdate(
    itemId,
    { $inc: { availableStock: quantity } },
    { new: true }
  );
  return result;
}

/**
 * 获取品类列表
 */
async function getCategories() {
  const categories = await RentalItem.aggregate([
    { $match: { status: 'on_sale' } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  return RENTAL_CATEGORIES.map(cat => ({
    value: cat,
    label: getCategoryLabel(cat),
    count: categories.find(c => c._id === cat)?.count || 0
  }));
}

function getCategoryLabel(category) {
  const labels = {
    clothing: '服饰',
    digital: '数码',
    outdoor: '户外',
    electronics: '电子',
    baby: '母婴',
    luxury: '轻奢',
    sports: '运动',
    tools: '工具',
    other: '其他'
  };
  return labels[category] || category;
}

// ============================================
// 订单管理
// ============================================

/**
 * 创建租赁订单
 */
async function createRentalOrder(data) {
  const { userId, storeId, items, rentalDays, deliveryMethod, deliveryAddress, depositMode: userDepositMode } = data;

  if (!items || items.length === 0) throw new Error('请选择至少一件商品');

  // 验证商品并计算金额
  let totalDeposit = 0;
  let totalRental = 0;
  const orderItems = [];

  for (const item of items) {
    const dbItem = await RentalItem.findById(item.itemId || item.id);
    if (!dbItem) throw new Error(`商品 ${item.name || item.itemId} 不存在`);
    if (dbItem.status === 'off_sale') throw new Error(`商品 ${dbItem.name} 已下架`);
    if (dbItem.availableStock < (item.quantity || 1)) throw new Error(`商品 ${dbItem.name} 库存不足`);

    const days = rentalDays || dbItem.rentalPeriodMin || 1;
    const qty = item.quantity || 1;
    const subtotal = dbItem.dailyRate * qty * days;

    // 押金模式判定
    let itemDepositMode = dbItem.depositMode;
    if (dbItem.depositMode === 'both' && userDepositMode) {
      itemDepositMode = userDepositMode;
    } else if (dbItem.depositMode === 'both') {
      itemDepositMode = 'deposit'; // 默认押金
    }

    totalDeposit += dbItem.depositAmount * qty;
    totalRental += subtotal;

    orderItems.push({
      itemId: dbItem._id.toString(),
      name: dbItem.name,
      image: dbItem.images?.[0] || '',
      category: dbItem.category,
      dailyRate: dbItem.dailyRate,
      depositMode: itemDepositMode,
      depositAmount: dbItem.depositAmount,
      quantity: qty,
      rentalDays: days,
      subtotal
    });
  }

  // 订单级押金模式：取最严格的
  const orderDepositMode = determineOrderDepositMode(orderItems);

  const orderNo = 'RNT' + Date.now().toString(36).toUpperCase();

  const order = new RentalOrder({
    orderNo,
    orderType: 'rental',
    userId,
    storeId,
    items: orderItems,
    amounts: {
      subtotal: totalRental,
      deposit: totalDeposit,
      total: totalRental + totalDeposit,
      discount: 0,
      deliveryFee: 0
    },
    rentalDays: rentalDays || orderItems[0]?.rentalDays || 1,
    depositMode: orderDepositMode,
    status: 'reserved',
    delivery: {
      type: deliveryMethod || 'courier',
      address: deliveryAddress?.address,
      contactName: deliveryAddress?.contactName,
      contactPhone: deliveryAddress?.contactPhone,
      latitude: deliveryAddress?.latitude,
      longitude: deliveryAddress?.longitude
    },
    reservedAt: new Date(),
    statusHistory: [{ status: 'reserved', time: new Date(), note: '预约下单', operator: 'user' }]
  });

  await order.save();

  // 扣减库存
  for (const item of items) {
    await decreaseStock(item.itemId || item.id, item.quantity || 1);
  }

  return order;
}

/**
 * 确定订单级押金模式
 */
function determineOrderDepositMode(items) {
  const modes = items.map(i => i.depositMode);
  // 如果有任何一个要求纯押金，则整单押金
  if (modes.includes('deposit')) return 'deposit';
  // 如果有任何一个支持both，则both
  if (modes.includes('both')) return 'both';
  // 全部credit_free
  return 'credit_free';
}

/**
 * 订单列表
 */
async function listOrders({ userId, storeId, status, page = 1, limit = 20 }) {
  const filter = {};
  if (userId) filter.userId = userId;
  if (storeId) filter.storeId = storeId;
  if (status) filter.status = status;

  const total = await RentalOrder.countDocuments(filter);
  const orders = await RentalOrder.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return { orders, total, page, limit };
}

/**
 * 订单详情
 */
async function getOrderDetail(orderId) {
  const order = await RentalOrder.findOne({
    $or: [
      { orderNo: orderId },
      { _id: orderId }
    ]
  }).lean();
  return order;
}

// ============================================
// 租赁流程操作
// ============================================

/**
 * 支付成功回调
 */
async function onPaymentSuccess(orderId, paymentInfo) {
  const order = await RentalOrder.findOne({
    $or: [{ orderNo: orderId }, { _id: orderId }]
  });
  if (!order) throw new Error('订单不存在');
  if (order.status !== 'reserved') throw new Error('订单状态不允许支付');

  order.status = 'paid';
  order.paidAt = new Date();
  order.depositPaid = order.amounts.deposit > 0;
  order.payment = {
    method: paymentInfo?.method,
    transactionId: paymentInfo?.transactionId,
    status: 'paid',
    paidAt: new Date()
  };
  order.addStatusHistory('paid', '支付成功', 'system');
  await order.save();

  return order;
}

/**
 * 门店发货（第一程配送）
 */
async function shipItem(orderId, { courierProvider, trackingNo, deliveryOrderId }) {
  const order = await RentalOrder.findOne({
    $or: [{ orderNo: orderId }, { _id: orderId }]
  });
  if (!order) throw new Error('订单不存在');
  if (order.status !== 'paid') throw new Error('订单状态不允许发货（需已支付）');

  order.status = 'shipped';
  order.shippedAt = new Date();
  order.delivery.courier = {
    provider: courierProvider,
    trackingNo,
    status: 'picking'
  };
  if (deliveryOrderId) order.delivery.deliveryOrderId = deliveryOrderId;
  order.addStatusHistory('shipped', `已发货，配送商: ${courierProvider}`, 'store');
  await order.save();

  // 触发灯条通知
  triggerLightBarForRental(order, 'outbound');

  return order;
}

/**
 * 用户确认收货
 */
async function confirmReceive(orderId) {
  const order = await RentalOrder.findOne({
    $or: [{ orderNo: orderId }, { _id: orderId }]
  });
  if (!order) throw new Error('订单不存在');
  if (order.status !== 'shipped') throw new Error('订单未发货或已收货');

  order.status = 'using';
  order.receivedAt = new Date();
  order.startedAt = new Date();
  order.dueDate = new Date(Date.now() + (order.rentalDays || 1) * 86400000);
  order.addStatusHistory('using', '用户已开始使用', 'user');
  await order.save();

  return order;
}

/**
 * 用户发起归还（第二程配送）
 */
async function returnItem(orderId, { deliveryMethod, address, provider, contactName, contactPhone }) {
  const order = await RentalOrder.findOne({
    $or: [{ orderNo: orderId }, { _id: orderId }]
  });
  if (!order) throw new Error('订单不存在');
  if (!['using', 'due', 'overdue'].includes(order.status)) {
    throw new Error('当前状态不允许归还');
  }

  const isOverdue = order.dueDate && new Date() > new Date(order.dueDate);

  order.status = 'returning';
  order.returnDelivery = {
    type: deliveryMethod || 'courier',
    address: address?.address || address,
    contactName: contactName || address?.contactName,
    contactPhone: contactPhone || address?.contactPhone,
    courier: { provider }
  };
  order.returnRequestedAt = new Date();
  order.isOverdue = isOverdue;
  order.addStatusHistory('returning', isOverdue ? '用户逾期归还（第二程配送）' : '用户发起归还（第二程配送）', 'user');
  await order.save();

  triggerLightBarForRental(order, 'inbound');

  return { order, isOverdue };
}

/**
 * 门店确认归还
 */
async function confirmReturn(orderId, { damageCheck, damageNote, damagePhotos }) {
  const order = await RentalOrder.findOne({
    $or: [{ orderNo: orderId }, { _id: orderId }]
  });
  if (!order) throw new Error('订单不存在');
  if (order.status !== 'returning') throw new Error('订单未在归还中状态');

  order.status = 'returned';
  order.returnedAt = new Date();
  order.damageCheck = damageCheck || 'none';
  order.damageNote = damageNote || '';
  order.damagePhotos = damagePhotos || [];
  order.refundable = damageCheck !== 'damaged' && damageCheck !== 'major';

  // 计算逾期费
  if (order.isOverdue && order.dueDate) {
    const overdueDays = Math.ceil((new Date() - new Date(order.dueDate)) / 86400000);
    order.overdueDays = overdueDays;
    const overdueRate = order.items.reduce((sum, item) => sum + (item.dailyRate * item.quantity), 0) * 0.5;
    order.amounts.overdueFee = overdueDays * overdueRate;
  }

  // 损坏赔偿
  if (!order.refundable) {
    order.damagePenalty = order.amounts.deposit * 0.5; // 默认扣50%押金
  }

  order.addStatusHistory('returned', order.refundable ? '归还成功，物品完好' : '物品有损坏，押金暂扣', 'store');
  await order.save();

  // 恢复库存
  for (const item of order.items) {
    await increaseStock(item.itemId, item.quantity);
    // 增加租用次数
    await RentalItem.findByIdAndUpdate(item.itemId, { $inc: { totalRented: item.quantity } });
  }

  return order;
}

/**
 * 完成订单（押金退还后）
 */
async function completeOrder(orderId) {
  const order = await RentalOrder.findOne({
    $or: [{ orderNo: orderId }, { _id: orderId }]
  });
  if (!order) throw new Error('订单不存在');
  if (order.status !== 'returned') throw new Error('订单未归还');

  order.status = 'completed';
  order.completedAt = new Date();
  order.addStatusHistory('completed', '订单完成', 'system');
  await order.save();

  return order;
}

/**
 * 取消订单
 */
async function cancelOrder(orderId, reason) {
  const order = await RentalOrder.findOne({
    $or: [{ orderNo: orderId }, { _id: orderId }]
  });
  if (!order) throw new Error('订单不存在');
  if (!['reserved', 'paid'].includes(order.status)) throw new Error('当前状态不可取消');

  order.status = 'cancelled';
  order.cancelledAt = new Date();
  order.addStatusHistory('cancelled', reason || '用户取消', 'user');
  await order.save();

  // 恢复库存
  for (const item of order.items) {
    await increaseStock(item.itemId, item.quantity);
  }

  return order;
}

// ============================================
// 逾期管理
// ============================================

/**
 * 扫描并标记逾期订单
 */
async function checkOverdueOrders() {
  const overdueOrders = await RentalOrder.findOverdueOrders();
  const results = [];

  for (const order of overdueOrders) {
    const days = Math.ceil((new Date() - new Date(order.dueDate)) / 86400000);
    order.overdueDays = days;
    order.isOverdue = true;
    
    if (order.status === 'using') {
      order.status = 'overdue';
    }
    order.addStatusHistory('overdue', `逾期${days}天`, 'system');
    await order.save();
    results.push({ orderNo: order.orderNo, overdueDays: days });
  }

  return results;
}

// ============================================
// 押金管理
// ============================================

/**
 * 检查用户押金/免押资格
 */
async function checkDepositEligibility(userId, items) {
  const results = [];

  for (const item of items) {
    const dbItem = await RentalItem.findById(item.itemId || item.id).lean();
    if (!dbItem) continue;

    const result = {
      itemId: dbItem._id.toString(),
      name: dbItem.name,
      depositMode: dbItem.depositMode,
      depositAmount: dbItem.depositAmount,
      options: []
    };

    if (dbItem.depositMode === 'deposit') {
      result.options.push({ mode: 'deposit', amount: dbItem.depositAmount, label: '缴纳押金' });
    } else if (dbItem.depositMode === 'credit_free') {
      const credit = await checkCredit(userId, dbItem.creditThreshold);
      result.options.push({
        mode: 'credit_free',
        amount: 0,
        label: credit.eligible ? '信用免押' : '信用不足，需缴押金',
        eligible: credit.eligible,
        creditScore: credit.score
      });
    } else if (dbItem.depositMode === 'both') {
      const credit = await checkCredit(userId, dbItem.creditThreshold);
      result.options.push(
        { mode: 'deposit', amount: dbItem.depositAmount, label: '缴纳押金' },
        {
          mode: 'credit_free',
          amount: 0,
          label: credit.eligible ? '信用免押' : '信用不足',
          eligible: credit.eligible,
          creditScore: credit.score
        }
      );
    }

    results.push(result);
  }

  return results;
}

/**
 * 创建押金记录
 */
async function createDeposit(data) {
  const record = new DepositRecord(data);
  await record.save();
  return record;
}

/**
 * 押金支付成功
 */
async function onDepositPaid(orderNo, paymentInfo) {
  const record = await DepositRecord.findOne({ orderNo });
  if (!record) throw new Error('押金记录不存在');

  record.status = 'paid';
  record.paidAt = new Date();
  record.paymentMethod = paymentInfo?.method;
  record.paymentTransactionId = paymentInfo?.transactionId;
  await record.save();

  return record;
}

/**
 * 退还押金
 */
async function refundDeposit(orderNo, { amount, reason }) {
  const record = await DepositRecord.findOne({ orderNo });
  if (!record) throw new Error('押金记录不存在');

  await record.refund(amount, reason);
  return record;
}

/**
 * 扣除押金
 */
async function deductDeposit(orderNo, { amount, reason, proof }) {
  const record = await DepositRecord.findOne({ orderNo });
  if (!record) throw new Error('押金记录不存在');

  await record.deduct(amount, reason, proof);
  return record;
}

// ============================================
// 信用评估
// ============================================

/**
 * 检查用户信用
 */
async function checkCredit(userId, threshold = 600) {
  const eligibility = await DepositRecord.checkCreditEligibility(userId, threshold);
  return eligibility;
}

/**
 * 获取用户信用详情
 */
async function getCredit(userId) {
  const stats = await DepositRecord.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        totalDeposits: { $sum: '$depositAmount' },
        totalRefunded: { $sum: '$refundedAmount' },
        totalDeducted: { $sum: '$deductedAmount' },
        orderCount: { $sum: 1 },
        deductedCount: { $sum: { $cond: [{ $eq: ['$status', 'deducted'] }, 1, 0] } }
      }
    }
  ]);

  const orderStats = await RentalOrder.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        overdueCount: { $sum: { $cond: [{ $eq: ['$isOverdue', true] }, 1, 0] } },
        avgRentalDays: { $avg: '$rentalDays' }
      }
    }
  ]);

  const depositStats = stats[0] || { totalDeposits: 0, totalRefunded: 0, totalDeducted: 0, orderCount: 0, deductedCount: 0 };
  const orderData = orderStats[0] || { totalOrders: 0, overdueCount: 0, avgRentalDays: 0 };

  // 计算信用分
  let score = 600;
  score += Math.min(orderData.totalOrders * 10, 100);
  score -= orderData.overdueCount * 30;
  score -= depositStats.deductedCount * 50;
  score = Math.max(0, Math.min(1000, score));

  const level = score >= 800 ? 'excellent' : score >= 700 ? 'good' : score >= 600 ? 'normal' : 'poor';

  return {
    userId,
    score,
    level,
    totalOrders: orderData.totalOrders,
    overdueCount: orderData.overdueCount,
    deductedCount: depositStats.deductedCount,
    totalDeposits: depositStats.totalDeposits,
    totalRefunded: depositStats.totalRefunded
  };
}

// ============================================
// 工具函数
// ============================================

function triggerLightBarForRental(order, direction) {
  try {
    const lightRequest = {
      type: direction === 'outbound' ? 'rental_outbound' : 'rental_return',
      orderId: order.orderNo || order._id?.toString(),
      orderType: 'rental',
      direction,
      items: order.items,
      timestamp: Date.now(),
      storeId: order.storeId,
      customerName: order.delivery?.contactName || '用户',
      message: direction === 'outbound'
        ? '租赁发货：请根据灯条取出物品交给骑手'
        : '租赁归还：请根据灯条接收归还物品入库'
    };

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('store_light_request', JSON.stringify(lightRequest));
    }
  } catch (e) {
    // 非浏览器环境忽略
  }
}

module.exports = {
  // 商品管理
  createItem,
  updateItem,
  deleteItem,
  getItemDetail,
  listItems,
  listItemsByStore,
  updateStock,
  decreaseStock,
  increaseStock,
  getCategories,
  getCategoryLabel,

  // 订单管理
  createRentalOrder,
  listOrders,
  getOrderDetail,
  onPaymentSuccess,
  cancelOrder,

  // 租赁流程
  shipItem,
  confirmReceive,
  returnItem,
  confirmReturn,
  completeOrder,

  // 逾期管理
  checkOverdueOrders,

  // 押金管理
  checkDepositEligibility,
  createDeposit,
  onDepositPaid,
  refundDeposit,
  deductDeposit,

  // 信用评估
  checkCredit,
  getCredit
};
