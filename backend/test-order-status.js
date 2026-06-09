const mongoose = require('mongoose');
require('./config');
const Order = require('./modules/cleaning/models/Order');

async function test() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dry_cleaning');
    
    const orders = await Order.find().sort({createdAt: -1}).limit(1).lean();
    if (orders.length > 0) {
      const o = orders[0];
      console.log('最新订单:');
      console.log('  _id:', o._id.toString());
      console.log('  status:', o.status);
      console.log('  orderNo:', o.orderNo);
    } else {
      console.log('没有订单');
    }
    
    await mongoose.disconnect();
  } catch (e) {
    console.error('错误:', e.message);
    process.exit(1);
  }
}
test();
