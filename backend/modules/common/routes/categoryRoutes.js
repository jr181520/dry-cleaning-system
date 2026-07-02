/**
 * 多品类路由
 * 提供品类列表、服务查询等公共API
 */
const express = require('express');
const router = express.Router();
const categoryService = require('../services/categoryService');

// 获取所有已启用品类（首页品类选择用）
router.get('/list', (req, res) => {
  try {
    const cards = categoryService.getCategoryCards();
    res.json({ success: true, categories: cards });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取品类详情
router.get('/:categoryId', (req, res) => {
  try {
    const cat = categoryService.getCategory(req.params.categoryId);
    if (!cat) {
      return res.status(404).json({ success: false, error: '品类不存在或未启用' });
    }
    res.json({ success: true, category: cat });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取品类服务列表
router.get('/:categoryId/services', (req, res) => {
  try {
    const services = categoryService.getServices(req.params.categoryId);
    if (!services) {
      return res.status(404).json({ success: false, error: '品类不存在或未启用' });
    }
    res.json({ success: true, services });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取品类状态流
router.get('/:categoryId/status-flow', (req, res) => {
  try {
    const flow = categoryService.getStatusFlow(req.params.categoryId);
    if (!flow) {
      return res.status(404).json({ success: false, error: '品类不存在或未启用' });
    }
    res.json({ success: true, statusFlow: flow });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
