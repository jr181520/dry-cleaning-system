/**
 * TabBar 配置
 * 根据模块状态动态生成
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

/**
 * 默认 TabBar 配置
 */
const DEFAULT_TABBAR = {
  color: '#999999',
  selectedColor: '#3B82F6',
  backgroundColor: '#FFFFFF',
  borderStyle: 'black',
  list: [
    {
      pagePath: 'pages/index/index',
      text: '首页',
      iconPath: 'images/tabbar/home.png',
      selectedIconPath: 'images/tabbar/home-active.png'
    },
    {
      pagePath: 'pages/orders/index',
      text: '订单',
      iconPath: 'images/tabbar/order.png',
      selectedIconPath: 'images/tabbar/order-active.png'
    },
    {
      pagePath: 'pages/services/list/index',
      text: '服务',
      iconPath: 'images/tabbar/service.png',
      selectedIconPath: 'images/tabbar/service-active.png'
    },
    {
      pagePath: 'pages/profile/index',
      text: '我的',
      iconPath: 'images/tabbar/profile.png',
      selectedIconPath: 'images/tabbar/profile-active.png'
    }
  ]
};

/**
 * 获取动态 TabBar 配置
 */
async function getDynamicTabBar(userRoles = ['customer']) {
  try {
    const response = await fetch(`${API_BASE}/api/system/modules`);
    const result = await response.json();
    
    if (!result.success) {
      return DEFAULT_TABBAR;
    }
    
    const config = result.data;
    const list = [];
    
    // 首页（始终显示）
    list.push({
      pagePath: 'pages/index/index',
      text: '首页',
      iconPath: 'images/tabbar/home.png',
      selectedIconPath: 'images/tabbar/home-active.png'
    });
    
    // 订单（始终显示）
    list.push({
      pagePath: 'pages/orders/index',
      text: '订单',
      iconPath: 'images/tabbar/order.png',
      selectedIconPath: 'images/tabbar/order-active.png'
    });
    
    // 服务（根据启用的模块动态调整）
    if (config.modules.cleaning?.enabled || 
        config.modules.recycle?.enabled || 
        config.modules.rental?.enabled) {
      list.push({
        pagePath: 'pages/services/list/index',
        text: '服务',
        iconPath: 'images/tabbar/service.png',
        selectedIconPath: 'images/tabbar/service-active.png'
      });
    }
    
    // 门店入口（员工/老板角色）
    if (userRoles.includes('store_staff') || userRoles.includes('store_owner')) {
      list.push({
        pagePath: 'pages/store/index',
        text: '管理',
        iconPath: 'images/tabbar/store.png',
        selectedIconPath: 'images/tabbar/store-active.png'
      });
    }
    
    // 我的
    list.push({
      pagePath: 'pages/profile/index',
      text: '我的',
      iconPath: 'images/tabbar/profile.png',
      selectedIconPath: 'images/tabbar/profile-active.png'
    });
    
    return {
      ...DEFAULT_TABBAR,
      list
    };
  } catch (error) {
    console.error('[TabBar] Failed to get dynamic config:', error);
    return DEFAULT_TABBAR;
  }
}

/**
 * 简化版 TabBar（用于C端H5）
 */
function getSimpleTabBar(moduleConfig) {
  const items = [
    { id: 'home', name: '首页', path: '/c-index.html', icon: 'home' },
    { id: 'orders', name: '订单', path: '/c-orders.html', icon: 'order' },
    { id: 'profile', name: '我的', path: '/c-profile.html', icon: 'profile' }
  ];
  
  // 动态添加服务入口
  if (moduleConfig?.modules?.cleaning?.enabled) {
    items.splice(1, 0, { id: 'service', name: '服务', path: '/c-service.html', icon: 'service' });
  }
  
  return items;
}

module.exports = {
  DEFAULT_TABBAR,
  getDynamicTabBar,
  getSimpleTabBar
};
