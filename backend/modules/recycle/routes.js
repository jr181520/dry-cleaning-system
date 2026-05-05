/**
 * 回收模块路由
 * V2 实现 - 当前返回"服务暂未开放"
 */

const express = require('express');
const router = express.Router();
const { moduleGuard } = require('../common/middlewares/moduleGuard');

// 所有路由都需要回收模块启用
router.use(moduleGuard('recycle'));

// 回收员相关
router.post('/assess', async (req, res) => {
  res.json({ success: false, error: 'V2功能', message: '回收估价功能即将上线' });
});

router.post('/orders', async (req, res) => {
  res.json({ success: false, error: 'V2功能', message: '回收订单功能即将上线' });
});

router.get('/orders', async (req, res) => {
  res.json({ success: false, error: 'V2功能', message: '回收订单列表即将上线' });
});

router.get('/orders/:id', async (req, res) => {
  res.json({ success: false, error: 'V2功能', message: '回收订单详情即将上线' });
});

router.post('/orders/:id/confirm', async (req, res) => {
  res.json({ success: false, error: 'V2功能', message: '回收确认功能即将上线' });
});

router.post('/orders/:id/collect', async (req, res) => {
  res.json({ success: false, error: 'V2功能', message: '上门回收功能即将上线' });
});

module.exports = router;
