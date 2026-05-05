# 干洗店管理系统 - 统一服务架构

**更新日期**: 2026-05-05
**版本**: 2.0

---

## 📋 架构说明

### 之前的问题
- 后端服务运行在 **端口 3000**
- 支付系统运行在 **端口 3002**
- 两个服务独立运行，数据不同步
- 前端需要跨域配置，增加复杂度

### 现在的解决方案
✅ **所有服务合并到端口 3000**
- 后端API（订单、门店、商品）
- 支付系统（微信、支付宝、银联、余额）
- POS收银系统
- 会员卡系统
- 数据同步机制

---

## 🚀 快速启动

### 方式1：使用统一启动脚本（推荐）

```bash
# 双击运行
启动统一服务.bat

# 或在命令行中
cd dry_cleaning_system
启动统一服务.bat
```

### 方式2：手动启动

```bash
cd backend
npm start
# 或
node server.js
```

---

## 📱 访问地址

启动后，在浏览器中访问：

| 页面 | 地址 | 说明 |
|------|------|------|
| 管理员后台 | http://localhost:3000/admin.html | 系统管理 |
| M端POS | http://localhost:3000/m-index.html | 门店端收银 |
| C端用户 | http://localhost:3000/c-index.html | 客户端下单 |
| 支付页面 | http://localhost:3000/c-payment.html | 订单支付 |
| 会员充值 | http://localhost:3000/c-recharge.html | 会员卡充值 |

---

## 🔧 技术细节

### API结构

所有API都通过 `http://localhost:3000/api` 访问：

```javascript
// 订单相关
POST /api/cleaning/orders          // 创建订单
GET  /api/admin/orders              // 获取所有订单
GET  /api/admin/store/:id/orders    // 获取门店订单

// 支付相关
POST /api/payment/create            // 创建支付
GET  /api/payment/query/:orderId    // 查询支付状态
POST /api/payment/callback          // 支付回调

// 会员卡
POST /api/member-card/recharge      // 会员充值
POST /api/member-card/deduct        // 会员扣款
GET  /api/member-card/info/:cardId  // 查询会员卡

// POS
POST /api/pos/create               // POS订单

// 余额
GET  /api/balance/:userId          // 查询余额
POST /api/balance/recharge         // 充值
```

### 前端配置

所有前端页面现在使用统一的API配置：

```html
<script src="js/api-config.js"></script>
<script>
    // 自动使用当前页面端口
    console.log(API_CONFIG.baseUrl);  // http://localhost:3000/api
    
    // 使用便捷方法
    API.getOrders().then(orders => {
        console.log(orders);
    });
</script>
```

---

## 📊 功能模块

### 1. 订单管理
- [x] 代客下单
- [x] 订单列表
- [x] 订单状态管理
- [x] 物品入库
- [x] 取件管理

### 2. 支付系统
- [x] 微信支付
- [x] 支付宝
- [x] 银联支付
- [x] 余额支付
- [x] 现金支付

### 3. 会员系统
- [x] 会员卡管理
- [x] 余额充值
- [x] 余额扣款
- [x] 消费记录

### 4. POS收银
- [x] 快速收款
- [x] 扫码支付
- [x] 现金找零
- [x] 小票打印

---

## 🐛 数据同步

### 自动同步机制

系统内置数据同步功能，解决浏览器缓存问题：

1. **定时同步**：每8秒自动从服务器拉取最新订单
2. **页面可见性同步**：切换标签页时自动同步
3. **手动同步**：用户可手动触发同步

### 同步日志

打开浏览器控制台（F12），查看同步状态：
```
[同步 10:30:45] ℹ️ 开始同步订单数据...
[同步 10:30:46] ℹ️ 同步完成
[同步 10:30:54] ℹ️ 开始同步订单数据...
```

---

## 🔒 安全建议

### 开发环境
- 数据库使用SQLite（文件存储在 `backend/data/`）
- 无需认证即可访问API

### 生产环境
- 启用用户认证
- 配置数据库密码
- 使用HTTPS
- 限制API访问权限
- 定期备份数据

---

## 📝 常见问题

### Q1: 如何清除所有数据？
```bash
# 删除数据库文件
rm backend/data/*.db

# 或在浏览器中清除localStorage
Ctrl + Shift + Delete
```

### Q2: 如何查看API是否正常运行？
```bash
curl http://localhost:3000/api/health
# 应返回: {"status":"ok","timestamp":"2026-05-05T10:30:45.123Z"}
```

### Q3: 端口3000被占用怎么办？
```bash
# Windows查找占用端口的进程
netstat -ano | findstr :3000

# 结束进程
taskkill /PID <进程ID> /F
```

### Q4: 如何查看所有订单？
```bash
curl http://localhost:3000/api/admin/orders
```

---

## 🚀 部署到生产环境

### 1. 修改端口
在 `backend/server.js` 中修改：
```javascript
const PORT = process.env.PORT || 3000;  // 改为 80 或 443
```

### 2. 启用HTTPS
需要配置SSL证书，并在Express中添加HTTPS支持。

### 3. 使用PM2管理进程
```bash
npm install -g pm2
pm2 start backend/server.js --name drycleaning
pm2 save
pm2 startup
```

---

## 📞 技术支持

如有问题，请检查：
1. Node.js 版本（需要 v14+）
2. 所有依赖是否安装成功（`npm install`）
3. 端口是否被占用
4. 浏览器控制台错误信息

---

## 📄 许可证

MIT License

---

**祝你使用愉快！** 🎉
