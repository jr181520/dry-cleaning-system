/**
 * 前端模块配置服务
 * 从后端获取模块状态，动态生成菜单
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

// 模块配置缓存
let moduleConfigCache = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

/**
 * 获取模块配置
 * @param {boolean} forceRefresh - 强制刷新
 */
async function getModuleConfig(forceRefresh = false) {
  const now = Date.now();
  
  // 检查缓存
  if (!forceRefresh && moduleConfigCache && (now - cacheTime) < CACHE_TTL) {
    return moduleConfigCache;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/system/modules`);
    const result = await response.json();
    
    if (result.success) {
      moduleConfigCache = result.data;
      cacheTime = now;
      return moduleConfigCache;
    }
  } catch (error) {
    console.error('[ModuleConfig] Failed to fetch:', error);
  }
  
  // 降级到本地配置
  return getLocalConfig();
}

/**
 * 本地默认配置（降级用）
 */
function getLocalConfig() {
  return {
    version: '1.0.0',
    modules: {
      cleaning: {
        enabled: true,
        name: '干洗服务',
        nameEn: 'Dry Cleaning'
      },
      recycle: {
        enabled: false,
        name: '旧衣回收',
        nameEn: 'Clothing Recycling',
        message: '即将上线'
      },
      rental: {
        enabled: false,
        name: '服饰租赁',
        nameEn: 'Fashion Rental',
        message: '即将上线'
      }
    },
    enabledModules: [
      { name: 'cleaning', name: '干洗服务', enabled: true }
    ]
  };
}

/**
 * 检查模块是否启用
 */
function isModuleEnabled(moduleName, config) {
  const module = config?.modules?.[moduleName];
  return module?.enabled === true;
}

/**
 * 获取模块菜单配置
 */
function getModuleMenus(moduleConfig) {
  const menus = [];
  
  // 干洗模块
  if (isModuleEnabled('cleaning', moduleConfig)) {
    menus.push({
      id: 'cleaning',
      module: 'cleaning',
      name: '干洗服务',
      icon: 'icon-dry-clean',
      pages: [
        { path: '/pages/order/create/index', name: '下单' },
        { path: '/pages/orders/index', name: '我的订单' },
        { path: '/pages/pickup/index', name: '取件' }
      ]
    });
  }
  
  // 回收模块
  if (isModuleEnabled('recycle', moduleConfig)) {
    menus.push({
      id: 'recycle',
      module: 'recycle',
      name: '旧衣回收',
      icon: 'icon-recycle',
      pages: [
        { path: '/pages/recycle/create/index', name: '发起回收' },
        { path: '/pages/recycle/orders/index', name: '回收记录' }
      ]
    });
  }
  
  // 租赁模块
  if (isModuleEnabled('rental', moduleConfig)) {
    menus.push({
      id: 'rental',
      module: 'rental',
      name: '服饰租赁',
      icon: 'icon-rental',
      pages: [
        { path: '/pages/rental/browse/index', name: '浏览商品' },
        { path: '/pages/rental/my/index', name: '我的租赁' },
        { path: '/pages/rental/deposit/index', name: '押金管理' }
      ]
    });
  }
  
  return menus;
}

/**
 * 获取首页功能入口
 */
function getHomeEntries(moduleConfig) {
  const entries = [];
  
  if (isModuleEnabled('cleaning', moduleConfig)) {
    entries.push({
      id: 'cleaning',
      name: '干洗下单',
      icon: '/images/icons/cleaning.png',
      color: '#3B82F6',
      path: '/pages/order/create/index'
    });
    
    entries.push({
      id: 'pickup',
      name: '上门取件',
      icon: '/images/icons/pickup.png',
      color: '#10B981',
      path: '/pages/pickup/index'
    });
  }
  
  if (isModuleEnabled('recycle', moduleConfig)) {
    entries.push({
      id: 'recycle',
      name: '旧衣回收',
      icon: '/images/icons/recycle.png',
      color: '#F59E0B',
      path: '/pages/recycle/create/index'
    });
  }
  
  if (isModuleEnabled('rental', moduleConfig)) {
    entries.push({
      id: 'rental',
      name: '服饰租赁',
      icon: '/images/icons/rental.png',
      color: '#8B5CF6',
      path: '/pages/rental/browse/index'
    });
  }
  
  return entries;
}

/**
 * 导出方法
 */
module.exports = {
  getModuleConfig,
  isModuleEnabled,
  getModuleMenus,
  getHomeEntries,
  API_BASE
};
