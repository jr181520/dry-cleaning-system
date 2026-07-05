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
 * 门店员工登录（index.html / m-index.html 门店管理端）
 * POST /api/auth/staff-login
 * Body: { account, password }
 * 返回: { token, user, store, permissions, menus }
 */
router.post('/staff-login', async (req, res) => {
  try {
    const { account, password, openid } = req.body;
    if (!account || !password) throw new Error('请输入账号和密码');
    
    // 查找门店员工账户（通过手机号或工号），同时支持连锁管理员登录
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
    
    // 更新登录信息
    user.lastLoginAt = new Date();
    user.loginCount = (user.loginCount || 0) + 1;
    await user.save();
    
    // 生成token
    const token = authService.generateToken(user._id);
    
    // 获取门店详情
    let storeInfo = null;
    if (user.storeId) {
      try {
        const mongoose = require('mongoose');
        const Store = mongoose.models.Store;
        if (Store) {
          const store = await Store.findOne({ 
            $or: [
              { _id: mongoose.Types.ObjectId.isValid(user.storeId) ? user.storeId : null },
              { storeNo: user.storeId }
            ]
          }).lean();
          if (store) {
            storeInfo = {
              id: store._id.toString(),
              storeNo: store.storeNo,
              name: store.name,
              address: store.address,
              phone: store.phone,
              city: store.city,
              district: store.district,
              status: store.status,
              businessHours: store.businessHours,
              services: store.services
            };
          }
        }
      } catch (e) {
        console.warn('[staff-login] 获取门店信息失败:', e.message);
      }
    }
    
    // 构建角色权限信息
    const isOwner = user.roles.includes('store_owner');
    const isStaff = user.roles.includes('store_staff');
    const isAdmin = user.roles.includes('admin');
    
    const permissions = {
      canManageStore: isOwner || isAdmin,           // 门店设置
      canManagePrices: isOwner || isAdmin,           // 价格管理
      canManageStaff: isOwner || isAdmin,            // 员工管理
      canViewSettlement: isOwner || isAdmin,         // 结算中心
      canProcessOrders: true,                        // 处理订单（所有店员）
      canViewOrders: true,                           // 查看订单
      canManageCustomers: true,                      // 客户管理
      canViewStatistics: isOwner || isAdmin,         // 统计分析
      canProcessRefund: isOwner || isAdmin,          // 退款
      canConfigServices: isOwner || isAdmin,         // 服务配置
      canManageInventory: isOwner || isAdmin,        // 库存管理
      canExportData: isOwner || isAdmin,             // 数据导出
    };
    
    // 构建可访问菜单
    const menus = [
      { id: 'dashboard', name: '仪表盘', icon: 'fa-dashboard', allowed: true },
      { id: 'orders', name: '订单管理', icon: 'fa-file-text', allowed: true },
      { id: 'customers', name: '客户管理', icon: 'fa-users', allowed: true },
      { id: 'members', name: '会员管理', icon: 'fa-id-card', allowed: true },
      { id: 'items', name: '物品管理', icon: 'fa-cube', allowed: true },
      { id: 'light-system', name: '智能灯条', icon: 'fa-lightbulb-o', allowed: isOwner || isAdmin || isStaff },
      { id: 'statistics', name: '统计分析', icon: 'fa-bar-chart', allowed: isOwner || isAdmin },
      { id: 'settlement', name: '结算中心', icon: 'fa-cny', allowed: isOwner || isAdmin },
      { id: 'messages', name: '消息中心', icon: 'fa-bell', allowed: true },
      { id: 'store-settings', name: '门店设置', icon: 'fa-cog', allowed: isOwner || isAdmin },
    ];
    
    res.json({
      success: true,
      data: {
        token,
        user: authService.sanitizeUser(user),
        store: storeInfo,
        permissions,
        menus,
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
    
    // 如果发生了账户合并，返回新token
    const responseData = {
      success: true,
      data: {
        user: { ...user },  // 去掉 __merged 标记
        __merged: user.__merged || false
      }
    };
    
    if (user.__merged && user._id) {
      // 合并后的用户需要新 token
      responseData.data.token = authService.generateToken(user._id);
      responseData.data.__mergedFrom = user.__mergedFrom;
      delete responseData.data.user.__merged;
      delete responseData.data.user.__mergedFrom;
    }
    
    res.json(responseData);
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

/**
 * 连锁管理员自助注册
 * POST /api/auth/chain-register
 * Body: { phone, password, chainName, adminName }
 * 自动创建连锁企业 + 管理员账户，返回 token
 */
router.post('/chain-register', async (req, res) => {
  try {
    const { phone, password, chainName, adminName } = req.body;
    if (!phone || !password) throw new Error('请填写手机号和密码');
    if (!chainName) throw new Error('请填写连锁企业名称');
    if (phone.length < 11) throw new Error('手机号格式不正确');
    if (password.length < 6) throw new Error('密码至少6位');

    // 检查手机号是否已注册
    const mongoose = require('mongoose');
    const User = mongoose.models.User;
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ success: false, error: '该手机号已注册，请直接登录' });
    }

    // 检查连锁名称是否已存在
    const Chain = mongoose.models.Chain;
    const existingChain = await Chain.findOne({ name: chainName });
    if (existingChain) {
      return res.status(400).json({ success: false, error: '连锁企业名称已存在' });
    }

    // 1. 创建连锁管理员用户
    const userNo = 'CA' + Date.now().toString(36).toUpperCase();
    const user = await User.create({
      userNo,
      phone,
      password,
      name: adminName || chainName + '管理员',
      roles: ['chain_admin'],
      status: 'active',
      registrationSource: 'chain-admin',
      createdFrom: 'chain-admin'
    });

    // 2. 创建连锁企业
    const chainNo = 'CH' + Date.now().toString(36).toUpperCase();
    const chain = await Chain.create({
      chainNo,
      name: chainName,
      adminId: user._id.toString(),
      adminPhone: phone,
      contactPerson: adminName || user.name,
      status: 'active',
      subscription: { plan: 'basic', maxStores: 5 },
      stats: { totalStores: 0, activeStores: 0, totalOrders: 0, totalRevenue: 0, monthlyOrders: 0, monthlyRevenue: 0 }
    });

    // 3. 将 chainId 写回用户
    user.chainId = chain._id.toString();
    await user.save();

    // 4. 生成 token
    const token = authService.generateToken(user._id);

    console.log(`[连锁注册] 新连锁企业注册成功: ${chainName} (${chainNo}), 管理员: ${phone}`);

    res.json({
      success: true,
      data: {
        token,
        user: authService.sanitizeUser(user),
        chain: {
          _id: chain._id.toString(),
          chainNo: chain.chainNo,
          name: chain.name
        }
      }
    });
  } catch (error) {
    console.error('[连锁注册] 失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 查询用户入驻申请状态
 * GET /api/auth/application-status?phone=xxx
 */
router.get('/application-status', async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ success: false, error: '缺少phone参数' });

    const mongoose = require('mongoose');
    let Application;
    try {
      Application = mongoose.models.StoreApplication || mongoose.model('StoreApplication');
    } catch (e) {
      // Schema 未注册，尝试从 adminService 获取
      const adminService = require('../../admin/services/adminService');
      Application = adminService.getApplicationModel ? adminService.getApplicationModel() : null;
    }

    if (!Application) {
      return res.json({ success: true, data: { hasApplication: false, status: null, needsApplication: true } });
    }

    // 查找该手机号最新的申请
    const latestApp = await Application.findOne({ applicantPhone: phone })
      .sort({ createdAt: -1 })
      .lean();

    if (!latestApp) {
      return res.json({ success: true, data: { hasApplication: false, status: null, needsApplication: true } });
    }

    res.json({
      success: true,
      data: {
        hasApplication: true,
        applicationId: latestApp.applicationId,
        status: latestApp.status,
        storeName: latestApp.storeName,
        needsApplication: latestApp.status !== 'approved'
      }
    });
  } catch (error) {
    console.error('[申请状态] 查询失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 商家注册（新商家用户注册账号，尚无门店）
 * POST /api/auth/merchant-register
 * Body: { phone, password, name }
 */
router.post('/merchant-register', async (req, res) => {
  try {
    const { phone, password, name } = req.body;
    if (!phone || !password) throw new Error('手机号和密码不能为空');

    // 检查手机号是否已注册（查找所有角色的用户）
    const mongoose = require('mongoose');
    const User = mongoose.models.User;
    const existing = User ? await User.findOne({ phone }) : null;
    if (existing) {
      return res.status(400).json({ success: false, error: '该手机号已注册' });
    }

    // 创建新的商家用户（无门店关联）- pre-save hook 会自动 hash password
    const userNo = 'U' + Date.now().toString().slice(-8);
    const user = await User.create({
      userNo,
      phone,
      name: name || '新商家',
      password: password,
      roles: ['merchant'],
      storeId: null,
      status: 'active',
      lastLoginAt: new Date(),
      loginCount: 1
    });

    const token = authService.generateToken(user._id);
    console.log('[商家注册] 新商家注册成功:', phone, name);

    res.json({
      success: true,
      data: {
        token,
        user: authService.sanitizeUser(user),
        store: null,
        needsApplication: true
      }
    });
  } catch (error) {
    console.error('[商家注册] 失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
