const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/dry_cleaning').then(async () => {
  const Order = mongoose.model('Order', new mongoose.Schema({
    orderNo: String,
    orderType: String,
    userId: String,
    storeId: String,
    items: [{
      name: String,
      price: Number,
      quantity: Number,
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
      status: String
    },
    payment: {
      status: String,
      method: String
    },
    cleaning: {
      pickupCode: String,
      storeReceivedAt: Date
    },
    status: String,
    statusHistory: [{
      status: String,
      time: Date,
      note: String
    }]
  }, { timestamps: true }));

  // 创建测试订单
  const order = await Order.create({
    orderNo: 'CL' + Date.now(),
    orderType: 'cleaning',
    userId: 'USER001',
    storeId: 'ST001',
    items: [
      { name: '西装', price: 120, quantity: 1, status: 'processing' },
      { name: '衬衫', price: 40, quantity: 2, status: 'processing' }
    ],
    amounts: {
      subtotal: 200,
      discount: 20,
      deliveryFee: 0,
      total: 180
    },
    delivery: {
      type: 'pickup'
    },
    payment: {
      status: 'paid',
      method: 'wechat'
    },
    cleaning: {
      pickupCode: 'P' + String(Math.floor(Math.random() * 1000000)).padStart(6, '0'),
      storeReceivedAt: new Date()
    },
    status: 'processing',
    statusHistory: [
      { status: 'paid', time: new Date(Date.now() - 7200000), note: '支付成功' },
      { status: 'delivering', time: new Date(Date.now() - 6000000), note: '配送员已取件' },
      { status: 'received', time: new Date(Date.now() - 5400000), note: '衣物已送达服务网点' },
      { status: 'processing', time: new Date(Date.now() - 3600000), note: '衣物已进入清洗工序' }
    ]
  });

  console.log('测试订单已创建:');
  console.log('  订单ID:', order._id);
  console.log('  订单号:', order.orderNo);
  console.log('  状态:', order.status);
  console.log('  取件码:', order.cleaning.pickupCode);

  await mongoose.disconnect();
}).catch(console.error);
