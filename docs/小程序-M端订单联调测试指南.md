# 小程序 ↔ M端 订单联调测试指南

## 概述

本文档说明如何测试**微信小程序下单 → M端（m-index.html）接单处理 → 小程序查看状态更新**的完整订单流程。

小程序作为**纯C端**，商家操作在**M端**完成，两端的订单数据通过 MongoDB 共享，状态变更通过 MQTT 实时同步。

---

## 数据流架构

```
┌──────────────┐     POST /api/cleaning/orders      ┌──────────────┐
│  微信小程序    │ ──────────────────────────────────→ │   后端 Node   │
│  (C端用户)    │                                    │   (Port 3000) │
│              │ ←────────────────────────────────── │              │
│              │     GET /api/cleaning/orders/:id    │              │
└──────────────┘     (轮询获取最新状态)               └──────┬───────┘
                                                     │         │
                                            MQTT发布事件      │ MongoDB
                                            dryclean/orders/  │ 读写
                                            {storeId}/update  │
                                                     │         │
┌──────────────┐     MQTT WebSocket 订阅            │         │
│  M端          │ ←──────────────────────────────────┘         │
│  (m-index)   │                                            │
│  商家管理界面  │ ──── POST /api/cleaning/orders/:id/receive ──→│
│              │      POST /api/cleaning/orders/:id/processing │
│              │      POST /api/cleaning/orders/:id/complete   │
│              │      POST /api/cleaning/orders/:id/pickup     │
└──────────────┘
```

## 订单状态流转

```
pending → paid → delivering → received → processing → ready → delivering_back → completed
                  ↘ (cancelled)                                         ↑
                                              └── 用户选择取件方式 ──┘
```

| 状态 | 触发方 | API | 说明 |
|------|--------|-----|------|
| pending | 小程序 | POST /cleaning/orders | 用户下单 |
| paid | 小程序 | POST /cleaning/orders/:id/pay | 用户支付 |
| delivering | M端 | POST /cleaning/orders/:id/delivering | 配送取件 |
| received | M端 | POST /cleaning/orders/:id/receive | 门店入库 |
| processing | M端 | POST /cleaning/orders/:id/processing | 开始清洗 |
| ready | M端 | POST /cleaning/orders/:id/complete | 清洗完成待取件 |
| completed | 小程序/M端 | POST /cleaning/orders/:id/pickup | 用户取件 |

---

## 测试步骤

### 前提条件

1. **后端服务**运行中（`http://192.168.1.5:3000`）
2. **EMQX**运行中（WSL Ubuntu，端口 1883/8083/18083）
3. **M端页面**可访问（`http://192.168.1.5:3000/m-index.html` 或本地文件）

### Step 1: M端登录商家账号

1. 浏览器打开 `m-index.html`
2. 选择门店账号登录（例如 **ST001 - 朝阳区干洗店**）
3. 确认MQTT连接状态：控制台应显示 `[订单事件] ✅ 已连接到 EMQX`

> **关键**：M端登录的门店ID必须与小程序下单选择的门店一致。小程序默认门店列表中 ST001/ST002/ST003 对应M端可登录的门店。

### Step 2: 小程序下单

1. 在微信开发者工具中打开小程序
2. 首页 → 选择服务（如"西装干洗"）
3. 选择门店 → **选择与M端登录门店一致的门店**（如 ST001）
4. 选择配送方式 → 填写信息 → 确认支付
5. 支付使用模拟支付即可

### Step 3: M端查看新订单

1. 切换到M端浏览器
2. 如果MQTT正常，订单列表会**自动刷新**显示新订单
3. 如果MQTT未连接，手动下拉刷新

**验证点**：
- M端"新订单"Tab中应出现小程序创建的订单
- 订单号、金额、服务项目与小程序端一致
- 控制台显示 `[订单事件] 收到事件: order_created`

### Step 4: M端处理订单（完整流程）

按照以下顺序操作：

1. **确认入库** → 订单状态变为 `received`
2. **开始处理** → 订单状态变为 `processing`  
3. **完成处理** → 订单状态变为 `ready`

每次操作后：
- M端控制台应显示 `[订单事件] 已发布 order_status_changed`
- 小程序端下次轮询（3秒间隔）会看到状态更新

### Step 5: 小程序端确认取件

1. 回到小程序订单详情页
2. 状态应已变为"待取件"
3. 选择取件方式（到店自提/配送到家）
4. 确认取件 → 订单完成

### Step 6: 验证同步

- M端订单列表中订单状态应变为"已完成"
- 小程序订单列表中显示"已完成"
- 两端数据一致

---

## 常见问题排查

### 1. M端看不到小程序的订单

**原因**：门店ID不匹配

**排查**：
- 小程序下单时选择的门店 `storeId`（如 `ST001`）
- M端登录的门店 `storeId`（侧边栏显示）
- 两者必须一致

**查看数据库**：
```bash
# 在WSL中
mongosh
use drycleaning
db.orders.find({}, {orderNo:1, storeId:1, status:1, userId:1})
```

### 2. 小程序看不到M端操作后的状态变化

**原因**：小程序订单详情页通过轮询获取状态，间隔3秒

**排查**：
- 确认后端API正常：`curl http://192.168.1.5:3000/api/cleaning/orders/{orderNo}`
- 检查小程序控制台是否有轮询日志
- 确认 `loadOrderDetail()` 是否正常调用

### 3. MQTT事件未同步

**排查步骤**：
1. 检查EMQX是否运行：浏览器访问 `http://localhost:18083`（admin/public）
2. 检查后端MQTT连接：`[lightService] MQTT 连接成功`
3. 检查M端MQTT连接：控制台 `[订单事件] ✅ 已连接到 EMQX`
4. EMQX管理面板 → WebSocket 页面，手动订阅 `dryclean/orders/+/update` 测试

### 4. 小程序支付后订单状态未更新

**排查**：
- 小程序 `onConfirmPayment()` 中调用 `/cleaning/orders/{id}/pay`
- 检查后端 `payOrder()` 是否执行成功
- 支付使用模拟支付（mockPay），90%成功率，可重试

---

## API 速查

### 小程序端使用的API

| API | 方法 | 说明 |
|-----|------|------|
| `/cleaning/services` | GET | 获取服务列表 |
| `/cleaning/stores` | GET | 获取门店列表 |
| `/cleaning/orders` | POST | 创建订单 |
| `/cleaning/orders/:id` | GET | 查询订单详情 |
| `/cleaning/orders/:id/pay` | POST | 支付订单 |
| `/cleaning/orders/:id/cancel` | POST | 取消订单 |
| `/cleaning/orders/:id/pickup` | POST | 确认取件 |
| `/cleaning/orders/:id/pickup-method` | POST | 选择取件方式 |
| `/cleaning/orders` | GET | 订单列表(按userId) |

### M端使用的API

| API | 方法 | 说明 |
|-----|------|------|
| `/cleaning/orders?storeId=ST001` | GET | 查询门店订单 |
| `/cleaning/orders/:id/receive` | POST | 确认入库 |
| `/cleaning/orders/:id/processing` | POST | 开始处理 |
| `/cleaning/orders/:id/complete` | POST | 完成处理 |
| `/cleaning/orders/:id/pickup` | POST | 确认取件 |
| `/cleaning/orders/:id/delivering` | POST | 设置配送中 |
| `/cleaning/orders/:id/status` | PUT | 通用状态更新 |

### MQTT 事件主题

| 主题 | 说明 | 订阅方 |
|------|------|--------|
| `dryclean/orders/{storeId}/update` | 门店级订单事件 | M端 |
| `dryclean/orders/all/update` | 全局订单事件 | Admin端 |
