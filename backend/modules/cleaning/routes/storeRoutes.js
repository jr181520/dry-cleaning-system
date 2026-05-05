/**
 * 门店管理路由
 */

const express = require('express');
const router = express.Router();
const storeService = require('../services/storeService');
const { authMiddleware, requireRoles } = require('../../common/middlewares/auth');

// ============================================
// 公开接口
// ============================================

/**
 * 获取门店列表
 * GET /api/stores
 */
router.get('/', async (req, res) => {
  try {
    const { page, pageSize, city, district, keyword, latitude, longitude, radius } = req.query;
    const result = await storeService.getStores({
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20,
      city, district, keyword, latitude, longitude, radius
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 获取门店详情
 * GET /api/stores/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const store = await storeService.getStoreById(req.params.id);
    res.json({ success: true, data: store });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

/**
 * 获取门店服务列表
 * GET /api/stores/:id/services
 */
router.get('/:id/services', async (req, res) => {
  try {
    const services = await storeService.getStoreServices(req.params.id);
    res.json({ success: true, data: services });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ============================================
// 需要认证的接口
// ============================================

/**
 * 创建门店（仅管理员/门店所有者）
 * POST /api/stores
 */
router.post('/', authMiddleware, requireRoles('admin', 'store_owner'), async (req, res) => {
  try {
    const store = await storeService.createStore(req.user.id, req.body);
    res.json({ success: true, data: store });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 更新门店信息（仅门店所有者）
 * PUT /api/stores/:id
 */
router.put('/:id', authMiddleware, requireRoles('admin', 'store_owner'), async (req, res) => {
  try {
    const store = await storeService.updateStore(req.params.id, req.user.id, req.body);
    res.json({ success: true, data: store });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 获取我的门店列表（门店所有者）
 * GET /api/stores/my
 */
router.get('/owner/my', authMiddleware, requireRoles('admin', 'store_owner'), async (req, res) => {
  try {
    const stores = await storeService.getOwnerStores(req.user.id);
    res.json({ success: true, data: stores });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 添加门店员工
 * POST /api/stores/:id/staff
 */
router.post('/:id/staff', authMiddleware, requireRoles('admin', 'store_owner'), async (req, res) => {
  try {
    const { staffId } = req.body;
    if (!staffId) throw new Error('请提供员工ID');
    
    const store = await storeService.addStaff(req.params.id, req.user.id, staffId);
    res.json({ success: true, data: store });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 获取门店员工列表
 * GET /api/stores/:id/staff
 */
router.get('/:id/staff', authMiddleware, requireRoles('admin', 'store_owner', 'store_staff'), async (req, res) => {
  try {
    const staffIds = await storeService.getStaffList(req.params.id, req.user.id);
    res.json({ success: true, data: staffIds });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
