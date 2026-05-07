# 门店自提功能测试指南

## 功能概览

门店自提功能允许用户在线下单，选择「门店自提」方式，然后到店扫描二维码进行取件。

## 测试流程

### 场景一：完整用户取件流程

#### 第一步：C端下单（门店自提）

1. 打开 C端首页 `c-index.html`
2. 选择服务项目（如：西装干洗）
3. 选择门店（点击门店卡片）
4. 在配送方式选择页面，选择「自送到店」或「门店自提」
5. 填写联系方式和地址
6. 点击「确认下单」
7. 完成支付（如果使用模拟支付）
8. 订单状态变为 `awaiting_store_confirm`

#### 第二步：用户到店

1. 用户到店
2. 打开 `c-store-pickup.html` 或在首页点击「到店取件」
3. 点击「扫码登记」按钮
4. 选择对应的门店（或模拟扫码）
5. 页面显示该门店的待取件订单
6. 点击订单的「到店取件」按钮
7. 系统发送灯条请求到M端

#### 第三步：M端处理

1. 打开 M端 `m-index.html`
2. 进入「订单管理」页面
3. 在「门店自提订单」区域看到新订单
4. 点击「激活灯条」按钮
5. 系统点亮对应物品的灯条
6. 店员根据灯条拣货

#### 第四步：物品出库

1. 店员扫码或手动点击每个物品的「出库」按钮
2. 对应灯条熄灭
3. 所有物品出库后，订单状态变为 `ready`
4. C端收到「物品已备好」通知

#### 第五步：完成取件

1. 用户在C端看到「物品已备好」提示
2. 点击「确认取件完成」按钮
3. 订单状态变为 `completed`
4. M端订单自动更新为已完成

### 场景二：店员代客下单

1. M端点击「代客下单」或「新增订单」
2. 选择「门店自提」方式
3. 填写客户信息和物品
4. 订单自动同步到C端（如果用户已登录）

### 场景三：模拟测试

#### 测试数据准备

```javascript
// 在浏览器控制台执行，创建一个测试订单
const testOrder = {
    orderId: 'TEST' + Date.now(),
    deliveryMethod: 'pickup',
    status: 'awaiting_store_confirm',
    customerName: '测试用户',
    customerPhone: '13800138000',
    items: [
        { name: '西装干洗', quantity: 1, price: 50, itemStatus: 'pending' },
        { name: '衬衫清洗', quantity: 1, price: 30, itemStatus: 'pending' }
    ],
    fees: { total: 80 }
};

// 保存到store_orders
const orders = JSON.parse(localStorage.getItem('store_orders') || '[]');
orders.unshift(testOrder);
localStorage.setItem('store_orders', JSON.stringify(orders));

console.log('测试订单已创建:', testOrder.orderId);
```

#### 测试步骤

1. **创建测试订单**
   - 在浏览器控制台执行上面的代码
   - 刷新M端页面

2. **激活灯条**
   - 在M端找到测试订单
   - 点击「激活灯条」按钮
   - 检查 `localStorage.getItem('light_bindings')`

3. **物品出库**
   - 点击「出库」按钮
   - 检查物品状态变化
   - 检查灯条绑定状态

4. **完成取件**
   - 点击「完成取件」按钮
   - 验证订单状态更新

## 功能测试清单

### C端功能

- [ ] 门店自提订单创建
- [ ] 扫码/选择门店
- [ ] 到店取件请求发送
- [ ] 灯条激活通知接收
- [ ] 物品备好通知
- [ ] 确认取件完成
- [ ] 订单状态同步

### M端功能

- [ ] 待取件订单列表显示
- [ ] 新请求通知
- [ ] 灯条激活
- [ ] 单个物品出库
- [ ] 一键全部出库
- [ ] 扫码出库
- [ ] 完成取件确认
- [ ] 订单状态同步到C端

### 数据同步

- [ ] localStorage 同步正常
- [ ] C端/M端数据一致
- [ ] 状态更新实时生效
- [ ] 灯条绑定关系正确

## 常见问题

### Q: 灯条请求超过30秒了怎么办？

**A:** 灯条请求的有效期是30秒。超过后需要用户重新点击「到店取件」按钮发送新请求。

### Q: M端看不到待取件订单？

**A:** 检查以下几点：
1. 订单的 `deliveryMethod` 是否为 `'pickup'`
2. 订单的 `storeId` 是否与当前门店ID匹配
3. 订单状态是否为 `awaiting_store_confirm` 或 `ready`
4. 刷新页面重新加载

### Q: 物品出库后灯条没熄灭？

**A:** 检查 `light_bindings` localStorage 数据，确认灯条ID和状态是否正确更新。

### Q: C端收不到状态更新？

**A:** 检查以下几点：
1. 刷新C端页面
2. 检查 `orders` localStorage 数据
3. 查看浏览器控制台是否有错误
4. 检查 `orderStatusUpdated` 事件是否触发

## 调试技巧

### 查看灯条绑定

```javascript
console.log('灯条绑定:', localStorage.getItem('light_bindings'));
```

### 查看待取件订单

```javascript
const orders = JSON.parse(localStorage.getItem('store_orders') || '[]');
const pickupOrders = orders.filter(o => o.deliveryMethod === 'pickup');
console.log('待取件订单:', pickupOrders);
```

### 查看灯条请求

```javascript
console.log('灯条请求:', localStorage.getItem('store_light_request'));
```

### 清除所有灯条

```javascript
localStorage.removeItem('light_bindings');
localStorage.removeItem('store_light_request');
console.log('已清除所有灯条数据');
```

### 重置测试订单

```javascript
// 清除测试订单
const orders = JSON.parse(localStorage.getItem('store_orders') || '[]');
const filtered = orders.filter(o => !o.orderId.startsWith('TEST'));
localStorage.setItem('store_orders', JSON.stringify(filtered));
console.log('已清除测试订单');
```

## 性能优化建议

1. **批量出库**: 对于多物品订单，建议使用「一键出库」功能
2. **扫码枪**: 使用扫码枪可以大幅提高出库效率
3. **灯条系统**: 建议使用真实的WLED灯条系统代替模拟
4. **消息通知**: 后续可集成微信模板消息通知用户

## 下一步优化

### 计划功能

1. **微信消息通知**
   - 用户到店提醒
   - 物品备好通知
   - 取件完成通知

2. **数据分析**
   - 每日取件统计
   - 等待时间分析
   - 店员绩效统计

3. **智能灯条**
   - 集成真实WLED灯条
   - RGB颜色区分
   - 闪烁频率控制

4. **多门店支持**
   - 跨门店订单转移
   - 门店间调拨
   - 库存共享

## 技术支持

如有问题，请检查：

1. 浏览器控制台错误信息
2. localStorage 数据完整性
3. 订单状态流转是否正确
4. C端/M端数据同步

---

**文档版本：** 1.0  
**最后更新：** 2025-05-07  
**测试环境：** Chrome/Firefox/Edge
