# 数据同步问题排查与解决方案

**日期**: 2026-05-05
**问题**: 本地文件与localhost:3002数据不同步

---

## 🔍 问题分析

您遇到的数据不同步问题，根本原因有以下几点：

### 1. API端口不匹配
- **代客下单**调用的是 `localhost:3000` 的API
- **POS系统**运行在 `localhost:3002`
- 两者端口不一致，导致订单无法正确同步

### 2. 浏览器隔离
- 不同端口的localStorage数据是**完全隔离**的
- `localhost:3000` 创建的订单在 `localhost:3002` 中看不到
- 反之亦然

### 3. 缺少数据同步机制
- 系统没有实时同步机制
- 前端localStorage与后端数据库没有自动同步

---

## ✅ 已完成的修复

### 修复1：统一API端口
**文件**: `m-index.html`

修改了代客下单的API调用地址：
```javascript
// 之前
fetch('http://localhost:3000/api/cleaning/orders')

// 现在
fetch('http://localhost:3002/api/cleaning/orders')  // 使用当前端口
```

### 修复2：数据同步管理器
**文件**: `m-index.html` + `js/order-sync.js`

添加了自动数据同步功能：
- 自动检测当前页面端口
- 每8秒自动同步一次订单数据
- 支持从服务器拉取最新订单到本地

### 修复3：门店信息显示
**文件**: `c-orders.html`, `c-order.html`, `m-index.html`

修复了门店信息显示为 "undefined" 的问题

---

## 🧪 测试步骤

### 步骤1：清除浏览器缓存
1. 打开Chrome开发者工具 (F12)
2. 点击 "Application" 标签
3. 在左侧找到 "Local Storage"
4. 右键点击， 选择 "Clear"

或者使用快捷键：
- **Windows**: Ctrl + Shift + Delete
- **Mac**: Cmd + Shift + Delete

### 步骤2：重启服务器
确保两个服务都已停止，然后重新启动：

**方式A：只启动一个服务（推荐）**
```bash
# 只启动后端服务（端口3000）
cd backend
node server.js

# 或只启动支付系统（端口3002）
cd api/payment-server
node server.js
```

**方式B：启动多个服务（使用不同端口）**
修改其中一个服务的端口号，避免冲突。

### 步骤3：测试数据同步
按照以下流程测试：

1. **在M端创建订单**
   - 访问 http://localhost:3002/m-index.html
   - 点击"代客下单"
   - 填写信息并提交

2. **检查订单是否保存**
   - 查看浏览器控制台 (F12)
   - 应该有 "[代客下单] 后端订单创建成功" 的日志
   - 也应该有 "[同步管理器] 同步成功" 的日志

3. **验证数据同步**
   - 刷新页面，订单应该还在
   - 打开另一个标签页访问同一地址，应该能看到相同订单

---

## 🔧 深度排查

### 检查API是否正常工作

**测试3000端口**：
```bash
curl http://localhost:3000/api/health
```

**测试3002端口**：
```bash
curl http://localhost:3002/api/health
```

### 检查订单是否创建成功

**在3000端口创建订单**：
```bash
curl -X POST http://localhost:3000/api/cleaning/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user",
    "storeId": "ST001",
    "items": [{"name": "西装", "price": 50, "quantity": 1}],
    "serviceType": "dry_clean",
    "pickupMethod": "store_pickup",
    "contact": {"name": "测试", "phone": "13800138000"},
    "total": 50
  }'
```

**查看所有订单**：
```bash
curl http://localhost:3000/api/cleaning/orders
```

### 查看服务器日志

启动服务器时，观察控制台输出：
- `[代客下单] 后端订单创建成功` = 订单已保存
- `[代客下单] 后端订单创建失败` = API调用失败
- `[代客下单] 后端API调用失败` = 无法连接到服务器

---

## ⚠️ 常见问题

### Q1: 两个端口都有服务在运行，应该用哪个？

**答案**：选择一个并坚持使用它。

- 如果主要使用干洗订单功能 → 使用 `localhost:3000`
- 如果主要使用POS收银功能 → 使用 `localhost:3002`
- **不要同时运行两个服务**，会导致数据混乱

### Q2: 已经创建了很多订单，数据还在吗？

**答案**：取决于存储位置。

- 如果存储在 `localStorage`，清除缓存后会丢失
- 如果存储在后端数据库，重启服务后仍然存在

### Q3: 如何备份订单数据？

**方法1：导出localStorage**
打开浏览器控制台，执行：
```javascript
const orders = JSON.parse(localStorage.getItem('store_orders') || '[]');
console.log(JSON.stringify(orders, null, 2));
```

**方法2：查询数据库**
```bash
# SQLite数据库文件
ls backend/data/*.db
```

### Q4: 同步功能不工作？

**检查清单**：
1. ✅ 浏览器控制台有 "[同步管理器]" 日志吗？
2. ✅ API服务器是否正常运行？
3. ✅ 控制台有报错信息吗？

**启用详细日志**：
在控制台执行：
```javascript
OrderSyncManager.config.enableLog = true;
OrderSyncManager.manualSync();
```

---

## 📝 建议的工作流程

### 推荐的测试流程

1. **确定使用哪个端口**
   - 只启动一个服务
   - 决定使用3000还是3002

2. **清除缓存并重启**
   ```bash
   # 停止所有服务
   # 清除浏览器缓存
   # 重新启动服务
   ```

3. **只在一个端口上测试**
   - 打开 http://localhost:3002/m-index.html
   - 或 http://localhost:3000/m-index.html
   - **不要在两个端口之间切换**

4. **观察日志验证**
   - 打开浏览器控制台
   - 创建订单
   - 确认日志输出

---

## 🆘 如果问题仍然存在

请收集以下信息并反馈：

1. **服务器日志**：终端输出的所有内容
2. **浏览器控制台**：F12打开Console标签的截图
3. **使用的端口**：3000还是3002？
4. **执行的步骤**：具体做了哪些操作？

### 快速诊断命令

在浏览器控制台执行：
```javascript
// 检查当前配置
console.log('API_BASE_URL:', API_BASE_URL);

// 检查localStorage数据
console.log('本地订单数:', (JSON.parse(localStorage.getItem('store_orders') || '[]')).length);

// 手动触发同步
OrderSyncManager.manualSync();
```

---

## 📚 相关文档

- [数据同步方案](./DATA-SYNC-SOLUTION.md)
- [订单系统分析](./ORDER-SYSTEM-ANALYSIS.md)
- [测试指南](./QUICK-TEST-GUIDE.md)
