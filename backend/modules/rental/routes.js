/**
 * 租赁模块路由 - 服饰租赁 + 小件商品租赁
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
// 租赁物品管理
// ============================================

// 获取租赁商品列表
router.get('/items', async (req, res) => {
  try {
    const { category = 'rental', page = 1, limit = 20 } = req.query;
    const result = await rentalService.listItems({ category, page: parseInt(page), limit: parseInt(limit) });
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
// 租赁订单
// ============================================

// 创建租赁订单（预约）
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
    const { userId, status, page = 1, limit = 20 } = req.query;
    const result = await rentalService.listOrders({ userId, status, page: parseInt(page), limit: parseInt(limit) });
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

// ============================================
// 租赁流程操作
// ============================================

// 门店发货（租赁第一程：门店→用户）
router.post('/orders/:id/ship', async (req, res) => {
  try {
    const result = await rentalService.shipItem(req.params.id, req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 用户确认收货（开始使用）
router.post('/orders/:id/confirm-receive', async (req, res) => {
  try {
    const result = await rentalService.confirmReceive(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 用户发起归还（租赁第二程：用户→门店）
router.post('/orders/:id/return', async (req, res) => {
  try {
    const { deliveryMethod, address, provider } = req.body;
    const result = await rentalService.returnItem(req.params.id, { deliveryMethod, address, provider });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 门店确认归还
router.post('/orders/:id/confirm-return', async (req, res) => {
  try {
    const result = await rentalService.confirmReturn(req.params.id, req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ============================================
// 押金管理
// ============================================

router.post('/deposit', async (req, res) => {
  try {
    const result = await rentalService.manageDeposit('pay', req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/deposit/refund', async (req, res) => {
  try {
    const result = await rentalService.manageDeposit('refund', req.body);
    res.json({ success: true, ...result });
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

module.exports = router;
