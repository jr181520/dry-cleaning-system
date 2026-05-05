/**
 * 干洗订单服务
 */

const { v4: uuidv4 } = require('uuid');
const paymentService = require('../../common/services/paymentService');
const notificationService = require('../../common/services/notificationService');

class OrderService {
  constructor() {
    this.orders = new Map();
    this.items = new Map();
  }
  
  async createOrder(params) {
    const { userId, storeId, items, delivery, amounts } = params;
    const orderNo = this.generateOrderNo();
    const orderId = 'ORD-' + uuidv4();
    const amountsCalculated = this.calculateAmounts(items, delivery);
    
    const order = {
      id: orderId,
      orderNo,
      orderType: 'cleaning',
      userId,
      storeId,
      items: items.map(item => ({
        itemId: item.itemId || 'ITEM-' + uuidv4(),
        name: item.name,
        itemType: 'dry_cleaning',
        serviceType: item.serviceType || 'dry_clean',
        price: item.price,
        quantity: item.quantity || 1,
        subtotal: item.price * (item.quantity || 1),
        specialReq: item.specialReq || '',
        pickupCode: this.generatePickupCode()
      })),
      amounts: {
        subtotal: amountsCalculated.subtotal,
        discount: amounts?.discount || 0,
        deliveryFee: amounts?.deliveryFee || 0,
        total: amountsCalculated.total
      },
      delivery: delivery || { type: 'pickup' },
      payment: { status: 'pending', method: null },
      cleaning: {
        storeReceivedAt: null,
        storeCompletedAt: null,
        returnDate: this.calculateReturnDate(),
        qualityCheckPassed: false
      },
      status: 'pending',
      statusHistory: [{ status: 'pending', time: new Date().toISOString(), actorId: userId, note: '订单创建' }],
      createdAt: new Date().toISOString(),
      createdFrom: 'app'
    };
    
    this.orders.set(orderId, order);
    await notificationService.send(userId, 'cleaning.order_created', { orderNo: order.orderNo, estimatedDays: 3 });
    return order;
  }
  
  async getOrders(params) {
    const { userId, roles, page, pageSize, status, storeId } = params;
    let orders = Array.from(this.orders.values());
    
    if (roles?.includes('customer')) {
      orders = orders.filter(o => o.userId === userId);
    } else if (roles?.includes('store_staff') || roles?.includes('store_owner')) {
      orders = orders.filter(o => o.storeId === storeId);
    }
    
    if (status) orders = orders.filter(o => o.status === status);
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const total = orders.length;
    const start = (page - 1) * pageSize;
    return { list: orders.slice(start, start + pageSize), total, page, pageSize };
  }
  
  async getOrderById(orderId, auth) {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('订单不存在');
    if (auth.roles?.includes('customer') && order.userId !== auth.userId) {
      throw new Error('无权查看此订单');
    }
    return order;
  }
  
  async cancelOrder(orderId, auth) {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('订单不存在');
    if (order.status !== 'pending' && order.status !== 'paid') throw new Error('当前状态无法取消');
    if (order.userId !== auth.userId && !auth.roles?.includes('admin')) throw new Error('无权取消此订单');
    
    order.status = 'cancelled';
    order.statusHistory.push({ status: 'cancelled', time: new Date().toISOString(), actorId: auth.userId, note: auth.reason || '用户取消' });
    return order;
  }
  
  async receiveOrder(orderId, auth) {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('订单不存在');
    if (order.status !== 'paid') throw new Error('订单未支付，无法收件');
    
    order.status = 'in_progress';
    order.cleaning.storeReceivedAt = new Date().toISOString();
    order.statusHistory.push({ status: 'in_progress', time: new Date().toISOString(), actorId: auth.staffId, note: '门店已收件' });
    
    for (const item of order.items) item.status = 'received';
    await notificationService.send(order.userId, 'cleaning.order_received', { itemName: order.items[0]?.name });
    return order;
  }
  
  async completeOrder(orderId, auth) {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('订单不存在');
    if (order.status !== 'in_progress') throw new Error('订单状态不对');
    
    order.status = 'completed';
    order.cleaning.storeCompletedAt = new Date().toISOString();
    order.cleaning.qualityCheckPassed = true;
    order.statusHistory.push({ status: 'completed', time: new Date().toISOString(), actorId: auth.staffId, note: '清洗完成' });
    
    for (const item of order.items) item.status = 'ready';
    await notificationService.send(order.userId, 'cleaning.order_completed', { itemName: order.items[0]?.name, storeName: '门店名称' });
    return order;
  }
  
  generateOrderNo() {
    const date = new Date();
    return 'CL' + date.getFullYear() + String(date.getMonth() + 1).padStart(2, '0') + String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  }
  
  generatePickupCode() {
    return 'P' + String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  }
  
  calculateAmounts(items, delivery) {
    const subtotal = items.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
    const deliveryFee = delivery?.type === 'delivery' ? (delivery.fee || 10) : 0;
    return { subtotal, deliveryFee, total: subtotal + deliveryFee };
  }
  
  calculateReturnDate() {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    return date.toISOString().split('T')[0];
  }
  
  async getItems(params) {
    const items = Array.from(this.items.values()).filter(i => i.ownerId === params.userId);
    return { list: items, total: items.length };
  }
}

module.exports = new OrderService();
