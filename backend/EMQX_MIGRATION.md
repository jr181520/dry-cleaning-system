# EMQX 迁移指南

## 从 Aedes (1884) 迁移到 EMQX (1883)

### 背景
Aedes 在某些环境下存在 `connack timeout` 问题，推荐使用更稳定的 EMQX Broker。

### 迁移步骤

#### 1. 启动 EMQX
```bash
cd C:\EMQX
emqx-edge start
```

#### 2. 修改配置文件

需要将所有配置从端口 `1884` 改为 `1883`：

**backend/.env**
```env
MQTT_BROKER=mqtt://localhost:1883
```

**backend/modules/admin/services/adminService.js**
```javascript
mqttEndpoint: {
  broker: process.env.MQTT_BROKER || 'mqtt://localhost:1883',
  port: 1883,
  // ...
}
```

#### 3. 修改前端 HTML 文件

所有 HTML 文件中的 MQTT 连接地址：
```javascript
// 旧代码
const broker = 'mqtt://localhost:1884';

// 新代码
const broker = 'mqtt://localhost:1883';
```

#### 4. 使用全局搜索替换

在项目中搜索 `1884`，替换为 `1883`：
- `admin.html`
- `index.html`
- `m-index.html`
- `.env`

#### 5. 重启所有服务

```bash
# 1. 停止旧 Broker
# 在 Broker 窗口按 Ctrl+C

# 2. 确保 EMQX 正在运行
cd C:\EMQX
emqx-edge start

# 3. 重启后端
cd backend
npm start
```

### EMQX 管理

- **Web 界面**: http://localhost:18083
- **默认账号**: admin / public
- **MQTT 端口**: 1883
- **WebSocket 端口**: 8083

### 测试命令

```bash
# 测试 MQTT 连接
node backend/test-emqx.bat
```

### 回滚方案

如果 EMQX 也有问题，可以同时运行两个 Broker：
- EMQX: 端口 1883
- Aedes: 端口 1884

这样可以逐步迁移。
