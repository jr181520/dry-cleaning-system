/**
 * 租赁模块路由 - 全品类租物
 * 
 * 租赁双向跑腿模型：
 *   发货：门店 → 跑腿 → 用户（第一程）
 *   归还：用户 → 跑腿 → 门店（第二程，反向）
 */
const express = require('express');
const router = express.Router();
const { moduleGuard } = require('../common/middlewares/moduleGuard');
const rentalService = require('./services/rentalService');

// 所有路由需要租赁模块启用
router.use(moduleGuard('rental'));

// ============================================
// C端/小程序 - 商品浏览
// ============================================

// 获取品类列表
router.get('/items/categories', async (req, res) => {
  try {
    const categories = await rentalService.getCategories();
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取租赁商品列表（支持品类/门店/关键词筛选）
router.get('/items', async (req, res) => {
  try {
    const { category, storeId, keyword, page = 1, limit = 20, sortBy, sortOrder } = req.query;
    const result = await rentalService.listItems({
      category,
      storeId,
      keyword,
      status: 'on_sale',
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy: sortBy || 'sortWeight',
      sortOrder: sortOrder === 'asc' ? 1 : -1
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取指定门店的商品
router.get('/stores/:storeId/items', async (req, res) => {
  try {
    const { page = 1, limit = 20, category } = req.query;
    const result = await rentalService.listItems({
      storeId: req.params.storeId,
      category,
      status: 'on_sale',
      page: parseInt(page),
      limit: parseInt(limit)
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取租赁商品详情
router.get('/items/:id', async (req, res) => {
  try {
    const item = await rentalService.getItemDetail(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: '商品不存在' });
    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// 商家端 - 商品管理（需merchant角色）
// ============================================

// 商家创建商品
router.post('/store/items', requireMerchant, async (req, res) => {
  try {
    const data = {
      ...req.body,
      storeId: req.user?.storeId || req.body.storeId
    };
    const item = await rentalService.createItem(data);
    res.json({ success: true, item, message: '商品创建成功' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 商家编辑商品
router.put('/store/items/:id', requireMerchant, async (req, res) => {
  try {
    const item = await rentalService.updateItem(req.params.id, req.body);
    res.json({ success: true, item, message: '商品更新成功' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 商家下架商品
router.delete('/store/items/:id', requireMerchant, async (req, res) => {
  try {
    await rentalService.deleteItem(req.params.id);
    res.json({ success: true, message: '商品已下架' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 商家获取本店商品列表
router.get('/store/items', requireMerchant, async (req, res) => {
  try {
    const storeId = req.user?.storeId || req.query.storeId;
    if (!storeId) return res.status(400).json({ success: false, error: '缺少门店ID' });

    const { status, page = 1, limit = 20 } = req.query;
    const result = await rentalService.listItemsByStore(storeId, {
      status,
      page: parseInt(page),
      limit: parseInt(limit)
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 商家更新库存
router.put('/store/items/:id/stock', requireMerchant, async (req, res) => {
  try {
    const { quantity } = req.body;
    const item = await rentalService.updateStock(req.params.id, quantity);
    res.json({ success: true, item });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ============================================
// 租赁订单
// ============================================

// 创建租赁订单（C端/小程序）
router.post('/orders', async (req, res) => {
  try {
    const order = await rentalService.createRentalOrder(req.body);
    res.json({ success: true, order });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 获取租赁订单列表
router.get('/orders', async (req, res) => {
  try {
    const { userId, storeId, status, page = 1, limit = 20 } = req.query;
    const result = await rentalService.listOrders({
      userId,
      storeId,
      status,
      page: parseInt(page),
      limit: parseInt(limit)
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取租赁订单详情
router.get('/orders/:id', async (req, res) => {
  try {
    const order = await rentalService.getOrderDetail(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: '订单不存在' });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 取消订单
router.post('/orders/:id/cancel', async (req, res) => {
  try {
    const order = await rentalService.cancelOrder(req.params.id, req.body.reason);
    res.json({ success: true, order });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ============================================
// 租赁流程操作
// ============================================

// 支付成功回调
router.post('/orders/:id/pay', async (req, res) => {
  try {
    const order = await rentalService.onPaymentSuccess(req.params.id, req.body);
    res.json({ success: true, order });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 门店发货（租赁第一程：门店→用户）
router.post('/orders/:id/ship', requireMerchant, async (req, res) => {
  try {
    const order = await rentalService.shipItem(req.params.id, req.body);
    res.json({ success: true, order, message: '已发货，等待用户接收' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 用户确认收货（开始使用）
router.post('/orders/:id/confirm-receive', async (req, res) => {
  try {
    const order = await rentalService.confirmReceive(req.params.id);
    res.json({ success: true, order, message: '已开始使用，到期日: ' + order.dueDate });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 用户发起归还（租赁第二程：用户→门店）
router.post('/orders/:id/return', async (req, res) => {
  try {
    const result = await rentalService.returnItem(req.params.id, req.body);
    res.json({ success: true, order: result.order, isOverdue: result.isOverdue, message: '归还配送已发起' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 门店确认归还
router.post('/orders/:id/confirm-return', requireMerchant, async (req, res) => {
  try {
    const order = await rentalService.confirmReturn(req.params.id, req.body);
    res.json({ success: true, order, message: order.refundable ? '归还成功，押金退回中' : '物品有损坏，押金暂扣' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 完成订单
router.post('/orders/:id/complete', async (req, res) => {
  try {
    const order = await rentalService.completeOrder(req.params.id);
    res.json({ success: true, order });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ============================================
// 押金管理
// ============================================

// 检查押金/免押资格
router.post('/deposit/check', async (req, res) => {
  try {
    const { userId, items } = req.body;
    const results = await rentalService.checkDepositEligibility(userId, items);
    res.json({ success: true, depositOptions: results });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 创建押金记录
router.post('/deposit', async (req, res) => {
  try {
    const record = await rentalService.createDeposit(req.body);
    res.json({ success: true, record });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 押金支付成功
router.post('/deposit/paid', async (req, res) => {
  try {
    const { orderNo, paymentInfo } = req.body;
    const record = await rentalService.onDepositPaid(orderNo, paymentInfo);
    res.json({ success: true, record });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 退还押金
router.post('/deposit/refund', async (req, res) => {
  try {
    const { orderNo, amount, reason } = req.body;
    const record = await rentalService.refundDeposit(orderNo, { amount, reason });
    res.json({ success: true, record, message: '押金退还成功' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 扣除押金
router.post('/deposit/deduct', requireMerchant, async (req, res) => {
  try {
    const { orderNo, amount, reason, proof } = req.body;
    const record = await rentalService.deductDeposit(orderNo, { amount, reason, proof });
    res.json({ success: true, record });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 信用评估
router.get('/credit/:userId', async (req, res) => {
  try {
    const credit = await rentalService.getCredit(req.params.userId);
    res.json({ success: true, credit });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// 芝麻信用（支付宝小程序）
// ============================================

const zhimaCreditService = require('./services/zhimaCreditService');

// 查询芝麻信用分 + 免押资格
router.post('/deposit/zhima-check', async (req, res) => {
  try {
    const { userId, alipayUserId, serviceId } = req.body;
    const result = await zhimaCreditService.checkZhimaCredit(alipayUserId || userId, serviceId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 芝麻信用预授权冻结
router.post('/deposit/zhima-freeze', async (req, res) => {
  try {
    const { orderNo, amount, alipayUserId, depositMode } = req.body;
    const result = await zhimaCreditService.freezeDeposit({
      orderNo, amount, alipayUserId, depositMode
    });
    res.json({ success: result.success, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 芝麻信用预授权解冻
router.post('/deposit/zhima-unfreeze', async (req, res) => {
  try {
    const { orderNo, authNo, amount, reason } = req.body;
    const result = await zhimaCreditService.unfreezeDeposit({
      orderNo, authNo, amount, reason
    });
    res.json({ success: result.success, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 芝麻信用扣款（逾期/损坏）
router.post('/deposit/zhima-deduct', requireMerchant, async (req, res) => {
  try {
    const { orderNo, authNo, amount, reason } = req.body;
    const result = await zhimaCreditService.deductFromAuth({
      orderNo, authNo, amount, reason
    });
    res.json({ success: result.success, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 芝麻信用守约/违约上报
router.post('/deposit/zhima-report', async (req, res) => {
  try {
    const { orderNo, type, note } = req.body;
    const result = await zhimaCreditService.reportCreditRecord({ orderNo, type, note });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// 逾期管理（定时任务）
// ============================================

// 扫描逾期订单（内部调用）
router.post('/cron/check-overdue', async (req, res) => {
  try {
    const results = await rentalService.checkOverdueOrders();
    res.json({ success: true, overdueCount: results.length, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// 中间件
// ============================================

function requireMerchant(req, res, next) {
  // 开发环境放行
  if (process.env.NODE_ENV === 'development' || !req.user) {
    return next();
  }
  
  const roles = req.user.roles || [];
  const isMerchant = roles.some(r => ['store_owner', 'store_staff', 'admin'].includes(r));
  
  if (!isMerchant) {
    return res.status(403).json({ success: false, error: '需要商家权限' });
  }
  next();
}

module.exports = router;
