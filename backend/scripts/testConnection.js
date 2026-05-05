/**
 * 数据库连接测试脚本
 */

require('dotenv').config();
const db = require('../config');

async function testConnection() {
  console.log('🧪 测试数据库连接...\n');
  console.log(`数据库类型: ${process.env.DB_TYPE || 'mongodb'}\n`);
  
  try {
    // 初始化连接
    console.log('📦 正在连接数据库...');
    await db.initDatabase();
    console.log('✅ 连接成功！\n');
    
    // 执行测试查询
    const dbType = process.env.DB_TYPE || 'mongodb';
    
    if (dbType === 'mongodb') {
      await testMongoDB();
    } else {
      await testMySQL();
    }
    
    console.log('\n✅ 所有测试通过！');
    
  } catch (error) {
    console.error('\n❌ 连接失败:', error.message);
    console.error('\n💡 故障排除:');
    console.error('   1. 确保 MongoDB/MySQL 服务已启动');
    console.error('   2. 检查 .env 中的连接配置');
    console.error('   3. 如果是远程数据库，检查网络连接');
    process.exit(1);
  } finally {
    await db.closeDatabase();
  }
}

async function testMongoDB() {
  const mongoose = db.getMongoose();
  const dbInstance = mongoose.connection.db;
  
  console.log('📊 MongoDB 测试:');
  
  // 测试1: 获取数据库信息
  const adminDb = dbInstance.admin();
  const result = await adminDb.serverInfo();
  console.log(`  ✅ 服务器版本: ${result.version}`);
  
  // 测试2: 列出集合
  const collections = await dbInstance.listCollections().toArray();
  console.log(`  ✅ 当前集合数: ${collections.length}`);
  
  // 测试3: 写入测试
  const testCollection = dbInstance.collection('_connection_test');
  await testCollection.insertOne({ test: true, time: new Date() });
  const count = await testCollection.countDocuments({ test: true });
  console.log(`  ✅ 写入测试: ${count} 条记录`);
  
  // 清理测试数据
  await testCollection.deleteMany({ test: true });
  console.log('  ✅ 清理测试数据完成');
}

async function testMySQL() {
  const pool = db.getMySQLPool();
  
  console.log('📊 MySQL 测试:');
  
  // 测试1: 获取版本
  const [version] = await pool.execute('SELECT VERSION() as version');
  console.log(`  ✅ 服务器版本: ${version[0].version}`);
  
  // 测试2: 获取数据库名
  const [dbName] = await pool.execute('SELECT DATABASE() as db');
  console.log(`  ✅ 当前数据库: ${dbName[0].db}`);
  
  // 测试3: 写入测试
  await pool.execute('CREATE TEMPORARY TABLE test_table (id INT, name VARCHAR(50))');
  await pool.execute('INSERT INTO test_table VALUES (1, "test")');
  const [rows] = await pool.execute('SELECT * FROM test_table');
  console.log(`  ✅ 写入测试: ${rows.length} 条记录`);
}

testConnection();
