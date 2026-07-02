/**
 * 统一数据同步路由
 * 为微信小程序和C端H5提供一致的数据视图
 * 
 * GET /api/sync/all?types=user,orders,member,delivery
 * 后端作为唯一权威数据源，同步所有用户相关数据
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authService = require('../services/authService');
const memberService = require('../../member/services/memberService');

// 校验合法 ObjectId
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
}

/**
 * GET /api/sync/all
 * 统一拉取所有用户数据（profile + 订单 + 会员 + 配送信息）
 * Query: types=user,orders,member,delivery（逗号分隔，默认全部）
 * Header: Authorization: Bearer <token>
 */
router.get('/all', async (req, res) => {
  try {
    // 1. 解析用户身份
    let userId = null;
    let userPhone = null;
    
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        // 开发模式：处理 mock_token 格式（小程序模拟登录）
        if (process.env.NODE_ENV !== 'production' && token.startsWith('mock_token_')) {
          const openid = token.replace('mock_token_', '');
          userId = openid;
        } else {
          const parsed = authService.parseToken(token);
          if (parsed && parsed.userId && typeof parsed.userId === 'string' && parsed.userId.length >= 12) {
            userId = parsed.userId;
          }
        }
      } catch (e) {
        // token 解析失败不报错，继续尝试 query 参数
      }
    }
    
    // 备用：从 query 参数获取
    if (!userId) {
      userId = req.query.userId || req.query.openid || '';
    }
    
    // 净化 userId：只接受合法 ObjectId 或已知的非ObjectId 格式
    if (userId && !isValidObjectId(userId)) {
      // 接受 openid 格式（wx 开头或 mock_token 格式）
      if (/^[a-zA-Z0-9_-]{12,}$/.test(userId)) {
        // 合法的非ObjectId格式，保留
      } else {
        console.warn('[同步] 无效userId格式，已忽略:', typeof userId === 'string' ? userId.substring(0, 20) + '...' : typeof userId);
        userId = '';
      }
    }
    
    // 手机号从 query 参数传入（小程序/C端传过来的已知手机号）
    const queryPhone = req.query.phone || '';
    
    // 2. 确定要同步的数据类型
    const typesParam = req.query.types || 'user,orders,member,delivery';
    const types = typesParam.split(',').map(t => t.trim()).filter(Boolean);
    
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      data: {}
    };
    
    // 3. 先加载用户资料（必须，因为订单查询需要userPhone做跨平台匹配）
    if (types.includes('user')) {
      try {
        if (userId && isValidObjectId(userId)) {
          const user = await authService.getUserById(userId);
          if (user) {
            userPhone = user.phone;
            result.data.user = user;
          }
        }
      } catch (e) {
        // 用户不存在时静默降级
      }
      if (!result.data.user) {
        result.data.user = null;
      }
    }
    
    // 跨平台增强：优先使用 query 传入的手机号，其次使用用户资料中的手机号
    const effectivePhone = queryPhone || userPhone || '';
    if (effectivePhone) {
      console.log('[同步] 跨平台手机号匹配:', effectivePhone, '来源:', queryPhone ? 'query参数' : '用户资料');
    }
    
    // 4. 并行加载会员、订单、配送
    const promises = [];
    
    // 会员信息（基于userId，不依赖phone；非ObjectId只返回模拟数据）
    if (types.includes('member')) {
      promises.push((async () => {
        try {
          const validId = (userId && isValidObjectId(userId)) ? userId : null;
          const memberResult = await memberService.getMemberInfo(validId);
          result.data.member = memberResult.member || null;
        } catch (e) {
          result.data.member = null;
        }
      })());
    }
    
    // 订单数据（使用 effectivePhone 实现跨平台订单匹配）
    if (types.includes('orders')) {
      promises.push((async () => {
        try {
          const orderService = require('../../cleaning/services/orderService');
          const validUserId = (userId && isValidObjectId(userId)) ? userId : '';
          console.log('[sync/orders] 🔍 userId:', validUserId || '(空)', 'phone:', effectivePhone || '(空)');
          const ordersResult = await orderService.getOrders({
            userId: validUserId,
            customerPhone: effectivePhone,
            page: 1,
            pageSize: 100
          });
          const orders = ordersResult.list || ordersResult || [];
          result.data.orders = orders.map(o => ({
            orderNo: o.orderNo,
            _id: o._id,
            status: o.status,
            paymentStatus: o.paymentStatus || 'pending',
            items: o.items || [],
            amounts: o.amounts || {},
            storeId: o.storeId,
            storeName: o.store?.name || o.storeName || '',
            storeAddress: o.store?.address || o.storeAddress || '',
            customerName: o.customerName || '',
            customerPhone: o.customerPhone || '',
            contact: o.contact || {},
            createdAt: o.createdAt,
            updatedAt: o.updatedAt
          }));
        } catch (e) {
          result.data.orders = [];
        }
      })());
    }
    
    // 配送信息（从用户记录中获取）
    if (types.includes('delivery')) {
      promises.push((async () => {
        try {
          if (userId && isValidObjectId(userId)) {
            const user = await mongoose.model('User').findById(userId)
              .select('deliveryInfo address').lean();
            result.data.delivery = {
              defaultAddress: user?.address || null,
              savedInfo: user?.deliveryInfo || null
            };
          } else {
            result.data.delivery = { defaultAddress: null, savedInfo: null };
          }
        } catch (e) {
          result.data.delivery = { defaultAddress: null, savedInfo: null };
        }
      })());
    }
    
    await Promise.all(promises);
    
    res.json(result);
  } catch (error) {
    console.error('[同步API] 错误:', error.message);
    res.status(500).json({
      success: false,
      error: '数据同步失败',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
