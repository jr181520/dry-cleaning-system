# C端用户App - API接口文档

## 支付服务API (`api/payment-api.js`)

### 1. 创建微信支付订单
```
POST /api/payment/wechat/unified
```
**参数:**
```json
{
  "orderId": "string",        // 订单ID
  "amount": 45.00,            // 支付金额（元）
  "description": "string",    // 订单描述
  "openid": "string"          // 用户OpenID（小程序）
}
```
**返回:**
```json
{
  "success": true,
  "data": {
    "payment": {
      "timeStamp": "string",
      "nonceStr": "string",
      "package": "string",
      "signType": "MD5",
      "paySign": "string"
    }
  }
}
```

### 2. 余额支付
```
POST /api/payment/balance/pay
```
**参数:**
```json
{
  "orderId": "string",
  "amount": 45.00,
  "userId": "string"
}
```

### 3. 创建支付宝支付订单
```
POST /api/payment/alipay/create
```
**参数:**
```json
{
  "orderId": "string",
  "amount": 45.00,
  "subject": "干洗服务订单"
}
```
**返回:**
```json
{
  "success": true,
  "data": {
    "payUrl": "https://...",
    "qrCode": "https://..."
  }
}
```

### 4. 创建银联支付订单
```
POST /api/payment/unionpay/create
```

### 5. 查询支付状态
```
GET /api/payment/status/{orderId}
```

### 6. 申请退款
```
POST /api/payment/refund
```
**参数:**
```json
{
  "orderId": "string",
  "amount": 45.00,
  "reason": "string"
}
```

### 7. 获取用户余额
```
GET /api/user/balance
```
**返回:**
```json
{
  "success": true,
  "data": {
    "balance": 500.00,
    "frozenBalance": 0,
    "totalBalance": 500.00
  }
}
```

### 8. 余额充值
```
POST /api/user/recharge
```
**参数:**
```json
{
  "amount": 100.00,
  "paymentMethod": "wechat"
}
```

---

## 聚合跑腿服务API (`api/delivery-api.js`)

### 1. 查询可用配送服务商
```
POST /api/delivery/query
```
**参数:**
```json
{
  "pickupAddress": "string",     // 取件地址
  "deliveryAddress": "string",   // 送件地址
  "weight": 3                    // 物品重量（kg）
}
```
**返回:**
```json
{
  "success": true,
  "providers": [
    {
      "id": "meituan",
      "name": "美团跑腿",
      "estimatedTime": "25-35分钟",
      "baseFee": 10,
      "discountFee": 8,
      "rating": 4.8
    },
    {
      "id": "ele",
      "name": "饿了么蜂鸟",
      "estimatedTime": "30-40分钟",
      "baseFee": 12,
      "discountFee": 12,
      "rating": 4.6
    },
    {
      "id": "dada",
      "name": "达达配送",
      "estimatedTime": "35-45分钟",
      "baseFee": 8,
      "discountFee": 7,
      "rating": 4.5
    }
  ]
}
```

### 2. 创建配送订单
```
POST /api/delivery/{providerId}/create
```
**参数:**
```json
{
  "pickupAddress": "string",
  "deliveryAddress": "string",
  "pickupTime": "string",
  "remark": "string",
  "userId": "string",
  "orderSource": "dry_cleaning_app"
}
```
**返回:**
```json
{
  "success": true,
  "deliveryOrderId": "DEL-xxx",
  "status": "pending",
  "estimatedArrival": "15:30",
  "actualFee": 8
}
```

### 3. 查询配送状态
```
GET /api/delivery/status/{deliveryOrderId}
```
**返回:**
```json
{
  "success": true,
  "status": "picked",
  "statusText": "已取件",
  "rider": {
    "name": "张师傅",
    "phone": "138****8888"
  },
  "location": {
    "lat": 39.908,
    "lng": 116.397
  }
}
```

### 4. 取消配送订单
```
POST /api/delivery/cancel
```
**参数:**
```json
{
  "deliveryOrderId": "string"
}
```

---

## 配送状态码说明

| 状态码 | 说明 |
|--------|------|
| pending | 待接单 |
| assigned | 已接单 |
| picked | 已取件 |
| delivering | 配送中 |
| completed | 已完成 |
| cancelled | 已取消 |

---

## 支付方式ID说明

| ID | 说明 |
|----|------|
| wechat | 微信支付 |
| balance | 账户余额 |
| alipay | 支付宝 |
| unionpay | 银行卡支付 |

---

## 文件说明

- `c-index.html` - C端首页
- `c-order.html` - 下单页面（集成跑腿选择）
- `c-payment.html` - 支付页面
- `c-orders.html` - 订单列表
- `c-profile.html` - 个人中心
- `api/payment-api.js` - 支付服务API配置
- `api/delivery-api.js` - 聚合跑腿服务API配置

---

## 注意事项

1. **API预留接口**: 当前所有API调用都已预留接口位置，注释中包含了完整的请求参数和响应格式
2. **模拟数据**: 为了方便开发和测试，所有API都有模拟返回数据
3. **实际接入**: 当真实API就绪时，只需取消注释并替换为真实API调用即可
4. **认证**: 所有API调用都需要在请求头中包含 `Authorization: Bearer {token}`
5. **错误处理**: 所有API都包含错误处理和重试机制
