# 门店自提流程优化更新日志

## 📅 更新日期：2026-05-07

## 🎯 核心改进

### 问题诊断
用户反馈原有门店自提流程存在以下问题：
1. ✅ 点击"确认取件"直接完成订单，缺少M端出库流程
2. ✅ 订单直接结束，不需要M端配合操作
3. ✅ 缺少物品明细的独立灯条控制

### 解决方案
重新设计了完整的门店自提业务流程，强调**M端主导**、**C端触发**的模式。

---

## 🔄 新业务流程

```
C端（用户）                                    M端（门店）
─────────────────────────────────────────     ──────────────────────────────────────────
1. 订单列表点击"门店自提"进入详情页                   
2. 查看订单物品明细                                  
3. 点击物品的"点亮灯条" ──────────────────────→ 4. M端收到灯条请求通知
                                                  5. 店员点击"激活灯条"
                                                  6. 灯条亮起，店员拣货
                                                  7. 店员扫码/手动出库
                                                  8. 每个物品出库对应灯条熄灭
                                                  9. 所有物品出库完成
                                                  10. 店员点击"完成取件"
11. C端收到订单完成通知                               
12. 订单状态变为"已完成"                            
```

---

## 📝 主要改动

### 1. C端门店自提页面重构 (`c-store-pickup.html`)

#### 新增功能
- ✅ **订单选择列表**：显示所有待取件订单
- ✅ **订单详情页**：
  - 订单基本信息（订单号、门店、价格）
  - 物品明细列表
  - 每个物品独立的"点亮灯条"按钮
  - 底部的"点亮所有灯条"按钮
- ✅ **灯条状态显示**：实时显示当前亮起的灯条
- ✅ **流程说明**：显示取件流程指引
- ✅ **自动更新**：监听订单状态变化，自动刷新页面

#### 移除功能
- ❌ 扫码入口（改为直接进入订单列表）
- ❌ 底部的"确认取件"按钮（改为M端确认完成）

### 2. 核心逻辑增强 (`js/store-pickup.js`)

#### 新增函数
```javascript
// 单个物品灯条请求
StorePickupManager.requestLightForItem(orderId, itemIndex)

// 获取物品灯条状态
StorePickupManager.getItemLightStatus(orderId, itemIndex)

// 更新物品灯条状态
StorePickupManager.updateItemLightStatus(orderId, itemIndex, status)
```

#### 功能说明
- **requestLightForItem**: C端用户点击物品的"点亮灯条"按钮时调用，发送灯条请求到M端
- **getItemLightStatus**: 查询指定物品的灯条请求状态
- **updateItemLightStatus**: 更新物品灯条状态（C端本地）

### 3. M端订单管理增强 (`m-index.html`)

#### 新增功能
- ✅ **单个物品灯条请求处理**：
  - 自动识别C端发送的单个物品灯条请求
  - 显示"待处理"标记
  - 提供"激活灯条"按钮
- ✅ **智能按钮显示**：
  - 根据灯条请求数量显示不同按钮
  - "激活所有灯条 (N)" - 当有多个灯条请求时
  - "激活灯条" - 当无灯条请求时
- ✅ **实时刷新**：自动检测新的灯条请求

#### 新增函数
```javascript
// 激活单个物品灯条
function activateSingleLight(orderId, itemIndex)
```

### 4. C端首页集成 (`c-index.html`)

#### 新增功能
- ✅ **订单类型区分**：在待取件通知中区分"门店自提"和其他订单
- ✅ **门店自提入口**：门店自提订单显示"🏪 门店自提"标记
- ✅ **点击跳转**：点击门店自提订单直接进入详情页

#### 新增函数
```javascript
// 跳转到门店自提详情页
function goToStorePickup(orderId)
```

---

## 🎨 交互设计

### C端用户操作流程

1. **查看待取件订单**
   - 在首页通知栏看到待取件订单数量
   - 门店自提订单显示特殊标记

2. **进入门店自提详情页**
   - 点击订单或门店自提入口
   - 查看订单物品明细

3. **点亮灯条**
   - 点击单个物品的"点亮灯条"按钮
   - 或点击"点亮所有灯条"按钮
   - 等待店员处理

4. **等待完成**
   - 实时监听订单状态变化
   - 收到"已完成"通知后返回

### M端店员操作流程

1. **查看待取件订单**
   - 在订单管理页面看到"门店自提订单"专区
   - 有灯条请求时显示"新请求"标记

2. **处理灯条请求**
   - 看到物品旁边的"待处理"标记
   - 点击"激活灯条"点亮对应灯条
   - 或使用"激活所有灯条"批量处理

3. **拣货出库**
   - 根据灯条指示拣货
   - 点击物品的"出库"按钮
   - 或使用扫码枪扫描出库

4. **完成取件**
   - 所有物品出库后
   - 点击"完成取件"按钮
   - C端自动收到完成通知

---

## 💡 技术亮点

### 1. 双向通信机制
- C端发送灯条请求 → M端接收并处理
- M端完成操作 → C端自动更新状态
- 使用 `CustomEvent` 实现实时通信

### 2. 物品级精确管理
- 每个物品独立状态追踪
- 每个物品独立灯条控制
- 支持批量操作（点亮所有灯条）

### 3. 智能状态显示
- 根据订单状态显示不同UI
- 自动识别新的灯条请求
- 实时更新按钮文案

### 4. 完整的错误处理
- 物品已出库时禁用灯条按钮
- 请求过期自动失效
- 订单不存在时提示错误

---

## 🔍 测试步骤

### 测试场景1：C端点亮灯条 → M端接收请求

```javascript
// 1. 在C端创建测试订单
const order = {
    orderId: 'TEST_PICKUP_' + Date.now(),
    deliveryMethod: 'pickup',
    status: 'awaiting_store_confirm',
    customerName: '测试用户',
    customerPhone: '13800138000',
    items: [
        { name: '西装干洗', price: 50, quantity: 1, itemStatus: 'pending' },
        { name: '衬衫清洗', price: 30, quantity: 1, itemStatus: 'pending' }
    ],
    fees: { total: 80 }
};

const orders = JSON.parse(localStorage.getItem('orders') || '[]');
orders.unshift(order);
localStorage.setItem('orders', JSON.stringify(orders));
```

```javascript
// 2. 同步到M端
const storeOrders = JSON.parse(localStorage.getItem('store_orders') || '[]');
storeOrders.unshift({...order, storeId: 'ST002'});
localStorage.setItem('store_orders', JSON.stringify(storeOrders));
```

```javascript
// 3. 在C端点亮第一个物品的灯条
StorePickupManager.requestLightForItem(order.orderId, 0);
```

**预期结果**：
- C端：物品按钮变为"灯已亮"状态
- M端：订单显示"1个灯条请求"，物品旁边显示"待处理"标记

### 测试场景2：M端处理灯条请求

```javascript
// 在M端手动处理
activateSingleLight('TEST_PICKUP_xxx', 0);
```

**预期结果**：
- M端：灯条请求被处理，物品状态更新
- C端：收到灯条激活事件，页面自动刷新
- localStorage：灯条绑定保存到 `light_bindings`

### 测试场景3：M端完成取件

```javascript
// 1. 出库所有物品
quickCheckoutAll('TEST_PICKUP_xxx');

// 2. 点击完成取件
completePickup('TEST_PICKUP_xxx');
```

**预期结果**：
- M端：订单状态变为"已完成"
- C端：收到 `pickupCompleted` 事件
- C端页面：自动跳转回订单列表

---

## 📊 数据结构

### 灯条请求（单个物品）
```javascript
{
    type: 'single_item_light',
    orderId: 'ORDER_123',
    itemIndex: 0,
    itemName: '西装干洗',
    storeId: 'ST002',
    timestamp: 1715100000000,
    customerId: 'USER_001',
    status: 'pending'
}
```

### 灯条绑定
```javascript
{
    orderId: 'ORDER_123',
    itemIndex: 0,
    itemName: '西装干洗',
    lightId: 'LIGHT_ORDER_123_0',
    status: 'on',  // on | off
    activatedAt: '2026-05-07T15:00:00.000Z'
}
```

### 物品状态
```javascript
{
    name: '西装干洗',
    price: 50,
    quantity: 1,
    itemStatus: 'pending',  // pending | checked_out
    lightStatus: 'on',      // on | off
    checkedOutAt: null
}
```

---

## 🚀 后续优化建议

### 短期优化
1. 添加微信消息通知（M端确认时通知C端）
2. 添加订单超时提醒（灯条亮起超过10分钟）
3. 添加历史取件记录查询

### 长期优化
1. 接入真实灯条硬件设备
2. 添加门店库存管理
3. 添加多门店统一管理
4. 添加数据分析报表

---

## 📝 注意事项

1. **权限控制**：只有门店自提订单才能使用此流程
2. **状态同步**：C端和M端数据需保持同步
3. **异常处理**：网络断开、页面刷新等情况的处理
4. **性能优化**：大量订单时的分页加载

---

## ✅ 验收标准

- [x] C端可以从订单列表进入门店自提详情页
- [x] 订单详情显示所有物品明细
- [x] 每个物品有独立的"点亮灯条"按钮
- [x] 底部有"点亮所有灯条"按钮
- [x] 点亮灯条后，M端收到请求通知
- [x] M端可以激活单个物品灯条
- [x] M端可以一键激活所有灯条
- [x] M端可以扫码/手动出库
- [x] M端可以完成取件确认
- [x] C端自动收到完成通知
- [x] C端移除了"确认取件"按钮
- [x] 订单完成由M端主导

---

## 👥 开发者

- **前端开发**：C端/M端门店自提页面
- **逻辑开发**：灯条请求与绑定系统
- **集成测试**：端到端流程测试

---

## 📞 技术支持

如有问题，请查看：
- [门店自提设计文档](./docs/STORE-PICKUP-DESIGN.md)
- [测试指南](./STORE-PICKUP-TEST-GUIDE.md)
- [快速参考](./docs/STORE-PICKUP-QUICK-REF.md)
