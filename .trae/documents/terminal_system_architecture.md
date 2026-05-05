# 终端操作系统架构设计

## 1. 前端架构

### 1.1 技术栈
- **HTML5**: 页面结构
- **CSS3/Tailwind CSS**: 样式设计
- **JavaScript (ES6+)**: 业务逻辑
- **Font Awesome**: 图标库
- **Chart.js**: 数据可视化
- **jsQR**: QR码扫描

### 1.2 代码组织
```
├── index.html          # 主页面
├── js/                # JavaScript文件夹
│   ├── app.js         # 主应用逻辑
│   ├── navigation.js  # 导航功能
│   ├── orders.js      # 订单管理
│   ├── customers.js   # 客户管理
│   ├── items.js       # 物品管理
│   ├── members.js     # 会员管理
│   ├── light.js       # 智能灯条系统
│   ├── statistics.js  # 统计分析
│   ├── messages.js    # 消息中心
│   ├── settings.js    # 系统设置
│   └── api.js         # API通信
└── api/               # API文件夹
    └── delivery.js    # 配送API
```

### 1.3 状态管理
- 使用`localStorage`存储用户会话和本地数据
- 使用全局变量管理应用状态
- 实现简单的发布-订阅模式处理组件间通信

### 1.4 导航系统
- 基于哈希路由的单页应用导航
- 侧边栏菜单与内容区域的联动
- 页面切换动画和过渡效果

## 2. 页面结构

### 2.1 主布局
- **顶部导航栏**: 搜索功能、门店选择、通知中心、用户信息
- **侧边导航栏**: 功能菜单，包括仪表盘、订单管理、客户管理等
- **主内容区域**: 根据导航切换显示不同功能模块
- **状态栏**: 显示当前时间、今日订单数、待取件数等

### 2.2 核心页面

#### 2.2.1 仪表盘
- 统计卡片: 今日收入、今日订单、待处理订单、会员数量
- 图表: 收入趋势、订单趋势、客户分布
- 快速操作: 新建订单、快速扫描、查看待处理订单

#### 2.2.2 订单管理
- 订单列表: 所有订单的概览
- 订单详情: 单个订单的详细信息
- 订单状态: 待处理、处理中、待取件、已完成、已取消
- 订单操作: 新建、编辑、删除、标记状态

#### 2.2.3 客户管理
- 客户列表: 所有客户的概览
- 客户详情: 单个客户的详细信息
- 客户标签: 普通客户、会员、VIP
- 客户操作: 新建、编辑、删除、查看历史订单

#### 2.2.4 物品管理
- 物品列表: 所有物品的概览
- 物品分类: 衣物、家居用品、特殊物品等
- 物品详情: 物品名称、类别、价格、处理状态
- 物品操作: 新建、编辑、删除、批量处理

#### 2.2.5 会员管理
- 会员列表: 所有会员的概览
- 会员等级: 普通会员、银卡会员、金卡会员、钻石会员
- 会员详情: 会员信息、积分、储值、消费记录
- 会员操作: 新建、编辑、删除、充值、积分管理

#### 2.2.6 智能灯条系统
- 灯条状态: 在线/离线
- 灯条控制: 开启/关闭、亮度调节、颜色选择
- 模式切换: 正常模式、节日模式、促销模式
- 状态监控: 能耗统计、故障报警

#### 2.2.7 统计分析
- 收入分析: 日/周/月/年收入趋势
- 订单分析: 订单数量、平均订单金额、订单状态分布
- 客户分析: 客户数量、客户增长、客户消费习惯
- 物品分析: 物品分类分布、热门物品

#### 2.2.8 消息中心
- 消息列表: 所有消息的概览
- 消息详情: 消息内容、发送时间、状态
- 消息分类: 系统消息、订单消息、客户消息
- 消息操作: 标记已读、删除、回复

## 3. API设计

### 3.1 与总后台的通信
- **API基础路径**: `/api`
- **认证方式**: JWT令牌
- **数据格式**: JSON

### 3.2 核心API接口

#### 3.2.1 认证接口
- `POST /api/auth/login`: 用户登录
- `POST /api/auth/logout`: 用户登出
- `GET /api/auth/refresh`: 刷新令牌

#### 3.2.2 订单接口
- `GET /api/orders`: 获取订单列表
- `GET /api/orders/:id`: 获取订单详情
- `POST /api/orders`: 创建新订单
- `PUT /api/orders/:id`: 更新订单
- `DELETE /api/orders/:id`: 删除订单

#### 3.2.3 客户接口
- `GET /api/customers`: 获取客户列表
- `GET /api/customers/:id`: 获取客户详情
- `POST /api/customers`: 创建新客户
- `PUT /api/customers/:id`: 更新客户信息
- `DELETE /api/customers/:id`: 删除客户

#### 3.2.4 物品接口
- `GET /api/items`: 获取物品列表
- `GET /api/items/:id`: 获取物品详情
- `POST /api/items`: 创建新物品
- `PUT /api/items/:id`: 更新物品信息
- `DELETE /api/items/:id`: 删除物品

#### 3.2.5 会员接口
- `GET /api/members`: 获取会员列表
- `GET /api/members/:id`: 获取会员详情
- `POST /api/members`: 创建新会员
- `PUT /api/members/:id`: 更新会员信息
- `DELETE /api/members/:id`: 删除会员

#### 3.2.6 门店接口
- `GET /api/stores`: 获取门店列表
- `GET /api/stores/:id`: 获取门店详情
- `PUT /api/stores/:id`: 更新门店信息

#### 3.2.7 统计接口
- `GET /api/statistics/revenue`: 获取收入统计
- `GET /api/statistics/orders`: 获取订单统计
- `GET /api/statistics/customers`: 获取客户统计
- `GET /api/statistics/items`: 获取物品统计

#### 3.2.8 消息接口
- `GET /api/messages`: 获取消息列表
- `GET /api/messages/:id`: 获取消息详情
- `POST /api/messages`: 发送消息
- `PUT /api/messages/:id/read`: 标记消息已读
- `DELETE /api/messages/:id`: 删除消息

## 4. 数据结构

### 4.1 订单数据结构
```javascript
{
  id: String,           // 订单ID
  customerId: String,   // 客户ID
  customerName: String, // 客户名称
  customerPhone: String, // 客户电话
  items: [              // 物品列表
    {
      id: String,       // 物品ID
      name: String,     // 物品名称
      category: String,  // 物品分类
      quantity: Number,  // 数量
      price: Number,     // 价格
      status: String     // 处理状态
    }
  ],
  totalPrice: Number,   // 总价格
  status: String,       // 订单状态
  createdAt: Date,      // 创建时间
  updatedAt: Date,      // 更新时间
  pickupTime: Date,     // 取件时间
  notes: String         // 备注
}
```

### 4.2 客户数据结构
```javascript
{
  id: String,           // 客户ID
  name: String,         // 客户名称
  phone: String,        // 客户电话
  email: String,        // 客户邮箱
  address: String,      // 客户地址
  memberId: String,     // 会员ID (如果是会员)
  level: String,        // 客户等级
  createdAt: Date,      // 创建时间
  updatedAt: Date,      // 更新时间
  lastOrderAt: Date     // 最后订单时间
}
```

### 4.3 物品数据结构
```javascript
{
  id: String,           // 物品ID
  name: String,         // 物品名称
  category: String,      // 物品分类
  price: Number,         // 价格
  description: String,   // 描述
  status: String,        // 状态
  orderId: String,       // 所属订单ID
  createdAt: Date,       // 创建时间
  updatedAt: Date        // 更新时间
}
```

### 4.4 会员数据结构
```javascript
{
  id: String,           // 会员ID
  customerId: String,   // 客户ID
  level: String,        // 会员等级
  points: Number,       // 积分
  balance: Number,      // 储值余额
  createdAt: Date,      // 创建时间
  updatedAt: Date,      // 更新时间
  expiryDate: Date      // 到期时间
}
```

### 4.5 门店数据结构
```javascript
{
  id: String,           // 门店ID
  name: String,         // 门店名称
  address: String,      // 门店地址
  phone: String,        // 门店电话
  manager: String,      // 门店经理
  status: String,       // 门店状态
  createdAt: Date,      // 创建时间
  updatedAt: Date       // 更新时间
}
```

### 4.6 消息数据结构
```javascript
{
  id: String,           // 消息ID
  type: String,         // 消息类型
  title: String,        // 消息标题
  content: String,      // 消息内容
  status: String,       // 消息状态
  sender: String,       // 发送者
  recipient: String,    // 接收者
  createdAt: Date,      // 创建时间
  readAt: Date          // 阅读时间
}
```

## 5. 系统集成

### 5.1 与总后台的集成
- 通过API接口实现数据同步
- 总后台可以查看所有终端的数据
- 终端可以获取总后台的配置和指令

### 5.2 多终端协同
- 支持多个终端同时登录同一门店
- 实时数据同步，避免数据冲突
- 权限管理，不同角色有不同操作权限

### 5.3 离线功能
- 支持离线操作，网络恢复后自动同步
- 本地数据缓存，确保系统稳定性
- 离线模式下的功能限制和提示

## 6. 性能优化

### 6.1 前端优化
- 代码压缩和混淆
- 图片优化和懒加载
- 组件按需加载
- 缓存策略优化

### 6.2 后端优化
- API响应时间优化
- 数据库查询优化
- 服务器资源分配
- 负载均衡

### 6.3 用户体验优化
- 响应式设计，适配不同设备
- 操作流程简化，减少用户操作步骤
- 实时反馈，提供操作状态提示
- 错误处理和用户引导

## 7. 安全考虑

### 7.1 前端安全
- XSS防护
- CSRF防护
- 输入验证
- 敏感信息保护

### 7.2 后端安全
- 身份验证和授权
- API访问控制
- 数据加密
- 安全日志

### 7.3 数据安全
- 数据备份和恢复
- 数据传输加密
- 数据存储安全
- 隐私保护

## 8. 未来扩展

### 8.1 功能扩展
- 移动应用开发
- 自助取件系统
- 在线支付集成
- 会员积分系统

### 8.2 技术扩展
- 微服务架构
- 容器化部署
- 人工智能应用
- 物联网集成

### 8.3 业务扩展
- 多门店管理
- 连锁经营支持
- 数据分析和预测
- 客户关系管理