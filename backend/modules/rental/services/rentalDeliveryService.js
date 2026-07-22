/**
 * 租赁配送集成服务
 * 处理双程跑腿配送：
 *   第一程（outbound）：门店 → 用户
 *   第二程（return）：用户 → 门店
 */

const { RentalOrder } = require('../models/RentalOrder');

/**
 * 创建第一程配送（门店→用户）
 * 商家发货时调用
 */
async function createOutboundDelivery(orderNo, { provider, storeAddress, userAddress }) {
  const order = await RentalOrder.findOne({ orderNo });
  if (!order) throw new Error('订单不存在');

  // 构建配送单数据
  const deliveryData = {
    orderId: order._id.toString(),
    orderNo: order.orderNo,
    type: 'rental_outbound',  // 租赁第一程
    direction: 'outbound',
    provider: provider || 'mock',
    pickupAddress: {
      contactName: '门店',
      contactPhone: '',
      address: storeAddress || '门店地址'
    },
    deliveryAddress: {
      contactName: order.delivery?.contactName || '用户',
      contactPhone: order.delivery?.contactPhone || '',
      address: order.delivery?.address || '用户地址',
      latitude: order.delivery?.latitude,
      longitude: order.delivery?.longitude
    },
    items: order.items.map(i => ({ name: i.name, quantity: i.quantity })),
    status: 'pending',
    createdAt: new Date()
  };

  // 调用配送服务（复用现有deliveryService）
  try {
    const deliveryService = require('../../common/services/deliveryService');
    const deliveryOrder = await deliveryService.createDelivery(deliveryData);
    
    // 更新订单配送信息
    order.delivery.deliveryOrderId = deliveryOrder._id?.toString() || deliveryOrder.id;
    order.delivery.courier = {
      provider: deliveryOrder.provider,
      trackingNo: deliveryOrder.trackingNo || deliveryOrder.providerOrderId,
      status: 'pending'
    };
    await order.save();

    return deliveryOrder;
  } catch(e) {
    // 如果deliveryService不可用，使用模拟
    console.warn('[RentalDelivery] deliveryService不可用，使用模拟配送:', e.message);
    
    const mockDeliveryId = 'DEL' + Date.now().toString(36).toUpperCase();
    order.delivery.deliveryOrderId = mockDeliveryId;
    order.delivery.courier = {
      provider: provider || 'mock',
      trackingNo: 'MOCK-' + Date.now(),
      status: 'pending'
    };
    await order.save();

    return {
      id: mockDeliveryId,
      type: 'rental_outbound',
      status: 'pending',
      provider: provider || 'mock',
      trackingNo: 'MOCK-' + Date.now()
    };
  }
}

/**
 * 创建第二程配送（用户→门店，归还）
 * 用户发起归还时调用
 */
async function createReturnDelivery(orderNo, { provider, pickupAddress }) {
  const order = await RentalOrder.findOne({ orderNo });
  if (!order) throw new Error('订单不存在');

  const deliveryData = {
    orderId: order._id.toString(),
    orderNo: order.orderNo,
    type: 'rental_return',  // 租赁第二程（归还）
    direction: 'return',
    provider: provider || 'mock',
    pickupAddress: {
      contactName: pickupAddress?.contactName || order.delivery?.contactName || '用户',
      contactPhone: pickupAddress?.contactPhone || order.delivery?.contactPhone || '',
      address: pickupAddress?.address || order.delivery?.address || '用户地址',
      latitude: pickupAddress?.latitude,
      longitude: pickupAddress?.longitude
    },
    deliveryAddress: {
      contactName: '门店',
      contactPhone: '',
      address: '门店地址'  // TODO: 从门店信息获取
    },
    items: order.items.map(i => ({ name: i.name, quantity: i.quantity })),
    status: 'pending',
    createdAt: new Date()
  };

  try {
    const deliveryService = require('../../common/services/deliveryService');
    const deliveryOrder = await deliveryService.createDelivery(deliveryData);
    
    order.returnDelivery.deliveryOrderId = deliveryOrder._id?.toString() || deliveryOrder.id;
    order.returnDelivery.courier = {
      provider: deliveryOrder.provider,
      trackingNo: deliveryOrder.trackingNo || deliveryOrder.providerOrderId,
      status: 'pending'
    };
    await order.save();

    return deliveryOrder;
  } catch(e) {
    console.warn('[RentalDelivery] deliveryService不可用，使用模拟配送:', e.message);
    
    const mockDeliveryId = 'DEL' + Date.now().toString(36).toUpperCase();
    order.returnDelivery.deliveryOrderId = mockDeliveryId;
    order.returnDelivery.courier = {
      provider: provider || 'mock',
      trackingNo: 'MOCK-RET-' + Date.now(),
      status: 'pending'
    };
    await order.save();

    return {
      id: mockDeliveryId,
      type: 'rental_return',
      status: 'pending',
      provider: provider || 'mock',
      trackingNo: 'MOCK-RET-' + Date.now()
    };
  }
}

/**
 * 配送状态回调更新
 * 配送商状态变更时调用
 */
async function onDeliveryStatusUpdate(deliveryOrderId, { status, courier }) {
  const order = await RentalOrder.findOne({
    $or: [
      { 'delivery.deliveryOrderId': deliveryOrderId },
      { 'returnDelivery.deliveryOrderId': deliveryOrderId }
    ]
  });

  if (!order) {
    console.warn('[RentalDelivery] 配送单关联订单未找到:', deliveryOrderId);
    return;
  }

  const isOutbound = order.delivery.deliveryOrderId === deliveryOrderId;
  
  if (isOutbound) {
    order.delivery.courier = { ...order.delivery.courier, ...courier, status };
    
    // 配送完成 → 等待用户确认收货
    if (status === 'delivered') {
      order.addStatusHistory('shipped', '第一程配送完成，等待用户确认收货', 'system');
    }
  } else {
    order.returnDelivery.courier = { ...order.returnDelivery.courier, ...courier, status };
    
    // 归还配送完成 → 门店收到物品
    if (status === 'delivered') {
      order.addStatusHistory('returning', '第二程配送完成，门店已收到归还物品', 'system');
    }
  }

  await order.save();
}

module.exports = {
  createOutboundDelivery,
  createReturnDelivery,
  onDeliveryStatusUpdate
};
