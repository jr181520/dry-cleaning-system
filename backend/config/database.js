/**
 * 数据库配置
 * 支持 MySQL 和 MongoDB
 */

module.exports = {
  // 数据库类型: 'mysql' | 'mongodb'
  type: process.env.DB_TYPE || 'mongodb',
  
  // MySQL 配置
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'dry_cleaning',
    
    // 连接池配置
    pool: {
      min: 5,
      max: 20,
      acquireTimeout: 30000,
      idleTimeout: 10000
    },
    
    // 是否启用 SSL
    ssl: process.env.MYSQL_SSL === 'true',
    
    // 时区
    timezone: '+08:00',
    
    // 日志
    logging: process.env.NODE_ENV === 'development'
  },
  
  // MongoDB 配置
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/dry_cleaning',
    
    // 选项
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    }
  },
  
  // Redis 配置（可选，用于缓存）
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: process.env.REDIS_DB || 0,
    
    // 缓存 TTL
    ttl: {
      moduleConfig: 300,        // 5分钟
      userSession: 86400,      // 24小时
      orderCache: 300          // 5分钟
    }
  }
};
