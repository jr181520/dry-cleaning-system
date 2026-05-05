/**
 * RBAC 权限中间件
 * 基于角色的访问控制
 */

const { PERMISSIONS } = require('../models/index');

/**
 * 检查用户是否拥有指定权限
 * @param {string} userId - 用户ID
 * @param {string} permission - 权限标识
 * @param {Object} userRoles - 用户角色数组
 * @returns {boolean}
 */
function hasPermission(userRoles, permission) {
  // admin 拥有所有权限
  if (userRoles.includes('admin')) return true;
  
  // 检查权限配置
  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) return false;
  
  // * 表示所有人
  if (allowedRoles.includes('*')) return true;
  
  // 检查用户角色
  return userRoles.some(role => allowedRoles.includes(role));
}

/**
 * 权限检查中间件
 * @param {string} permission - 所需权限
 */
function requirePermission(permission) {
  return (req, res, next) => {
    const userRoles = req.user?.roles || [];
    
    if (!hasPermission(userRoles, permission)) {
      return res.status(403).json({
        success: false,
        error: 'forbidden',
        message: '您没有此操作的权限'
      });
    }
    
    next();
  };
}

/**
 * 权限检查中间件（多个权限，满足其一即可）
 * @param  {...string} permissions
 */
function requireAnyPermission(...permissions) {
  return (req, res, next) => {
    const userRoles = req.user?.roles || [];
    
    const hasAny = permissions.some(p => hasPermission(userRoles, p));
    
    if (!hasAny) {
      return res.status(403).json({
        success: false,
        error: 'forbidden',
        message: '您没有此操作的权限'
      });
    }
    
    next();
  };
}

/**
 * 权限检查中间件（多个权限，需全部满足）
 * @param  {...string} permissions
 */
function requireAllPermissions(...permissions) {
  return (req, res, next) => {
    const userRoles = req.user?.roles || [];
    
    const hasAll = permissions.every(p => hasPermission(userRoles, p));
    
    if (!hasAll) {
      return res.status(403).json({
        success: false,
        error: 'forbidden',
        message: '您没有此操作的权限'
      });
    }
    
    next();
  };
}

/**
 * 角色检查中间件
 * @param  {...string} roles
 */
function requireRoles(...roles) {
  return (req, res, next) => {
    const userRoles = req.user?.roles || [];
    
    const hasRole = roles.some(r => userRoles.includes(r));
    
    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: 'forbidden',
        message: '需要特定角色才能执行此操作'
      });
    }
    
    next();
  };
}

/**
 * 获取用户可访问的菜单
 * @param {Array} userRoles - 用户角色
 */
function getAccessibleMenus(userRoles) {
  const allMenus = {
    // 干洗模块
    cleaning: [
      { id: 'cleaning_orders', name: '清洗订单', icon: 'order', roles: ['customer', 'store_staff', 'store_owner', 'admin'] },
      { id: 'cleaning_items', name: '物品管理', icon: 'item', roles: ['store_staff', 'store_owner', 'admin'] },
      { id: 'cleaning_stats', name: '数据统计', icon: 'chart', roles: ['store_owner', 'admin'] },
      
      // 回收模块（待开放）
      { id: 'recycle', name: '旧衣回收', icon: 'recycle', roles: ['customer', 'recycler', 'admin'], requiresModule: 'recycle' },
      { id: 'recycle_assess', name: '回收估价', icon: 'assess', roles: ['recycler', 'appraiser', 'admin'], requiresModule: 'recycle' },
      
      // 租赁模块（待开放）
      { id: 'rental', name: '服饰租赁', icon: 'rental', roles: ['customer', 'brand_admin', 'admin'], requiresModule: 'rental' },
      { id: 'rental_manage', name: '租赁管理', icon: 'rental-manage', roles: ['brand_admin', 'admin'], requiresModule: 'rental' }
    ],
    
    // 门店管理
    store: [
      { id: 'store_info', name: '门店信息', icon: 'store', roles: ['store_owner', 'admin'] },
      { id: 'store_staff', name: '员工管理', icon: 'team', roles: ['store_owner', 'admin'] },
      { id: 'store_settlement', name: '结算管理', icon: 'wallet', roles: ['store_owner', 'admin'] }
    ],
    
    // 系统
    system: [
      { id: 'users', name: '用户管理', icon: 'user', roles: ['admin'] },
      { id: 'modules', name: '模块管理', icon: 'setting', roles: ['admin'] }
    ]
  };
  
  // 过滤可访问菜单
  const accessible = {};
  for (const [category, menus] of Object.entries(allMenus)) {
    accessible[category] = menus.filter(menu => {
      // 检查角色权限
      if (!menu.roles.some(r => userRoles.includes(r))) return false;
      return true;
    });
  }
  
  return accessible;
}

module.exports = {
  hasPermission,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireRoles,
  getAccessibleMenus
};
