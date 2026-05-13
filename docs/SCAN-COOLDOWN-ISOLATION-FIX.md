# 扫码冷却期和灯条请求隔离修复

## 问题描述

之前的修改虽然添加了扫码冷却期和灯条请求防重复触发机制，但实现方式是**全局变量**，导致：

1. **不同订单间互相干扰**：切换订单后，之前订单的扫码状态仍会影响新订单
2. **历史订单测试异常**：测试历史订单时，灯条请求无法正常触发
3. **跨storeId测试问题**：不同门店ID的订单会互相影响

## 根本原因

原代码使用全局变量：
```javascript
let userHasScanned = false;
let lightRequestTriggered = false;
let scanCooldownUntil = 0;
```

这些变量在页面生命周期内不会重置，导致订单间状态污染。

## 修复方案

### 1. C端 (c-order-detail.html)

**引入基于订单ID的状态隔离Map**

```javascript
// 创建订单状态Map，格式: { orderId -> { userHasScanned, lightTriggered, cooldownUntil } }
const orderStateMap = new Map();

function getOrderState(oid) {
  if (!oid) return null;
  if (!orderStateMap.has(oid)) {
    orderStateMap.set(oid, {
      userHasScanned: false,
      lightTriggered: false,
      cooldownUntil: 0
    });
  }
  return orderStateMap.get(oid);
}
```

**提供兼容函数**

```javascript
function getCurrentUserHasScanned() {
  const state = getOrderState(orderId);
  return state ? state.userHasScanned : false;
}

function setCurrentUserHasScanned(value) {
  const state = getOrderState(orderId);
  if (state) state.userHasScanned = value;
}

function getCurrentLightTriggered() {
  const state = getOrderState(orderId);
  return state ? state.lightTriggered : false;
}

function setCurrentLightTriggered(value) {
  const state = getOrderState(orderId);
  if (state) state.lightTriggered = value;
}

function getCurrentCooldownUntil() {
  const state = getOrderState(orderId);
  return state ? state.cooldownUntil : 0;
}

function setCurrentCooldownUntil(value) {
  const state = getOrderState(orderId);
  if (state) state.cooldownUntil = value;
}
```

**替换所有直接变量引用**

所有使用 `userHasScanned`、`lightRequestTriggered`、`scanCooldownUntil` 的地方都改为调用上述函数。

**添加URL变化监听**

```javascript
// 监听URL变化，支持订单切换时重置状态
let lastLoadedOrderId = orderId;
setInterval(() => {
  const currentOrderId = getCurrentOrderId();
  if (currentOrderId && currentOrderId !== lastLoadedOrderId) {
    lastLoadedOrderId = currentOrderId;
    orderId = currentOrderId;
    loadOrderDetail(); // 会自动初始化新订单的状态
  }
}, 2000);
```

### 2. M端 (m-index.html)

**引入基于请求ID的处理状态Map**

```javascript
const processedLightRequests = new Map(); // 格式: { requestId -> processedAt }

function markLightRequestProcessed(requestId) {
  processedLightRequests.set(requestId, Date.now());
  // 清理超过5分钟的记录
  const now = Date.now();
  for (const [key, time] of processedLightRequests) {
    if (now - time > 300000) {
      processedLightRequests.delete(key);
    }
  }
}

function isLightRequestProcessed(requestId) {
  return processedLightRequests.has(requestId);
}
```

**替换旧的全局变量**

```javascript
// 旧的实现（有问题）
if (lastProcessedLightRequestId === requestId) { ... }

// 新的实现
if (isLightRequestProcessed(requestId)) { ... }
```

## 改进效果

1. **订单级隔离**：每个订单有独立的状态，互不干扰
2. **会话持久化**：Map结构在页面刷新后会重新初始化，但避免了旧订单状态残留
3. **URL变化感知**：能够检测订单切换并正确重置状态
4. **历史订单测试友好**：测试不同订单时可以独立验证功能

## 测试建议

1. **切换订单测试**：在同一标签页中打开不同订单，验证灯条请求独立触发
2. **跨门店测试**：用不同storeId的订单测试，确保互不影响
3. **历史订单测试**：测试已完成订单的扫码功能，验证冷却期独立
4. **页面刷新测试**：刷新页面后，验证状态正确恢复

## 修改的文件

- `c-order-detail.html`：C端订单详情页
- `m-index.html`：M端管理页面
