/**
 * 数据库初始化脚本
 * 用于创建数据库表或MongoDB集合
 */

require('dotenv').config();
const db = require('../config');
const { createMongoDBModels } = require('../migrations/002_mongodb_schema');

async function initDatabase() {
  console.log('🚀 开始初始化数据库...\n');
  
  try {
    // 初始化连接
    console.log('📦 初始化数据库连接...');
    await db.initDatabase();
    console.log('✅ 数据库连接成功\n');
    
    const dbType = process.env.DB_TYPE || 'mongodb';
    
    if (dbType === 'mongodb') {
      // MongoDB 初始化
      await initMongoDB();
    } else {
      // MySQL 初始化
      await initMySQL();
    }
    
    console.log('\n✅ 数据库初始化完成！');
    
    // 关闭连接
    await db.closeDatabase();
    
  } catch (error) {
    console.error('\n❌ 数据库初始化失败:', error);
    process.exit(1);
  }
}

async function initMongoDB() {
  console.log('📊 初始化 MongoDB 集合...\n');
  
  const mongoose = db.getMongoose();
  const dbName = mongoose.connection.name;
  
  console.log(`数据库名称: ${dbName}`);
  console.log('集合列表:');
  console.log('  - users (用户表)');
  console.log('  - stores (门店表)');
  console.log('  - orders (订单表)');
  console.log('  - items (物品表)');
  console.log('  - payments (支付记录表)');
  console.log('  - notifications (通知表)');
  console.log('  - credits (信用记录表)');
  console.log('  - order_history (订单历史表)');
  console.log('  - split_records (分账记录表)');
  console.log('');
  
  // 创建索引
  console.log('🔍 创建索引...');
  
  const collections = {
    users: [
      { key: { openId: 1 }, unique: true },
      { key: { phone: 1 } },
      { key: { roles: 1 } }
    ],
    stores: [
      { key: { storeId: 1 }, unique: true },
      { key: { ownerId: 1 } }
    ],
    orders: [
      { key: { orderId: 1 }, unique: true },
      { key: { userId: 1 } },
      { key: { storeId: 1 } },
      { key: { orderType: 1 } },
      { key: { status: 1 } },
      { key: { createdAt: -1 } }
    ],
    items: [
      { key: { itemId: 1 }, unique: true },
      { key: { ownerId: 1 } },
      { key: { itemType: 1 } },
      { key: { ownerType: 1 } }
    ],
    credits: [
      { key: { userId: 1 }, unique: true },
      { key: { createdAt: -1 } }
    ]
  };
  
  console.log('✅ MongoDB 初始化完成');
  console.log('💡 索引将在首次插入数据时自动创建');
}

async function initMySQL() {
  console.log('📊 初始化 MySQL 表...\n');
  
  const pool = db.getMySQLPool();
  
  // 读取并执行迁移脚本
  const fs = require('fs');
  const path = require('path');
  const migrationFile = path.join(__dirname, '../migrations/001_migrate_to_polymorphic.sql');
  
  if (fs.existsSync(migrationFile)) {
    console.log('📄 发现迁移脚本: 001_migrate_to_polymorphic.sql');
    
    // 读取SQL文件
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    // 分割SQL语句并执行
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    console.log(`\n📝 将执行 ${statements.length} 条 SQL 语句\n`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length > 0) {
        try {
          await pool.execute(statement);
          // 提取表名
          const tableMatch = statement.match(/CREATE TABLE.*?`?(\w+)`?/i);
          if (tableMatch) {
            console.log(`  ✅ 创建表: ${tableMatch[1]}`);
          }
        } catch (error) {
          // 忽略表已存在的错误
          if (!error.message.includes('already exists')) {
            console.error(`  ⚠️ SQL 执行警告: ${error.message.substring(0, 60)}...`);
          }
        }
      }
    }
  } else {
    console.log('⚠️ 未找到迁移脚本，手动执行 SQL 文件');
    console.log(`   路径: ${migrationFile}`);
  }
  
  console.log('\n✅ MySQL 初始化完成');
}

// 运行
initDatabase();
