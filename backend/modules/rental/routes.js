/**
 * 租赁模块路由
 * V3 实现 - 当前返回"服务暂未开放"
 */

const express = require('express');
const router = express.Router();
const { moduleGuard } = require('../common/middlewares/moduleGuard');

// 所有路由都需要租赁模块启用
router.use(moduleGuard('rental'));

// 租赁相关
router.post('/items', async (req, res) => {
  res.json({ success: false, error: 'V3功能', message: '租赁物品上架即将上线' });
});

router.get('/items', async (req, res) => {
  res.json({ success: false, error: 'V3功能', message: '租赁物品列表即将上线' });
});

router.get('/items/:id', async (req, res) => {
  res.json({ success: false, error: 'V3功能', message: '租赁物品详情即将上线' });
});

router.post('/reserve', async (req, res) => {
  res.json({ success: false, error: 'V3功能', message: '预约租赁即将上线' });
});

router.post('/orders', async (req, res) => {
  res.json({ success: false, error: 'V3功能', message: '租赁订单即将上线' });
});

router.get('/orders', async (req, res) => {
  res.json({ success: false, error: 'V3功能', message: '租赁订单列表即将上线' });
});

router.post('/orders/:id/return', async (req, res) => {
  res.json({ success: false, error: 'V3功能', message: '归还租赁物品即将上线' });
});

router.get('/credit', async (req, res) => {
  res.json({ success: false, error: 'V3功能', message: '信用评估即将上线' });
});

router.post('/deposit', async (req, res) => {
  res.json({ success: false, error: 'V3功能', message: '押金功能即将上线' });
});

module.exports = router;
