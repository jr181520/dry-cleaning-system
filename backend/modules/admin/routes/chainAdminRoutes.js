/**
 * 连锁后台路由
 * 提供连锁企业管理员的数据访问接口
 * 集成数据层级权限控制，确保数据边界清晰
 */

const express = require('express');
const router = express.Router();
const adminService = require('../services/adminService');
const { authMiddleware, requireRoles } = require('../../common/middlewares/auth');
const { createDataHierarchyMiddleware, dataAggregationService } = require('../../common/services/dataHierarchyService');

// 所有路由需要连锁管理员权限
router.use(authMiddleware);
router.use(requireRoles('chain_admin'));

// ============================================
// 连锁信息
// ============================================

/**
 * 获取当前连锁企业信息
 * GET /api/chain-admin/info
 */
router.get('/info', createDataHierarchyMiddleware({ 
  dataType: 'chain',
  allowedRoles: ['chain_admin']
}), async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.chainId) {
      return res.status(403).json({ 
        success: false, 
        error: '连锁管理员未关联连锁企业' 
      });
    }

    const mongoose = require('mongoose');
    const Chain = mongoose.models.Chain;
    
    const chain = await Chain.findOne({
      $or: [{ _id: mongoose.Types.ObjectId.isValid(user.chainId) ? user.chainId : null }, { chainNo: user.chainId }]
    }).select('-password').lean();
    
    if (!chain) {
      return res.status(404).json({
        success: false,
        error: '连锁企业不存在'
      });
    }

    res.json({
      success: true,
      data: chain
    });
  } catch (error) {
    console.error('[连锁后台] 获取连锁信息失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取连锁信息失败'
    });
  }
});

// ============================================
// 连锁仪表盘
// ============================================

/**
 * 获取连锁仪表盘数据
 * GET /api/chain-admin/dashboard
 * 使用数据层级权限中间件，确保只能访问自己连锁的数据
 */
router.get('/dashboard', createDataHierarchyMiddleware({ 
  dataType: 'dashboard',
  allowedRoles: ['chain_admin']
}), async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.chainId) {
      return res.status(403).json({ 
        success: false, 
        error: '连锁管理员未关联连锁企业' 
      });
    }

    // 使用聚合服务获取连锁层级数据
    const result = await dataAggregationService.getChainAggregation(user.chainId, 'day');
    
    if (!result.success) {
      return res.status(500).json(result);
    }

    // 格式化仪表盘数据
    const dashboardData = {
      success: true,
      data: {
        chainId: user.chainId,
        summary: {
          totalStores: result.data.summary.totalStores,
          todayOrders: result.data.summary.totalOrders,
          todayRevenue: result.data.summary.totalRevenue,
          todayNewUsers: result.data.summary.newUsers,
          totalUsers: result.data.summary.totalUsers,
          completedOrders: result.data.summary.completedOrders,
          avgOrderValue: result.data.summary.avgOrderValue
        },
        revenueTrend: result.data.revenueTrend,
        topStores: result.data.storeStats
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5),
        recentOrders: [], // 需要另外获取
        userGrowth: {
          today: result.data.summary.newUsers,
          weekly: 0, // 需要另外计算
          monthly: result.data.summary.totalUsers
        }
      }
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('[连锁后台] 仪表盘接口失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取仪表盘数据失败'
    });
  }
});

/**
 * 获取连锁订单列表
 * GET /api/chain-admin/orders
 * 只能访问自己连锁下门店的订单
 */
router.get('/orders', createDataHierarchyMiddleware({ 
  dataType: 'order',
  allowedRoles: ['chain_admin']
}), async (req, res) => {
  try {
    const { page, pageSize, keyword, status, storeId, startDate, endDate } = req.query;
    const user = req.user;
    
    // 获取连锁下辖门店列表
    const mongoose = require('mongoose');
    const Store = mongoose.models.Store;
    
    // 获取连锁下所有门店（确保只能访问自己连锁）
    const stores = await Store.find({ chainId: user.chainId }).select('_id storeNo name').lean();
    const storeNos = stores.map(s => s.storeNo);
    
    // 构建查询条件
    const filter = {
      storeId: { $in: storeNos }
    };
    
    if (status) filter.status = status;
    if (storeId) {
      // 验证storeId是否属于当前连锁
      const storeInChain = stores.find(s => s.storeNo === storeId);
      if (!storeInChain) {
        return res.status(403).json({
          success: false,
          error: '无权访问该门店的订单'
        });
      }
      filter.storeId = storeId;
    }
    if (keyword) {
      filter.$or = [
        { orderNo: new RegExp(keyword, 'i') },
        { 'delivery.contactName': new RegExp(keyword, 'i') },
        { 'delivery.contactPhone': new RegExp(keyword, 'i') }
      ];
    }
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    const Order = mongoose.models.Order;
    const pageNum = parseInt(page) || 1;
    const pageSizeNum = parseInt(pageSize) || 20;
    
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * pageSizeNum)
        .limit(pageSizeNum)
        .lean(),
      Order.countDocuments(filter)
    ]);
    
    // 补充门店名称
    const storeMap = stores.reduce((map, store) => {
      map[store.storeNo] = store.name;
      return map;
    }, {});
    
    const orderList = orders.map(order => ({
      ...order,
      storeName: storeMap[order.storeId] || '未知门店'
    }));
    
    res.json({
      success: true,
      data: {
        list: orderList,
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          total,
          totalPages: Math.ceil(total / pageSizeNum)
        }
      }
    });
  } catch (error) {
    console.error('[连锁后台] 获取订单列表失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取订单列表失败'
    });
  }
});

/**
 * 获取连锁订单详情
 * GET /api/chain-admin/orders/:id
 * 验证订单是否属于连锁下门店
 */
router.get('/orders/:id', createDataHierarchyMiddleware({ 
  dataType: 'order',
  allowedRoles: ['chain_admin']
}), async (req, res) => {
  try {
    const orderId = req.params.id;
    const user = req.user;
    
    const mongoose = require('mongoose');
    const Order = mongoose.models.Order;
    const Store = mongoose.models.Store;
    
    // 获取订单
    const order = await Order.findById(orderId).lean();
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'order_not_found',
        message: '订单不存在'
      });
    }
    
    // 验证订单门店是否属于当前连锁
    const store = await Store.findOne({ storeNo: order.storeId }).lean();
    if (!store || store.chainId !== user.chainId) {
      return res.status(403).json({
        success: false,
        error: 'permission_denied',
        message: '无权访问该订单'
      });
    }
    
    // 补充门店信息
    order.storeInfo = {
      name: store.name,
      address: store.address,
      phone: store.phone
    };
    
    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('[连锁后台] 获取订单详情失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取订单详情失败'
    });
  }
});

/**
 * 获取连锁门店列表
 * GET /api/chain-admin/stores
 * 只能访问自己连锁的门店
 */
router.get('/stores', createDataHierarchyMiddleware({ 
  dataType: 'store',
  allowedRoles: ['chain_admin']
}), async (req, res) => {
  try {
    const { page, pageSize, keyword, status } = req.query;
    const user = req.user;
    
    const mongoose = require('mongoose');
    const Store = mongoose.models.Store;
    
    // 构建查询条件
    const filter = { chainId: user.chainId };
    
    if (status) filter.status = status;
    if (keyword) {
      filter.$or = [
        { name: new RegExp(keyword, 'i') },
        { storeNo: new RegExp(keyword, 'i') },
        { address: new RegExp(keyword, 'i') }
      ];
    }
    
    const pageNum = parseInt(page) || 1;
    const pageSizeNum = parseInt(pageSize) || 20;
    
    const [stores, total] = await Promise.all([
      Store.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * pageSizeNum)
        .limit(pageSizeNum)
        .lean(),
      Store.countDocuments(filter)
    ]);
    
    // 获取每个门店的统计信息
    const storesWithStats = await Promise.all(
      stores.map(async store => {
        const Order = mongoose.models.Order;
        const User = mongoose.models.User;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const [todayOrders, todayRevenue, totalUsers] = await Promise.all([
          Order.countDocuments({
            storeId: store.storeNo,
            createdAt: { $gte: today },
            isDeleted: { $ne: true }
          }),
          Order.aggregate([
            {
              $match: {
                storeId: store.storeNo,
                createdAt: { $gte: today },
                status: 'completed',
                isDeleted: { $ne: true }
              }
            },
            {
              $group: {
                _id: null,
                total: { $sum: '$totalAmount' }
              }
            }
          ]),
          User.countDocuments({
            storeId: store._id.toString(),
            status: 'active'
          })
        ]);
        
        return {
          ...store,
          stats: {
            todayOrders: todayOrders || 0,
            todayRevenue: todayRevenue[0]?.total || 0,
            totalUsers: totalUsers || 0,
            rating: store.rating || 0
          }
        };
      })
    );
    
    res.json({
      success: true,
      data: {
        list: storesWithStats,
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          total,
          totalPages: Math.ceil(total / pageSizeNum)
        }
      }
    });
  } catch (error) {
    console.error('[连锁后台] 获取门店列表失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取门店列表失败'
    });
  }
});

/**
 * 获取连锁门店详情
 * GET /api/chain-admin/stores/:id
 * 验证门店是否属于当前连锁
 */
router.get('/stores/:id', createDataHierarchyMiddleware({ 
  dataType: 'store',
  allowedRoles: ['chain_admin']
}), async (req, res) => {
  try {
    const storeId = req.params.id;
    const user = req.user;
    
    const mongoose = require('mongoose');
    const Store = mongoose.models.Store;
    
    // 获取门店详情
    const store = await Store.findById(storeId).lean();
    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'store_not_found',
        message: '门店不存在'
      });
    }
    
    // 验证门店是否属于当前连锁
    if (store.chainId !== user.chainId) {
      return res.status(403).json({
        success: false,
        error: 'permission_denied',
        message: '无权访问该门店'
      });
    }
    
    // 获取门店统计信息
    const Order = mongoose.models.Order;
    const User = mongoose.models.User;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    
    const [todayOrders, todayRevenue, weekOrders, monthOrders, totalUsers, todayNewUsers] = await Promise.all([
      Order.countDocuments({
        storeId: store.storeNo,
        createdAt: { $gte: today },
        isDeleted: { $ne: true }
      }),
      Order.aggregate([
        {
          $match: {
            storeId: store.storeNo,
            createdAt: { $gte: today },
            status: 'completed',
            isDeleted: { $ne: true }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' }
          }
        }
      ]),
      Order.countDocuments({
        storeId: store.storeNo,
        createdAt: { $gte: weekAgo },
        isDeleted: { $ne: true }
      }),
      Order.countDocuments({
        storeId: store.storeNo,
        createdAt: { $gte: monthAgo },
        isDeleted: { $ne: true }
      }),
      User.countDocuments({
        storeId: store._id.toString(),
        status: 'active'
      }),
      User.countDocuments({
        storeId: store._id.toString(),
        createdAt: { $gte: today },
        status: 'active'
      })
    ]);
    
    store.stats = {
      todayOrders: todayOrders || 0,
      todayRevenue: todayRevenue[0]?.total || 0,
      weekOrders: weekOrders || 0,
      monthOrders: monthOrders || 0,
      totalUsers: totalUsers || 0,
      todayNewUsers: todayNewUsers || 0,
      rating: store.rating || 0
    };
    
    res.json({
      success: true,
      data: store
    });
  } catch (error) {
    console.error('[连锁后台] 获取门店详情失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取门店详情失败'
    });
  }
});

/**
 * 获取连锁用户列表
 * GET /api/chain-admin/users
 * 只能访问自己连锁下门店的用户
 */
router.get('/users', createDataHierarchyMiddleware({ 
  dataType: 'user',
  allowedRoles: ['chain_admin']
}), async (req, res) => {
  try {
    const { page, pageSize, keyword, status } = req.query;
    const user = req.user;
    
    const mongoose = require('mongoose');
    const Store = mongoose.models.Store;
    const User = mongoose.models.User;
    
    // 获取连锁下所有门店ID
    const stores = await Store.find({ chainId: user.chainId }).select('_id').lean();
    const storeIds = stores.map(s => s._id.toString());
    
    // 构建查询条件
    const filter = {
      storeId: { $in: storeIds },
      roles: { $in: ['customer'] } // 只获取客户用户
    };
    
    if (status) filter.status = status;
    if (keyword) {
      filter.$or = [
        { phone: new RegExp(keyword, 'i') },
        { name: new RegExp(keyword, 'i') },
        { 'profile.name': new RegExp(keyword, 'i') }
      ];
    }
    
    const pageNum = parseInt(page) || 1;
    const pageSizeNum = parseInt(pageSize) || 20;
    
    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * pageSizeNum)
        .limit(pageSizeNum)
        .lean(),
      User.countDocuments(filter)
    ]);
    
    // 获取门店信息映射
    const storeDetails = await Store.find({ 
      _id: { $in: storeIds } 
    }).select('_id storeNo name').lean();
    
    const storeMap = storeDetails.reduce((map, store) => {
      map[store._id.toString()] = store;
      return map;
    }, {});
    
    // 补充用户信息
    const userList = users.map(user => {
      const store = storeMap[user.storeId];
      return {
        ...user,
        storeInfo: store ? {
          storeNo: store.storeNo,
          name: store.name
        } : null
      };
    });
    
    res.json({
      success: true,
      data: {
        list: userList,
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          total,
          totalPages: Math.ceil(total / pageSizeNum)
        }
      }
    });
  } catch (error) {
    console.error('[连锁后台] 获取用户列表失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取用户列表失败'
    });
  }
});

/**
 * 获取连锁用户详情
 * GET /api/chain-admin/users/:id
 * 验证用户是否属于连锁下门店
 */
router.get('/users/:id', createDataHierarchyMiddleware({ 
  dataType: 'user',
  allowedRoles: ['chain_admin']
}), async (req, res) => {
  try {
    const userId = req.params.id;
    const user = req.user;
    
    const mongoose = require('mongoose');
    const User = mongoose.models.User;
    const Store = mongoose.models.Store;
    
    // 获取用户详情
    const customer = await User.findById(userId).lean();
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'user_not_found',
        message: '用户不存在'
      });
    }
    
    // 验证用户是否属于连锁下门店
    if (customer.storeId) {
      const store = await Store.findById(customer.storeId).lean();
      if (!store || store.chainId !== user.chainId) {
        return res.status(403).json({
          success: false,
          error: 'permission_denied',
          message: '无权访问该用户'
        });
      }
      
      // 补充门店信息
      customer.storeInfo = {
        storeNo: store.storeNo,
        name: store.name,
        address: store.address,
        phone: store.phone
      };
    }
    
    // 获取用户订单统计
    const Order = mongoose.models.Order;
    const [totalOrders, totalSpent] = await Promise.all([
      Order.countDocuments({
        userId: customer._id.toString(),
        isDeleted: { $ne: true }
      }),
      Order.aggregate([
        {
          $match: {
            userId: customer._id.toString(),
            status: 'completed',
            isDeleted: { $ne: true }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' }
          }
        }
      ])
    ]);
    
    customer.orderStats = {
      totalOrders: totalOrders || 0,
      totalSpent: totalSpent[0]?.total || 0
    };
    
    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('[连锁后台] 获取用户详情失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取用户详情失败'
    });
  }
});

/**
 * 获取连锁资金概览
 * GET /api/chain-admin/finance/overview
 * 只能查看自己连锁的资金数据
 */
router.get('/finance/overview', createDataHierarchyMiddleware({ 
  dataType: 'finance',
  allowedRoles: ['chain_admin']
}), async (req, res) => {
  try {
    const user = req.user;
    
    // 调用adminService获取连锁资金概览
    const result = await adminService.getChainFinanceOverview(user.chainId);
    res.json(result);
  } catch (error) {
    console.error('[连锁后台] 资金概览失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取资金概览失败'
    });
  }
});

/**
 * 获取连锁资金流水记录
 * GET /api/chain-admin/finance/records
 */
router.get('/finance/records', createDataHierarchyMiddleware({ 
  dataType: 'finance',
  allowedRoles: ['chain_admin']
}), async (req, res) => {
  try {
    const { page, pageSize, type, startDate, endDate } = req.query;
    const user = req.user;
    
    const result = await adminService.getChainFinanceRecords(user.chainId, {
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 10,
      type, startDate, endDate
    });
    res.json(result);
  } catch (error) {
    console.error('[连锁后台] 资金流水失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取资金流水失败'
    });
  }
});

/**
 * 获取连锁门店资金统计
 * GET /api/chain-admin/finance/stores
 */
router.get('/finance/stores', createDataHierarchyMiddleware({ 
  dataType: 'finance',
  allowedRoles: ['chain_admin']
}), async (req, res) => {
  try {
    const user = req.user;
    const result = await adminService.getChainStoreFinance(user.chainId);
    res.json(result);
  } catch (error) {
    console.error('[连锁后台] 门店资金统计失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取门店资金统计失败'
    });
  }
});

/**
 * 获取连锁资金趋势
 * GET /api/chain-admin/finance/trend
 */
router.get('/finance/trend', createDataHierarchyMiddleware({ 
  dataType: 'finance',
  allowedRoles: ['chain_admin']
}), async (req, res) => {
  try {
    const user = req.user;
    const result = await adminService.getChainFinanceTrend(user.chainId);
    res.json(result);
  } catch (error) {
    console.error('[连锁后台] 资金趋势失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取资金趋势失败'
    });
  }
});

/**
 * 获取连锁结算概览
 * GET /api/chain-admin/settlement/overview
 */
router.get('/settlement/overview', createDataHierarchyMiddleware({ 
  dataType: 'settlement',
  allowedRoles: ['chain_admin']
}), async (req, res) => {
  try {
    const user = req.user;
    const result = await adminService.getChainSettlementOverview(user.chainId);
    res.json(result);
  } catch (error) {
    console.error('[连锁后台] 结算概览失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取结算概览失败'
    });
  }
});

/**
 * 获取连锁结算单列表
 * GET /api/chain-admin/settlements
 */
router.get('/settlements', createDataHierarchyMiddleware({ 
  dataType: 'settlement',
  allowedRoles: ['chain_admin']
}), async (req, res) => {
  try {
    const { page, pageSize, status } = req.query;
    const user = req.user;
    
    const result = await adminService.getChainSettlements(user.chainId, {
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 10,
      status
    });
    res.json(result);
  } catch (error) {
    console.error('[连锁后台] 结算单列表失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取结算单列表失败'
    });
  }
});

/**
 * 创建连锁结算单
 * POST /api/chain-admin/settlements/create
 */
router.post('/settlements/create', createDataHierarchyMiddleware({ 
  dataType: 'settlement',
  allowedRoles: ['chain_admin']
}), async (req, res) => {
  try {
    const { period, storeId, ratio, remark } = req.body;
    const user = req.user;
    
    const result = await adminService.createChainSettlement(user.chainId, {
      period, storeId, ratio, remark
    }, user);
    res.json(result);
  } catch (error) {
    console.error('[连锁后台] 创建结算单失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '创建结算单失败'
    });
  }
});

/**
 * 获取连锁门店结算权限列表
 * GET /api/chain-admin/settlement/stores
 */
router.get('/settlement/stores', createDataHierarchyMiddleware({ 
  dataType: 'store',
  allowedRoles: ['chain_admin']
}), async (req, res) => {
  try {
    const { page, pageSize, storeType, terminalSettlementEnabled, search } = req.query;
    const user = req.user;
    
    const result = await adminService.getSettlementStores(user.chainId);
    
    // 前端需要分页和过滤逻辑
    let filteredData = result.data || [];
    
    // 过滤门店类型
    if (storeType) {
      filteredData = filteredData.filter(store => store.storeType === storeType);
    }
    
    // 过滤终端结算状态
    if (terminalSettlementEnabled === 'true') {
      filteredData = filteredData.filter(store => store.terminalSettlementEnabled === true);
    } else if (terminalSettlementEnabled === 'false') {
      filteredData = filteredData.filter(store => store.terminalSettlementEnabled === false);
    }
    
    // 搜索过滤
    if (search) {
      const searchLower = search.toLowerCase();
      filteredData = filteredData.filter(store => 
        store.name.toLowerCase().includes(searchLower) ||
        store.storeNo.toLowerCase().includes(searchLower) ||
        store.address?.toLowerCase().includes(searchLower)
      );
    }
    
    // 分页
    const pageNum = parseInt(page) || 1;
    const pageSizeNum = parseInt(pageSize) || 20;
    const total = filteredData.length;
    const startIndex = (pageNum - 1) * pageSizeNum;
    const paginatedData = filteredData.slice(startIndex, startIndex + pageSizeNum);
    
    res.json({
      success: true,
      data: paginatedData,
      total,
      totalPages: Math.ceil(total / pageSizeNum),
      page: pageNum,
      pageSize: pageSizeNum
    });
  } catch (error) {
    console.error('[连锁后台] 获取门店结算权限失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '获取门店结算权限失败'
    });
  }
});

/**
 * 更新门店结算配置
 * PUT /api/chain-admin/settlement/stores/:storeId
 */
router.put('/settlement/stores/:storeId', createDataHierarchyMiddleware({ 
  dataType: 'store',
  allowedRoles: ['chain_admin']
}), async (req, res) => {
  try {
    const { storeType, terminalSettlementEnabled, settlementRatio } = req.body;
    const user = req.user;
    const storeId = req.params.storeId;
    
    const result = await adminService.updateStoreSettlementConfig(
      user.chainId, 
      storeId, 
      { storeType, terminalSettlementEnabled, settlementRatio }
    );
    res.json(result);
  } catch (error) {
    console.error('[连锁后台] 更新门店配置失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '更新门店配置失败'
    });
  }
});

/**
 * 批量更新门店结算配置
 * POST /api/chain-admin/settlement/stores/batch-update
 */
router.post('/settlement/stores/batch-update', createDataHierarchyMiddleware({ 
  dataType: 'store',
  allowedRoles: ['chain_admin']
}), async (req, res) => {
  try {
    const { storeIds, storeType, terminalSettlementEnabled, settlementRatio } = req.body;
    const user = req.user;
    
    // 如果storeIds为空数组，表示更新所有门店
    const allStores = storeIds && storeIds.length > 0 ? storeIds : [];
    
    const result = await adminService.batchUpdateStoreSettlementConfig(
      user.chainId, 
      allStores, 
      { storeType, terminalSettlementEnabled, settlementRatio }
    );
    res.json(result);
  } catch (error) {
    console.error('[连锁后台] 批量更新门店配置失败:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: '批量更新门店配置失败'
    });
  }
});

module.exports = router;