# 干洗系统支付网关

完整的支付系统，支持微信支付、支付宝、银联支付、账户余额，并包含完整的资金结算体系。

## 📁 项目结构

```
api/payment-server/
├── config.js           # 配置文件
├── server.js           # 主服务器（支付网关）
├── wechat-pay.js       # 微信支付模块
├── alipay.js           # 支付宝支付模块
├── unionpay.js         # 银联支付模块
├── balance.js          # 余额管理模块
├── settlement.js       # 资金结算系统
└── package.json        # 依赖配置
```

## 🚀 快速开始

### 1. 安装依赖

```bash
cd api/payment-server
npm install
```

### 2. 配置API密钥

复制配置文件模板：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入真实的API密钥：

```env
# 微信支付配置
WECHAT_APPID=your_wechat_appid
WECHAT_MCHID=your_merchant_id
WECHAT_API_KEY=your_api_key
WECHAT_CERT_PATH=./certs/apiclient_cert.pem
WECHAT_CERT_KEY_PATH=./certs/apiclient_key.pem

# 支付宝配置
ALIPAY_APP_ID=your_alipay_app_id
ALIPAY_PRIVATE_KEY=your_private_key
ALIPAY_PUBLIC_KEY=your_public_key

# 银联配置
UNIONPAY_MERCHANT_ID=your_merchant_id
UNIONPAY_SIGN_CERT_PATH=./certs/acp_sign.pfx
UNIONPAY_SIGN_CERT_PWD=your_password

# 服务器配置
PORT=3001
NODE_ENV=development
```

### 3. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3001` 启动。

## 💳 支持的支付方式

### 1. 微信支付

**适用场景**：
- 微信小程序支付（JSAPI）
- 微信公众号支付（JSAPI）
- H5网页支付（MWEB）
- APP支付（APP）

**接口**：
```javascript
POST /api/payment/create
{
  "orderId": "ORD123456",
  "amount": 100.00,
  "subject": "干洗服务",
  "paymentMethod": "wechat",
  "openid": "user_openid"
}
```

### 2. 支付宝支付

**适用场景**：
- 网页支付（H5跳转）
- APP支付

**接口**：
```javascript
POST /api/payment/create
{
  "orderId": "ORD123456",
  "amount": 100.00,
  "subject": "干洗服务",
  "paymentMethod": "alipay",
  "returnUrl": "https://yourapp.com/payment/success"
}
```

### 3. 银联支付

**适用场景**：
- 银行卡支付
- 云闪付

**接口**：
```javascript
POST /api/payment/create
{
  "orderId": "ORD123456",
  "amount": 100.00,
  "subject": "干洗服务",
  "paymentMethod": "unionpay"
}
```

### 4. 账户余额支付

**适用场景**：
- 用户余额充足时
- 快速支付，无需跳转

**接口**：
```javascript
POST /api/payment/create
{
  "orderId": "ORD123456",
  "amount": 100.00,
  "subject": "干洗服务",
  "paymentMethod": "balance",
  "userId": "user_123"
}
```

## 💰 资金结算体系

完整的资金结算链路：用户支付 → 平台收款 → 扣除服务费 → 结算给门店 → 门店提现

### 结算流程

```
┌─────────────────────────────────────────────┐
│           用户支付（多种支付方式）             │
│  微信支付 / 支付宝 / 银联 / 余额              │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│              平台账户收款                     │
│  订单金额（包含服务费和配送费）                │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│              订单分账计算                     │
│  - 平台服务费：5%                            │
│  - 门店应得：95%                             │
│  - 配送费：单独结算                           │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│              T+7结算周期                     │
│  订单完成后第7天自动结算到门店余额             │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│              门店账户                        │
│  可用余额 / 冻结余额 / 待结算金额             │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│              门店提现                        │
│  最低100元，最高50000元，T+1到账              │
└─────────────────────────────────────────────┘
```

### API接口

#### 1. 获取门店结算信息

```javascript
GET /api/settlement/store/:storeId
```

返回：
```json
{
  "success": true,
  "data": {
    "storeId": "store_001",
    "availableBalance": 5000.00,
    "frozenBalance": 1000.00,
    "pendingSettlement": 3000.00,
    "totalOrders": 150,
    "totalSettlement": 50000.00
  }
}
```

#### 2. 获取结算记录

```javascript
GET /api/settlement/store/:storeId/records?startDate=2025-01-01&endDate=2025-01-31
```

#### 3. 发起结算

```javascript
POST /api/settlement/store/:storeId/settle
{
  "settlementCycle": 7  // T+N结算
}
```

#### 4. 门店提现

```javascript
POST /api/settlement/store/:storeId/withdraw
{
  "amount": 5000.00,
  "bankAccount": "6222021234567890"
}
```

#### 5. 生成财务报表

```javascript
POST /api/settlement/report
{
  "startDate": "2025-01-01",
  "endDate": "2025-01-31",
  "storeId": "store_001",
  "type": "detailed"
}
```

## 📊 账户余额系统

### 用户余额

```javascript
// 获取用户余额
GET /api/balance/:userId

// 获取交易记录
GET /api/balance/:userId/transactions

// 余额充值
POST /api/balance/recharge
{
  "userId": "user_123",
  "amount": 1000.00,
  "channel": "wechat"  // wechat, alipay, unionpay
}
```

## 🔐 安全配置

### 微信支付证书

将微信支付证书放置在 `certs/` 目录：

```bash
mkdir certs
# 上传以下文件到 certs/ 目录：
# - apiclient_cert.pem
# - apiclient_key.pem
# - ca.pem (可选)
```

### 支付宝密钥

使用支付宝密钥生成工具生成RSA2密钥对。

### 银联证书

将银联签名证书放置在 `certs/` 目录：

```bash
# 上传以下文件到 certs/ 目录：
# - acp_sign.pfx (签名证书)
# - acp_verify.cer (验签证书)
```

## 🧪 测试

### 本地测试

```bash
# 启动服务
npm start

# 运行测试脚本
node test-payment.js
```

### 测试支付

项目提供了完整的测试脚本，可以测试：
- ✅ 创建支付订单
- ✅ 查询支付状态
- ✅ 关闭订单
- ✅ 余额充值
- ✅ 门店结算
- ✅ 门店提现

## 📱 小程序端对接

### 微信支付小程序配置

1. 在 `app.js` 中配置支付服务器地址：

```javascript
globalData: {
  paymentServerUrl: 'http://localhost:3001'
}
```

2. 调用支付接口：

```javascript
// 微信支付
const res = await app.request('/payment/wechat/unified', {
  method: 'POST',
  data: {
    orderId: orderId,
    totalAmount: amount * 100, // 转为分
    description: '干洗服务',
    openid: userInfo.openid
  }
});

// 调起微信支付
if (res.success) {
  await wx.requestPayment({
    timeStamp: res.data.payParams.timeStamp,
    nonceStr: res.data.payParams.nonceStr,
    package: res.data.payParams.package,
    signType: res.data.payParams.signType,
    paySign: res.data.payParams.paySign
  });
}
```

3. 支付结果页面配置 `pages/order/success/index`

## 🔧 错误处理

### 常见错误

1. **余额不足**
```json
{
  "success": false,
  "error": "余额不足",
  "availableBalance": 50.00,
  "requiredAmount": 100.00
}
```

2. **支付方式未配置**
```json
{
  "success": false,
  "error": "支付方式未启用"
}
```

3. **订单不存在**
```json
{
  "success": false,
  "error": "订单不存在"
}
```

## 📈 监控与日志

### 日志记录

所有支付操作都会记录日志：

```javascript
// 日志格式
{
  timestamp: "2025-01-01T12:00:00.000Z",
  action: "payment_create",
  orderId: "ORD123456",
  paymentMethod: "wechat",
  amount: 100.00,
  status: "success",
  message: ""
}
```

### 回调通知

确保回调URL可公网访问：
- 微信支付：`POST /api/payment/wechat/notify`
- 支付宝：`POST /api/payment/alipay/notify`
- 银联：`POST /api/payment/unionpay/notify`

## 🚀 生产环境部署

### 1. 环境要求

- Node.js 16+
- HTTPS证书（必须）
- 公网可访问的回调URL

### 2. 配置反向代理

```nginx
# Nginx配置示例
server {
    listen 443 ssl;
    server_name api.yourapp.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 3. 启动服务

```bash
# 使用PM2启动
pm2 start server.js --name payment-gateway

# 设置开机自启
pm2 startup
pm2 save
```

## 📞 技术支持

如有问题，请检查：

1. API密钥是否配置正确
2. 回调URL是否可公网访问
3. 证书文件是否正确放置
4. 日志文件查看详细错误信息

## 📋 费率说明

| 支付方式 | 费率 | 备注 |
|---------|------|------|
| 微信支付 | 0.6% | 官方标准费率 |
| 支付宝 | 0.6% | 官方标准费率 |
| 银联支付 | 0.7% | 官方标准费率 |
| 账户余额 | 0% | 平台内部支付 |
| 平台服务费 | 5% | 订单金额的5% |

## 🔄 版本更新

### v1.0.0 (2025-01-01)
- ✅ 支持微信支付
- ✅ 支持支付宝
- ✅ 支持银联支付
- ✅ 支持账户余额
- ✅ 完整的资金结算系统
- ✅ 门店提现功能
- ✅ 财务报表生成

## 📄 许可证

MIT License
