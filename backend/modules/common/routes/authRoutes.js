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
    
    const result = await authService.wechatLogin(openid, { 
      nickname, 
      headimgurl, 
      sex,
      platform: 'wechat_web' // 标记为网页端
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(401).json({ success: false, error: error.message });
  }
});

/**
 * 微信网页授权 - 生成授权URL
 * GET /api/auth/wechat/authorize
 */
router.get('/wechat/authorize', async (req, res) => {
  try {
    const appId = process.env.WX_WEB_APP_ID || process.env.WX_MINI_APP_ID;
    const redirectUri = process.env.WX_WEB_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/wechat/callback`;
    const state = req.query.state || 'web_login';
    
    if (!appId) {
      throw new Error('未配置微信网页授权参数');
    }
    
    // 微信授权地址
    const authorizeUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`;
    
    res.json({ 
      success: true, 
      data: { 
        authorizeUrl,
        appId 
      } 
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 微信网页授权 - 回调处理
 * GET /api/auth/wechat/callback
 */
router.get('/wechat/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.redirect('/?error=微信授权失败');
    }
    
    // 用code换取openid
    const appId = process.env.WX_WEB_APP_ID || process.env.WX_MINI_APP_ID;
    const appSecret = process.env.WX_WEB_APP_SECRET || process.env.WX_MINI_APP_SECRET;
    
    if (!appId || !appSecret) {
      return res.redirect('/?error=服务器未配置微信参数');
    }
    
    // 调用微信API获取access_token和openid
    const wxApiUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`;
    
    const wxResponse = await fetch(wxApiUrl);
    const wxData = await wxResponse.json();
    
    if (wxData.errcode) {
      console.error('[微信授权回调] 微信API错误:', wxData);
      return res.redirect(`/?error=微信API错误:${wxData.errmsg}`);
    }
    
    const openid = wxData.openid;
    const accessToken = wxData.access_token;
    
    // 获取用户信息（可选）
    let userData = {};
    try {
      const userInfoUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${accessToken}&openid=${openid}`;
      const userInfoResponse = await fetch(userInfoUrl);
      const userInfo = await userInfoResponse.json();
      
      if (!userInfo.errcode) {
        userData = {
          nickname: userInfo.nickname,
          headimgurl: userInfo.headimgurl,
          sex: userInfo.sex,
          platform: 'wechat_web'
        };
      }
    } catch (e) {
      console.log('[微信授权回调] 获取用户信息失败:', e.message);
    }
    
    // 执行登录/注册
    const result = await authService.wechatLogin(openid, userData);
    
    // 将openid和token通过URL参数返回（前端处理）
    // 注意：这里使用URL重定向到前端页面，前端解析参数并保存登录状态
    const redirectUrl = `/?wechat_login=1&openid=${openid}&token=${result.token}`;
    res.redirect(redirectUrl);
    
  } catch (error) {
    console.error('[微信授权回调] 处理失败:', error);
    res.redirect(`/?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * 微信小程序登录（通过 code 换取 openid）
 * POST /api/auth/wxmini-login
 */
router.post('/wxmini-login', async (req, res) => {
  try {
    const { code, nickname, avatarUrl, gender } = req.body;
    if (!code) throw new Error('code 不能为空');
    
    // 调用微信 API 用 code 换取 openid
    const appId = process.env.WX_MINI_APP_ID;
    const appSecret = process.env.WX_MINI_APP_SECRET;
    
    console.log('[微信登录] WX_MINI_APP_ID =', appId, 'WX_MINI_APP_SECRET =', appSecret ? '***' : '未设置');
    
    if (!appId || !appSecret) {
      throw new Error('微信小程序配置缺失，请检查 .env 文件');
    }
    
    const wxApiUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;
    
    const wxResponse = await fetch(wxApiUrl);
    const wxData = await wxResponse.json();
    
    if (wxData.errcode) {
      console.error('[微信登录] 微信API错误:', wxData);
      throw new Error(`微信登录失败: ${wxData.errmsg}`);
    }
    
    const { openid, session_key } = wxData;
    
    // 用 openid 登录或注册
    const result = await authService.wechatLogin(openid, { 
      nickname: nickname || '微信用户',
      headimgurl: avatarUrl,
      sex: gender
    });
    
    res.json({ 
      success: true, 
      data: {
        ...result,
        openid,
        session_key
      }
    });
  } catch (error) {
    console.error('[微信小程序登录] 错误:', error);
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
