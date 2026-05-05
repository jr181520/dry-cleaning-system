/**
 * 认证路由
 */

const express = require('express');
const router = express.Router();
const authService = require('../services/authService');

// ============================================
// 公开接口
// ============================================

/**
 * 发送验证码
 * POST /api/auth/send-code
 */
router.post('/send-code', async (req, res) => {
  try {
    const { phone, type } = req.body;
    if (!phone) throw new Error('请输入手机号');
    
    const result = await authService.sendVerifyCode(phone, type);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 验证验证码
 * POST /api/auth/verify-code
 */
router.post('/verify-code', async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) throw new Error('参数不完整');
    
    await authService.verifyCode(phone, code);
    res.json({ success: true, data: { verified: true } });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 用户注册
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { phone, password, code, name } = req.body;
    if (!phone || !password) throw new Error('请填写完整信息');
    
    // 验证验证码（如果有）
    if (code) {
      await authService.verifyCode(phone, code);
    }
    
    const result = await authService.register(phone, password, { name });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 用户登录
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) throw new Error('请填写完整信息');
    
    const result = await authService.login(phone, password);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(401).json({ success: false, error: error.message });
  }
});

/**
 * 开发模式管理员登录（仅用于开发和测试）
 * POST /api/auth/admin-login
 */
router.post('/admin-login', async (req, res) => {
  try {
    const { roles } = req.body;
    
    // 开发模式下，直接创建一个虚拟管理员token
    if (process.env.NODE_ENV !== 'production') {
      // 创建一个管理员虚拟用户ID
      const devAdminId = 'dev-admin-' + Date.now();
      const token = authService.generateToken(devAdminId);
      
      res.json({
        success: true,
        data: {
          token,
          user: {
            id: devAdminId,
            userNo: 'DEV001',
            phone: '13800138000',
            name: '开发管理员',
            roles: roles || ['admin']
          }
        },
        message: '开发模式登录成功'
      });
      return;
    }
    
    // 生产环境需要真实登录
    res.status(401).json({
      success: false,
      error: '生产环境需要真实的管理员账户'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 微信登录
 * POST /api/auth/wechat
 */
router.post('/wechat', async (req, res) => {
  try {
    const { openid, nickname, headimgurl, sex } = req.body;
    if (!openid) throw new Error('openid 不能为空');
    
    const result = await authService.wechatLogin(openid, { nickname, headimgurl, sex });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(401).json({ success: false, error: error.message });
  }
});

/**
 * 忘记密码
 * POST /api/auth/forgot-password
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { phone, code, password } = req.body;
    if (!phone || !code || !password) throw new Error('参数不完整');
    
    await authService.verifyCode(phone, code);
    await authService.resetPassword(phone, password);
    
    res.json({ success: true, data: { message: '密码重置成功' } });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ============================================
// 需要认证的接口
// ============================================

// 简单的 token 验证中间件（简化版）
const authMiddleware = require('../middlewares/auth');

/**
 * 获取当前用户信息
 * GET /api/auth/profile
 */
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await authService.getUserById(req.user.id);
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 更新用户信息
 * PUT /api/auth/profile
 */
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await authService.updateUser(req.user.id, req.body);
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 修改密码
 * POST /api/auth/change-password
 */
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) throw new Error('参数不完整');
    
    await authService.changePassword(req.user.id, oldPassword, newPassword);
    res.json({ success: true, data: { message: '密码修改成功' } });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 退出登录
 * POST /api/auth/logout
 */
router.post('/logout', authMiddleware, async (req, res) => {
  res.json({ success: true, data: { message: '已退出登录' } });
});

module.exports = router;
