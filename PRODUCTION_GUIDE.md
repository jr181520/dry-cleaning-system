# 生产环境部署指南

## 当前方案

### 问题
- `m-index.html` 依赖外部 CDN（Tailwind CSS、Font Awesome）
- 国内网络环境可能导致 CDN 加载失败
- `Content unavailable. Resource was not cached` 错误

## 解决方案

### 方案 1：国内 CDN（推荐）
将 CDN 替换为国内镜像源：

```html
<!-- Tailwind CSS -->
<script src="https://unpkg.com/tailwindcss@3.4.0/dist/tailwind.min.js"></script>

<!-- Font Awesome -->
<link rel="stylesheet" href="https://cdn.bootcdn.net/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
```

### 方案 2：完全本地化（最稳定）

#### 2.1 下载依赖到本地
```bash
# 创建 lib 目录
mkdir lib

# 下载 Tailwind CSS
curl -o lib/tailwind.min.js https://unpkg.com/tailwindcss@3.4.0/dist/tailwind.min.js

# 下载 Font Awesome
curl -o lib/font-awesome.min.css https://cdn.bootcdn.net/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css
```

#### 2.2 修改 HTML 引用
```html
<head>
    <!-- Tailwind CSS 本地版本 -->
    <script src="lib/tailwind.min.js"></script>
    <!-- Font Awesome 本地版本 -->
    <link rel="stylesheet" href="lib/font-awesome.min.css">
</head>
```

### 方案 3：PWA + Service Worker（最佳实践）

创建 `sw.js` 文件：
```javascript
const CACHE_NAME = 'dry-cleaning-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/m-index.html',
    '/lib/tailwind.min.js',
    '/lib/font-awesome.min.css',
    '/offline.html'
];

// 安装事件
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
    );
});

// 请求拦截
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
            .catch(() => caches.match('/offline.html'))
    );
});
```

在 HTML 中注册 Service Worker：
```html
<script>
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
}
</script>
```

## 推荐的部署架构

```
dry_cleaning_system/
├── index.html          # PC端入口
├── m-index.html        # 移动端入口（已优化CDN）
├── m-index-offline.html # 移动端离线版
├── lib/                # 本地化资源库
│   ├── tailwind.min.js
│   └── font-awesome.min.css
├── backend/            # 后端服务
│   ├── server.js
│   └── ...
└── public/             # Nginx/Caddy 静态文件目录
```

## 快速修复步骤

### 立即可用方案

1. **使用 `m-index-offline.html`**
   - 完全离线，不依赖任何外部资源
   - 适合：内网环境、网络不稳定地区

2. **使用国内 CDN**
   ```html
   <!-- 替换 <head> 中的 CDN 引用 -->
   <script src="https://unpkg.com/tailwindcss@3.4.0/dist/tailwind.min.js"></script>
   <link rel="stylesheet" href="https://cdn.bootcdn.net/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
   ```

3. **使用 Docker 部署完整环境**
   ```bash
   # 使用 Docker Compose
   docker-compose up -d
   
   # 服务包括：
   # - Nginx (静态文件 + CDN代理)
   # - 后端 API
   # - 数据库
   # - MQTT Broker
   ```

## CDN 容灾脚本

在 `m-index.html` 中添加以下脚本，实现自动容灾：

```html
<script>
// CDN 加载检测和容灾
document.addEventListener('DOMContentLoaded', function() {
    // 检查 Tailwind 是否加载成功
    setTimeout(function() {
        if (typeof tailwind === 'undefined') {
            console.warn('Tailwind CDN 加载失败，尝试备用 CDN...');
            var script = document.createElement('script');
            script.src = 'https://unpkg.com/tailwindcss@3.4.0/dist/tailwind.min.js';
            document.head.appendChild(script);
        }
    }, 2000);
});

// 离线检测
window.addEventListener('offline', function() {
    alert('网络已断开，部分功能可能不可用');
});
</script>
```

## 生产环境检查清单

- [ ] CDN 使用国内镜像
- [ ] 本地资源已备份
- [ ] 离线页面已准备
- [ ] Service Worker 已配置（可选）
- [ ] 网络超时已设置
- [ ] 错误日志已配置

## 快速测试命令

```bash
# 测试 CDN 可用性
curl -I https://cdn.tailwindcss.com
curl -I https://unpkg.com/tailwindcss@3.4.0/dist/tailwind.min.js
curl -I https://cdn.bootcdn.net/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css

# 测试后端服务
curl http://localhost:3000/api/health

# 测试 MQTT Broker
curl -I http://localhost:18083
```

## 推荐的生产配置

使用 Nginx 反向代理所有请求：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # 静态文件
    location / {
        root /var/www/dry-cleaning;
        index index.html m-index.html;
        try_files $uri $uri/ /index.html;
    }
    
    # 代理 CDN 请求到国内镜像
    location /cdn/tailwind {
        proxy_pass https://unpkg.com/tailwindcss@3.4.0/dist/tailwind.min.js;
        proxy_cache_valid 200 7d;
    }
    
    # API 代理
    location /api {
        proxy_pass http://localhost:3000;
    }
    
    # MQTT WebSocket
    location /mqtt {
        proxy_pass http://localhost:8083;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

**创建时间**: 2026-04-25  
**最后更新**: 2026-04-25  
**版本**: v1.0
