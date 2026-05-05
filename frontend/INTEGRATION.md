# 前端集成指南

## 目录结构

```
frontend/
├── common/                    # 公共模块
│   ├── moduleConfig.js       # 模块配置服务
│   ├── tabBar.js             # TabBar动态配置
│   └── navigation.js         # 导航动态配置
├── C端H5/
│   ├── modules/              # 按业务模块分包
│   │   ├── cleaning/
│   │   ├── recycle/
│   │   └── rental/
│   └── common/
│       ├── api.js
│       ├── auth.js
│       └── config.js
└── 小程序/
    ├── modules/              # 同样按模块分包
    │   ├── cleaning/
    │   ├── recycle/
    │   └── rental/
    ├── app.json
    └── api/
        └── moduleConfig.js
```

## 小程序集成

### 1. 修改 app.js

```javascript
// app.js
App({
  onLaunch(options) {
    // 加载模块配置
    this.loadModuleConfig();
    this.login();
  },
  
  // 加载模块配置
  async loadModuleConfig() {
    try {
      const config = await this.fetchModuleConfig();
      this.globalData.moduleConfig = config;
      this.globalData.enabledModules = Object.entries(config.modules)
        .filter(([_, m]) => m.enabled)
        .map(([name, m]) => ({ name, ...m }));
      
      // 更新TabBar
      this.updateTabBar();
    } catch (error) {
      console.error('[模块配置] 加载失败:', error);
    }
  },
  
  // 检查模块是否启用
  isModuleEnabled(moduleName) {
    return this.globalData.moduleConfig?.modules?.[moduleName]?.enabled === true;
  }
});
```

### 2. 使用模块配置

```javascript
// 在页面中
Page({
  data: {
    modules: []
  },
  
  onLoad() {
    const app = getApp();
    this.setData({
      modules: app.globalData.enabledModules || []
    });
  },
  
  // 根据模块动态显示功能
  showCleaningEntry() {
    return getApp().isModuleEnabled('cleaning');
  },
  
  showRecycleEntry() {
    return getApp().isModuleEnabled('recycle');
  }
});
```

## C端H5集成

### 1. 引入模块配置

```html
<script src="../../common/moduleConfig.js"></script>
```

### 2. 使用配置

```javascript
// 获取模块配置
const config = await getModuleConfig();

// 检查模块状态
if (isModuleEnabled('cleaning', config)) {
  // 显示干洗入口
}

// 获取首页入口
const entries = getHomeEntries(config);
```

## API 端点

### 获取模块状态

```
GET /api/system/modules
```

响应：
```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "modules": {
      "cleaning": { "enabled": true, "name": "干洗服务" },
      "recycle": { "enabled": false, "message": "即将上线" },
      "rental": { "enabled": false, "message": "即将上线" }
    },
    "enabledModules": [{ "name": "cleaning", "enabled": true }]
  }
}
```

## 菜单配置

### 小程序 TabBar

在 `app.js` 的 `updateTabBar()` 方法中配置：

```javascript
updateTabBar() {
  const modules = this.globalData.enabledModules || [];
  let tabList = [
    { pagePath: 'pages/index/index', text: '首页' },
    { pagePath: 'pages/orders/index', text: '订单' }
  ];
  
  // 根据模块动态添加
  if (modules.some(m => m.name === 'cleaning')) {
    tabList.push({ pagePath: 'pages/services/list/index', text: '服务' });
  }
  
  // ...
}
```

### 首页功能入口

在 `moduleConfig.js` 中配置：

```javascript
function getHomeEntries(config) {
  const entries = [];
  
  if (isModuleEnabled('cleaning', config)) {
    entries.push({
      id: 'cleaning',
      name: '干洗下单',
      icon: '/images/icons/cleaning.png',
      path: '/pages/order/create/index'
    });
  }
  
  // ... 其他模块
  
  return entries;
}
```

## 升级流程

### V1 → V2 升级回收模块

1. 修改 `backend/config/modules.js`：
```javascript
recycle: {
  enabled: true,  // 改为 true
  version: '2.0',
  name: '旧衣回收'
}
```

2. 实现 `backend/modules/recycle/` 路由

3. 前端自动显示回收入口（无需修改）

### V2 → V3 升级租赁模块

1. 修改模块配置
2. 实现租赁路由
3. 配置信用评估接口
