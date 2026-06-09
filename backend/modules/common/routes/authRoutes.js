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
 * 使用微信公众号网页授权方式
 */
router.get('/wechat/authorize', async (req, res) => {
  try {
    // 使用微信公众号的AppID（可以是小程序AppID）
    const appId = process.env.WX_MINI_APP_ID;
    
    if (!appId) {
      throw new Error('未配置微信AppID');
    }
    
    // 授权后跳转的回调地址（必须是已备案的域名，且在微信公众号后台配置）
    // 本地开发环境需要使用穿透工具
    const host = req.get('host');
    let redirectUri;
    
    if (host.includes('localhost')) {
      // 本地开发环境使用测试模式
      throw new Error('本地开发环境请使用测试模式');
    } else {
      // 生产环境使用实际域名
      redirectUri = `${req.protocol}://${host}/api/auth/wechat/callback`;
    }
    
    const state = req.query.state || 'web_login';
    
    // 微信公众号网页授权地址
    // scope=snsapi_userinfo 表示弹出授权页面，获取用户基本信息
    // scope=snsapi_base 静默授权，只能获取openid
    const authorizeUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=snsapi_userinfo&state=${state}#wechat_redirect`;
    
    console.log('[微信授权] 生成授权URL:', authorizeUrl);
    
    res.json({ 
      success: true, 
      data: { 
        authorizeUrl,
        appId,
        isWebAuthorize: true
      } 
    });
  } catch (error) {
    console.error('[微信授权] 生成授权URL失败:', error);
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
 * 微信小程序商家登录（店员/店长通过账号密码登录切换为商家模式）
 * POST /api/auth/staff-login
 */
router.post('/staff-login', async (req, res) => {
  try {
    const { account, password, openid } = req.body;
    if (!account || !password) throw new Error('请输入账号和密码');
    
    // 查找门店员工账户（通过手机号或工号）
    const user = await authService.findStaffByAccount(account);
    if (!user) {
      return res.status(401).json({ success: false, error: '账号不存在' });
    }
    
    // 验证密码
    const isValid = await authService.verifyStaffPassword(user, password);
    if (!isValid) {
      return res.status(401).json({ success: false, error: '密码错误' });
    }
    
    // 如果提供了openid，绑定该微信用户到员工账户
    if (openid) {
      await authService.bindWechatToStaff(openid, user);
    }
    
    // 生成带角色信息的token
    const token = authService.generateToken(user._id);
    
    res.json({
      success: true,
      data: {
        token,
        user: authService.sanitizeUser(user),
        openid: user.openid
      }
    });
  } catch (error) {
    console.error('[商家登录] 错误:', error);
    res.status(401).json({ success: false, error: error.message });
  }
});

/**
 * 开发模式：快速商家登录（创建或获取测试员工账户）
 * POST /api/auth/dev-staff-login
 */
router.post('/dev-staff-login', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, error: '生产环境不可用' });
    }

    const { storeId, openid } = req.body;
    const targetStoreId = storeId || 'ST002';
    
    // 查找或创建该门店的测试店长账户
    let user = await authService.findStaffByAccount('13800138001');
    
    if (!user) {
      // 创建测试店长账户
      const result = await authService.register('13800138001', 'admin123', {
        name: '测试店长',
        roles: ['store_owner'],
        storeId: targetStoreId,
        createdFrom: 'dev'
      });
      user = result.user;
    } else {
      // 确保角色和门店ID正确
      const User = require('mongoose').models.User;
      if (!user.roles.includes('store_owner')) {
        user.roles = [...new Set([...user.roles, 'store_owner'])];
      }
      if (!user.storeId) {
        user.storeId = targetStoreId;
      }
      await user.save();
    }
    
    // 绑定openid
    if (openid) {
      await authService.bindWechatToStaff(openid, user);
    }
    
    const token = authService.generateToken(user._id);
    
    res.json({
      success: true,
      data: {
        token,
        user: authService.sanitizeUser(user),
        openid: user.openid
      },
      message: '开发模式商家登录成功'
    });
  } catch (error) {
    console.error('[开发商家登录] 错误:', error);
    res.status(500).json({ success: false, error: error.message });
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
