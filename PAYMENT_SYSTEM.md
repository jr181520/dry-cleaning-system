# 干洗系统支付与结算系统

## 🎯 系统架构

完整的支付系统和资金结算体系，支持多支付方式，实现平台到门店的完整资金流。

```
┌─────────────────────────────────────────────┐
│              用户端（C端）                   │
│                                             │
│  💬 微信支付    💙 支付宝    💳 银行卡支付    │
│  💰 账户余额                                 │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│           支付网关 (payment-server)          │
│                                             │
│  - 统一支付接口                             │
│  - 微信/支付宝/银联/余额                    │
│  - 支付安全（签名、验签）                    │
│  - 异步回调处理                             │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│           资金结算系统                       │
│                                             │
│  用户支付 → 平台收款 → 分账计算              │
│  → T+7结算 → 门店余额 → 提现到账            │
└─────────────────────────────────────────────┘
```

## 📁 目录结构

```
api/payment-server/
├── config.js           # 配置文件（API密钥等）
├── server.js           # 支付网关主服务器
├── wechat-pay.js       # 微信支付模块
├── alipay.js           # 支付宝支付模块
├── unionpay.js         # 银联支付模块
├── balance.js          # 账户余额模块
├── settlement.js       # 资金结算系统
├── README.md          # 完整使用文档
├── QUICK_START.md     # 快速开始指南
└── test-api.js        # API测试脚本

wechat-mini-app/
└── pages/
    └── order/
        └── payment/
            ├── index.js      # 支付页面（已对接API）
            ├── index.wxml    # 支付页面模板
            └── index.wxss    # 支付页面样式

    └── webview/
        ├── index.js         # WebView页面（支付宝/银联跳转）
        ├── index.wxml        # WebView模板
        └── index.wxss        # WebView样式
```

## 🚀 快速开始

### 1. 启动支付服务器

```bash
cd api/payment-server
npm install
npm start
```

服务将在 `http://localhost:3001` 启动。

### 2. 配置API密钥

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入真实的API密钥。

### 3. 测试支付功能

```bash
node test-api.js
```

## 💳 支持的支付方式

| 支付方式 | 状态 | 说明 |
|---------|------|------|
| 💬 微信支付 | ✅ 已完成 | 小程序/H5/APP |
| 💙 支付宝 | ✅ 已完成 | 网页跳转支付 |
| 💳 银行卡/银联 | ✅ 已完成 | 网关支付 |
| 💰 账户余额 | ✅ 已完成 | 平台内部支付 |

## 💰 资金结算链路

### 完整流程

```
1️⃣ 用户选择支付方式 → 微信/支付宝/银联/余额
          ↓
2️⃣ 完成支付 → 资金进入平台账户
          ↓
3️⃣ 订单分账 → 扣除5%平台服务费
          ↓
4️⃣ T+7结算 → 资金转入门店可用余额
          ↓
5️⃣ 门店提现 → 申请提现到银行卡
          ↓
6️⃣ T+1到账 → 资金到账银行卡
```

### 结算配置

- **结算周期**: T+7（可配置）
- **平台服务费**: 5%
- **最低提现金额**: 100元
- **最高提现金额**: 50000元
- **提现到账时间**: T+1

## 📱 小程序端使用

### 支付页面

用户下单后，进入支付页面选择支付方式：

```javascript
// pages/order/payment/index.js
const app = getApp();

Page({
  data: {
    paymentMethods: [
      { id: 'wechat', name: '微信支付', icon: '💬', recommended: true },
      { id: 'balance', name: '账户余额', icon: '💰' },
      { id: 'alipay', name: '支付宝', icon: '💙' },
      { id: 'unionpay', name: '银行卡支付', icon: '💳' }
    ],
    selectedPaymentMethod: 'wechat'
  },

  // 选择支付方式
  onSelectPayment(e) {
    this.setData({ selectedPaymentMethod: e.currentTarget.dataset.id });
  },

  // 确认支付
  async onConfirmPayment() {
    const method = this.data.selectedPaymentMethod;
    
    switch (method) {
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
  }
});
```

### WebView页面

用于支付宝和银联支付的H5跳转：

```
pages/webview/index
```

小程序会自动跳转至此页面，加载外部支付链接。

## 🏪 门店端结算

### 门店账户功能

1. **查看账户余额**
   - 可用余额
   - 冻结余额
   - 待结算金额

2. **结算记录**
   - 结算时间
   - 结算金额
   - 结算状态

3. **提现功能**
   - 绑定银行卡
   - 申请提现
   - 查看提现记录

4. **财务报表**
   - 收支明细
   - 统计分析
   - 导出报表

### API接口

```javascript
// 获取门店账户信息
GET /api/settlement/store/:storeId

// 获取结算记录
GET /api/settlement/store/:storeId/records

// 发起结算
POST /api/settlement/store/:storeId/settle

// 门店提现
POST /api/settlement/store/:storeId/withdraw
{
  "amount": 5000.00,
  "bankAccount": "6222021234567890"
}

// 生成财务报表
POST /api/settlement/report
{
  "startDate": "2025-01-01",
  "endDate": "2025-01-31",
  "storeId": "store_001",
  "type": "detailed"
}
```

## 🔐 安全配置

### 微信支付证书

```bash
mkdir api/payment-server/certs
# 上传以下文件到 certs/ 目录：
# - apiclient_cert.pem
# - apiclient_key.pem
```

### 支付宝密钥

使用支付宝密钥生成工具生成RSA2密钥对。

### 银联证书

```bash
# 上传以下文件到 certs/ 目录：
# - acp_sign.pfx
# - acp_verify.cer
```

## 🧪 测试

### 启动服务
```bash
cd api/payment-server
npm start
```

### 运行测试
```bash
node test-api.js
```

测试项目：
- ✅ 支付接口
- ✅ 余额管理
- ✅ 结算功能
- ✅ 提现功能
- ✅ 报表生成

## 📊 费率说明

| 支付方式 | 费率 | 备注 |
|---------|------|------|
| 微信支付 | 0.6% | 官方标准费率 |
| 支付宝 | 0.6% | 官方标准费率 |
| 银联支付 | 0.7% | 官方标准费率 |
| 账户余额 | 0% | 平台内部支付 |
| 平台服务费 | 5% | 门店收入扣除 |

## 🚀 生产环境部署

### 1. 环境要求

- Node.js 16+
- HTTPS证书（必须）
- 公网可访问的服务器

### 2. 配置域名

```
# Nginx配置示例
server {
    listen 443 ssl;
    server_name api.yourapp.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://127.0.0.1:3001;
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

### 4. 配置回调URL

在微信/支付宝/银联商户后台配置回调URL：

- 微信：`https://api.yourapp.com/api/payment/wechat/notify`
- 支付宝：`https://api.yourapp.com/api/payment/alipay/notify`
- 银联：`https://api.yourapp.com/api/payment/unionpay/notify`

## 📞 技术支持

### 常见问题

1. **微信支付调起失败？**
   - 检查 `openid` 是否正确
   - 检查证书是否配置
   - 检查签名是否正确

2. **支付宝跳转失败？**
   - 检查是否开通H5支付
   - 检查 `returnUrl` 配置
   - 检查密钥算法（RSA2）

3. **结算周期多久？**
   - 默认 T+7，可配置

4. **如何查看资金流水？**
   - 使用财务报表API
   - 查看结算记录

### 日志查看

```bash
# 查看服务器日志
pm2 logs payment-gateway

# 查看实时日志
pm2 logs payment-gateway --lines 100 --nostream
```

## 📋 开发进度

- ✅ 微信支付对接
- ✅ 支付宝支付对接
- ✅ 银联支付对接
- ✅ 账户余额系统
- ✅ 资金结算系统
- ✅ 门店提现功能
- ✅ 财务报表生成
- ✅ 小程序支付页面
- ✅ WebView支付跳转
- 🔄 聚合跑腿API（待完善）

## 📄 许可证

MIT License

## 🔗 相关文档

- [支付服务器完整文档](./api/payment-server/README.md)
- [快速开始指南](./api/payment-server/QUICK_START.md)
- [结算系统说明](./api/payment-server/SETTLEMENT.md)
