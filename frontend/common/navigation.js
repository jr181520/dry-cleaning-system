/**
 * C端动态导航配置
 * 根据后端模块配置动态生成导航菜单
 */

const API_BASE = 'http://localhost:3000/api';

// 缓存
let menuCache = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

/**
 * 获取导航菜单
 */
async function getNavigationMenu() {
  const now = Date.now();
  
  // 检查缓存
  if (menuCache && (now - cacheTime) < CACHE_TTL) {
    return menuCache;
  }
  
  try {
    const response = await fetch(`${API_BASE}/system/modules`);
    const result = await response.json();
    
    if (result.success) {
      menuCache = buildNavigation(result.data);
      cacheTime = now;
      return menuCache;
    }
  } catch (error) {
    console.error('[Navigation] 获取模块配置失败:', error);
  }
  
  // 降级到默认配置
  return getDefaultNavigation();
}

/**
 * 构建导航配置
 */
function buildNavigation(moduleConfig) {
  const modules = moduleConfig.modules || {};
  
  return {
    // 主导航
    mainNav: [
      {
        id: 'home',
        name: '首页',
        path: '/c-index.html',
        icon: 'home',
        active: true
      },
      {
        id: 'service',
        name: '服务',
        path: '/c-service.html',
        icon: 'service',
        visible: modules.cleaning?.enabled
      },
      {
        id: 'recycle',
        name: '回收',
        path: '/c-recycle.html',
        icon: 'recycle',
        visible: modules.recycle?.enabled,
        badge: modules.recycle?.enabled ? '' : null,  // 未启用时隐藏
        disabled: !modules.recycle?.enabled,
        disabledMessage: modules.recycle?.message
      },
      {
        id: 'rental',
        name: '租赁',
        path: '/c-rental.html',
        icon: 'rental',
        visible: modules.rental?.enabled,
        disabled: !modules.rental?.enabled,
        disabledMessage: modules.rental?.message
      }
    ].filter(item => item.visible !== false),
    
    // 用户菜单
    userMenu: [
      {
        id: 'orders',
        name: '我的订单',
        path: '/c-orders.html',
        icon: 'order'
      },
      {
        id: 'profile',
        name: '个人中心',
        path: '/c-profile.html',
        icon: 'profile'
      },
      {
        id: 'store',
        name: '门店入驻',
        path: '/c-store-register.html',
        icon: 'store',
        roles: ['customer']
      }
    ],
    
    // 首页功能入口
    homeEntries: buildHomeEntries(modules),
    
    // 模块信息
    modules: Object.entries(modules).map(([name, config]) => ({
      name,
      ...config,
      enabled: config.enabled === true
    }))
  };
}

/**
 * 构建首页功能入口
 */
function buildHomeEntries(modules) {
  const entries = [];
  
  // 干洗服务
  if (modules.cleaning?.enabled !== false) {
    entries.push({
      id: 'cleaning',
      title: '干洗服务',
      subtitle: '专业清洗 呵护衣物',
      icon: 'cleaning',
      color: '#3B82F6',
      path: '/c-order.html',
      tags: ['干洗', '水洗', '熨烫']
    });
  }
  
  // 上门取件
  entries.push({
    id: 'pickup',
    title: '上门取件',
    subtitle: '预约骑手 免费取件',
    icon: 'pickup',
    color: '#10B981',
    path: '/c-pickup.html',
    tags: ['预约取件', '配送到家']
  });
  
  // 旧衣回收
  if (modules.recycle?.enabled) {
    entries.push({
      id: 'recycle',
      title: '旧衣回收',
      subtitle: '环保回收 变废为宝',
      icon: 'recycle',
      color: '#F59E0B',
      path: '/c-recycle.html',
      tags: ['免费估价', '上门回收']
    });
  } else {
    entries.push({
      id: 'recycle-upcoming',
      title: '旧衣回收',
      subtitle: modules.recycle?.message || '即将上线',
      icon: 'recycle',
      color: '#9CA3AF',
      path: null,
      tags: ['敬请期待'],
      disabled: true
    });
  }
  
  // 服饰租赁
  if (modules.rental?.enabled) {
    entries.push({
      id: 'rental',
      title: '服饰租赁',
      subtitle: '名牌租赁 轻松换装',
      icon: 'rental',
      color: '#8B5CF6',
      path: '/c-rental.html',
      tags: ['名牌包包', '高端服饰']
    });
  } else {
    entries.push({
      id: 'rental-upcoming',
      title: '服饰租赁',
      subtitle: modules.rental?.message || '即将上线',
      icon: 'rental',
      color: '#9CA3AF',
      path: null,
      tags: ['敬请期待'],
      disabled: true
    });
  }
  
  return entries;
}

/**
 * 默认导航配置
 */
function getDefaultNavigation() {
  return {
    mainNav: [
      { id: 'home', name: '首页', path: '/c-index.html', icon: 'home', active: true },
      { id: 'service', name: '服务', path: '/c-service.html', icon: 'service' },
      { id: 'orders', name: '订单', path: '/c-orders.html', icon: 'order' },
      { id: 'profile', name: '我的', path: '/c-profile.html', icon: 'profile' }
    ],
    userMenu: [
      { id: 'orders', name: '我的订单', path: '/c-orders.html', icon: 'order' },
      { id: 'profile', name: '个人中心', path: '/c-profile.html', icon: 'profile' }
    ],
    homeEntries: [
      { id: 'cleaning', title: '干洗服务', subtitle: '专业清洗 呵护衣物', icon: 'cleaning', color: '#3B82F6', path: '/c-order.html' },
      { id: 'pickup', title: '上门取件', subtitle: '预约骑手 免费取件', icon: 'pickup', color: '#10B981', path: '/c-pickup.html' }
    ],
    modules: [
      { name: 'cleaning', enabled: true },
      { name: 'recycle', enabled: false },
      { name: 'rental', enabled: false }
    ]
  };
}

/**
 * 渲染底部导航
 */
function renderBottomNav(containerId) {
  getNavigationMenu().then(nav => {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const html = nav.mainNav.map(item => {
      const isActive = window.location.pathname === item.path;
      const disabled = item.disabled ? ' disabled' : '';
      const path = item.path || 'javascript:void(0)';
      
      return `
        <a href="${path}" class="nav-item${disabled}${isActive ? ' active' : ''}" ${item.disabled ? 'data-disabled="true"' : ''}>
          <span class="nav-icon">${getIcon(item.icon)}</span>
          <span class="nav-text">${item.name}</span>
          ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
        </a>
      `;
    }).join('');
    
    container.innerHTML = html;
    
    // 添加禁用提示
    container.querySelectorAll('[data-disabled="true"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const item = nav.mainNav.find(n => n.id === el.dataset.id);
        alert(item?.disabledMessage || '服务暂未开放');
      });
    });
  });
}

/**
 * 渲染首页功能入口
 */
function renderHomeEntries(containerId) {
  getNavigationMenu().then(nav => {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const html = nav.homeEntries.map(entry => {
      const disabled = entry.disabled ? ' entry-disabled' : '';
      const path = entry.path || 'javascript:void(0)';
      
      return `
        <a href="${path}" class="home-entry${disabled}">
          <div class="entry-icon" style="background: ${entry.color}20; color: ${entry.color}">
            ${getIcon(entry.icon)}
          </div>
          <div class="entry-info">
            <h3>${entry.title}</h3>
            <p>${entry.subtitle}</p>
          </div>
          <div class="entry-tags">
            ${entry.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
          </div>
        </a>
      `;
    }).join('');
    
    container.innerHTML = html;
  });
}

/**
 * 获取图标
 */
function getIcon(type) {
  const icons = {
    home: '<svg class="icon" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>',
    service: '<svg class="icon" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',
    order: '<svg class="icon" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>',
    profile: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
    cleaning: '<svg class="icon" viewBox="0 0 24 24"><path d="M19.36 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.64-4.96z"/></svg>',
    pickup: '<svg class="icon" viewBox="0 0 24 24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>',
    recycle: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>',
    rental: '<svg class="icon" viewBox="0 0 24 24"><path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>',
    store: '<svg class="icon" viewBox="0 0 24 24"><path d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z"/></svg>'
  };
  return icons[type] || '';
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getNavigationMenu, renderBottomNav, renderHomeEntries };
}
