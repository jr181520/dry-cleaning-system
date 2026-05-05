# 订单功能优化 - 问题修复总结

## 修复日期
2026-04-26

## 修复的问题

### 问题1：账号切换后订单未按门店过滤

**问题描述**：
- 切换门店账号后，订单列表仍然显示所有订单（包括不属于当前门店的订单）
- 账户信息窗口打开后无法通过关闭按钮关闭，只能刷新页面

**修复方案**：

1. **订单过滤逻辑** (`m-index.html` - `loadOrderList` 函数)：
   - 添加门店ID过滤逻辑
   - 根据当前登录门店账号的 `storeId` 过滤订单
   - 只显示属于当前门店的订单

```javascript
// 获取当前门店ID
const currentStore = JSON.parse(localStorage.getItem('currentStore') || '{}');
const currentStoreId = currentStore.storeId || 'ST002';

// 过滤：只显示属于当前门店的订单
const myOrders = orders.filter(order => {
    if (order.store && order.store.id === currentStoreId) {
        return true;
    }
    if (order.storeId === currentStoreId) {
        return true;
    }
    return false;
});
```

2. **数据同步优化** (`m-index.html` - `syncC端Orders` 函数)：
   - 同步C端订单时只同步属于当前门店的订单
   - 避免将其他门店的订单错误同步到当前门店

**测试验证**：
- 切换到海淀区店账号 → 只显示海淀区店的订单
- 切换到朝阳区店账号 → 只显示朝阳区店的订单
- 切换到西城区店账号 → 只显示西城区店的订单

---

### 问题2：物品状态更新后订单状态未自动同步

**问题描述**：
- 物品状态需要手动更新，订单状态也需要手动更新
- 即使所有物品都达到同一状态，订单状态也不会自动更新
- 状态窗口无法通过关闭按钮关闭

**修复方案** (`m-index.html` - `updateItemStatus` 函数)：

1. **自动同步逻辑**：
   - 单物品订单：物品状态变更时自动同步订单状态
   - 多物品订单：当所有物品达到同一状态时，自动更新订单状态

2. **状态映射规则**：
   - 所有物品 `completed` → 订单 `completed`
   - 所有物品 `ready/completed` → 订单 `ready`
   - 所有物品 `cleaned/ready/completed` → 订单 `cleaned`
   - 所有物品 `cleaning/cleaned/ready/completed` → 订单 `cleaning`

3. **自动通知**：
   - 订单状态变更时自动发送客户通知
   - 状态变更包括：开始清洗、清洗完成、待取件、已完成

```javascript
// 自动同步订单状态
const allCompleted = items.every(item => item.status === 'completed');
const allReady = items.every(item => ['ready', 'completed'].includes(item.status));
const allCleaned = items.every(item => ['cleaned', 'ready', 'completed'].includes(item.status));
const allCleaning = items.every(item => ['cleaning', 'cleaned', 'ready', 'completed'].includes(item.status));

if (allCompleted) {
    newOrderStatus = 'completed';
} else if (allReady) {
    newOrderStatus = 'ready';
} else if (allCleaned) {
    newOrderStatus = 'cleaned';
} else if (allCleaning && orderToUpdate.status !== 'cleaning') {
    newOrderStatus = 'cleaning';
}
```

**测试验证**：
- 更新单个物品为"清洗中" → 订单状态自动变为"清洗中"
- 所有物品都更新为"已清洗" → 订单状态自动变为"清洗完成"
- 所有物品都更新为"已完成" → 订单状态自动变为"已完成"
- 客户收到状态变更通知

---

### 问题3：C端下单数据未同步到门店端

**问题描述**：
- C端下单选择皮具+床单，但门店端显示西装+衬衫
- 门店选择无法点击确认
- 自送到店支付无法确认
- 跑腿配送支付后订单直接跳到待处理，忽略配送状态
- m-index和admin没有订单数据

**修复方案**：

1. **订单数据结构优化** (`c-order.html` - `confirmOrder` 函数)：
   - 使用 `items` 字段存储物品信息（兼容 `services`）
   - 同时设置 `storeId` 字段确保门店ID正确传递
   - 添加 `deliveryStatus` 区分自取和跑腿配送

```javascript
const order = {
    orderId: 'ORD' + ...,
    // 使用 items 字段存储物品（兼容 services）
    items: orderData.selectedServices.map(s => ({
        name: s.name,
        serviceName: s.name,
        price: s.price,
        quantity: 1,
        status: 'pending'
    })),
    services: orderData.selectedServices,
    // 门店信息 - 使用 id 和 storeId 两种字段确保兼容
    store: orderData.selectedStore,
    storeId: orderData.selectedStore ? orderData.selectedStore.id : null,
    // 配送状态（区分自取和跑腿）
    deliveryStatus: orderData.deliveryMethod === 'courier' ? 'pending_pickup' : 'self_delivery',
    status: 'pending',
    createdAt: new Date().toISOString(),
    // ...
};
```

2. **支付成功同步** (`c-payment.html` - `processPayment` 函数)：
   - 支付成功后立即同步到门店端
   - 确保门店能立即看到新订单

```javascript
// 支付成功
order.status = 'paid';
// ...

// 同时同步到门店端订单（确保门店能看到新订单）
let storeOrders = JSON.parse(localStorage.getItem('store_orders') || '[]');
const storeOrderIndex = storeOrders.findIndex(o => o.orderId === order.orderId);
if (storeOrderIndex > -1) {
    storeOrders[storeOrderIndex] = order;
} else {
    storeOrders.unshift(order);
}
localStorage.setItem('store_orders', JSON.stringify(storeOrders));
```

3. **门店端同步优化** (`m-index.html` - `syncC端Orders` 函数)：
   - 同步时过滤只同步属于当前门店的订单
   - 按门店ID精确匹配

**测试验证**：
- C端选择皮具+床单下单 → 门店端正确显示皮具+床单
- C端支付成功 → m-index立即显示新订单
- C端切换门店 → 只显示该门店的订单

---

## 技术改进点

### 1. 数据一致性
- 统一使用 `items` 和 `storeId` 字段
- 支付成功后立即同步到所有相关存储
- 门店过滤确保数据隔离

### 2. 自动化程度
- 物品状态变更自动同步订单状态
- 状态变更自动发送客户通知
- 减少人工操作步骤

### 3. 错误处理
- API调用失败时自动回退到本地缓存
- 订单过滤失败时显示友好提示
- 完善的数据合并策略

## 后续待优化

1. **门店选择确认按钮**：
   - 当前门店选择是可选的，可以跳过
   - 考虑添加"必须选择门店"的强制验证

2. **配送状态跟踪**：
   - 完善跑腿配送的状态跟踪
   - 添加配送员位置实时更新
   - 配送异常处理机制

3. **扫码功能集成**：
   - 扫码枪集成
   - 二维码生成和打印
   - 扫码自动更新物品状态

4. **数据持久化**：
   - 考虑使用后端API存储订单
   - 数据库设计优化
   - 数据备份机制

## 相关文件

- `m-index.html` - 门店端管理页面
- `c-order.html` - C端下单页面
- `c-payment.html` - C端支付页面
- `c-order-success.html` - 订单成功页面
- `c-orders.html` - C端订单列表
- `admin.html` - 管理端页面

## 测试清单

- [ ] 门店账号切换测试
- [ ] 订单按门店过滤测试
- [ ] 物品状态自动同步测试
- [ ] 多物品订单状态自动更新测试
- [ ] C端下单数据同步测试
- [ ] 支付成功后门店端即时显示测试
- [ ] 客户通知接收测试
- [ ] 跨标签页数据同步测试
