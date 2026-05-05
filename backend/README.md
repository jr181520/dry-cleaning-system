# 干洗系统后端

> 📖 **完整指南**: [QUICKSTART.md](./QUICKSTART.md) - 详细的安装和配置说明

## 📌 概述

本系统采用渐进式架构设计，支持干洗 → 回收 → 租赁三阶段业务平滑扩展。

### 核心设计原则

1. **数据模型多态** - 通过枚举和 JSON 字段预留扩展
2. **模块化隔离** - 各业务模块独立，启用/禁用灵活
3. **RBAC 权限体系** - 支持多角色权限管理
4. **支付分账预留** - 支持多方分账

---

## 📁 目录结构

```
backend/
├── config/
│   ├── database.js           # 数据库配置
│   ├── index.js              # 数据库连接管理
│   └── modules.js            # 模块开关配置
│
├── modules/
│   ├── common/               # 公共模块
│   │   ├── models/           # 数据模型定义
│   │   │   └── index.js      # 枚举、权限、模型骨架
│   │   ├── services/         # 公共服务
│   │   │   ├── paymentService.js      # 统一支付+分账
│   │   │   ├── creditService.js       # 信用体系
│   │   │   └── notificationService.js # 消息通知
│   │   └── middlewares/       # 公共中间件
│   │       ├── moduleGuard.js   # 模块守卫
│   │       └── rbac.js         # 权限控制
│   │
│   ├── cleaning/              # V1 干洗模块（完整实现）
│   │   ├── routes.js
│   │   └── services/
│   │       ├── orderService.js
│   │       └── pricingService.js
│   │
│   ├── recycle/               # V2 回收模块（空壳）
│   │   └── routes.js          # 返回"服务暂未开放"
│   │
│   └── rental/                 # V3 租赁模块（空壳）
│       └── routes.js          # 返回"服务暂未开放"
│
├── migrations/               # 数据库迁移
│   ├── 001_migrate_to_polymorphic.sql  # MySQL 迁移脚本
│   └── 002_mongodb_schema.js           # MongoDB 模型
│
├── server.js                  # 入口文件
└── .env.example               # 环境变量示例
```

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填写数据库配置
```

### 3. 选择数据库

**MongoDB (推荐):**
```env
DB_TYPE=mongodb
MONGODB_URI=mongodb://localhost:27017/dry_cleaning
```

**MySQL:**
```env
DB_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=dry_cleaning
```

### 4. 启动服务

```bash
node server.js
```

服务启动后输出：
```
╔════════════════════════════════════════════════════════════╗
║          干洗系统后端服务已启动                            ║
╠════════════════════════════════════════════════════════════╣
║  端口: 3000
║  环境: development
║  数据库: MONGODB
╠════════════════════════════════════════════════════════════╣
║  已启用模块:
║    ✓ 干洗服务 (Dry Cleaning)
║                                                            ║
║  待开放模块:
║    ○ 旧衣回收 - 即将上线
║    ○ 服饰租赁 - 即将上线
╚════════════════════════════════════════════════════════════╝
```

---

## 🔧 数据库配置

### MongoDB (推荐用于快速开发)

MongoDB 配置在 `config/database.js` 中：

```javascript
{
  type: 'mongodb',
  mongodb: {
    uri: 'mongodb://localhost:27017/dry_cleaning',
    options: {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000
    }
  }
}
```

### MySQL (推荐用于生产环境)

```javascript
{
  type: 'mysql',
  mysql: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'password',
    database: 'dry_cleaning',
    pool: { min: 5, max: 20 }
  }
}
```

### 数据库连接 API

```javascript
const db = require('./config');

// 初始化数据库
await db.initDatabase();

// MySQL 查询
const rows = await db.query('SELECT * FROM users WHERE id = ?', [id]);

// 事务
await db.transaction(async (conn) => {
  await conn.execute('UPDATE orders SET status = ? WHERE id = ?', ['paid', orderId]);
});

// 关闭连接
await db.closeDatabase();
```

---

## 📡 API 列表

### 系统接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/system/modules` | GET | 获取所有模块状态 |
| `/api/system/modules/:name` | GET | 获取单个模块配置 |
| `/api/health` | GET | 健康检查 |

### 干洗模块

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/cleaning/orders` | POST | 创建订单 |
| `/api/cleaning/orders` | GET | 获取订单列表 |
| `/api/cleaning/orders/:id` | GET | 订单详情 |
| `/api/cleaning/orders/:id/cancel` | POST | 取消订单 |
| `/api/cleaning/orders/:id/receive` | POST | 门店收件 |
| `/api/cleaning/orders/:id/complete` | POST | 完成清洗 |
| `/api/cleaning/pricing` | POST | 价格计算 |
| `/api/cleaning/items` | GET | 获取物品列表 |

### 回收模块（V2）

返回 `{ success: false, error: 'V2功能', message: '服务暂未开放' }`

### 租赁模块（V3）

返回 `{ success: false, error: 'V3功能', message: '服务暂未开放' }`

---

## 🔧 模块开关配置

编辑 `config/modules.js`:

```javascript
modules: {
  cleaning: { enabled: true },  // V1 已启用
  recycle:  { enabled: false },  // V2 待启用
  rental:   { enabled: false }   // V3 待启用
}
```

---

## 💳 分账配置

在 `config/modules.js` 中配置各业务分账比例：

```javascript
payment: {
  // 干洗：平台6%，门店94%
  receivers: { platform: { ratio: 0.06 }, store: { ratio: 0.94 } },
  
  // 回收：用户90%，平台10%
  recycle: { user: 0.90, platform: 0.10 },
  
  // 租赁：所有者70%，品牌15%，平台15%
  rental: { owner: 0.70, brand: 0.15, platform: 0.15 }
}
```

---

## 🔐 角色权限

| 角色 | 说明 |
|------|------|
| `customer` | 普通用户 |
| `store_staff` | 门店员工 |
| `store_owner` | 门店老板 |
| `recycler` | 回收员 |
| `appraiser` | 鉴定师 |
| `brand_admin` | 品牌管理员 |
| `admin` | 系统管理员 |

---

## 📊 数据模型

### 订单（多态）

```javascript
{
  orderType: 'cleaning',  // cleaning | recycle | rental | deposit
  items: [...],
  amounts: { subtotal, discount, deliveryFee, total },
  payment: { status, method, splits: [...] },
  // 业务特定字段
  cleaning: { returnDate, storeReceivedAt },
  recycle: { estimatedPrice, finalPrice },
  rental: { startDate, dueDate, deposit }
}
```

### 物品（多态）

```javascript
{
  itemType: 'dry_cleaning',  // dry_cleaning | recycle | rental
  ownerType: 'user',          // user | store | brand | recycle_shop
  ownerId: 'user_id',
  attributes: { brand, category, material, ... },
  // 业务特定字段
  cleaning: { serviceType, stains },
  recycle: { estimatedPrice, weight },
  rental: { deposit, dailyRate }
}
```

---

## 🛠️ 数据库迁移

### MySQL

```bash
mysql -u root -p database_name < migrations/001_migrate_to_polymorphic.sql
```

### MongoDB

```javascript
// 使用 mongoose 模型
const { User, Order, Item } = require('./migrations/002_mongodb_schema');
```

---

## 📝 下一步

1. 选择数据库（MySQL / MongoDB）
2. 执行迁移脚本
3. 配置数据库连接
4. 启用干洗模块进行测试

---

## 📅 升级路线

| 阶段 | 时间 | 模块 | 功能 |
|------|------|------|------|
| V1 | 0-6个月 | 干洗 | 订单、会员、收衣、取衣、对账 |
| V2 | 6-12个月 | 回收 | 旧衣回收、估价、结算 |
| V3 | 12个月+ | 租赁 | 服饰租赁、信用、鉴定 |
