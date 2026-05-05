# 支付系统快速开始指南

## 🎯 系统概述

本支付系统支持 **4种支付方式**，实现 **完整的资金结算链路**：

### 支付方式
1. 💬 **微信支付** - 小程序/H5/APP
2. 💙 **支付宝** - 网页跳转支付
3. 💳 **银行卡/银联** - 网关支付
4. 💰 **账户余额** - 平台内部支付

### 资金结算链路
```
用户支付 → 平台收款 → 扣除服务费(5%) → T+7结算给门店 → 门店提现
```

## 🚀 快速启动

### 1. 启动支付服务器

```bash
cd api/payment-server
npm install
npm start
```

服务将在 **http://localhost:3001** 启动。

### 2. 测试支付功能

```bash
node test-api.js
```

### 3. 配置小程序

在小程序的 `app.js` 中添加支付服务器地址：

```javascript
globalData: {
  paymentServerUrl: 'http://localhost:3001'
}
```

## 📱 小程序端使用

### 支付页面调用示例

```javascript
// pages/order/payment/index.js

// 选择支付方式
onSelectPayment(e) {
  const paymentId = e.currentTarget.dataset.id;
  this.setData({
    selectedPaymentMethod: paymentId
  });
},

// 确认支付
async onConfirmPayment() {
  const paymentMethod = this.data.selectedPaymentMethod;
  const amount = this.data.orderData.fees.totalAmount;

  switch (paymentMethod) {
    case 'wechat':
      await this.wechatPay();
      break;
    case 'balance':
      await this.balancePay();
      break;
    case 'alipay':
      await this.alipayPay();
      break;
    case 'unionpay':
      await this.unionpayPay();
      break;
  }
},

// 微信支付
async wechatPay() {
  const res = await app.request('/payment/wechat/unified', {
    method: 'POST',
    data: {
      orderId: this.data.orderId,
      totalAmount: amount * 100, // 分
      description: '干洗服务',
      openid: app.globalData.userInfo.openid
    }
  });

  if (res.success && res.data.payParams) {
    await wx.requestPayment(res.data.payParams);
    app.showToast('支付成功', 'success');
  }
},

// 余额支付
async balancePay() {
  const res = await app.request('/payment/balance/pay', {
    method: 'POST',
    data: {
      orderId: this.data.orderId,
      openid: app.globalData.userInfo.openid,
      amount: amount
    }
  });

  if (res.success) {
    app.showToast('支付成功', 'success');
  }
},

// 支付宝支付（跳转到WebView）
async alipayPay() {
  const res = await app.request('/payment/alipay/create', {
    method: 'POST',
    data: {
      orderId: this.data.orderId,
      totalAmount: amount,
      subject: '干洗服务'
    }
  });

  if (res.success && res.data.payUrl) {
    // 跳转到WebView页面
    wx.navigateTo({
      url: `/pages/webview/index?url=${encodeURIComponent(res.data.payUrl)}&type=alipay`
    });
  }
},

// 银联支付（跳转到WebView）
async unionpayPay() {
  const res = await app.request('/payment/unionpay/create', {
    method: 'POST',
    data: {
      orderId: this.data.orderId,
      totalAmount: amount,
      subject: '干洗服务'
    }
  });

  if (res.success && res.data.payUrl) {
    wx.navigateTo({
      url: `/pages/webview/index?url=${encodeURIComponent(res.data.payUrl)}&type=unionpay`
    });
  }
}
```

## 🏪 门店端结算

### 结算流程

1. **用户支付完成** → 资金进入平台账户
2. **订单分账** → 计算平台服务费(5%)和门店应得(95%)
3. **T+7结算** → 资金转入门店可用余额
4. **门店提现** → 申请提现到银行卡

### 门店端API

#### 获取门店账户信息
```javascript
GET /api/settlement/store/:storeId
```

#### 获取结算记录
```javascript
GET /api/settlement/store/:storeId/records
```

#### 发起结算
```javascript
POST /api/settlement/store/:storeId/settle
{
  "settlementCycle": 7
}
```

#### 门店提现
```javascript
POST /api/settlement/store/:storeId/withdraw
{
  "amount": 5000.00,
  "bankAccount": "6222021234567890"
}
```

#### 生成财务报表
```javascript
POST /api/settlement/report
{
  "startDate": "2025-01-01",
  "endDate": "2025-01-31",
  "storeId": "store_001",
  "type": "detailed"
}
```

## ⚙️ 配置说明

### 环境变量 (.env)

```env
# 微信支付
WECHAT_APPID=wx1234567890abcdef
WECHAT_MCHID=1234567890
WECHAT_API_KEY=your_api_key_here
WECHAT_CERT_PATH=./certs/apiclient_cert.pem
WECHAT_CERT_KEY_PATH=./certs/apiclient_key.pem

# 支付宝
ALIPAY_APP_ID=2021001234567890
ALIPAY_PRIVATE_KEY=your_private_key
ALIPAY_PUBLIC_KEY=your_public_key

# 银联
UNIONPAY_MERCHANT_ID=898340183988823
UNIONPAY_SIGN_CERT_PATH=./certs/acp_sign.pfx
UNIONPAY_SIGN_CERT_PWD=your_password

# 服务器
PORT=3001
NODE_ENV=development
```

### 支付开关

在 `config.js` 中可以启用/禁用各支付方式：

```javascript
module.exports = {
  wechat: {
    enabled: true,  // 启用微信支付
    // ...
  },
  alipay: {
    enabled: true,  // 启用支付宝
    // ...
  },
  unionpay: {
    enabled: true,  // 启用银联
    // ...
  },
  balance: {
    enabled: true,  // 启用余额支付
    // ...
  }
};
```

## 🔐 安全说明

### 1. 微信支付证书

必须将微信支付证书放置在 `certs/` 目录：

```bash
mkdir certs
# 上传以下文件：
# - apiclient_cert.pem
# - apiclient_key.pem
```

### 2. 回调URL

确保以下回调URL公网可访问：

- 微信支付：`http://your-domain.com/api/payment/wechat/notify`
- 支付宝：`http://your-domain.com/api/payment/alipay/notify`
- 银联：`http://your-domain.com/api/payment/unionpay/notify`

### 3. HTTPS要求

生产环境**必须使用HTTPS**：
- 微信支付要求HTTPS
- 支付宝要求HTTPS
- 银联要求HTTPS

## 💡 常见问题

### Q1: 微信支付调起失败？

检查：
1. `openid` 是否正确获取
2. 小程序appid是否与支付配置一致
3. 证书是否正确配置
4. 签名是否正确

### Q2: 支付宝跳转失败？

检查：
1. 支付宝应用是否开通H5支付
2. `returnUrl` 是否正确配置
3. 密钥是否使用RSA2算法生成

### Q3: 余额不足？

解决方案：
1. 引导用户充值余额
2. 使用其他支付方式
3. 提供余额不足提示

### Q4: 结算周期多久？

- 默认 **T+7** 结算
- 可配置为 T+1, T+3, T+7 等
- 节假日顺延

### Q5: 如何查看资金流水？

```javascript
// 用户交易记录
GET /api/balance/:userId/transactions

// 门店结算记录
GET /api/settlement/store/:storeId/records
```

## 📊 费率说明

| 项目 | 费率 | 说明 |
|------|------|------|
| 微信支付 | 0.6% | 官方标准费率 |
| 支付宝 | 0.6% | 官方标准费率 |
| 银联支付 | 0.7% | 官方标准费率 |
| 余额支付 | 0% | 平台内部支付 |
| 平台服务费 | 5% | 从门店收入中扣除 |

## 🧪 测试清单

启动服务后，运行测试脚本：

```bash
node test-api.js
```

检查清单：
- ✅ 健康检查通过
- ✅ 余额支付成功
- ✅ 微信支付接口调用成功
- ✅ 支付宝接口调用成功
- ✅ 银联接口调用成功
- ✅ 结算功能正常
- ✅ 提现功能正常

## 📞 技术支持

如有问题，请检查：

1. **服务器日志**：查看 `npm start` 的控制台输出
2. **API密钥**：确认 `.env` 文件配置正确
3. **证书文件**：确认证书路径和权限正确
4. **网络连接**：确保回调URL可公网访问

## 🎉 下一步

1. ✅ 启动支付服务器
2. ✅ 测试支付功能
3. ✅ 配置API密钥
4. ✅ 部署到生产环境
5. ✅ 监控支付情况

详细文档请查看：
- [完整README](./README.md)
- [结算系统说明](./SETTLEMENT.md)
- [API接口文档](./API.md)
