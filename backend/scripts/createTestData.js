/**
 * 测试数据生成脚本
 * 创建模拟账号和订单用于测试
 */

const mongoose = require('mongoose');

// 连接数据库
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dryclean';

async function createTestData() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[测试数据] 已连接MongoDB');

    const db = mongoose.connection.db;

    // ==========================================
    // 1. 创建门店
    // ==========================================
    const storeCollection = db.collection('stores');
    
    // 检查是否已有测试门店
    const existingStore = await storeCollection.findOne({ code: 'ST001' });
    let storeId;
    
    if (existingStore) {
      storeId = existingStore._id.toString();
      console.log('[测试数据] 门店已存在:', existingStore.name);
    } else {
      const store = {
        _id: new mongoose.Types.ObjectId(),
        id: 'ST001',
        name: '干洗一号店',
        code: 'ST001',
        ownerId: 'OWNER001',
        staffIds: ['STAFF001'],
        business: {
          licenseNo: '91110000MA00ABCD1',
          contactPhone: '13800138001',
          description: '专业干洗服务'
        },
        location: {
          province: '北京市',
          city: '北京市',
          district: '朝阳区',
          address: '朝阳区建国路88号',
          latitude: 39.9042,
          longitude: 116.4074
        },
        hours: {
          monday: { open: '08:00', close: '21:00' },
          tuesday: { open: '08:00', close: '21:00' },
          wednesday: { open: '08:00', close: '21:00' },
          thursday: { open: '08:00', close: '21:00' },
          friday: { open: '08:00', close: '21:00' },
          saturday: { open: '09:00', close: '20:00' },
          sunday: { open: '09:00', close: '20:00' }
        },
        services: [
          { serviceId: 'S001', name: '普通干洗', price: 35, enabled: true },
          { serviceId: 'S002', name: '奢品护理', price: 120, enabled: true }
        ],
        delivery: {
          enabled: true,
          freeThreshold: 100,
          fee: 10,
          providers: ['platform']
        },
        stats: {
          totalOrders: 156,
          monthlyOrders: 23,
          rating: 4.8,
          ratingCount: 89
        },
        settlement: {
          balance: 12580.50,
          frozenBalance: 0,
          pendingSettlement: 3200
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await storeCollection.insertOne(store);
      storeId = store._id.toString();
      console.log('[测试数据] 门店已创建:', store.name);
    }

    // ==========================================
    // 2. 创建店员账号
    // ==========================================
    const userCollection = db.collection('users');
    
    const staffAccount = {
      _id: new mongoose.Types.ObjectId(),
      id: 'STAFF001',
      phone: '13900001001',
      openId: 'mock_openid_staff_001',
      roles: ['store_staff'],
      profile: {
        name: '店员小王',
        avatar: '',
        gender: 'male'
      },
      storeId: storeId,
      member: {
        level: 'normal',
        points: 0,
        totalSpent: 0
      },
      balance: {
        available: 0,
        frozen: 0
      },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const existingStaff = await userCollection.findOne({ phone: '13900001001' });
    if (!existingStaff) {
      await userCollection.insertOne(staffAccount);
      console.log('[测试数据] 店员账号已创建: 13900001001');
    } else {
      console.log('[测试数据] 店员账号已存在: 13900001001');
    }

    // ==========================================
    // 3. 创建用户账号
    // ==========================================
    const customerAccounts = [
      {
        _id: new mongoose.Types.ObjectId(),
        id: 'CUST001',
        phone: '13800001001',
        openId: 'mock_openid_customer_001',
        unionId: 'mock_unionid_001',
        roles: ['customer'],
        profile: {
          name: '张三',
          avatar: '',
          gender: 'male'
        },
        addresses: [
          {
            id: 'ADDR001',
            name: '家',
            phone: '13800001001',
            province: '北京市',
            city: '北京市',
            district: '朝阳区',
            address: '朝阳区建国路100号',
            latitude: 39.9050,
            longitude: 116.4080,
            tag: 'home',
            isDefault: true
          }
        ],
        member: {
          level: 'gold',
          points: 520,
          totalSpent: 2580,
          memberSince: new Date('2025-01-01')
        },
        balance: {
          available: 200,
          frozen: 0
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        _id: new mongoose.Types.ObjectId(),
        id: 'CUST002',
        phone: '13800001002',
        openId: 'mock_openid_customer_002',
        unionId: 'mock_unionid_002',
        roles: ['customer'],
        profile: {
          name: '李四',
          avatar: '',
          gender: 'female'
        },
        addresses: [
          {
            id: 'ADDR002',
            name: '家',
            phone: '13800001002',
            province: '北京市',
            city: '北京市',
            district: '海淀区',
            address: '海淀区中关村大街50号',
            latitude: 39.9850,
            longitude: 116.3180,
            tag: 'home',
            isDefault: true
          }
        ],
        member: {
          level: 'silver',
          points: 120,
          totalSpent: 860,
          memberSince: new Date('2025-06-01')
        },
        balance: {
          available: 50,
          frozen: 0
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const customer of customerAccounts) {
      const existing = await userCollection.findOne({ phone: customer.phone });
      if (!existing) {
        await userCollection.insertOne(customer);
        console.log('[测试数据] 用户账号已创建:', customer.phone, '-', customer.profile.name);
      } else {
        console.log('[测试数据] 用户账号已存在:', customer.phone);
      }
    }

    // ==========================================
    // 4. 创建测试订单
    // ==========================================
    const orderCollection = db.collection('orders');
    
    // 生成订单号
    const orderNo = 'ORD' + Date.now();
    
    const testOrders = [
      {
        _id: new mongoose.Types.ObjectId(),
        id: orderNo,
        orderNo: orderNo,
        orderType: 'cleaning',
        userId: 'CUST001',
        storeId: storeId,
        items: [
          {
            itemId: 'ITEM001',
            name: '西装套装',
            itemType: 'dry_cleaning',
            price: 120,
            quantity: 1,
            subtotal: 120,
            serviceType: 'dry_clean',
            pickupCode: '1001'
          },
          {
            itemId: 'ITEM002',
            name: '羊绒大衣',
            itemType: 'dry_cleaning',
            price: 180,
            quantity: 1,
            subtotal: 180,
            serviceType: 'dry_clean',
            pickupCode: '1002'
          }
        ],
        amounts: {
          subtotal: 300,
          discount: 0,
          deliveryFee: 0,
          total: 300
        },
        delivery: {
          type: 'pickup',  // 用户自取
          courierType: 'solo',
          pickupAddress: {
            contactName: '店员小王',
            contactPhone: '13900001001',
            address: '朝阳区建国路88号 干洗一号店'
          }
        },
        payment: {
          status: 'paid',
          method: 'wechat',
          transactionId: 'WX' + Date.now(),
          paidAt: new Date(Date.now() - 86400000) // 1天前支付
        },
        status: 'in_progress',
        cleaning: {
          storeReceivedAt: new Date(Date.now() - 86400000),
          storeCompletedAt: new Date(Date.now() - 3600000), // 1小时前完成
          qualityCheckPassed: true
        },
        statusHistory: [
          { status: 'pending', time: new Date(Date.now() - 172800000), actorId: 'CUST001', actorType: 'customer', note: '订单创建' },
          { status: 'paid', time: new Date(Date.now() - 86400000), actorId: 'CUST001', actorType: 'customer', note: '支付成功' },
          { status: 'in_progress', time: new Date(Date.now() - 86400000), actorId: 'STAFF001', actorType: 'store_staff', note: '已收件' }
        ],
        remark: '',
        createdAt: new Date(Date.now() - 172800000),
        updatedAt: new Date(),
        createdFrom: 'wechat'
      }
    ];

    for (const order of testOrders) {
      const existing = await orderCollection.findOne({ orderNo: order.orderNo });
      if (!existing) {
        await orderCollection.insertOne(order);
        console.log('[测试数据] 订单已创建:', order.orderNo, '- 待取件');
      } else {
        console.log('[测试数据] 订单已存在:', order.orderNo);
      }
    }

    // ==========================================
    // 输出测试账号信息
    // ==========================================
    console.log('\n========================================');
    console.log('         测试账号信息');
    console.log('========================================');
    console.log('门店: 干洗一号店 (ST001)');
    console.log('店员: 13900001001 / 密码: 123456');
    console.log('用户1: 13800001001 / 密码: 123456 (张三)');
    console.log('用户2: 13800001002 / 密码: 123456 (李四)');
    console.log('测试订单:', orderNo);
    console.log('========================================\n');

    console.log('[测试数据] 完成！');
    
  } catch (error) {
    console.error('[测试数据] 错误:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createTestData();
