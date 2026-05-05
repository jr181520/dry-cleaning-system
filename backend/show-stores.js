/**
 * 查看所有门店数据
 */
const mongoose = require('mongoose');

async function showAllStores() {
    try {
        await mongoose.connect('mongodb://localhost:27017/dry_cleaning');
        console.log('已连接到MongoDB\n');

        const Store = mongoose.models.Store || mongoose.model('Store', new mongoose.Schema({}));
        const stores = await Store.find().lean();

        console.log('=== 所有门店数据 ===\n');
        stores.forEach((store, index) => {
            console.log(`门店 ${index + 1}:`);
            console.log('  _id:', store._id);
            console.log('  storeNo:', store.storeNo);
            console.log('  name:', store.name);
            console.log('  address:', store.address);
            console.log();
        });

        await mongoose.disconnect();
    } catch (error) {
        console.error('错误:', error.message);
        process.exit(1);
    }
}

showAllStores();
