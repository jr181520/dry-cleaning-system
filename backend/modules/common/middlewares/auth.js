/**
 * 认证中间件
 */

const authService = require('../services/authService');

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
    
    // 开发模式：处理开发管理员token
    if (process.env.NODE_ENV !== 'production' && token.startsWith('dev-admin-')) {
      req.user = {
        id: token.replace('dev-admin-', ''),
        userNo: 'DEV001',
        phone: '13800138000',
        name: '开发管理员',
        roles: ['admin'],
        storeId: null,
        creditScore: 100
      };
      next();
      return;
    }
    
    const parsed = authService.parseToken(token);
    
    // 开发模式：处理开发管理员token
    if (process.env.NODE_ENV !== 'production' && parsed && parsed.userId.startsWith('dev-admin-')) {
      req.user = {
        id: parsed.userId,
        userNo: 'DEV001',
        phone: '13800138000',
        name: '开发管理员',
        roles: ['admin'],
        storeId: null,
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
 */
function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }
    
    const hasRole = roles.some(role => req.user.roles.includes(role));
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
