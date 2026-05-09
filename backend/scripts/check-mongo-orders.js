/**
 * 检查MongoDB订单数据
 */
const mongoose = require('mongoose');

async function checkOrders() {
  try {
    await mongoose.connect('mongodb://localhost:27017/dry_cleaning');
    console.log('✅ MongoDB连接成功\n');

    // 获取订单集合
    const collection = mongoose.connection.db.collection('orders');

    // 统计数据
    const totalCount = await collection.countDocuments();
    console.log(`📊 总订单数: ${totalCount}\n`);

    // 获取最近10条订单
    const recentOrders = await collection
      .find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    if (recentOrders.length === 0) {
      console.log('❌ 没有找到任何订单\n');
    } else {
      console.log('📋 最近10条订单:\n');
      recentOrders.forEach((order, index) => {
        console.log(`${index + 1}. 订单号: ${order.orderNo}`);
        console.log(`   状态: ${order.status}`);
        console.log(`   用户ID: ${order.userId}`);
        console.log(`   门店ID: ${order.storeId}`);
        console.log(`   创建时间: ${new Date(order.createdAt).toLocaleString()}`);
        console.log(`   金额: ¥${order.amounts?.total || 0}`);
        if (order.items && order.items.length > 0) {
          console.log(`   服务: ${order.items.map(i => i.name).join(', ')}`);
        }
        console.log('');
      });
    }

    await mongoose.disconnect();
    console.log('✅ 检查完成');
    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

checkOrders();
