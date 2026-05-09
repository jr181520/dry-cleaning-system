/**
 * 修复订单查询问题
 * 
 * 问题：前端下单时使用 localStorage.userId (guest_xxx)
 *      但查询订单时使用 authToken，导致用户ID不匹配
 * 
 * 解决方案：后端API支持通过 query 参数传递 userId
 */

const express = require('express');
const router = express.Router();
const orderService = require('../services/orderService');
const { moduleGuard } = require('../../common/middlewares/moduleGuard');
const { optionalAuth } = require('../../common/middlewares/auth');

// 所有路由都需要干洗模块启用
router.use(moduleGuard('cleaning'));

// ============================================
// 修复后的订单列表查询
// 支持多种查询方式：
// 1. 优先使用 query.userId（游客模式）
// 2. 其次使用 req.user.id（登录用户）
// 3. 如果都为空，返回空列表
// ============================================

/**
 * 获取订单列表 - 修复版
 * GET /api/cleaning/orders
 */
router.get('/orders', optionalAuth, async (req, res) => {
  try {
    const { page, pageSize, status, storeId, userId: queryUserId } = req.query;
    
    // 优先级：query.userId > req.user.id
    const targetUserId = queryUserId || req.user?.id;
    
    console.log('[订单查询] 用户ID:', targetUserId, '来源:', queryUserId ? 'query参数' : (req.user ? '认证token' : '未知'));
    
    // 如果没有用户ID，返回空列表（而不是报错）
    if (!targetUserId) {
      return res.json({ 
        success: true, 
        data: { 
          list: [], 
          total: 0, 
          page: 1, 
          pageSize: parseInt(pageSize) || 20,
          message: '未提供用户ID，请先登录或确保下单时已保存用户ID'
        } 
      });
    }
    
    const result = await orderService.getOrders({
      userId: targetUserId,
      roles: req.user?.roles || [],
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20,
      status,
      storeId
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[订单查询] 失败:', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 获取订单详情 - 修复版
 * GET /api/cleaning/orders/:id
 */
router.get('/orders/:id', optionalAuth, async (req, res) => {
  try {
    const result = await orderService.getOrderById(req.params.id, {
      userId: req.user?.id,
      roles: req.user?.roles || []
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

module.exports = router;
