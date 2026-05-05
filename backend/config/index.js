/**
 * 数据库连接管理
 * 单例模式
 */

const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
const dbConfig = require('./database');

// MySQL 连接池
let mysqlPool = null;

// MongoDB 连接
let mongooseConnection = null;

/**
 * 初始化数据库连接
 */
async function initDatabase() {
  if (dbConfig.type === 'mongodb') {
    await initMongoDB();
  } else {
    await initMySQL();
  }
}

/**
 * 初始化 MongoDB 连接
 */
async function initMongoDB() {
  if (mongooseConnection) {
    return mongooseConnection;
  }
  
  try {
    console.log('[DB] Connecting to MongoDB...');
    mongooseConnection = await mongoose.connect(dbConfig.mongodb.uri, dbConfig.mongodb.options);
    console.log('[DB] MongoDB connected successfully');
    
    mongoose.connection.on('error', (err) => {
      console.error('[DB] MongoDB error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('[DB] MongoDB disconnected');
    });
    
    return mongooseConnection;
  } catch (error) {
    console.error('[DB] MongoDB connection failed:', error);
    throw error;
  }
}

/**
 * 初始化 MySQL 连接池
 */
async function initMySQL() {
  if (mysqlPool) {
    return mysqlPool;
  }
  
  try {
    console.log('[DB] Creating MySQL connection pool...');
    mysqlPool = mysql.createPool({
      host: dbConfig.mysql.host,
      port: dbConfig.mysql.port,
      user: dbConfig.mysql.user,
      password: dbConfig.mysql.password,
      database: dbConfig.mysql.database,
      waitForConnections: true,
      connectionLimit: dbConfig.mysql.pool.max,
      queueLimit: 0,
      timezone: dbConfig.mysql.timezone,
      ssl: dbConfig.mysql.ssl ? {} : undefined
    });
    
    // 测试连接
    const connection = await mysqlPool.getConnection();
    console.log('[DB] MySQL connected successfully');
    connection.release();
    
    return mysqlPool;
  } catch (error) {
    console.error('[DB] MySQL connection failed:', error);
    throw error;
  }
}

/**
 * 获取 MySQL 连接池
 */
function getMySQLPool() {
  if (!mysqlPool) {
    throw new Error('MySQL not initialized. Call initDatabase() first.');
  }
  return mysqlPool;
}

/**
 * 获取 MongoDB 连接
 */
function getMongoose() {
  return mongoose;
}

/**
 * 关闭所有连接
 */
async function closeDatabase() {
  try {
    if (mysqlPool) {
      await mysqlPool.end();
      mysqlPool = null;
      console.log('[DB] MySQL pool closed');
    }
    
    if (mongoose.connection) {
      await mongoose.connection.close();
      mongooseConnection = null;
      console.log('[DB] MongoDB closed');
    }
  } catch (error) {
    console.error('[DB] Error closing database:', error);
  }
}

/**
 * 执行 MySQL 查询（便捷方法）
 */
async function query(sql, params = []) {
  const pool = getMySQLPool();
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * 执行 MySQL 事务
 */
async function transaction(callback) {
  const pool = getMySQLPool();
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  initDatabase,
  initMongoDB,
  initMySQL,
  getMySQLPool,
  getMongoose,
  closeDatabase,
  query,
  transaction
};
