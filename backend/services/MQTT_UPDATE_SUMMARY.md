# 智能灯条 MQTT 系统 - 文件更新总结

## 📅 更新时间: 2026-04-23

---

## 1. 新增文件清单

### 1.1 MQTT 服务核心文件

| 文件路径 | 说明 | 大小 |
|----------|------|------|
| `backend/services/lightService.js` | MQTT 服务类，实现灯条控制逻辑 | 10.2 KB |
| `backend/services/MQTT_DEPLOYMENT.md` | MQTT Broker 部署指南 | ~15 KB |
| `backend/services/start-mqtt.bat` | Windows 一键启动脚本 | ~2 KB |
| `backend/services/start-mqtt.sh` | Linux/Mac 一键启动脚本 | ~2 KB |

### 1.2 配置文件更新

| 文件路径 | 更新内容 |
|----------|----------|
| `backend/package.json` | 添加 `mqtt` 依赖 (^5.5.0) |
| `backend/.env` | 添加 MQTT 环境变量配置 |
| `backend/.env.example` | 添加 MQTT 配置示例 |

### 1.3 后端代码更新

| 文件路径 | 更新内容 |
|----------|----------|
| `backend/modules/admin/services/adminService.js` | 新增 3 个方法 |
| `backend/modules/admin/routes/adminRoutes.js` | 新增 4 个 API 路由 |
| `admin.html` | 新增 MQTT 状态显示和配置面板 |

---

## 2. 后端新增 API 端点

### 2.1 灯条管理 API

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/admin/store/:storeId/mqtt-config` | 获取门店 MQTT 配置 |
| GET | `/api/admin/store/:storeId/light-connection` | 检查灯条连接状态 |
| POST | `/api/admin/store/:storeId/light-all-off` | 关闭全部灯条 |

### 2.2 批量导入 API

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/admin/stores/import` | 批量导入门店 |

---

## 3. MQTT 服务功能清单

### 3.1 lightService.js 提供的方法

```javascript
// 连接管理
connect()                    // 连接到 MQTT Broker
disconnect()                 // 断开连接

// 灯条控制
lightOn(storeNo, params)     // 点亮灯条
lightOff(storeNo, params)   // 关闭灯条
lightBatch(storeNo, cmds)   // 批量控制
lightBlink(storeNo, params)  // 闪烁提醒
lightAllOff(storeNo)         // 全部关闭

// 订阅管理
subscribe(topic, callback)   // 订阅主题
publish(topic, message)      // 发布消息
```

### 3.2 灯条颜色定义

| 颜色 | 代码 | 用途 |
|------|------|------|
| 绿色 | `#4CAF50` | 正常/普通订单 |
| 橙色 | `#FF9800` | 紧急订单 |
| 红色 | `#F44336` | VIP 订单 |
| 蓝色 | `#2196F3` | 系统通知 |
| 紫色 | `#9C27B0` | 促销优惠 |
| 黄色 | `#FFEB3B` | 等待确认 |

---

## 4. 快速部署步骤

### 4.1 第一步：启动 MQTT Broker

**Windows 用户:**
```bash
cd backend/services
start-mqtt.bat
```

**Linux/Mac 用户:**
```bash
cd backend/services
chmod +x start-mqtt.sh
./start-mqtt.sh
```

**Docker 用户:**
```bash
docker run -d \
  --name emqx \
  -p 1883:1883 \
  -p 8083:8083 \
  -p 8883:8883 \
  -p 8084:8084 \
  -p 18083:18083 \
  emqx/emqx:latest
```

### 4.2 第二步：安装 MQTT 包

```bash
cd backend
npm install mqtt
```

### 4.3 第三步：验证连接

1. 访问控制台: http://localhost:18083
2. 使用 admin/public 登录
3. 检查后端日志，应该显示：
   ```
   [MQTT] 成功连接到 Broker
   [MQTT] 订阅成功
   ```

### 4.4 第四步：测试功能

1. 打开后台管理页面 (admin.html)
2. 进入"智能灯条系统"
3. 查看 MQTT 连接状态
4. 选择门店进行灯条控制测试

---

## 5. MQTT 主题设计

### 5.1 主题命名规范

```
干洗系统/{环境}/{门店编号}/{设备类型}/{动作}
```

示例：
```
dryclean/dev/ST26042301/light/control
dryclean/prod/ST26042301/light/status
```

### 5.2 核心主题列表

| 主题 | 方向 | 说明 |
|------|------|------|
| `dryclean/{env}/{storeNo}/light/control` | 后端→灯条 | 灯条控制命令 |
| `dryclean/{env}/{storeNo}/light/status` | 灯条→后端 | 状态上报 |
| `dryclean/{env}/{storeNo}/light/batch` | 后端→灯条 | 批量控制 |
| `dryclean/{env}/{storeNo}/light/heartbeat` | 灯条→后端 | 心跳保活 |
| `dryclean/{env}/{storeNo}/order/{orderId}/ready` | 后端→灯条 | 订单完成通知 |
| `dryclean/{env}/{storeNo}/order/{orderId}/picked` | 灯条→后端 | 取货确认 |

---

## 6. 端口分配表

| 端口 | 协议 | 用途 |
|------|------|------|
| 1883 | MQTT | 灯条控制主端口 |
| 8083 | WebSocket | Web 端连接 |
| 8883 | MQTT/SSL | 生产环境加密 |
| 8084 | WebSocket/SSL | 安全 Web 连接 |
| 18083 | HTTP | EMQX 管理控制台 |

---

## 7. 当前状态

### ✅ 已完成

- [x] MQTT 服务代码实现
- [x] 后端 API 集成
- [x] 前端界面更新
- [x] 配置文件更新
- [x] 部署文档编写
- [x] 快速启动脚本

### ⏳ 待部署

- [ ] MQTT Broker 服务
- [ ] 安装 mqtt npm 包
- [ ] 重启后端服务
- [ ] 验证连接状态

---

## 8. 故障排查

### 问题 1: MQTT 连接失败

**检查项:**
- [ ] MQTT Broker 是否启动
- [ ] 端口 1883 是否被占用
- [ ] 防火墙是否开放 1883 端口
- [ ] 用户名密码是否正确

**解决方案:**
```bash
# 检查端口占用
netstat -an | grep 1883

# 检查容器状态
docker ps | grep emqx

# 查看日志
docker logs emqx
```

### 问题 2: 后端连接失败

**检查项:**
- [ ] .env 文件是否配置正确
- [ ] mqtt 包是否安装成功
- [ ] 后端服务是否重启

**解决方案:**
```bash
# 重新安装依赖
cd backend
rm -rf node_modules
npm install

# 重启服务
npm start
```

---

## 9. 参考文档

- [EMQX 官方文档](https://www.emqx.io/docs/zh/)
- [MQTT 协议规范](https://mqtt.org/)
- [MQTT.js 客户端库](https://github.com/mqttjs/MQTT.js)

---

**文档版本**: v1.0  
**创建时间**: 2026-04-23  
**最后更新**: 2026-04-23
