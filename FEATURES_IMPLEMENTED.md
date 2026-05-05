# 功能实现总结

## 最近更新

### ✅ C端用户登录/注册功能

#### 1. 登录页面 (`c-login.html`)
- 手机号 + 密码登录
- 与后端 `/api/auth/login` 对接
- 登录成功保存 token 到 localStorage
- 已登录用户自动跳转到首页
- **测试模式快捷登录**: 点击按钮即可使用测试账号登录

#### 2. 注册页面 (`c-register.html`)
- 手机号 + 验证码 + 密码注册
- 与后端 `/api/auth/register` 对接
- 验证码发送到 `/api/auth/send-code`
- 开发环境下自动显示验证码方便测试

#### 3. 用户中心 (`c-profile.html`)
- 显示用户信息（姓名、手机号、余额、积分）
- 从后端 `/api/auth/profile` 获取最新数据
- **切换账号/退出登录** 功能

#### 4. 全局登录保护
所有C端页面（除登录/注册）都需要登录：
- `c-index.html` - 首页
- `c-order.html` - 下单页
- `c-order-detail.html` - 订单详情
- `c-orders.html` - 订单列表
- `c-payment.html` - 支付页
- `c-order-success.html` - 支付成功页
- `c-stores.html` - 门店列表

未登录自动跳转到登录页

#### 5. 测试账号

| 端 | 登录入口 | 账号 | 角色 |
|----|---------|------|------|
| **C端用户** | `c-login.html` | 13800001001 | 下单用户 |
| **门店端店员** | `m-login.html` | 13900001001 | 店员-处理订单 |
| **门店端店长** | `m-login.html` | 13900001002 | 店长-处理订单 |
| **管理员** | `admin-login.html` | admin / admin123 | 总管理员 |

#### 6. 测试流程
1. 用户登录 `c-login.html` → 点击"用户测试" → 进入C端
2. 用户下单 → 订单保存到localStorage
3. 店员登录 `m-login.html` → 点击"店员测试" → 进入门店端
4. 门店端自动加载用户订单 → 可确认支付/取件/完成订单

#### 6. 后端认证API
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/auth/login` | POST | 用户登录 |
| `/api/auth/register` | POST | 用户注册 |
| `/api/auth/send-code` | POST | 发送验证码 |
| `/api/auth/verify-code` | POST | 验证验证码 |
| `/api/auth/profile` | GET | 获取用户信息 |
| `/api/auth/logout` | POST | 退出登录 |

---

### ✅ C端App和微信小程序订单流程完善

#### 1. 返回首页按钮
- **C端App** (`c-order.html`, `c-order-detail.html`): 添加了明显的"首页"按钮
- **微信小程序** (`pages/order/detail/index.wxml`): 添加了首页图标按钮

#### 2. 订单状态流程
```
待支付 → 已支付 → 配送中 → 已入库 → 处理中 → 待取件 → 完成
```

#### 3. 取件方式选择（待取件状态）
当订单状态变为"待取件"时，用户可以选择：
- **到店自提**: 凭取件码到店取件
- **配送到家**: 填写配送地址，骑手送件上门

#### 4. 一键取货功能
- 管理员可以一键完成同一网点所有待取件订单
- API: `POST /api/admin/store/:storeId/batch-pickup`
- 支持选择特定订单或全部订单

#### 5. 智能灯条取货功能
- 终端网点智能灯条控制
- 支持点亮、关闭操作
- 优先级设置（normal, urgent, vip）

**API接口**:
```bash
GET  /api/admin/store/:storeId/light-status    # 获取灯条状态
POST /api/admin/store/:storeId/light-up       # 点亮取货灯
POST /api/admin/store/:storeId/light-off       # 关闭灯
```

#### 6. 用户信息自动记忆
- 用户下单时自动记忆联系人、电话、地址
- 下次下单时自动填充
- 存储在 localStorage 中

---

## 新增API端点

### 订单API
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/cleaning/orders/:id/pickup-method` | POST | 选择取件方式 |
| `/api/cleaning/orders/batch-pickup` | POST | 一键取货 |
| `/api/cleaning/store/:storeId/light-up` | POST | 点亮智能灯 |
| `/api/cleaning/store/:storeId/light-off` | POST | 关闭智能灯 |
| `/api/cleaning/store/:storeId/light-status` | GET | 获取灯条状态 |

### 管理员API
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/admin/store/:storeId/pending-orders` | GET | 获取待取件订单 |
| `/api/admin/store/:storeId/batch-pickup` | POST | 一键取货 |
| `/api/admin/store/:storeId/light-status` | GET | 灯条状态 |
| `/api/admin/store/:storeId/light-up` | POST | 点亮灯 |
| `/api/admin/store/:storeId/light-off` | POST | 关闭灯 |
| `/api/admin/delivery/orders` | GET | 配送订单列表 |
| `/api/admin/delivery/create` | POST | 创建配送订单 |

---

## 订单状态详细说明

| 状态 | 说明 | 用户操作 |
|------|------|---------|
| `pending` | 待支付 | 去支付 |
| `paid` | 已支付，等待取件 | 查看物流 |
| `delivering` | 配送中（取件） | 查看物流 |
| `received` | 已入库（服务网点） | 催单 |
| `processing` | 处理中（清洗中） | 催单 |
| `ready` | **待取件** | 选择取件方式 |
| `delivering_back` | 配送中（送回） | 查看配送 |
| `completed` | 已完成 | 去评价 |
| `cancelled` | 已取消 | - |

---

## 取件方式流程

### 到店自提
1. 用户选择"到店自提"
2. 系统显示取件码
3. 用户到店出示取件码
4. 门店确认取件，触发智能灯条

### 配送到家
1. 用户选择"配送到家"
2. 填写配送地址、联系人、电话
3. 系统创建配送订单
4. 骑手接单配送
5. 用户确认收货

---

## 文件更新列表

### 后端
- `backend/modules/cleaning/services/orderService.js` - 新增取件方式和灯条方法
- `backend/modules/cleaning/routes.js` - 新增API路由
- `backend/modules/admin/services/adminService.js` - 新增管理和灯条方法
- `backend/modules/admin/routes/adminRoutes.js` - 新增管理API路由

### 前端
- `c-order.html` - 添加返回按钮、用户信息记忆
- `c-order-detail.html` - 添加取件方式选择、返回按钮
- `wechat-mini-app/pages/order/detail/index.js` - 完善订单详情逻辑
- `wechat-mini-app/pages/order/detail/index.wxml` - 完善UI
- `wechat-mini-app/pages/order/detail/index.wxss` - 完善样式

---

## 服务状态

| 服务 | 地址 | 状态 |
|------|------|------|
| 后端API | http://localhost:3000 | ✅ 运行中 |
| 前端页面 | http://localhost:8080 | ✅ 运行中 |
| MongoDB | localhost:27017 | ✅ 已连接 |

---

## 访问地址

- **C端下单页**: http://localhost:8080/c-order.html
- **C端订单详情**: http://localhost:8080/c-order-detail.html
- **C端首页**: http://localhost:8080/c-index.html
- **管理员后台**: http://localhost:8080/admin.html

---

**更新日期**: 2026-04-22
