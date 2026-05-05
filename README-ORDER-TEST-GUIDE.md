# 订单系统测试完整指南

## ✅ 已完成的修复

### 1. 修复了C端小程序语法错误
- 文件：`m-index.html` 第1945-1946行
- 问题：多余的代码导致JavaScript解析失败
- 状态：✅ 已修复

### 2. 实现了门店端订单显示功能
- 文件：`m-index.html`
- 新增函数：
  - `loadRecentOrders()` - 加载最近订单到首页
  - `loadOrderList()` - 加载完整订单列表
  - `viewOrder()` - 查看订单详情
  - `processOrder()` - 处理订单
- 状态：✅ 已实现

### 3. 创建了完整的测试工具
- `test-full-simulation.html` - 完整的生产环境模拟
- `test-data-setup.html` - 单独的数据设置工具
- `test-order-debug.html` - 诊断工具
- 状态：✅ 已完成

---

## 🎯 测试流程

### 步骤1：打开完整模拟工具

双击打开：`test-full-simulation.html`

### 步骤2：配置测试数据

1. **设置C端用户信息**（可以保持默认）
   - 用户名：李明
   - 手机号：13800138001

2. **选择目标门店**
   - 例如：海淀区干洗店 (ST002)
   - 记住显示的门店账号：haidian001

3. **选择服务项目**
   - 至少选择1项（默认已选"羽绒服清洗" ¥80）

4. **选择配送方式**
   - 到店自取 或 配送到家

### 步骤3：执行模拟

点击 **"🚀 模拟完整下单流程"**

工具会自动：
- ✅ 创建C端用户登录令牌
- ✅ 创建C端订单（保存到 localStorage `orders`）
- ✅ 设置门店登录令牌（海淀区干洗店）
- ✅ 创建门店端订单（保存到 localStorage `store_orders`）
- ✅ 设置管理员登录令牌
- ✅ 创建管理后台订单（保存到 localStorage `admin_orders`）

### 步骤4：查看各系统

#### 📱 C端小程序
1. 点击 "📱 打开C端订单页" 或直接访问 `c-orders.html`
2. 应该能看到刚才创建的订单
3. 订单状态：待支付

#### 🏪 门店端
1. 点击 "🏪 打开门店端" 或直接访问 `m-index.html`
2. 首页"最近订单"区域会显示订单
3. 点击"订单管理"菜单查看完整列表
4. **重要**：门店端只显示属于**自己门店**的订单

#### 💼 管理后台
1. 点击 "💼 打开管理后台" 或直接访问 `admin.html`
2. 进入"订单管理"菜单
3. 应该能看到所有门店的订单
4. **注意**：目前管理后台依赖后端API，localStorage仅作为降级方案

---

## 📊 localStorage 数据结构

### C端小程序
```javascript
localStorage.setItem('userToken', JSON.stringify({
    token: 'c_token_xxx',
    userId: 'c_user_001',
    name: '李明',
    phone: '13800138001'
}));

localStorage.setItem('orders', JSON.stringify([{
    orderId: 'ORD20260426001',
    services: [{ name: '羽绒服清洗', price: 80 }],
    store: { id: 'ST002', name: '海淀区干洗店' },
    status: 'pending',
    total: 80,
    createdAt: '2026-04-26T08:00:00.000Z'
}]));
```

### 门店端
```javascript
localStorage.setItem('storeUser', JSON.stringify({
    token: 'store_token_xxx',
    storeId: 'ST002',
    storeName: '海淀区干洗店',
    role: 'store_manager',
    username: 'haidian001'
}));

localStorage.setItem('store_orders', JSON.stringify([{
    orderId: 'ORD20260426001',
    storeId: 'ST002',
    items: [{ name: '羽绒服清洗', price: 80, quantity: 1 }],
    status: 'pending',
    total: 80,
    createdAt: '2026-04-26T08:00:00.000Z',
    customerName: '李明',
    customerPhone: '138****8001'
}]));
```

### 管理后台
```javascript
localStorage.setItem('adminUser', JSON.stringify({
    token: 'admin_token_xxx',
    username: 'admin',
    role: '总管理员',
    name: '系统管理员'
}));

localStorage.setItem('admin_orders', JSON.stringify([{
    orderId: 'ORD20260426001',
    orderNo: 'ORD20260426001',
    userId: 'c_user_001',
    storeId: 'ST002',
    storeName: '海淀区干洗店',
    items: [{ name: '羽绒服清洗', price: 80, quantity: 1, subtotal: 80 }],
    amounts: { subtotal: 80, discount: 0, deliveryFee: 0, total: 80 },
    status: 'pending',
    paymentStatus: 'unpaid',
    createdAt: '2026-04-26T08:00:00.000Z',
    customerName: '李明',
    customerPhone: '13800138001'
}]));
```

---

## 🔧 门店账号说明

| 门店 | 门店ID | 门店账号 | 门店密码 |
|------|--------|----------|----------|
| 朝阳区干洗店 | ST001 | chaoyang001 | store123 |
| 海淀区干洗店 | ST002 | haidian001 | store123 |
| 丰台区干洗店 | ST003 | fengtai001 | store123 |

---

## ⚠️ 重要说明

### 1. 门店端订单筛选
门店端**只会显示属于当前登录门店的订单**。

例如：
- 如果你下单时选择"海淀区干洗店"
- 那么只有登录"海淀区干洗店"账号才能看到这个订单
- 登录"朝阳区干洗店"账号看不到

### 2. 测试时需要注意
1. **下单时选择的门店** = 订单所属门店
2. **查看门店端时** = 必须登录对应门店的账号
3. **管理后台** = 可以查看所有门店的订单

### 3. 订单数据存储位置
- C端：`localStorage.orders`
- 门店端：`localStorage.store_orders`
- 管理后台：`localStorage.admin_orders`

### 4. 刷新页面后
- C端：订单数据保留（localStorage）
- 门店端：订单数据保留（localStorage）
- 管理后台：需要后端API或刷新后从localStorage读取

---

## 🐛 常见问题

### Q1：门店端看不到订单
**原因**：下单时选择的门店与登录的门店不匹配

**解决**：
1. 检查下单时选择的门店（如：海淀区）
2. 确认门店端登录的是对应门店（如：海淀区干洗店）
3. 再次下单时选择对应的门店

### Q2：C端看不到订单
**原因**：没有C端用户登录令牌

**解决**：
1. 使用测试工具重新设置C端登录
2. 或者在浏览器控制台执行：
```javascript
localStorage.setItem('userToken', JSON.stringify({token: 'test', name: '测试', phone: '13800138001'}));
```

### Q3：刷新页面后订单消失
**原因**：没有正确保存到localStorage

**解决**：
1. 检查浏览器控制台是否有错误
2. 确认localStorage是否有数据
3. 打开 `test-data-setup.html` 查看数据

### Q4：管理后台看不到订单
**原因**：管理后台主要依赖后端API

**解决**：
1. 启动后端服务
2. 或者在控制台手动设置：
```javascript
localStorage.setItem('admin_orders', localStorage.getItem('store_orders'));
```

---

## 🚀 下一步优化

### 优先级1：完善管理后台订单显示
- 从localStorage读取订单
- 完善订单列表UI
- 实现订单详情查看

### 优先级2：实现订单状态同步
- C端下单 → 门店端实时显示
- 门店端处理 → C端和管理后台更新
- 状态变更推送通知

### 优先级3：连接后端数据库
- 将localStorage数据同步到MongoDB
- 实现完整的CRUD操作
- 添加权限控制和认证

---

## 📞 获取帮助

如果遇到问题：

1. **查看控制台**：F12 → Console
2. **查看localStorage**：F12 → Application → Local Storage
3. **使用诊断工具**：打开 `test-order-debug.html`
4. **清除所有数据**：打开 `test-data-setup.html` → 清除所有数据

---

**现在请打开 `test-full-simulation.html` 开始测试！** 🎯
