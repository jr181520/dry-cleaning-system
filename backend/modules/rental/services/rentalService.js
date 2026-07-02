/**
 * 租赁模块服务
 * 
 * 租赁双向跑腿模型：
 *   发货（第一程）：门店 → 跑腿配送 → 用户收到 → 开始使用
 *   归还（第二程）：用户 → 跑腿配送 → 门店收到 → 检查 → 退押金
 */

// ============================================
// 临时数据存储（后续迁移到数据库）
// ============================================
let rentalItems = [];
let rentalOrders = [];
let creditRecords = {};

// ============================================
// 物品管理
// ============================================

async function listItems({ category = 'rental', page = 1, limit = 20 }) {
  const items = rentalItems.filter(i => i.category === category);
  const total = items.length;
  const data = items.slice((page - 1) * limit, page * limit);
  return { items: data, total, page, limit };
}

async function getItemDetail(itemId) {
  return rentalItems.find(i => i.id === itemId || i._id?.toString() === itemId) || null;
}

// ============================================
// 订单管理
// ============================================

/**
 * 创建租赁订单
 */
async function createRentalOrder(data) {
  const { userId, storeId, items, rentalDays, deliveryMethod, deliveryAddress } = data;

  if (!items || items.length === 0) throw new Error('请选择至少一件商品');

  // 计算押金和租金
  let totalDeposit = 0;
  let totalRental = 0;
  const orderItems = items.map(item => {
    totalDeposit += (item.deposit || 0) * (item.quantity || 1);
    totalRental += (item.price || 0) * (item.quantity || 1) * (rentalDays || 1);
    return {
      itemId: item.itemId || item.id,
      name: item.name,
      dailyRate: item.price,
      rentalDays: rentalDays || 1,
      deposit: item.deposit,
      quantity: item.quantity || 1,
      subtotal: (item.price || 0) * (item.quantity || 1) * (rentalDays || 1)
    };
  });

  const orderNo = 'RNT' + Date.now().toString(36).toUpperCase();

  const order = {
    orderNo,
    orderType: data.orderType || 'rental',
    userId,
    storeId,
    items: orderItems,
    amounts: {
      subtotal: totalRental,
      deposit: totalDeposit,
      total: totalRental + totalDeposit,
      discount: 0
    },
    rentalDays: rentalDays || 1,
    status: 'reserved',
    deliveryMethod: deliveryMethod || 'courier',
    deliveryAddress,
    createdAt: new Date().toISOString(),
    statusHistory: [{ status: 'reserved', time: new Date(), note: '预约下单' }]
  };

  rentalOrders.push(order);
  return order;
}

async function listOrders({ userId, status, page = 1, limit = 20 }) {
  let orders = rentalOrders;
  if (userId) orders = orders.filter(o => o.userId === userId);
  if (status) orders = orders.filter(o => o.status === status);

  const total = orders.length;
  const data = orders.slice((page - 1) * limit, page * limit);
  return { orders: data, total, page, limit };
}

async function getOrderDetail(orderId) {
  return rentalOrders.find(o => o.orderNo === orderId || o._id?.toString() === orderId) || null;
}

// ============================================
// 租赁流程操作
// ============================================

/**
 * 门店发货（第一程配送）
 */
async function shipItem(orderId, { courierProvider, trackingNo }) {
  const order = rentalOrders.find(o => o.orderNo === orderId || o.id === orderId);
  if (!order) throw new Error('订单不存在');
  if (order.status !== 'reserved' && order.status !== 'paid') throw new Error('订单状态不允许发货');

  order.status = 'shipped';
  order.courier = { provider: courierProvider, trackingNo, status: 'picking' };
  order.shippedAt = new Date().toISOString();
  order.statusHistory.push({ status: 'shipped', time: new Date(), note: `已发货，配送商: ${courierProvider}` });

  // 触发灯条通知（门店找货出库）
  try {
    triggerLightBarForRental(order, 'outbound');
  } catch (e) { /* 非关键 */ }

  return { order, message: '已发货，等待用户接收' };
}

/**
 * 用户确认收货
 */
async function confirmReceive(orderId) {
  const order = rentalOrders.find(o => o.orderNo === orderId || o.id === orderId);
  if (!order) throw new Error('订单不存在');
  if (order.status !== 'shipped') throw new Error('订单未发货或已收货');

  order.status = 'using';
  order.startedAt = new Date().toISOString();
  order.dueDate = new Date(Date.now() + (order.rentalDays || 1) * 86400000).toISOString();
  order.statusHistory.push({ status: 'using', time: new Date(), note: '用户已开始使用' });

  return { order, message: '已开始使用，到期日: ' + order.dueDate };
}

/**
 * 用户发起归还（第二程配送）
 */
async function returnItem(orderId, { deliveryMethod, address, provider }) {
  const order = rentalOrders.find(o => o.orderNo === orderId || o.id === orderId);
  if (!order) throw new Error('订单不存在');
  if (order.status !== 'using' && order.status !== 'due' && order.status !== 'overdue') {
    throw new Error('当前状态不允许归还');
  }

  const isOverdue = order.dueDate && new Date() > new Date(order.dueDate);

  order.status = 'returning';
  order.returnDelivery = { method: deliveryMethod || 'courier', address, provider };
  order.returnRequestedAt = new Date().toISOString();
  order.isOverdue = isOverdue;
  order.statusHistory.push({ status: 'returning', time: new Date(), note: isOverdue ? '用户逾期归还（第二程配送）' : '用户发起归还（第二程配送）' });

  // 触发灯条通知（门店收货入库）
  try {
    triggerLightBarForRental(order, 'inbound');
  } catch (e) { /* 非关键 */ }

  return { order, message: '归还配送已发起', isOverdue };
}

/**
 * 门店确认归还
 */
async function confirmReturn(orderId, { damageCheck, damageNote }) {
  const order = rentalOrders.find(o => o.orderNo === orderId || o.id === orderId);
  if (!order) throw new Error('订单不存在');
  if (order.status !== 'returning') throw new Error('订单未在归还中状态');

  order.status = 'returned';
  order.returnedAt = new Date().toISOString();
  order.damageCheck = damageCheck || 'none';
  order.damageNote = damageNote || '';
  order.refundable = damageCheck !== 'damaged';
  order.statusHistory.push({
    status: 'returned',
    time: new Date(),
    note: damageCheck === 'damaged' ? '物品有损坏，押金暂扣' : '归还成功，退还押金'
  });

  return { order, message: order.refundable ? '归还成功，押金退回中' : '物品有损坏，押金暂扣' };
}

// ============================================
// 押金
// ============================================

async function manageDeposit(action, { orderId, amount }) {
  const order = rentalOrders.find(o => o.orderNo === orderId || o.id === orderId);
  if (!order) throw new Error('订单不存在');

  if (action === 'pay') {
    order.depositPaid = true;
    order.depositPaidAt = new Date().toISOString();
    order.status = 'paid';
    return { success: true, message: '押金支付成功', order };
  }

  if (action === 'refund') {
    if (!order.refundable) throw new Error('物品有损坏，押金不可退');
    order.depositRefunded = true;
    order.depositRefundedAt = new Date().toISOString();
    return { success: true, message: '押金退回成功', refundAmount: order.amounts?.deposit || 0 };
  }

  throw new Error('无效操作');
}

// ============================================
// 信用评估
// ============================================

async function getCredit(userId) {
  if (!creditRecords[userId]) {
    creditRecords[userId] = {
      userId,
      score: 600,
      level: 'normal',
      totalOrders: 0,
      onTimeReturns: 0,
      overdueCount: 0
    };
  }
  return creditRecords[userId];
}

// ============================================
// 工具函数
// ============================================

function triggerLightBarForRental(order, direction) {
  try {
    const lightRequest = {
      type: direction === 'outbound' ? 'rental_outbound' : 'rental_return',
      orderId: order.orderNo || order.id,
      orderType: order.orderType || 'rental',
      direction,
      items: order.items,
      timestamp: Date.now(),
      storeId: order.storeId,
      customerName: order.customerName || '用户',
      message: direction === 'outbound' ? '租赁发货：请根据灯条取出物品交给骑手' : '租赁归还：请根据灯条接收归还物品入库'
    };

    // 写入localStorage（仅浏览器环境）
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('store_light_request', JSON.stringify(lightRequest));
    }
  } catch (e) {
    // 非浏览器环境忽略
  }
}

module.exports = {
  listItems,
  getItemDetail,
  createRentalOrder,
  listOrders,
  getOrderDetail,
  shipItem,
  confirmReceive,
  returnItem,
  confirmReturn,
  manageDeposit,
  getCredit
};
