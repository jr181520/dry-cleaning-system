/**
 * 门店价格管理 API
 * 商家端可自行设置/修改各品类各服务的价格
 */
const express = require('express');
const router = express.Router();
const priceService = require('../services/priceService');

// ============================================
// 品类服务模板（商家可在模板上调整价格）
// ============================================

// 获取某品类下的服务模板列表（含当前门店自定义价格）
router.get('/templates/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { storeId } = req.query;
    const templates = await priceService.getPriceTemplates(categoryId, storeId);
    res.json({ success: true, data: templates });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 商家设置/修改单条服务价格
router.put('/set', async (req, res) => {
  try {
    const { storeId, categoryId, serviceId, price, deposit, unit } = req.body;
    if (!storeId || !categoryId || !serviceId || price === undefined) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }
    const result = await priceService.setServicePrice({
      storeId, categoryId, serviceId, price, deposit, unit
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 批量设置某品类下所有服务价格
router.put('/batch', async (req, res) => {
  try {
    const { storeId, categoryId, services } = req.body;
    if (!storeId || !categoryId || !Array.isArray(services)) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }
    const result = await priceService.batchSetPrices(storeId, categoryId, services);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取门店所有已设价格
router.get('/store/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;
    const { categoryId } = req.query;
    const prices = await priceService.getStorePrices(storeId, categoryId);
    res.json({ success: true, data: prices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 删除门店自定义价格（恢复默认）
router.delete('/reset', async (req, res) => {
  try {
    const { storeId, categoryId, serviceId } = req.body;
    await priceService.resetPrice(storeId, categoryId, serviceId);
    res.json({ success: true, message: '已恢复默认价格' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
