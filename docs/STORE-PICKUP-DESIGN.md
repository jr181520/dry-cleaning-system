# 门店自提完整流程设计方案

## 概述

本文档描述了干洗系统中"门店自提"功能的完整业务流程和技术实现方案。

## 业务流程图

```
用户端（C端）流程：
┌─────────────────────────────────────────────────────────────┐
│  1. 用户在线下单，选择「门店自提」                               │
│  2. 完成支付，订单状态: awaiting_store_confirm                │
│  3. 用户到店，扫描店铺二维码                                    │
│  4. C端展示「取件」按钮                                        │
│  5. 用户点击「到店取件」 → 发送灯条请求到M端                      │
│  6. M端灯条亮起，店员开始拣货                                   │
│  7. 店员操作「扫码出库/手动出库」                                │
│  8. 每个物品出库 → 对应灯条熄灭                                 │
│  9. 所有物品出库完成 → 订单状态变为 ready                       │
│  10. C端收到「物品已备好」通知                                  │
│  11. 用户确认取件 → 订单变为 completed                          │
└─────────────────────────────────────────────────────────────┘

门店端（M端）流程：
┌─────────────────────────────────────────────────────────────┐
│  1. 接收C端灯条请求（订单号、用户信息）                           │
│  2. 系统自动/手动激活对应订单的灯条                               │
│  3. 店员根据灯条指示拣货、打包                                   │
│  4. 扫码或手动扫描物品条码                                      │
│  5. 每个物品出库 → 对应灯条熄灭                                 │
│  6. 所有物品出库 → 订单变为「待取件」状态                        │
│  7. 用户到前台确认取件                                          │
│  8. 店员确认完成 → 订单变为已完成                                │
└─────────────────────────────────────────────────────────────┘
```

## 状态流转

### 订单状态

| 状态码 | 名称 | 说明 |
|--------|------|------|
| `awaiting_store_confirm` | 待门店确认 | 用户已支付，等待到店 |
| `ready` | 已备好 | 物品已备好，等待用户取件 |
| `completed` | 已完成 | 用户已取件 |

### 物品状态

| 状态码 | 名称 | 说明 |
|--------|------|------|
| `pending` | 待处理 | 初始状态 |
| `picked` | 已拣货 | 店员已拣货 |
| `checked_out` | 已出库 | 物品已交给用户 |

### 灯条状态

| 状态码 | 名称 | 说明 |
|--------|------|------|
| `off` | 熄灭 | 灯条关闭 |
| `on` | 亮起 | 灯条亮起 |
| `pulse` | 闪烁 | 灯条闪烁（提醒） |

## 数据结构

### 订单数据结构（扩展）

```javascript
{
  orderId: "DD123456789",
  deliveryMethod: "pickup",           // 配送方式：pickup=门店自提, courier=跑腿
  status: "awaiting_store_confirm",   // 订单状态
  items: [
    {
      name: "西装干洗",
      quantity: 1,
      price: 50,
      itemStatus: "pending"           // 物品状态
    }
  ],
  // 灯条绑定
  lightBindings: [
    {
      orderId: "DD123456789",
      itemIndex: 0,
      itemName: "西装干洗",
      lightId: "LIGHT_DD123456789_0",
      status: "on"
    }
  ]
}
```

### 灯条请求数据结构

```javascript
{
  type: "customer_arrival",           // 请求类型
  orderId: "DD123456789",            // 订单号
  storeId: "ST001",                  // 门店ID
  timestamp: 1704067200000,           // 时间戳
  customerId: "user_123",             // 用户ID
  status: "pending"                 // 请求状态
}
```

## 文件清单

### 核心文件

| 文件路径 | 说明 |
|---------|------|
| `js/store-pickup.js` | 门店自提核心逻辑（C端/M端共用） |
| `js/store-pickup-m.js` | M端门店自提订单管理 |
| `c-store-pickup.html` | C端扫码取件页面 |
| `m-index.html` | M端管理页面（需集成） |

### 修改的文件

| 文件路径 | 修改内容 |
|---------|---------|
| `m-index.html` | 添加门店自提订单管理区域 |
| `c-order-detail.html` | 添加门店自提状态显示和取件确认 |
| `js/order-sync.js` | 添加门店自提订单同步 |

## 技术实现

### 1. C端扫码取件页面 (`c-store-pickup.html`)

**功能列表：**
- 扫描店铺二维码
- 展示当前门店自提订单
- 「到店取件」按钮 → 触发灯条请求
- 订单完成通知

**关键代码：**
```javascript
// 触发取件请求
StorePickupManager.requestStorePickup(orderId, storeId);

// 确认取件
StorePickupManager.confirmPickup(orderId);
```

### 2. M端订单管理 (`m-index.html`)

**功能列表：**
- 待取件订单列表
- 灯条控制系统
- 扫码出库/手动出库
- 物品级出库管理
- 订单完成确认

**关键代码：**
```javascript
// 处理C端灯条请求
StorePickupManagerM.handleCustomerArrival(request);

// 物品出库
StorePickupManagerM.checkoutItem(orderId, itemIndex);

// 激活灯条
StorePickupManagerM.activateLights(orderId);

// 确认取件完成
StorePickupManagerM.confirmPickupComplete(orderId);
```

### 3. 数据同步机制

**同步方式：**
- localStorage 实时同步
- 每5秒轮询检查灯条请求
- 自定义事件触发更新

**同步键名：**
| 键名 | 说明 |
|-----|------|
| `store_light_request` | C端灯条请求 |
| `light_bindings` | 灯条绑定关系 |
| `store_orders` | M端订单列表 |
| `orders` | C端订单列表 |

## 页面集成

### M端集成方式

在 `m-index.html` 的 `<head>` 中添加：

```html
<script src="js/store-pickup.js"></script>
<script src="js/store-pickup-m.js"></script>
```

在订单管理页面添加待取件订单区域：

```html
<!-- 待取件订单 -->
<div id="pickup-orders-section" class="mb-6">
    <h3 class="text-lg font-bold mb-4">🏪 门店自提订单</h3>
    <div id="pickup-orders-list">
        <!-- 动态加载 -->
    </div>
</div>
```

初始化加载：

```javascript
document.addEventListener('DOMContentLoaded', function() {
    // 初始化门店自提管理
    StorePickupManagerM.init();
    
    // 加载待取件订单
    StorePickupManagerM.loadPickupOrders();
});
```

## 界面设计

### C端界面流程

```
1. 首页入口
┌──────────────────────┐
│  🏪 到店取件          │
│  ──────────────────  │
│  扫描店铺二维码        │
│  [ 扫码登记 ]         │
└──────────────────────┘

2. 已登记状态
┌──────────────────────┐
│  ✅ 已登记取件         │
│  ──────────────────  │
│  正在备货中...        │
│  💡 请留意灯条指示     │
└──────────────────────┘

3. 物品已备好
┌──────────────────────┐
│  🔔 物品已备好!       │
│  ──────────────────  │
│  订单号: DD123       │
│  门店: 旗舰店        │
│  ──────────────────  │
│  [ 确认取件完成 ]     │
└──────────────────────┘
```

### M端界面流程

```
1. 待取件订单列表
┌──────────────────────┐
│  🏪 待取件订单        │
│  ──────────────────  │
│  DD123 - 张三        │
│  物品: 2件待出库      │
│  [激活灯条] [扫码]    │
│  ──────────────────  │
│  DD456 - 李四        │
│  物品: 1件待出库      │
│  [激活灯条] [扫码]    │
└──────────────────────┘

2. 订单详情
┌──────────────────────┐
│  订单: DD123         │
│  ──────────────────  │
│  ☐ 西装干洗  [出库]  │
│  ☑ 衬衫清洗  已出库   │
│  ☐ 羽绒服    [出库]  │
│  ──────────────────  │
│  [ 一键出库 ]        │
│  [ 完成取件 ]        │
└──────────────────────┘
```

## 测试用例

### 功能测试

1. **C端扫码取件**
   - [ ] 扫描店铺二维码
   - [ ] 点击「到店取件」按钮
   - [ ] 收到灯条请求通知

2. **M端灯条控制**
   - [ ] 查看待取件订单
   - [ ] 激活灯条
   - [ ] 灯条亮起

3. **物品出库**
   - [ ] 扫码出库
   - [ ] 手动出库
   - [ ] 灯条熄灭
   - [ ] 所有物品出库后订单状态更新

4. **取件完成**
   - [ ] C端收到完成通知
   - [ ] 点击确认取件
   - [ ] 订单变为已完成

### 边界测试

1. 30秒内的灯条请求有效
2. 订单不存在时的错误处理
3. 物品已全部出库后的操作限制
4. 网络异常时的离线处理

## 后续优化

### 计划功能

1. **微信消息通知**
   - 用户到店提醒
   - 物品备好通知
   - 取件完成通知

2. **数据分析**
   - 每日待取件订单统计
   - 物品出库时间统计
   - 用户取件等待时间

3. **智能推荐**
   - 基于历史的取件时间预测
   - 店员工作负载均衡

4. **多门店支持**
   - 跨门店灯条控制
   - 门店间订单转移

## 附录

### 状态码参考

```javascript
const STATUS = {
    // 订单状态
    PENDING: 'awaiting_store_confirm',
    READY: 'ready',
    COMPLETED: 'completed',
    
    // 物品状态
    ITEM_PENDING: 'pending',
    ITEM_PICKED: 'picked',
    ITEM_CHECKED_OUT: 'checked_out',
    
    // 灯条状态
    LIGHT_OFF: 'off',
    LIGHT_ON: 'on',
    LIGHT_PULSE: 'pulse'
};
```

### localStorage 键名

```javascript
const STORAGE_KEYS = {
    LIGHT_REQUEST: 'store_light_request',
    LIGHT_BINDINGS: 'light_bindings',
    STORE_ORDERS: 'store_orders',
    CUSTOMER_ORDERS: 'orders'
};
```

## 更新日志

| 日期 | 版本 | 更新内容 |
|-----|-----|---------|
| 2025-05-07 | 1.0 | 初始版本，基础功能实现 |

---

**文档版本：** 1.0  
**最后更新：** 2025-05-07  
**负责人：** 开发团队
