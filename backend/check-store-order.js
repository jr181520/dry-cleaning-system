/**
 * 检查数据库中的门店和订单数据
 */
const mongoose = require('mongoose');

async function checkData() {
    try {
        // 连接到MongoDB
        await mongoose.connect('mongodb://localhost:27017/dry_cleaning');
        console.log('已连接到MongoDB\n');

        // 检查门店数据
        const Store = mongoose.models.Store || mongoose.model('Store', new mongoose.Schema({}));
        const stores = await Store.find().limit(5).lean();
        console.log('=== 门店数据 ===');
        console.log('门店总数:', stores.length);
        if (stores.length > 0) {
            console.log('\n示例门店:');
            console.log('  _id:', stores[0]._id);
            console.log('  name:', stores[0].name);
            console.log('  address:', stores[0].address);
            console.log('  phone:', stores[0].phone);
        }

        // 检查订单数据
        const Order = mongoose.models.Order || mongoose.model('Order', new mongoose.Schema({}));
        const orders = await Order.find().limit(5).lean();
        console.log('\n=== 订单数据 ===');
        console.log('订单总数:', orders.length);
        if (orders.length > 0) {
            console.log('\n示例订单:');
            console.log('  orderNo:', orders[0].orderNo);
            console.log('  storeId:', orders[0].storeId);
            console.log('  status:', orders[0].status);
            
            // 检查storeId和门店_id的匹配情况
            const orderStoreId = orders[0].storeId;
            const matchingStore = stores.find(s => s._id.toString() === orderStoreId);
            console.log('\n  门店匹配结果:', matchingStore ? '✅ 找到' : '❌ 未找到');
            if (matchingStore) {
                console.log('  匹配门店名:', matchingStore.name);
            }
        }

        await mongoose.disconnect();
        console.log('\n检查完成');
    } catch (error) {
        console.error('错误:', error.message);
        process.exit(1);
    }
}

checkData();
