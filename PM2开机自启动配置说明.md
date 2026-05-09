# PM2 开机自启动配置说明

## ✅ 当前状态

所有服务已成功配置并运行：

| 服务 | 状态 | 端口 | PID |
|------|------|------|-----|
| **后端服务** | ✅ 运行中 | 3000 | 9424 |
| **MQTT Broker** | ✅ 运行中 | 1884 | 21400 |

## 📋 已完成的配置

### 1. PM2 进程管理
- ✅ 后端服务：`dry-cleaning-backend` (server.js)
- ✅ MQTT Broker：`mqtt-broker` (production-broker.js)
- ✅ 进程列表已保存：`C:\Users\zh\.pm2\dump.pm2`

### 2. Windows 开机自启动
- ✅ 启动脚本：`PM2开机自启动.bat`
- ✅ 快捷方式：`C:\Users\zh\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\PM2_AutoStart.lnk`

## 🔧 开机自启动工作原理

1. **Windows 启动时**：自动运行 `PM2_AutoStart.lnk` 快捷方式
2. **快捷方式调用**：`PM2开机自启动.bat` 脚本
3. **PM2 恢复**：`pm2 resurrect` 命令从 `dump.pm2` 恢复所有进程
4. **服务启动**：
   - `dry-cleaning-backend` (后端API)
   - `mqtt-broker` (MQTT消息服务)

## 📝 常用命令

### PM2 管理命令
```bash
# 查看服务状态
pm2 list

# 查看日志
pm2 logs

# 查看后端日志
pm2 logs dry-cleaning-backend

# 查看MQTT日志
pm2 logs mqtt-broker

# 重启所有服务
pm2 restart all

# 重启单个服务
pm2 restart dry-cleaning-backend

# 停止所有服务
pm2 stop all

# 手动保存当前状态（重要！）
pm2 save
```

### 端口检查
```bash
# 检查端口是否监听
netstat -ano | findstr ":3000"
netstat -ano | findstr ":1884"
```

## 🔍 故障排除

### 问题 1：开机后服务未启动
**检查步骤**：
1. 确认快捷方式存在：
   ```bash
   dir "C:\Users\zh\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup"
   ```

2. 手动运行启动脚本：
   ```bash
   cd "d:\Trae CN\bin\dry_cleaning_system"
   "PM2开机自启动.bat"
   ```

3. 检查PM2状态：
   ```bash
   pm2 list
   ```

### 问题 2：PM2 未保存进程列表
**解决方法**：
```bash
pm2 save
```

### 问题 3：端口被占用
**检查端口占用**：
```bash
netstat -ano | findstr ":3000"
netstat -ano | findstr ":1884"
```

**停止占用进程**：
```bash
taskkill /PID <进程ID> /F
```

### 问题 4：PM2 命令不存在
**重新安装 PM2**：
```bash
npm install -g pm2
```

## ⚙️ 修改 PM2 配置

如需修改服务配置（如端口、环境变量等）：

1. 编辑 `ecosystem.config.js` 文件
2. 删除旧进程：
   ```bash
   pm2 delete all
   ```
3. 重新启动：
   ```bash
   pm2 start ecosystem.config.js
   ```
4. 保存配置：
   ```bash
   pm2 save
   ```

## 📊 MQTT Broker 信息

### 端口配置
- **MQTT 端口**：1884（配置中默认端口）
- **WebSocket 端口**：8084（可选，需要设置 `ENABLE_WS=true`）

### 认证信息（生产环境）
默认测试账号：
- 用户名：`admin`，密码：`admin123`
- 用户名：`store1`，密码：`store123`

> ⚠️ 生产环境建议修改默认密码或禁用认证

### 连接地址
```
mqtt://localhost:1884
```

## 🎯 验证开机自启动

### 测试方法
1. **保存当前状态**：
   ```bash
   pm2 save
   ```

2. **重启电脑**

3. **检查服务状态**：
   - 打开浏览器访问：http://localhost:3000
   - 检查PM2状态：`pm2 list`
   - 测试MQTT连接：使用 MQTT.fx 或其他客户端连接到 `mqtt://localhost:1884`

## 📌 注意事项

1. **定期保存配置**：
   ```bash
   pm2 save
   ```
   每次修改服务配置后都需要执行此命令。

2. **不要直接杀死 PM2 进程**：
   使用 `pm2 stop` 而非 `taskkill` 停止服务。

3. **备份配置**：
   定期备份 `ecosystem.config.js` 和 `C:\Users\zh\.pm2` 目录。

4. **监控日志**：
   定期检查日志文件，及时发现和解决问题。

## 📞 相关信息

- **项目路径**：`d:\Trae CN\bin\dry_cleaning_system`
- **后端代码**：`backend/server.js`
- **MQTT Broker**：`backend/production-broker.js`
- **PM2 配置**：`ecosystem.config.js`
- **PM2 数据目录**：`C:\Users\zh\.pm2`

---

**最后更新**：2026年5月9日
**版本**：v1.0
