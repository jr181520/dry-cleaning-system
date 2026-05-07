# PM2 生产环境部署指南

## 📋 概述

本文档介绍如何使用 PM2 在生产环境中部署和管理干洗系统后端服务。

**管理的服务列表**：

1. **dry-cleaning-backend** - 主后端API服务（端口 3000）
2. **mqtt-broker** - MQTT消息Broker服务（端口 1884）

## 🎯 PM2 的优势

- ✅ **自动重启** - 服务崩溃后自动恢复
- ✅ **开机自启** - 服务器重启后自动启动
- ✅ **日志管理** - 自动管理日志文件
- ✅ **进程监控** - 实时监控CPU和内存使用
- ✅ **负载均衡** - 支持多实例部署
- ✅ **零宕机部署** - 支持无缝更新

## 🚀 快速开始

### 1. 安装 PM2

```bash
npm install -g pm2
```

### 2. 启动服务

**方式一：使用脚本（推荐）**
```bash
双击运行：启动PM2服务.bat
```

**方式二：命令行启动**
```bash
pm2 start ecosystem.config.js
```

### 3. 设置开机自启动

**方式一：使用脚本（推荐）**
```bash
双击运行：启动PM2服务.bat autostart
```

**方式二：手动命令**
```bash
pm2 startup      # 生成启动命令
pm2 save         # 保存当前进程列表
```

## 📝 常用命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `pm2 start` | 启动服务 | `pm2 start ecosystem.config.js` |
| `pm2 list` | 查看所有进程 | `pm2 list` |
| `pm2 logs` | 查看日志 | `pm2 logs dry-cleaning-backend` |
| `pm2 restart` | 重启服务 | `pm2 restart dry-cleaning-backend` |
| `pm2 stop` | 停止服务 | `pm2 stop dry-cleaning-backend` |
| `pm2 delete` | 删除进程 | `pm2 delete dry-cleaning-backend` |
| `pm2 monit` | 监控面板 | `pm2 monit` |

## 🔧 使用启动脚本

双击 `启动PM2服务.bat`，然后输入数字选择操作：

```
========================================
  干洗系统 - PM2服务管理
========================================

可用操作：
  1. start      - 启动服务
  2. stop       - 停止服务
  3. restart    - 重启服务
  4. logs       - 查看日志
  5. status     - 查看状态
  6. autostart  - 设置开机自启动
  7. delete     - 删除服务
```

## 📊 监控和管理

### 查看服务状态
```bash
pm2 list
```

输出示例：
```
┌─────┬────────────────────┬──────────┬──────┬─────────�───────┬──────────────┐
│ id  │ name               │ mode     │ ↺    │ status  │ cpu  │ memory      │
├─────┼────────────────────┼──────────┼──────┼─────────┼───────┼─────────────┤
│ 0   │ dry-cleaning-backend │ fork    │ 0    │ online  │ 0.5% │ 125 MB      │
└─────┴────────────────────┴──────────┴──────┴─────────┴───────┴─────────────┘
```

### 查看实时日志
```bash
# 查看后端日志
pm2 logs dry-cleaning-backend --lines 100

# 查看MQTT Broker日志
pm2 logs mqtt-broker --lines 100

# 查看所有日志
pm2 logs --lines 100
```

### 监控面板
```bash
pm2 monit
```

## 🔒 生产环境配置

### 配置文件说明

`ecosystem.config.js` 已配置以下功能：

1. **自动重启**
   - 进程崩溃时自动重启
   - 最多重启10次
   - 重启延迟：4秒

2. **内存限制**
   - 内存超过 500MB 时自动重启
   - 防止内存泄漏导致服务器问题

3. **日志管理**
   - 日志文件位置：`./logs/`
   - 自动日志轮转
   - 错误日志分离

4. **环境变量**
   - NODE_ENV: production
   - PORT: 3000

### 自定义配置

编辑 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [{
    name: 'dry-cleaning-backend',
    script: 'server.js',
    cwd: './backend',
    
    // 实例数量（CPU核心数）
    instances: 4,  // 生产环境可增加
    
    // 内存限制
    max_memory_restart: '1G',  // 根据服务器配置调整
    
    // 环境变量
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // 其他配置...
  }]
};
```

## 🛡️ 安全建议

### 1. 使用防火墙
```bash
# 只允许特定IP访问
iptables -A INPUT -p tcp -s 192.168.1.0/24 --dport 3000 -j ACCEPT
iptables -A INPUT -p tcp --dport 3000 -j DROP
```

### 2. 使用 Nginx 反向代理
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. 使用 PM2 Cluster 模式
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'dry-cleaning-backend',
    script: 'server.js',
    instances: 'max',  // 最大实例数
    exec_mode: 'cluster',  // 集群模式
  }]
};
```

## 🔄 更新和部署

### 无缝更新步骤

1. 上传新代码
2. 重启服务：
```bash
pm2 restart dry-cleaning-backend
```

### 优雅重启（零宕机）
```bash
pm2 reload dry-cleaning-backend
```

## 📞 故障排除

### 查看详细错误
```bash
pm2 logs dry-cleaning-backend --err --lines 50
```

### 重置PM2进程列表
```bash
pm2 reset
```

### 查看所有日志
```bash
pm2 logs --lines 200
```

### 完全清理
```bash
pm2 kill
pm2 reset
```

## 🌐 访问服务

启动后，通过以下地址访问：

- **API端点**: http://localhost:3000
- **健康检查**: http://localhost:3000/api/health
- **前端页面**: http://localhost:3000/index.html
- **MQTT Broker**: mqtt://localhost:1884
- **WebSocket**: ws://localhost:8084 (可选，需要设置 ENABLE_WS=true)

## ❓ 常见问题

### Q: 如何查看服务是否正常运行？
```bash
pm2 list
```
状态显示 `online` 表示正常运行。

### Q: 如何设置开机自启动？
```bash
pm2 startup
pm2 save
```
Linux: 会提示需要运行的命令，复制执行即可。
Windows: 使用 `pm2-service-install`。

### Q: 日志文件太大怎么办？
PM2会自动管理日志，如果需要手动清理：
```bash
pm2 flush  # 清空所有日志
```

### Q: 如何限制CPU使用？
编辑 `ecosystem.config.js`：
```javascript
max_cpu_restart: 80  // CPU超过80%时重启
```

### Q: 服务崩溃后如何查看原因？
```bash
pm2 logs --err --lines 100
```

## 📚 参考资源

- [PM2官方文档](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [PM2 Plus 监控](https://pm2.io/)
- [PM2 Cluster模式](https://pm2.keymetrics.io/docs/usage/cluster-mode/)

---

**生成日期**: 2026-05-07
**版本**: 1.0
