/**
 * 数据层级权限中间件
 * 建立清晰的数据从属关系：admin → chain-admin → store → user
 */

const mongoose = require('mongoose');

/**
 * 数据层级权限验证工厂
 * @param {Object} options 配置选项
 * @param {string} options.dataType 数据类型：user/store/order/finance
 * @param {boolean} options.requireOwnership 是否要求数据所有权
 * @param {string[]} options.allowedRoles 允许的角色列表
 */
function createDataHierarchyMiddleware(options = {}) {
  const {
    dataType = 'order',
    requireOwnership = false,
    allowedRoles = ['admin', 'chain_admin', 'store_owner', 'store_staff']
  } = options;

  return async function dataHierarchyMiddleware(req, res, next) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ 
          success: false, 
          error: '请先登录',
          needLogin: true 
        });
      }

      // 检查角色权限
      const hasAllowedRole = allowedRoles.some(role => user.roles.includes(role));
      if (!hasAllowedRole) {
        return res.status(403).json({ 
          success: false, 
          error: '权限不足，无法访问该类型数据' 
        });
      }

      // 根据用户角色和数据类型设置数据访问范围
      req.dataAccessScope = await buildDataAccessScope(user, dataType, req);
      
      // 如果是admin，有全部权限
      if (user.roles.includes('admin')) {
        req.dataAccessScope = { adminAccess: true };
        next();
        return;
      }

      // chain-admin：只能访问自己连锁的数据
      if (user.roles.includes('chain_admin')) {
        const chainId = user.chainId;
        if (!chainId) {
          return res.status(403).json({ 
            success: false, 
            error: '连锁管理员未关联连锁企业' 
          });
        }
        req.dataAccessScope = { chainId };
        next();
        return;
      }

      // 门店角色：只能访问自己门店的数据
      if (user.roles.includes('store_owner') || user.roles.includes('store_staff')) {
        const storeId = user.storeId;
        if (!storeId) {
          return res.status(403).json({ 
            success: false, 
            error: '门店员工未关联门店' 
          });
        }
        req.dataAccessScope = { storeId };
        next();
        return;
      }

      // 其他角色（customer等）：只能访问自己的数据
      req.dataAccessScope = { userId: user.id };
      next();

    } catch (error) {
      console.error('[数据层级权限] 验证失败:', error);
      return res.status(500).json({ 
        success: false, 
        error: '数据权限验证失败' 
      });
    }
  };
}

/**
 * 构建数据访问范围
 */
async function buildDataAccessScope(user, dataType, req) {
  const scope = {};
  
  // 管理员有全部权限
  if (user.roles.includes('admin')) {
    scope.adminAccess = true;
    return scope;
  }

  // chain-admin：获取连锁下辖门店列表
  if (user.roles.includes('chain_admin')) {
    const Store = mongoose.models.Store;
    const chainId = user.chainId || req.params.chainId;
    
    if (chainId) {
      scope.chainId = chainId;
      
      // 获取连锁下辖所有门店ID
      const stores = await Store.find({ chainId }).select('_id').lean();
      scope.storeIds = stores.map(s => s._id.toString());
      
      // 获取连锁下辖所有用户ID（通过门店关联）
      // 这里需要根据实际业务逻辑扩展
    }
    return scope;
  }

  // 门店角色：只能访问自己门店的数据
  if (user.roles.includes('store_owner') || user.roles.includes('store_staff')) {
    scope.storeId = user.storeId;
    return scope;
  }

  // 普通用户：只能访问自己的数据
  scope.userId = user.id;
  return scope;
}

/**
 * 数据同步服务
 * 建立跨层级的数据同步机制
 */
class DataSyncService {
  constructor() {
    this.mqttClient = null;
    this.syncEvents = new Map();
  }

  /**
   * 初始化同步服务
   */
  async init() {
    // 初始化MQTT客户端（如果可用）
    try {
      const mqtt = require('mqtt');
      const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
      this.mqttClient = mqtt.connect(MQTT_BROKER);
      
      this.mqttClient.on('connect', () => {
        console.log('[数据同步] MQTT连接成功');
        // 订阅数据同步主题
        this.mqttClient.subscribe('data-sync/#');
      });
      
      this.mqttClient.on('message', (topic, message) => {
        this.handleSyncMessage(topic, JSON.parse(message.toString()));
      });
    } catch (error) {
      console.log('[数据同步] MQTT不可用，使用轮询模式');
    }
  }

  /**
   * 触发数据同步事件
   * @param {string} eventType 事件类型：user.created/order.updated/store.joined
   * @param {Object} data 事件数据
   * @param {Object} metadata 元数据
   */
  async triggerSync(eventType, data, metadata = {}) {
    const event = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: eventType,
      data,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        source: metadata.source || 'system'
      }
    };

    // 存储事件
    this.syncEvents.set(event.id, event);

    // 广播事件
    await this.broadcastEvent(event);

    // 触发层级同步
    await this.syncDataHierarchy(eventType, data);

    return event;
  }

  /**
   * 广播事件
   */
  async broadcastEvent(event) {
    // 通过MQTT广播
    if (this.mqttClient && this.mqttClient.connected) {
      const topic = `data-sync/${event.type}`;
      this.mqttClient.publish(topic, JSON.stringify(event));
    }

    // 记录到数据库
    await this.logSyncEvent(event);
  }

  /**
   * 记录同步事件
   */
  async logSyncEvent(event) {
    try {
      const SyncEvent = mongoose.models.SyncEvent || mongoose.model('SyncEvent', new mongoose.Schema({
        eventId: String,
        eventType: String,
        data: mongoose.Schema.Types.Mixed,
        metadata: mongoose.Schema.Types.Mixed,
        status: { type: String, enum: ['pending', 'processed', 'failed'], default: 'pending' },
        processedAt: Date,
        createdAt: { type: Date, default: Date.now }
      }));

      await SyncEvent.create({
        eventId: event.id,
        eventType: event.type,
        data: event.data,
        metadata: event.metadata,
        status: 'pending'
      });
    } catch (error) {
      console.error('[数据同步] 记录事件失败:', error);
    }
  }

  /**
   * 处理层级数据同步
   */
  async syncDataHierarchy(eventType, data) {
    switch (eventType) {
      case 'user.created':
        // 用户创建时，同步到相关层级
        await this.syncUserToHierarchy(data);
        break;
      
      case 'order.created':
      case 'order.updated':
        // 订单变更时，同步到门店和连锁
        await this.syncOrderToHierarchy(data);
        break;
      
      case 'store.created':
      case 'store.updated':
        // 门店变更时，同步到连锁
        await this.syncStoreToHierarchy(data);
        break;
      
      default:
        console.log(`[数据同步] 未知事件类型: ${eventType}`);
    }
  }

  /**
   * 同步用户数据到层级
   */
  async syncUserToHierarchy(userData) {
    const User = mongoose.models.User;
    const Store = mongoose.models.Store;
    const Chain = mongoose.models.Chain;

    try {
      const user = await User.findById(userData._id || userData.id);
      if (!user) return;

      // 记录用户来源
      const source = userData.metadata?.source || 'unknown';
      user.source = source; // C端、小程序、后台等
      user.registrationSource = source;
      
      await user.save();

      // 如果用户关联了门店，同步到门店层级
      if (user.storeId) {
        const store = await Store.findById(user.storeId);
        if (store) {
          // 更新门店用户统计
          await Store.updateOne(
            { _id: store._id },
            { $inc: { 'stats.totalUsers': 1 } }
          );

          // 如果门店属于连锁，同步到连锁层级
          if (store.chainId) {
            await Chain.updateOne(
              { _id: store.chainId },
              { $inc: { 'stats.totalUsers': 1 } }
            );
          }
        }
      }

      console.log(`[数据同步] 用户 ${user._id} 同步完成，来源: ${source}`);
    } catch (error) {
      console.error('[数据同步] 用户同步失败:', error);
    }
  }

  /**
   * 同步订单数据到层级
   */
  async syncOrderToHierarchy(orderData) {
    const Order = mongoose.models.Order;
    const Store = mongoose.models.Store;
    const Chain = mongoose.models.Chain;

    try {
      const order = await Order.findById(orderData._id || orderData.id);
      if (!order) return;

      // 记录订单来源
      const source = orderData.metadata?.source || 'unknown';
      order.createdFrom = source; // C端、小程序、门店后台等
      
      await order.save();

      // 同步到门店层级
      if (order.storeId) {
        const store = await Store.findOne({ storeNo: order.storeId });
        if (store) {
          // 更新门店订单统计
          await Store.updateOne(
            { _id: store._id },
            { 
              $inc: { 
                'stats.totalOrders': 1,
                'stats.monthlyOrders': 1,
                'stats.totalRevenue': order.totalAmount || 0,
                'stats.monthlyRevenue': order.totalAmount || 0
              }
            }
          );

          // 如果门店属于连锁，同步到连锁层级
          if (store.chainId) {
            await Chain.updateOne(
              { _id: store.chainId },
              { 
                $inc: { 
                  'stats.totalOrders': 1,
                  'stats.monthlyOrders': 1,
                  'stats.totalRevenue': order.totalAmount || 0,
                  'stats.monthlyRevenue': order.totalAmount || 0
                }
              }
            );
          }
        }
      }

      console.log(`[数据同步] 订单 ${order._id} 同步完成，来源: ${source}`);
    } catch (error) {
      console.error('[数据同步] 订单同步失败:', error);
    }
  }

  /**
   * 同步门店数据到层级
   */
  async syncStoreToHierarchy(storeData) {
    const Store = mongoose.models.Store;
    const Chain = mongoose.models.Chain;

    try {
      const store = await Store.findById(storeData._id || storeData.id);
      if (!store) return;

      // 同步到连锁层级
      if (store.chainId) {
        await Chain.updateOne(
          { _id: store.chainId },
          { $inc: { 'stats.totalStores': 1, 'stats.activeStores': 1 } }
        );
      }

      console.log(`[数据同步] 门店 ${store._id} 同步完成`);
    } catch (error) {
      console.error('[数据同步] 门店同步失败:', error);
    }
  }

  /**
   * 处理同步消息
   */
  handleSyncMessage(topic, message) {
    console.log(`[数据同步] 收到消息: ${topic}`, message);
    
    // 根据主题处理不同类型的同步消息
    const topicParts = topic.split('/');
    const eventType = topicParts[1];
    
    switch (eventType) {
      case 'user':
        this.processUserSync(message);
        break;
      case 'order':
        this.processOrderSync(message);
        break;
      case 'store':
        this.processStoreSync(message);
        break;
      default:
        console.log(`[数据同步] 未知主题: ${topic}`);
    }
  }

  /**
   * 处理用户同步
   */
  async processUserSync(message) {
    // 实现用户数据同步逻辑
    console.log('[数据同步] 处理用户同步:', message);
  }

  /**
   * 处理订单同步
   */
  async processOrderSync(message) {
    // 实现订单数据同步逻辑
    console.log('[数据同步] 处理订单同步:', message);
  }

  /**
   * 处理门店同步
   */
  async processStoreSync(message) {
    // 实现门店数据同步逻辑
    console.log('[数据同步] 处理门店同步:', message);
  }
}

/**
 * 数据聚合服务
 * 提供跨层级的数据聚合查询
 */
class DataAggregationService {
  /**
   * 获取连锁企业数据聚合
   */
  async getChainAggregation(chainId, period = 'day') {
    const Store = mongoose.models.Store;
    const Order = mongoose.models.Order;
    const User = mongoose.models.User;

    try {
      // 获取连锁下辖门店列表
      const stores = await Store.find({ chainId }).select('_id storeNo name').lean();
      const storeIds = stores.map(s => s._id.toString());
      const storeNos = stores.map(s => s.storeNo);

      // 计算时间范围
      const dateRange = this.getDateRange(period);
      
      // 聚合查询
      const [orderStats, userStats, revenueStats] = await Promise.all([
        // 订单统计
        Order.aggregate([
          {
            $match: {
              storeId: { $in: storeNos },
              createdAt: { $gte: dateRange.start, $lte: dateRange.end },
              isDeleted: { $ne: true }
            }
          },
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              totalAmount: { $sum: '$totalAmount' },
              completedOrders: { 
                $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } 
              },
              avgAmount: { $avg: '$totalAmount' }
            }
          }
        ]),
        
        // 用户统计
        User.aggregate([
          {
            $match: {
              storeId: { $in: storeIds },
              createdAt: { $gte: dateRange.start, $lte: dateRange.end },
              status: 'active'
            }
          },
          {
            $group: {
              _id: null,
              totalUsers: { $sum: 1 },
              newUsers: { 
                $sum: { 
                  $cond: [{ 
                    $gte: ['$createdAt', dateRange.start] 
                  }, 1, 0] 
                } 
              }
            }
          }
        ]),
        
        // 收入趋势
        Order.aggregate([
          {
            $match: {
              storeId: { $in: storeNos },
              createdAt: { $gte: dateRange.start, $lte: dateRange.end },
              status: 'completed',
              isDeleted: { $ne: true }
            }
          },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
              },
              dailyRevenue: { $sum: '$totalAmount' },
              orderCount: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ])
      ]);

      // 按门店分组统计
      const storeStats = await Promise.all(
        stores.map(async store => {
          const [storeOrderStats, storeUserStats] = await Promise.all([
            Order.aggregate([
              {
                $match: {
                  storeId: store.storeNo,
                  createdAt: { $gte: dateRange.start, $lte: dateRange.end }
                }
              },
              {
                $group: {
                  _id: '$storeId',
                  orders: { $sum: 1 },
                  revenue: { $sum: '$totalAmount' }
                }
              }
            ]),
            User.countDocuments({
              storeId: store._id.toString(),
              createdAt: { $gte: dateRange.start, $lte: dateRange.end }
            })
          ]);

          return {
            storeId: store._id,
            storeNo: store.storeNo,
            storeName: store.name,
            orders: storeOrderStats[0]?.orders || 0,
            revenue: storeOrderStats[0]?.revenue || 0,
            users: storeUserStats || 0
          };
        })
      );

      return {
        success: true,
        data: {
          chainId,
          period,
          dateRange,
          summary: {
            totalStores: stores.length,
            totalOrders: orderStats[0]?.totalOrders || 0,
            totalRevenue: orderStats[0]?.totalAmount || 0,
            totalUsers: userStats[0]?.totalUsers || 0,
            newUsers: userStats[0]?.newUsers || 0,
            completedOrders: orderStats[0]?.completedOrders || 0,
            avgOrderValue: orderStats[0]?.avgAmount || 0
          },
          revenueTrend: revenueStats,
          storeStats,
          stores: stores.map(s => ({
            id: s._id,
            storeNo: s.storeNo,
            name: s.name
          }))
        }
      };
    } catch (error) {
      console.error('[数据聚合] 连锁数据聚合失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取时间范围
   */
  getDateRange(period) {
    const now = new Date();
    let start, end = now;

    switch (period) {
      case 'day':
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start = new Date(now);
        start.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        start = new Date(now);
        start.setFullYear(now.getFullYear() - 1);
        break;
      default:
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
    }

    return { start, end };
  }
}

// 创建单例实例
const dataSyncService = new DataSyncService();
const dataAggregationService = new DataAggregationService();

// 初始化同步服务
dataSyncService.init().catch(console.error);

module.exports = {
  createDataHierarchyMiddleware,
  dataSyncService,
  dataAggregationService
};