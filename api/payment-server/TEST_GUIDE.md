# 支付系统测试指南

## 🚀 快速开始测试

### 第一步：安装依赖

```bash
cd api/payment-server
npm install
```

### 第二步：启动测试服务器

```bash
# 方式1: 使用 npm script
npm run start:test

# 方式2: 直接运行
node test-server.js
```

服务器将在 **http://localhost:3002** 启动，并显示：

```
╔════════════════════════════════════════════════════════╗
║      支付网关测试服务器 (模拟模式)                       ║
╠════════════════════════════════════════════════════════╣
║  🚀 服务地址: http://localhost:3002                     ║
║  📋 测试模式: 已启用 (无需API密钥)                       ║
╚════════════════════════════════════════════════════════╝
```

### 第三步：运行测试脚本

```bash
# 打开新的终端窗口，运行测试
npm test
```

或者：

```bash
node test-payment.js
```

## 📋 测试项目清单

### ✅ 测试项目（共10项）

1. **健康检查** - 验证服务器运行状态
2. **查看测试数据** - 查看预置的测试账户和余额
3. **余额充值** - 测试余额充值功能
4. **微信支付** - 测试微信支付（模拟）
5. **余额支付** - 测试余额直接支付
6. **支付宝支付** - 测试支付宝跳转（模拟）
7. **银联支付** - 测试银联支付（模拟）
8. **门店结算查询** - 查看门店账户和待结算金额
9. **门店提现** - 测试门店提现功能
10. **批量支付测试** - 同时测试4种支付方式

## 🎯 手动测试API

### 1. 健康检查

```bash
curl http://localhost:3002/api/health
```

预期响应：
```json
{
  "status": "ok",
  "mode": "test",
  "services": {
    "wechat": "mock",
    "alipay": "mock",
    "unionpay": "mock",
    "balance": "enabled"
  }
}
```

### 2. 查看测试数据

```bash
curl http://localhost:3002/api/test/stats
```

预期响应：
```json
{
  "success": true,
  "data": {
    "userBalances": [
      { "userId": "test_user_001", "balance": 10000 },
      { "userId": "test_user_002", "balance": 5000 }
    ],
    "storeBalances": [
      { "storeId": "test_store_001", "balance": 50000, "pendingSettlement": 10000 },
      { "storeId": "test_store_002", "balance": 30000, "pendingSettlement": 8000 }
    ]
  }
}
```

### 3. 获取用户余额

```bash
curl http://localhost:3002/api/balance/test_user_001
```

预期响应：
```json
{
  "success": true,
  "data": {
    "userId": "test_user_001",
    "balance": 10000,
    "frozenBalance": 0
  }
}
```

### 4. 余额充值

```bash
curl -X POST http://localhost:3002/api/balance/recharge \
  -H "Content-Type: application/json" \
  -d '{"userId": "test_user_001", "amount": 1000}'
```

预期响应：
```json
{
  "success": true,
  "data": {
    "userId": "test_user_001",
    "amount": 1000,
    "newBalance": 11000,
    "transactionId": "rch1234567890"
  }
}
```

### 5. 微信支付（模拟）

```bash
curl -X POST http://localhost:3002/api/payment/create \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "TEST_ORDER_001",
    "amount": 99.00,
    "paymentMethod": "wechat",
    "userId": "test_user_001",
    "openid": "test_openid"
  }'
```

预期响应：
```json
{
  "success": true,
  "data": {
    "prepayId": "wx1234567890mockprepayid",
    "payment": {
      "timeStamp": "1234567890",
      "nonceStr": "mock_nonce_str_1234567890",
      "package": "prepay_id=wx1234567890mockprepayid",
      "signType": "MD5",
      "paySign": "mock_paysign_1234567890"
    },
    "transactionId": "wx1234567890transactionid",
    "tradeState": "SUCCESS"
  }
}
```

### 6. 余额支付

```bash
curl -X POST http://localhost:3002/api/payment/create \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "TEST_ORDER_002",
    "amount": 50.00,
    "paymentMethod": "balance",
    "userId": "test_user_001"
  }'
```

预期响应：
```json
{
  "success": true,
  "data": {
    "orderId": "TEST_ORDER_002",
    "amount": 50.00,
    "balance": 10950,
    "transactionId": "bal1234567890"
  }
}
```

### 7. 支付宝支付（模拟）

```bash
curl -X POST http://localhost:3002/api/payment/create \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "TEST_ORDER_003",
    "amount": 88.00,
    "paymentMethod": "alipay",
    "userId": "test_user_001"
  }'
```

预期响应：
```json
{
  "success": true,
  "data": {
    "orderId": "TEST_ORDER_003",
    "payUrl": "https://openapi.alipay.com/mock/alipay?orderId=TEST_ORDER_003&amount=88",
    "qrCode": "https://qr.alipay.com/mock/TEST_ORDER_003",
    "transactionId": "ali1234567890"
  }
}
```

### 8. 银联支付（模拟）

```bash
curl -X POST http://localhost:3002/api/payment/create \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "TEST_ORDER_004",
    "amount": 66.00,
    "paymentMethod": "unionpay",
    "userId": "test_user_001"
  }'
```

预期响应：
```json
{
  "success": true,
  "data": {
    "orderId": "TEST_ORDER_004",
    "payUrl": "https://gateway.95516.com/mock/unionpay?orderId=TEST_ORDER_004&amount=66",
    "transactionId": "up1234567890"
  }
}
```

### 9. 查询门店结算信息

```bash
curl http://localhost:3002/api/settlement/store/test_store_001
```

预期响应：
```json
{
  "success": true,
  "data": {
    "storeId": "test_store_001",
    "availableBalance": 50000,
    "frozenBalance": 0,
    "pendingSettlement": 10000,
    "totalAssets": 60000
  }
}
```

### 10. 门店提现

```bash
curl -X POST http://localhost:3002/api/settlement/store/test_store_001/withdraw \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500,
    "bankAccount": "6222021234567890123"
  }'
```

预期响应：
```json
{
  "success": true,
  "data": {
    "withdrawId": "wd1234567890",
    "storeId": "test_store_001",
    "amount": 500,
    "bankAccount": "6222****0123",
    "status": "pending",
    "estimatedArrival": "2025-01-02T12:00:00.000Z"
  }
}
```

## 🎨 小程序端测试

### 配置小程序支付地址

在 `wechat-mini-app/app.js` 中配置支付服务器地址：

```javascript
globalData: {
  paymentServerUrl: 'http://localhost:3002'
}
```

### 测试流程

1. 打开小程序，进入下单页面
2. 选择门店和服务
3. 提交订单，进入支付页面
4. 选择支付方式：
   - **💬 微信支付** - 调用微信支付（模拟成功）
   - **💰 余额支付** - 扣除账户余额
   - **💙 支付宝** - 跳转WebView（显示模拟支付链接）
   - **💳 银行卡** - 跳转WebView（显示模拟支付链接）
5. 点击确认支付
6. 查看支付结果

## 🔍 调试技巧

### 查看所有订单

```bash
curl http://localhost:3002/api/test/stats
```

返回所有测试订单、用户余额和门店结算信息。

### 查看日志

测试服务器会实时输出所有支付请求：

```
========================================
[支付请求] 订单: TEST_ORDER_001
[支付方式] wechat
[支付金额] ¥99
========================================

✅ 支付成功！订单: TEST_ORDER_001
```

### 常见问题

#### 问题1: 连接服务器失败

```
Error: connect ECONNREFUSED localhost:3002
```

**解决方案**：
1. 确保测试服务器已启动：`npm run start:test`
2. 检查端口是否被占用：`netstat -an | grep 3002`

#### 问题2: 测试账号不存在

```
{ "success": false, "error": "用户不存在" }
```

**说明**：测试服务器会在启动时自动创建测试账号，无需手动创建。

#### 问题3: 余额不足

```
{ "success": false, "error": "余额不足" }
```

**解决方案**：
1. 使用余额充值接口增加余额
2. 或使用其他支付方式（微信/支付宝/银联）

## 📊 测试账号

### 用户账号

| 用户ID | 初始余额 | 用途 |
|--------|---------|------|
| test_user_001 | ¥10,000 | 主要测试用户 |
| test_user_002 | ¥5,000 | 备用测试用户 |

### 门店账号

| 门店ID | 可用余额 | 待结算 | 用途 |
|--------|---------|--------|------|
| test_store_001 | ¥50,000 | ¥10,000 | 主要测试门店 |
| test_store_002 | ¥30,000 | ¥8,000 | 备用测试门店 |

## 🎯 测试场景

### 场景1: 用户首次下单支付

1. 查看用户余额：`GET /api/balance/test_user_001`
2. 创建微信支付订单：`POST /api/payment/create`
3. 查询支付状态：`GET /api/payment/query/:orderId`
4. 查看用户余额变化

### 场景2: 用户余额支付

1. 查看当前余额：`GET /api/balance/test_user_001`
2. 创建余额支付订单：`POST /api/payment/create` (paymentMethod: "balance")
3. 查看余额变化：再次查询余额

### 场景3: 门店结算

1. 多个用户支付订单，金额进入待结算
2. 查询门店结算信息：`GET /api/settlement/store/test_store_001`
3. 查看待结算金额变化

### 场景4: 门店提现

1. 查询门店余额
2. 发起提现：`POST /api/settlement/store/:storeId/withdraw`
3. 再次查询，查看可用余额减少

## ✅ 测试完成检查清单

- [ ] 测试服务器成功启动
- [ ] 健康检查通过
- [ ] 微信支付（模拟）成功
- [ ] 余额支付成功
- [ ] 支付宝支付（模拟）成功
- [ ] 银联支付（模拟）成功
- [ ] 余额充值成功
- [ ] 门店结算查询成功
- [ ] 门店提现成功
- [ ] 批量支付测试成功

## 📝 下一步

测试通过后，你可以：

1. **查看详细文档** - `README.md`
2. **配置真实API** - 复制 `.env.example` 为 `.env`，填入真实密钥
3. **启动生产服务器** - `npm start`
4. **对接小程序** - 配置 `app.js` 中的支付服务器地址

## 🆘 获取帮助

如果测试过程中遇到问题：

1. 查看测试服务器日志输出
2. 运行 `node test-payment.js` 查看详细错误信息
3. 检查 `README.md` 中的常见问题解答
4. 查看 `QUICK_START.md` 中的配置说明

---

**🎉 祝你测试顺利！**
