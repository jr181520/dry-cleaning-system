/**
 * 清除测试数据
 * 运行方式: node scripts/clear-test-data.js
 */

const mongoose = require('mongoose');

// MongoDB 连接配置
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/dry_cleaning';

async function clearTestData() {
  try {
    console.log('正在连接 MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('已连接\n');

    const db = mongoose.connection.db;
    
    // 清除干洗订单
    console.log('清除干洗订单...');
    const ordersResult = await db.collection('orders').deleteMany({
      orderType: 'cleaning'
    });
    console.log(`已删除 ${ordersResult.deletedCount} 个订单\n`);

    // 清除配送单
    console.log('清除配送单...');
    const deliveryResult = await db.collection('deliveryorders').deleteMany({});
    console.log(`已删除 ${deliveryResult.deletedCount} 个配送单\n`);

    // 清除物品
    console.log('清除物品...');
    const itemsResult = await db.collection('items').deleteMany({});
    console.log(`已删除 ${itemsResult.deletedCount} 个物品\n`);

    console.log('测试数据已清除！');
    
  } catch (error) {
    console.error('错误:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('已断开 MongoDB 连接');
    process.exit(0);
  }
}

clearTestData();
