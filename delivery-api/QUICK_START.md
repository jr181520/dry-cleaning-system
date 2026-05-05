# 聚合配送系统快速使用指南

## ✅ 已完成工作

### 1. 后端聚合配送系统

已创建完整的聚合配送中间层系统，支持三家主流跑腿配送服务商：

**目录结构**：
```
delivery-api/
├── providers/           # 三家服务商实现
│   ├── meituan.js       # 美团配送
│   ├── dada.js          # 达达/京东秒送
│   └── shunfeng.js      # 顺丰同城
├── aggregator.js        # 聚合调度器
├── config.js            # 配置文件
├── server.js           # API服务器
├── test-api.js         # 测试脚本
├── .env.example        # 环境变量示例
└── README.md          # 详细文档
```

**核心功能**：
- ✅ 询价接口：自动查询三家服务商价格并排序
- ✅ 智能推荐：根据价格和时效综合推荐最优方案
- ✅ 订单分发：自动选择最优服务商创建订单
- ✅ 状态追踪：统一查询和取消订单

### 2. 小程序端对接

已更新小程序配送模块，对接真实API：
- ✅ 集成聚合配送API询价
- ✅ 自动选择最优服务商
- ✅ 创建真实配送订单
- ✅ 查询订单状态
- ✅ 网络异常时自动降级到模拟数据

## 🚀 快速开始

### 步骤1：安装并启动后端服务

```bash
cd delivery-api
npm install
npm start
```

### 步骤2：测试API

```bash
node test-api.js
```

### 步骤3：申请真实API密钥

根据需要申请以下服务商API：

**美团配送**：https://developer.meituan.com/
**达达/京东秒送**：https://newopen.imdada.cn/
**顺丰同城**：https://openic.sf-express.com/

### 步骤4：配置密钥

```bash
cp .env.example .env
# 编辑 .env 填入真实密钥
```

### 步骤5：配置小程序

修改 `wechat-mini-app/app.js` 中的API地址为实际服务器地址。

## 📱 核心API

1. **询价**：`GET /api/delivery/query`
2. **创建订单**：`POST /api/delivery/create`
3. **查询状态**：`GET /api/delivery/:provider/:id`
4. **取消订单**：`POST /api/delivery/:provider/:id/cancel`

详细文档请查看：`delivery-api/README.md`
