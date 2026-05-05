# 聚合配送系统使用指南

## 概述

本系统对接了三大主流跑腿配送服务商：
- 🚗 **美团跑腿** (meituan)
- 📦 **顺丰跑腿** (shunfeng)
- 🚚 **京东秒送/达达** (dada)

## 快速开始

### 1. 安装依赖

```bash
cd delivery-api
npm install
```

### 2. 配置API密钥

复制环境变量配置示例文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入真实API密钥：

```env
# 美团配送（申请地址：https://developer.meituan.com/）
MEITUAN_TEST_APP_ID=your_app_id
MEITUAN_TEST_SECRET=your_secret
MEITUAN_PROD_APP_ID=your_prod_app_id
MEITUAN_PROD_APP_SECRET=your_prod_secret

# 达达/京东秒送（申请地址：https://newopen.imdada.cn/）
DADA_TEST_APP_KEY=your_app_key
DADA_TEST_APP_SECRET=your_app_secret
DADA_PROD_APP_KEY=your_prod_app_key
DADA_PROD_APP_SECRET=your_prod_app_secret

# 顺丰同城（申请地址：https://openic.sf-express.com/）
SHUNFENG_TEST_APP_ID=your_app_id
SHUNFENG_TEST_APP_KEY=your_app_key
SHUNFENG_TEST_SECRET=your_secret
SHUNFENG_PROD_APP_ID=your_prod_app_id
SHUNFENG_PROD_APP_KEY=your_prod_app_key
SHUNFENG_PROD_APP_SECRET=your_prod_secret
```

### 3. 启动服务

```bash
# 开发环境
npm run dev

# 生产环境
npm start
```

服务将在 `http://localhost:3001` 启动。

## API接口

### 询价接口

查询多家服务商的配送价格：

```bash
GET /api/delivery/query?pickupAddress=北京市朝阳区XX&dropoffAddress=北京市海淀区XX&weight=1&cityName=北京
```

响应示例：
```json
{
  "success": true,
  "quotes": [
    {
      "provider": "dada",
      "providerName": "京东秒送",
      "price": 8.50,
      "estimateTime": 35,
      "distance": "4.0km"
    },
    {
      "provider": "meituan",
      "providerName": "美团跑腿",
      "price": 10.00,
      "estimateTime": 30,
      "distance": "3.5km"
    },
    {
      "provider": "shunfeng",
      "providerName": "顺丰跑腿",
      "price": 15.00,
      "estimateTime": 25,
      "distance": "3.8km"
    }
  ],
  "recommended": {
    "provider": "dada",
    "providerName": "京东秒送"
  }
}
```

### 创建订单

创建配送订单：

```bash
POST /api/delivery/create
Content-Type: application/json

{
  "pickupAddress": "北京市朝阳区建国路88号",
  "dropoffAddress": "北京市海淀区中关村大街1号",
  "customerName": "张三",
  "customerPhone": "13800138001",
  "shopName": "干洗店",
  "shopPhone": "010-12345678",
  "goodsDesc": "西装一套",
  "weight": 1,
  "cityName": "北京",
  "orderId": "ORD-2025-001"
}
```

### 查询订单状态

```bash
GET /api/delivery/:provider/:orderId
```

示例：
```bash
GET /api/delivery/meituan/M123456789
```

### 取消订单

```bash
POST /api/delivery/:provider/:orderId/cancel
Content-Type: application/json

{
  "reason": "用户取消"
}
```

## 小程序端配置

修改 `wechat-mini-app/app.js` 中的API地址：

```javascript
globalData: {
  deliveryApi: {
    baseUrl: 'http://your-server-ip:3001/api',  // 修改为实际服务器地址
    providers: ['meituan', 'dada', 'shunfeng']
  }
}
```

## 服务商申请指南

### 美团配送

1. 访问 [美团配送开放平台](https://developer.meituan.com/)
2. 注册开发者账号
3. 提交应用审核（3-5个工作日）
4. 获取 AppId 和 Secret
5. 签署配送服务协议

### 京东秒送/达达

1. 访问 [达达开放平台](https://newopen.imdada.cn/)
2. 注册开发者账号
3. 创建应用获取 AppKey
4. 签署配送服务协议

### 顺丰同城

1. 访问 [顺丰同城开放平台](https://openic.sf-express.com/)
2. 注册企业账号
3. 提交企业资质审核
4. 创建应用获取 AppId 和 AppKey
5. 签署配送服务协议

## 注意事项

1. **生产环境测试**：所有接口都提供了测试和生产两套环境，请务必在测试环境验证后再切换到生产环境
2. **签名机制**：每个平台的签名算法不同，请仔细阅读各平台的API文档
3. **回调配置**：需要配置公网可访问的回调URL来接收订单状态变更通知
4. **账户余额**：确保服务商账户有足够的余额来支付配送费用
5. **错误处理**：建议实现重试机制，处理网络异常和服务商接口不稳定的情况

## 故障排查

### 询价返回空

- 检查API密钥是否配置正确
- 确认服务商账户状态是否正常
- 查看服务器日志中的错误信息

### 订单创建失败

- 检查地址格式是否正确
- 确认服务范围是否在服务商覆盖范围内
- 查看错误码对照表

### 回调通知收不到

- 确认回调URL是否公网可访问
- 检查防火墙是否放行回调端口
- 验证回调Token是否正确
