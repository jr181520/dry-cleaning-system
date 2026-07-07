/**
 * 认证中间件
 */

const authService = require('../services/authService');

// 开发模式角色映射表
const DEV_ROLE_MAP = {
  super_admin:      { roles: ['admin'],                          name: '总管理员',     userNo: 'DEV_ADMIN' },
  region_admin:     { roles: ['admin', 'region_admin'],          name: '区域管理员',   userNo: 'DEV_REGION' },
  store_admin:      { roles: ['admin', 'store_admin'],           name: '门店管理员',   userNo: 'DEV_STORE' },
  finance_admin:    { roles: ['admin', 'finance_admin'],         name: '财务管理员',   userNo: 'DEV_FINANCE' },
  customer_service: { roles: ['admin', 'customer_service'],      name: '客服人员',     userNo: 'DEV_CS' },
  bd_user:          { roles: ['admin', 'bd_user'],               name: 'BD人员',       userNo: 'DEV_BD' },
  bd_manager:       { roles: ['admin', 'bd_manager'],            name: 'BD主管',       userNo: 'DEV_BDM' },
  bd_director:      { roles: ['admin', 'bd_director'],           name: 'BD总监',       userNo: 'DEV_BDD' },
  ops_engineer:     { roles: ['admin', 'ops_engineer'],          name: '运维人员',     userNo: 'DEV_OPS' },
  marketing:        { roles: ['admin', 'marketing'],             name: '市场运营',     userNo: 'DEV_MKT' }
};

/**
 * 解析开发模式admin token
 * 支持两种格式：
 *   新格式: dev-admin-{roleKey}-{id}  例如 dev-admin-customer_service-5
 *   旧格式: dev-admin-{id}             例如 dev-admin-12345（向后兼容，视为super_admin）
 */
function parseDevAdminToken(token) {
  const body = token.replace('dev-admin-', '');
  // 尝试匹配新格式：roleKey-id
  for (const roleKey of Object.keys(DEV_ROLE_MAP)) {
    if (body.startsWith(roleKey + '-')) {
      const userId = body.slice(roleKey.length + 1);
      const info = DEV_ROLE_MAP[roleKey];
      return { roleKey, userId, ...info };
    }
  }
  // 旧格式：直接当作 super_admin
  return { roleKey: 'super_admin', userId: body, ...DEV_ROLE_MAP.super_admin };
}

/**
 * 验证用户身份
 */
async function authMiddleware(req, res, next) {
  try {
    // 从 header 获取 token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: '请先登录',
        needLogin: true
      });
    }

    const token = authHeader.slice(7);
    
    // 开发模式：处理开发管理员token（支持多角色）
    if (process.env.NODE_ENV !== 'production' && token.startsWith('dev-admin-')) {
      const devInfo = parseDevAdminToken(token);
      req.user = {
        id: devInfo.userId,
        userNo: devInfo.userNo,
        phone: '13800138000',
        name: devInfo.name,
        roles: devInfo.roles,
        roleKey: devInfo.roleKey,
        storeId: null,
        chainId: null,
        bdUserId: (devInfo.roleKey === 'bd_user' || devInfo.roleKey === 'bd_manager') ? devInfo.userId : null,
        creditScore: 100
      };
      next();
      return;
    }
    
    // 开发模式：处理开发连锁管理员token
    if (process.env.NODE_ENV !== 'production' && token.startsWith('dev-chain-')) {
      req.user = {
        id: token.replace('dev-chain-', ''),
        userNo: 'CHAIN_DEV',
        phone: '13900139000',
        name: '连锁管理员',
        roles: ['chain_admin'],
        storeId: null,
        chainId: 'mock-chain',
        creditScore: 100
      };
      next();
      return;
    }
    
    const parsed = authService.parseToken(token);
    
    // 开发模式：处理开发管理员token（JWT格式）
    if (process.env.NODE_ENV !== 'production' && parsed && parsed.userId && parsed.userId.startsWith('dev-admin-')) {
      const devInfo = parseDevAdminToken(parsed.userId);
      req.user = {
        id: devInfo.userId,
        userNo: devInfo.userNo,
        phone: '13800138000',
        name: devInfo.name,
        roles: devInfo.roles,
        roleKey: devInfo.roleKey,
        storeId: null,
        chainId: null,
        bdUserId: (devInfo.roleKey === 'bd_user' || devInfo.roleKey === 'bd_manager') ? devInfo.userId : null,
        creditScore: 100
      };
      next();
      return;
    }
    
    // 开发模式：处理开发连锁管理员token（JWT格式）
    if (process.env.NODE_ENV !== 'production' && parsed && parsed.userId && parsed.userId.startsWith('dev-chain-')) {
      req.user = {
        id: parsed.userId,
        userNo: 'CHAIN_DEV',
        phone: '13900139000',
        name: '连锁管理员',
        roles: ['chain_admin'],
        storeId: null,
        chainId: 'mock-chain',
        creditScore: 100
      };
      next();
      return;
    }
    
    // 开发模式：处理 mock_token 格式（小程序模拟登录）
    if (process.env.NODE_ENV !== 'production' && token.startsWith('mock_token_')) {
      const openid = token.replace('mock_token_', '');
      req.user = {
        id: openid,
        userNo: 'MOCK001',
        phone: '00000000000',
        name: '模拟用户',
        roles: ['customer'],
        storeId: null,
        creditScore: 100
      };
      next();
      return;
    }
    
    if (!parsed) {
      return res.status(401).json({ 
        success: false, 
        error: '登录已过期',
        needLogin: true
      });
    }

    // 获取用户信息
    const user = await authService.getUserById(parsed.userId);
    
    // 挂载到请求对象
    req.user = {
      id: user._id.toString(),
      userNo: user.userNo,
      phone: user.phone,
      name: user.name,
      roles: user.roles,
      storeId: user.storeId,
      chainId: user.chainId || null,
      creditScore: user.creditScore,
      openid: user.openid || null  // 用于跨平台用户识别
    };

    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      error: '认证失败',
      needLogin: true
    });
  }
}

/**
 * 可选认证中间件（不强制登录）
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      
      // 开发模式：处理 mock_token 格式（小程序模拟登录）
      if (process.env.NODE_ENV !== 'production' && token.startsWith('mock_token_')) {
        const openid = token.replace('mock_token_', '');
        req.user = {
          id: openid,
          userNo: 'MOCK001',
          phone: '00000000000',
          name: '模拟用户',
          roles: ['customer'],
          storeId: null,
          creditScore: 100
        };
        next();
        return;
      }
      
      const parsed = authService.parseToken(token);
      
      if (parsed) {
        const user = await authService.getUserById(parsed.userId);
        req.user = {
          id: user._id.toString(),
          userNo: user.userNo,
          phone: user.phone,
          name: user.name,
          roles: user.roles,
          storeId: user.storeId,
          chainId: user.chainId || null,
          openid: user.openid || null  // 用于跨平台用户识别
        };
      }
    }
    next();
  } catch {
    next();
  }
}

/**
 * 角色验证中间件工厂
 * 支持 roleKey 精确匹配 + super_admin 全局通行
 */
function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }
    
    // super_admin 拥有全部权限，直接放行
    if (req.user.roleKey === 'super_admin') {
      return next();
    }
    
    // 优先使用 roleKey 精确匹配
    if (req.user.roleKey) {
      if (roles.includes(req.user.roleKey)) {
        return next();
      }
      return res.status(403).json({ success: false, error: '权限不足，需要角色: ' + roles.join(', ') });
    }
    
    // 向后兼容：旧token使用 roles 数组
    const hasRole = roles.some(role => req.user.roles && req.user.roles.includes(role));
    if (!hasRole) {
      return res.status(403).json({ success: false, error: '权限不足' });
    }
    
    next();
  };
}

module.exports = authMiddleware;
module.exports.authMiddleware = authMiddleware;
module.exports.optionalAuth = optionalAuth;
module.exports.requireRoles = requireRoles;
