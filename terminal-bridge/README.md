# 智能灯条系统 - 完整架构说明

## 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           智能灯条系统架构                                │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐           ┌──────────────────┐
│   admin.html     │           │   index.html     │
│   (后台管理系统)   │           │   (门店端系统)    │
└────────┬─────────┘           └────────┬─────────┘
         │ HTTP API                           │ HTTP API
         ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Node.js Backend                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │ adminRoutes.js  │  │ adminService.js│  │ lightService.js │            │
│  │ (灯条控制API)   │  │ (业务逻辑)      │  │ (MQTT客户端)     │            │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘            │
└───────────┼────────────────────┼────────────────────┼────────────────────┘
            │                    │                    │
            │                    │ MQTT Publish       │
            └────────────────────┴────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     Nanomq MQTT Broker (端口1883)                        │
│                                                                          │
│  订阅主题:                                                               │
│    - dryclean/+/+/light              (终端主消息)                         │
│    - dryclean/+/+/light/status       (状态上报)                          │
│    - dryclean/+/+/light/heartbeat    (心跳)                              │
└──────────────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│   terminal-bridge.js     │   │   admin.html            │
│   (门店终端桥接程序)       │   │   (终端监控面板)         │
│                           │   │                          │
│  1. 订阅MQTT命令          │   │  1. 订阅MQTT状态         │
│  2. 调用WLED HTTP API     │   │  2. 显示终端状态         │
│  3. 上报心跳/状态         │   │  3. 实时监控灯条         │
│                           │   │                          │
│  ┌───────────────────┐   │   │  ┌────────────────────┐   │
│  │   WLED设备         │   │   │  │  后台管理员        │   │
│  │   (灯条控制器)     │   │   │  │  (控制命令)        │   │
│  └───────────────────┘   │   │  └────────────────────┘   │
└──────────────────────────┘   └──────────────────────────┘
                                 
```

## MQTT消息格式

### 控制命令 (后台 → 终端)
```json
Topic: dryclean/prod/{storeId}/light

// 点亮灯条
{
  "action": "on",
  "lightIds": ["A1", "B2"],
  "color": "green",
  "priority": "normal",
  "timestamp": 1745489400000
}

// 关闭灯条
{
  "action": "off",
  "lightIds": ["A1"],
  "timestamp": 1745489400000
}

// 全关
{
  "action": "all_off",
  "timestamp": 1745489400000
}

// 闪烁
{
  "action": "pulse",
  "color": "red",
  "timestamp": 1745489400000
}
```

### 心跳 (终端 → 后台)
```json
Topic: dryclean/prod/{storeId}/light/heartbeat

{
  "action": "terminal_heartbeat",
  "terminalId": "T_ST001_1745489000000",
  "storeId": "ST001",
  "lightId": "L001",
  "status": "online",
  "wledMac": "AABBCCDDEEFF",
  "timestamp": 1745489400000
}
```

### 状态上报 (终端 → 后台)
```json
Topic: dryclean/prod/{storeId}/light/status

{
  "action": "status_report",
  "terminalId": "T_ST001_1745489000000",
  "storeId": "ST001",
  "lightId": "L001",
  "wledStatus": {
    "state": { "on": true, "bri": 255 },
    "info": { "mac": "AABBCCDDEEFF" }
  },
  "timestamp": 1745489400000
}
```

## 文件说明

### 后端部分
| 文件 | 说明 |
|------|------|
| `backend/services/lightService.js` | MQTT客户端服务，连接Broker，发布/订阅消息 |
| `backend/modules/admin/services/adminService.js` | 灯条控制业务逻辑 |
| `backend/modules/admin/routes/adminRoutes.js` | 灯条控制API路由 |

### 前端部分
| 文件 | 说明 |
|------|------|
| `admin.html` | 后台管理系统，包含终端监控面板 |
| `index.html` | 门店端系统，通过LightControl API控制灯条 |

### 终端部分
| 文件 | 说明 |
|------|------|
| `terminal-bridge/terminal-bridge.js` | MQTT-WLED桥接程序（部署在门店） |
| `terminal-bridge/package.json` | 桥接程序依赖配置 |
| `terminal-bridge/启动终端桥接.bat` | Windows启动脚本 |

## 启动顺序

### 1. 启动MQTT Broker
```bash
& "C:\EMQX\emqx-edge.exe" start
```

### 2. 启动后端服务
```bash
cd d:\Trae CN\bin\dry_cleaning_system\backend
node server.js
```

### 3. 启动终端桥接（每家门店）
```bash
cd d:\Trae CN\bin\dry_cleaning_system\terminal-bridge
# 使用启动脚本
启动终端桥接.bat
# 或命令行
node terminal-bridge.js ST001 192.168.1.101
```

### 4. 访问前端
```
后台管理: http://localhost:3000/admin.html
门店端:   http://localhost:3000/index.html
```

## API接口

### 灯条控制API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/lights/:storeId/turn-on` | 点亮灯条 |
| POST | `/api/admin/lights/:storeId/turn-off` | 关闭灯条 |
| POST | `/api/admin/lights/:storeId/turn-on-all` | 全部点亮 |
| POST | `/api/admin/lights/:storeId/turn-off-all` | 全部关闭 |
| GET | `/api/admin/terminals` | 获取所有终端 |
| GET | `/api/admin/store/:storeId/terminal-lights` | 获取门店终端状态 |
| GET | `/api/admin/store/:storeId/light-connection` | 检查灯条连接状态 |

## 数据同步

### admin.html → index.html 同步
1. admin通过后台API发送MQTT命令
2. 命令发送到 `dryclean/prod/{storeId}/light`
3. 终端桥接订阅该主题，接收命令
4. 终端调用WLED API执行控制
5. 终端上报状态到 `dryclean/prod/{storeId}/light/status`
6. admin订阅状态主题，更新终端监控面板

### index.html → admin.html 同步
1. index通过LightControl API发送请求
2. 后台API处理请求，发送MQTT命令
3. 后续流程同上

## 故障排除

### 问题1: 终端监控面板无数据
检查：
- [ ] Nanomq Broker是否运行
- [ ] 后端是否成功连接MQTT
- [ ] 终端桥接程序是否运行
- [ ] 查看浏览器控制台MQTT连接状态

### 问题2: 灯条不响应
检查：
- [ ] 终端桥接程序是否连接到正确门店
- [ ] WLED设备IP是否正确
- [ ] WLED设备是否在线
- [ ] 查看终端桥接程序日志

### 问题3: admin和index不同步
检查：
- [ ] 两系统使用的是否为同一storeId
- [ ] MQTT Broker是否正常
- [ ] 后端服务是否运行

## 配置说明

### 终端桥接环境变量
| 变量 | 默认值 | 说明 |
|------|--------|------|
| MQTT_BROKER | mqtt://localhost:1883 | MQTT Broker地址 |
| MQTT_USERNAME | (空) | MQTT用户名 |
| MQTT_PASSWORD | (空) | MQTT密码 |
| MQTT_ENV | prod | 环境(dev/prod) |
| STORE_ID | ST001 | 门店编号 |
| WLED_IP | 192.168.1.101 | WLED设备IP |
