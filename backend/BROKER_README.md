# MQTT Broker 使用指南

## 📁 文件说明

### 测试脚本（开发/调试用）
1. **minimal-broker.js** - 极简版（无认证）
   - 用于快速测试 MQTT 连接
   - **⚠️ 不适合生产环境**

2. **simple-broker-test.js** - 带认证测试版
   - 用于验证认证功能
   - **⚠️ 不适合生产环境**

3. **production-broker.js** - ⭐生产级别推荐
   - 完整的认证和授权
   - 错误处理和日志
   - WebSocket 支持（可选）
   - **✅ 推荐用于生产**

### 启动脚本
- **restart-mqtt.bat** - 重启 MQTT Broker
- **test-new-broker.bat** - 测试新 Broker

---

## 🚀 生产环境部署

### 1. 启动生产级 Broker
```bash
cd backend
node production-broker.js
```

### 2. 配置认证（可选）
默认启用认证，测试账号：
- 用户名: `admin`, 密码: `admin123`
- 用户名: `store1`, 密码: `store123`

**修改密码**：
```bash
# 方式1：环境变量
set MQTT_USERS=user1:pass1,user2:pass2
node production-broker.js

# 方式2：直接编辑 production-broker.js 中的 CONFIG.AUTHENTICATION.users
```

### 3. 禁用认证（仅测试用）
```bash
set MQTT_AUTH_ENABLED=false
node production-broker.js
```

### 4. 启用 WebSocket 支持
```bash
set ENABLE_WS=true
node production-broker.js
```

---

## 🔧 配置文件

编辑 `production-broker.js` 中的 `CONFIG` 对象：

```javascript
const CONFIG = {
  MQTT_PORT: 1884,              // MQTT 端口
  WS_PORT: 8084,                // WebSocket 端口
  AUTHENTICATION: {
    enabled: true,              // 启用认证
    users: [                    // 用户列表
      { username: 'admin', password: 'admin123' },
      { username: 'store1', password: 'store123' }
    ]
  }
};
```

---

## 🔒 安全建议

1. **修改默认密码**
   ```javascript
   // 在 production-broker.js 中修改
   users: [
     { username: 'admin', password: 'your_strong_password' }
   ]
   ```

2. **启用 TLS/SSL**（生产环境推荐）
   - 需要配置证书
   - 端口改为 8883

3. **限制主题访问**
   ```javascript
   // 在 authorizePublish/authorizeSubscribe 中添加逻辑
   authorizePublish: (client, topic, payload, callback) => {
     // 只允许用户发布自己的主题
     if (!topic.startsWith(`dryclean/${client.user}/`)) {
       callback(new Error('未授权'));
       return;
     }
     callback(null);
   }
   ```

4. **添加连接限制**
   - 防止过多并发连接
   - 添加 IP 白名单

---

## 📊 日志说明

启动后看到：
```
========================================
  🚀 MQTT Broker (生产级)
========================================
  MQTT:    mqtt://localhost:1884
  认证:    启用
========================================
```

客户端连接时：
```
[认证] 客户端: client_id, 用户: username
[认证成功] username from client_id
[连接] username (client_id)
```

---

## 🧪 测试连接

### 使用 npm mqtt 库
```javascript
const mqtt = require('mqtt');

const client = mqtt.connect('mqtt://localhost:1884', {
  clientId: 'myClient',
  username: 'admin',
  password: 'admin123'
});

client.on('connect', () => {
  console.log('连接成功！');
  client.subscribe('test');
});

client.on('message', (topic, message) => {
  console.log('收到:', message.toString());
});
```

### 使用 mosquitto 客户端
```bash
# 发布
mosquitto_pub -h localhost -p 1884 -u admin -P admin123 -t test -m "Hello"

# 订阅
mosquitto_sub -h localhost -p 1884 -u admin -P admin123 -t test
```

---

## ❓ 常见问题

**Q: 端口被占用？**
```
A: 停止占用端口的进程，或修改 MQTT_PORT 环境变量
```

**Q: 认证失败？**
```
A: 检查用户名和密码是否正确，确认 AUTHENTICATION.enabled = true
```

**Q: 客户端连接超时？**
```
A: 检查防火墙设置，确认端口 1884 可访问
```

---

## 📞 技术支持

如有问题，请提供：
1. Broker 启动日志
2. 客户端连接错误信息
3. `netstat -ano | findstr ":1884"` 输出
