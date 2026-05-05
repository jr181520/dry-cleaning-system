/**
 * 种子数据脚本
 * 初始化示例数据用于测试
 */

require('dotenv').config();
const db = require('../config');
const { v4: uuidv4 } = require('uuid');

async function seedData() {
  console.log('🌱 开始初始化种子数据...\n');
  
  try {
    // 初始化连接
    await db.initDatabase();
    
    const dbType = process.env.DB_TYPE || 'mongodb';
    
    if (dbType === 'mongodb') {
      await seedMongoDB();
    } else {
      await seedMySQL();
    }
    
    console.log('\n✅ 种子数据初始化完成！');
    console.log('\n📋 测试账号:');
    console.log('   - 用户手机: 13800138001');
    console.log('   - 管理员: admin / admin123');
    console.log('\n💡 可以运行 npm start 启动服务');
    
    await db.closeDatabase();
    
  } catch (error) {
    console.error('\n❌ 种子数据初始化失败:', error);
    process.exit(1);
  }
}

async function seedMongoDB() {
  console.log('📊 MongoDB 种子数据...\n');
  
  const mongoose = db.getMongoose();
  const dbInstance = mongoose.connection.db;
  
  // 清空现有数据
  console.log('🗑️ 清空现有数据...');
  await dbInstance.collection('users').deleteMany({});
  await dbInstance.collection('stores').deleteMany({});
  await dbInstance.collection('orders').deleteMany({});
  await dbInstance.collection('items').deleteMany({});
  await dbInstance.collection('credits').deleteMany({});
  console.log('✅ 清空完成\n');
  
  // 1. 创建测试门店
  console.log('📍 创建测试门店...');
  const stores = [
    {
      storeId: 'ST001',
      name: '干洗先生 - 旗舰店',
      address: '北京市朝阳区建国路88号',
      phone: '010-88888888',
      ownerId: 'OWNER001',
      rating: 4.8,
      businessHours: { open: '08:00', close: '21:00' },
      services: ['干洗', '水洗', '熨烫', '改衣'],
      pricing: {
        dryClean: { 西装: 50, 衬衫: 15, 羽绒服: 60 },
        wash: { 普通水洗: 20 },
        iron: { 熨烫: 10 }
      },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      storeId: 'ST002',
      name: '干洗先生 - 二店',
      address: '北京市海淀区中关村大街100号',
      phone: '010-66666666',
      ownerId: 'OWNER001',
      rating: 4.6,
      businessHours: { open: '09:00', close: '20:00' },
      services: ['干洗', '熨烫'],
      pricing: {
        dryClean: { 西装: 48, 衬衫: 12, 羽绒服: 55 },
        iron: { 熨烫: 8 }
      },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  
  await dbInstance.collection('stores').insertMany(stores);
  console.log(`  ✅ 创建 ${stores.length} 个门店\n`);
  
  // 2. 创建测试用户
  console.log('👤 创建测试用户...');
  const users = [
    {
      openId: 'USER001',
      name: '张三',
      phone: '13800138001',
      avatar: '',
      roles: ['customer'],
      addresses: [
        { label: '家', address: '北京市朝阳区xxx小区', phone: '13800138001' },
        { label: '公司', address: '北京市海淀区xxx大厦', phone: '13800138001' }
      ],
      memberLevel: 'gold',
      points: 500,
      balance: 100,
      credit: {
        fulfillmentScore: 95,
        completedOrders: 10,
        cancelledOrders: 0,
        lateReturns: 0,
        depositBalance: 0,
        creditLimit: 5000,
        blacklisted: false
      },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      openId: 'USER002',
      name: '李四',
      phone: '13900139002',
      avatar: '',
      roles: ['customer'],
      addresses: [
        { label: '家', address: '北京市海淀区xxx花园', phone: '13900139002' }
      ],
      memberLevel: 'silver',
      points: 200,
      balance: 50,
      credit: {
        fulfillmentScore: 80,
        completedOrders: 5,
        cancelledOrders: 1,
        lateReturns: 0,
        depositBalance: 0,
        creditLimit: 2000,
        blacklisted: false
      },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      openId: 'OWNER001',
      name: '王老板',
      phone: '13700137001',
      avatar: '',
      roles: ['store_owner', 'customer'],
      addresses: [],
      memberLevel: 'platinum',
      points: 1000,
      balance: 0,
      credit: {
        fulfillmentScore: 100,
        completedOrders: 0,
        cancelledOrders: 0,
        lateReturns: 0,
        depositBalance: 0,
        creditLimit: 0,
        blacklisted: false
      },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      openId: 'STAFF001',
      name: '小李',
      phone: '13600136001',
      avatar: '',
      roles: ['store_staff'],
      storeId: 'ST001',
      addresses: [],
      memberLevel: 'bronze',
      points: 0,
      balance: 0,
      credit: {
        fulfillmentScore: 100,
        completedOrders: 0,
        cancelledOrders: 0,
        lateReturns: 0,
        depositBalance: 0,
        creditLimit: 0,
        blacklisted: false
      },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  
  await dbInstance.collection('users').insertMany(users);
  console.log(`  ✅ 创建 ${users.length} 个用户\n`);
  
  // 3. 创建测试订单
  console.log('📋 创建测试订单...');
  const now = new Date();
  const orders = [
    {
      orderId: 'ORD20250422001',
      orderType: 'cleaning',
      userId: 'USER001',
      storeId: 'ST001',
      items: [
        { itemId: 'ITEM001', name: '西装外套', itemType: 'dry_cleaning', quantity: 1, price: 50, serviceType: 'dryClean', stains: [], specialReq: '' },
        { itemId: 'ITEM002', name: '衬衫', itemType: 'dry_cleaning', quantity: 2, price: 30, serviceType: 'dryClean', stains: ['领口'], specialReq: '' }
      ],
      amounts: { subtotal: 80, discount: 8, deliveryFee: 0, total: 72 },
      payment: { status: 'paid', method: 'wechat', transactionId: 'WX' + Date.now(), paidAt: new Date() },
      status: 'completed',
      cleaning: {
        pickupCode: 'P123456',
        storeReceivedAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
        completedAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
        returnDate: now,
        pickedUpAt: null
      },
      statusHistory: [
        { status: 'pending', time: new Date(now - 3 * 24 * 60 * 60 * 1000), actor: 'USER001' },
        { status: 'paid', time: new Date(now - 3 * 24 * 60 * 60 * 1000), actor: 'USER001' },
        { status: 'store_received', time: new Date(now - 2 * 24 * 60 * 60 * 1000), actor: 'STAFF001' },
        { status: 'in_progress', time: new Date(now - 2 * 24 * 60 * 60 * 1000), actor: 'STAFF001' },
        { status: 'completed', time: new Date(now - 1 * 24 * 60 * 60 * 1000), actor: 'STAFF001' }
      ],
      createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
      updatedAt: new Date()
    },
    {
      orderId: 'ORD20250422002',
      orderType: 'cleaning',
      userId: 'USER002',
      storeId: 'ST001',
      items: [
        { itemId: 'ITEM003', name: '羽绒服', itemType: 'dry_cleaning', quantity: 1, price: 60, serviceType: 'dryClean', stains: [], specialReq: '注意蓬松度' }
      ],
      amounts: { subtotal: 60, discount: 0, deliveryFee: 10, total: 70 },
      payment: { status: 'paid', method: 'wechat', transactionId: 'WX' + (Date.now() + 1), paidAt: new Date() },
      status: 'in_progress',
      cleaning: {
        pickupCode: 'P654321',
        storeReceivedAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
        completedAt: null,
        returnDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
        pickedUpAt: null
      },
      statusHistory: [
        { status: 'pending', time: new Date(now - 2 * 24 * 60 * 60 * 1000), actor: 'USER002' },
        { status: 'paid', time: new Date(now - 2 * 24 * 60 * 60 * 1000), actor: 'USER002' },
        { status: 'store_received', time: new Date(now - 1 * 24 * 60 * 60 * 1000), actor: 'STAFF001' },
        { status: 'in_progress', time: new Date(now - 1 * 24 * 60 * 60 * 1000), actor: 'STAFF001' }
      ],
      createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
      updatedAt: new Date()
    }
  ];
  
  await dbInstance.collection('orders').insertMany(orders);
  console.log(`  ✅ 创建 ${orders.length} 个订单\n`);
  
  // 4. 创建信用记录
  console.log('📈 创建信用记录...');
  const credits = users.map(user => ({
    userId: user.openId,
    score: user.credit.fulfillmentScore,
    completedOrders: user.credit.completedOrders,
    cancelledOrders: user.credit.cancelledOrders,
    lateReturns: user.credit.lateReturns,
    history: [
      { type: '初始化', score: user.credit.fulfillmentScore, time: new Date() }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  }));
  
  await dbInstance.collection('credits').insertMany(credits);
  console.log(`  ✅ 创建 ${credits.length} 条信用记录\n`);
  
  console.log('📊 数据统计:');
  console.log(`  - 门店: ${stores.length}`);
  console.log(`  - 用户: ${users.length}`);
  console.log(`  - 订单: ${orders.length}`);
  console.log(`  - 信用记录: ${credits.length}`);
}

async function seedMySQL() {
  console.log('📊 MySQL 种子数据...\n');
  
  const pool = db.getMySQLPool();
  
  // 清空现有数据
  console.log('🗑️ 清空现有数据...');
  await pool.execute('SET FOREIGN_KEY_CHECKS = 0');
  await pool.execute('TRUNCATE TABLE order_history');
  await pool.execute('TRUNCATE TABLE credits');
  await pool.execute('TRUNCATE TABLE orders');
  await pool.execute('TRUNCATE TABLE items');
  await pool.execute('TRUNCATE TABLE users');
  await pool.execute('TRUNCATE TABLE stores');
  await pool.execute('SET FOREIGN_KEY_CHECKS = 1');
  console.log('✅ 清空完成\n');
  
  // 1. 门店
  console.log('📍 创建测试门店...');
  await pool.execute(`
    INSERT INTO stores (store_id, name, address, phone, owner_id, rating, 
                       business_hours, services, pricing, status, created_at)
    VALUES 
    ('ST001', '干洗先生 - 旗舰店', '北京市朝阳区建国路88号', '010-88888888', 'OWNER001',
     4.8, '{"open":"08:00","close":"21:00"}', '["干洗","水洗","熨烫","改衣"]',
     '{"dryClean":{"西装":50,"衬衫":15,"羽绒服":60},"wash":{"普通水洗":20},"iron":{"熨烫":10}}',
     'active', NOW()),
    ('ST002', '干洗先生 - 二店', '北京市海淀区中关村大街100号', '010-66666666', 'OWNER001',
     4.6, '{"open":"09:00","close":"20:00"}', '["干洗","熨烫"]',
     '{"dryClean":{"西装":48,"衬衫":12,"羽绒服":55},"iron":{"熨烫":8}}',
     'active', NOW())
  `);
  console.log('  ✅ 创建 2 个门店\n');
  
  // 2. 用户
  console.log('👤 创建测试用户...');
  await pool.execute(`
    INSERT INTO users (open_id, name, phone, roles, addresses, member_level, 
                       points, balance, fulfillment_score, completed_orders, 
                       cancelled_orders, blacklisted, status, created_at)
    VALUES 
    ('USER001', '张三', '13800138001', '["customer"]',
     '[{"label":"家","address":"北京市朝阳区xxx小区","phone":"13800138001"},{"label":"公司","address":"北京市海淀区xxx大厦","phone":"13800138001"}]',
     'gold', 500, 100, 95, 10, 0, 0, 'active', NOW()),
    ('USER002', '李四', '13900139002', '["customer"]',
     '[{"label":"家","address":"北京市海淀区xxx花园","phone":"13900139002"}]',
     'silver', 200, 50, 80, 5, 1, 0, 'active', NOW()),
    ('OWNER001', '王老板', '13700137001', '["store_owner","customer"]',
     '[]', 'platinum', 1000, 0, 100, 0, 0, 0, 'active', NOW()),
    ('STAFF001', '小李', '13600136001', '["store_staff"]',
     '[]', 'bronze', 0, 0, 100, 0, 0, 0, 'active', NOW())
  `);
  console.log('  ✅ 创建 4 个用户\n');
  
  // 3. 订单
  console.log('📋 创建测试订单...');
  await pool.execute(`
    INSERT INTO orders (order_id, order_type, user_id, store_id, items, amounts, 
                       payment_status, payment_method, status, pickup_code, 
                       store_received_at, return_date, created_at)
    VALUES 
    ('ORD20250422001', 'cleaning', 'USER001', 'ST001',
     '[{"item_id":"ITEM001","name":"西装外套","item_type":"dry_cleaning","quantity":1,"price":50}]',
     '{"subtotal":80,"discount":8,"delivery_fee":0,"total":72}',
     'paid', 'wechat', 'completed', 'P123456',
     DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_ADD(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY)),
    ('ORD20250422002', 'cleaning', 'USER002', 'ST001',
     '[{"item_id":"ITEM003","name":"羽绒服","item_type":"dry_cleaning","quantity":1,"price":60}]',
     '{"subtotal":60,"discount":0,"delivery_fee":10,"total":70}',
     'paid', 'wechat', 'in_progress', 'P654321',
     DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY))
  `);
  console.log('  ✅ 创建 2 个订单\n');
  
  console.log('📊 数据统计:');
  console.log('  - 门店: 2');
  console.log('  - 用户: 4');
  console.log('  - 订单: 2');
}

// 运行
seedData();
