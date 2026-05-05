# MQTT Broker 部署指南

## 📋 文档信息

- **版本**: v1.0
- **日期**: 2026-04-23
- **状态**: 待部署
- **适用范围**: 干洗门店智能灯条系统

---

## 1. 环境要求

### 1.1 硬件要求

| 配置 | 最低要求 | 推荐配置 |
|------|----------|----------|
| CPU | 1 Core | 2+ Cores |
| 内存 | 512MB | 2GB+ |
| 磁盘 | 5GB | 20GB+ SSD |
| 网络 | 100Mbps | 1Gbps |

### 1.2 软件要求

- **操作系统**: Ubuntu 20.04+ / CentOS 7+ / Windows Server 2019+
- **Docker**: 20.10+ (推荐使用Docker部署)
- **Node.js**: 16+ (后端服务)
- **MongoDB**: 5.0+ (已有)

---

## 2. 快速部署（Docker）

### 2.1 安装 Docker

**Ubuntu:**
```bash
curl -fsSL https://get.docker.com | bash
sudo usermod -aG docker $USER
```

**CentOS:**
```bash
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
```

### 2.2 启动 EMQX Broker

```bash
# 创建网络
docker network create dryclean-net

# 启动 EMQX
docker run -d \
  --name emqx \
  --network dryclean-net \
  -p 1883:1883 \
  -p 8083:8083 \
  -p 8883:8883 \
  -p 8084:8084 \
  -p 18083:18083 \
  -e EMQX_LOADED_PLUGINS="emqx_management,emqx_dashboard" \
  -e EMQX_DASHBOARD__DEFAULT_USERNAME=admin \
  -e EMQX_DASHBOARD__DEFAULT_PASSWORD=public \
  emqx/emqx:latest
```

### 2.3 验证部署

```bash
# 检查容器状态
docker ps | grep emqx

# 访问控制台
# 浏览器打开: http://localhost:18083
# 用户名: admin
# 密码: public
```

---

## 3. Windows 本地部署

### 3.1 下载 EMQX

1. 访问: https://www.emqx.io/downloads
2. 下载 Windows 版本 (ZIP包)
3. 解压到 `C:\Program Files\emqx`

### 3.2 启动服务

```powershell
# 进入目录
cd "C:\Program Files\emqx\bin"

# 启动 EMQX
.\emqx start

# 检查状态
.\emqx_ctl status
```

### 3.3 访问控制台

```
http://localhost:18083
用户名: admin
密码: public
```

---

## 4. 配置 MQTT 连接

### 4.1 创建 .env 文件

在后端项目根目录创建 `.env` 文件：

```env
# MQTT 配置
MQTT_BROKER=mqtt://localhost:1883
MQTT_USERNAME=admin
MQTT_PASSWORD=public

# WebSocket 端口
MQTT_WS_PORT=8083
```

### 4.2 安装 MQTT Node.js 包

```bash
cd backend
npm install mqtt
```

### 4.3 验证连接

启动后端服务，检查日志：

```
[MQTT] 成功连接到 Broker
[MQTT] 订阅成功: dryclean/+/+/light/status
```

---

## 5. EMQX 高级配置

### 5.1 用户认证

通过控制台配置：

1. 访问 http://localhost:18083
2. 进入 **访问控制** → **认证**
3. 创建用户名密码认证

### 5.2 SSL/TLS 配置（生产环境）

```yaml
# emqx.conf 配置
listener.ssl.external.enable = true
listener.ssl.external.keyfile = /etc/emqx/certs/server.key
listener.ssl.external.certfile = /etc/emqx/certs/server.crt
listener.ssl.external.cafile = /etc/emqx/certs/ca.crt
```

### 5.3 WebHook 配置

配置 EMQX 将消息转发到后端：

```bash
# 进入控制台
# 路径: 访问控制 → Webhook
```

---

## 6. 测试 MQTT 连接

### 6.1 使用 MQTT.js 客户端测试

```javascript
const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://localhost:1883', {
  clientId: 'test_client',
  username: 'admin',
  password: 'public'
});

client.on('connect', () => {
  console.log('✅ MQTT 连接成功');
  
  // 订阅主题
  client.subscribe('dryclean/+/+/light/status', (err) => {
    if (!err) {
      console.log('✅ 订阅成功');
    }
  });
});

client.on('message', (topic, message) => {
  console.log(`📩 收到消息 [${topic}]:`, message.toString());
});

// 发送测试消息
client.publish('dryclean/prod/TEST001/light/control', JSON.stringify({
  action: 'light_on',
  payload: { positions: ['A1'], color: '#4CAF50' }
}));
```

### 6.2 使用 MQTTX 工具测试

1. 下载: https://mqttx.app/downloads
2. 配置连接:
   - Broker: mqtt://localhost:1883
   - Username: admin
   - Password: public
3. 订阅主题: `dryclean/#`
4. 发送测试消息

---

## 7. 生产环境部署

### 7.1 服务器要求

```yaml
推荐配置:
- CPU: 4 Cores+
- 内存: 8GB+
- 磁盘: 50GB+ SSD
- 网络: 公网IP + 域名
```

### 7.2 Docker Compose 部署

创建 `docker-compose.yml`:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:5.0
    container_name: dryclean-mongodb
    restart: always
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    networks:
      - dryclean-net

  emqx:
    image: emqx/emqx:latest
    container_name: dryclean-emqx
    restart: always
    ports:
      - "1883:1883"
      - "8083:8083"
      - "8883:8883"
      - "8084:8084"
      - "18083:18083"
    environment:
      - EMQX_LOADED_PLUGINS=emqx_management,emqx_dashboard
      - EMQX_DASHBOARD__DEFAULT_USERNAME=admin
      - EMQX_DASHBOARD__DEFAULT_PASSWORD=${EMQX_PASSWORD}
    networks:
      - dryclean-net

  backend:
    image: node:18-alpine
    container_name: dryclean-backend
    restart: always
    working_dir: /app
    volumes:
      - ./backend:/app
    ports:
      - "3000:3000"
    command: sh -c "npm install && npm start"
    depends_on:
      - mongodb
      - emqx
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongodb:27017/dry_cleaning
      - MQTT_BROKER=mqtt://emqx:1883
      - MQTT_USERNAME=admin
      - MQTT_PASSWORD=${EMQX_PASSWORD}
    networks:
      - dryclean-net

networks:
  dryclean-net:
    driver: bridge

volumes:
  mongodb_data:
```

启动：

```bash
# 设置环境变量
export EMQX_PASSWORD=your_secure_password

# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

---

## 8. 监控与维护

### 8.1 EMQX 控制台

访问: http://localhost:18083 (或服务器IP:18083)

功能:
- 实时连接数监控
- 消息吞吐量统计
- 主题订阅管理
- 用户认证管理
- 日志查看

### 8.2 日志查看

```bash
# Docker 日志
docker logs emqx

# 实时跟踪
docker logs -f emqx
```

### 8.3 常见问题排查

| 问题 | 解决方案 |
|------|----------|
| 连接被拒绝 | 检查防火墙/端口是否开放 |
| 认证失败 | 确认用户名密码正确 |
| 消息丢失 | 检查 QoS 设置，提高到 QoS 1 或 2 |
| 性能问题 | 增加服务器资源，调整 EMQX 配置 |

---

## 9. 安全建议

### 9.1 生产环境必做

1. **修改默认密码**
   - 登录 EMQX 控制台
   - 修改 admin 密码

2. **启用 SSL/TLS**
   - 申请 SSL 证书
   - 配置 8883 端口使用 SSL

3. **配置防火墙**
   ```bash
   # 只开放必要端口
   sudo ufw allow 1883   # MQTT
   sudo ufw allow 8083   # WebSocket
   sudo ufw allow 443    # HTTPS
   sudo ufw allow 18083  # 管理界面(限制IP访问)
   ```

4. **定期备份配置**
   ```bash
   docker exec emqx emqx ctl conf export /tmp/emqx_conf.json
   docker cp emqx:/tmp/emqx_conf.json ./backups/
   ```

---

## 10. 快速检查清单

部署完成后，确认以下项目：

- [ ] EMQX 容器运行中
- [ ] 控制台可访问 (http://localhost:18083)
- [ ] 可使用 admin/public 登录
- [ ] 端口 1883、8083 已开放
- [ ] 后端服务已安装 mqtt 包
- [ ] `.env` 文件已配置
- [ ] 后端日志显示 MQTT 连接成功
- [ ] 前端页面显示 MQTT 已连接

---

## 11. 联系与支持

如有问题，请检查:

1. **日志文件**: `backend/logs/` 或 Docker 日志
2. **EMQX 文档**: https://www.emqx.io/docs/zh/
3. **MQTT 协议**: https://mqtt.org/

---

**创建时间**: 2026-04-23  
**最后更新**: 2026-04-23  
**版本**: v1.0
