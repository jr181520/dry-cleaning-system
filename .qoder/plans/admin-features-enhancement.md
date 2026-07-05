# Admin后台三大功能增强实现计划

## Context
admin后台当前已有门店管理、门店入驻申请、业务管理（多品类）等模块。本次需新增三个能力：
1. 门店按业务品类归类展示
2. BD管理组织架构（门店入驻关联BD下拉选择）
3. 客服中心 + 客服智能体（自动响应订单问题）

## 涉及文件
| 文件 | 作用 |
|------|------|
| `admin.html` | 前端主页面（侧边栏、内容区域、JS逻辑） |
| `backend/modules/admin/services/adminService.js` | 后端服务层（数据模型、业务逻辑） |
| `backend/modules/admin/routes/adminRoutes.js` | 后端API路由 |

---

## Task 1：门店管理 - 业务品类归类

### 1.1 侧边栏：门店管理增加"门店归类"子菜单
- 在 `admin.html` 门店管理 submenu（`#store-management`）中的"智能灯条系统"之后，追加：
  ```html
  <li><a href="#store-categories" class="nav-link ...">
      <i class="fa fa-th-large w-5 text-center"></i><span>门店归类</span>
  </a></li>
  ```

### 1.2 门店列表表格增加品类列
- `loadStoresData()` 渲染表格时，在"服务项目"列后增加"业务品类"列，使用 `categoryMap` 显示品类 emoji + 名称
- 增加品类筛选下拉框（在门店列表顶部工具栏区域）

### 1.3 新增"门店归类"内容区域
- 在 `admin.html` 的 `stores-content` 区域之后，添加 `store-categories-content` section
- 布局：顶部品类标签栏（全部 + 7个品类tab），下方卡片网格展示该品类下的门店
- 每张卡片显示：门店名称、地址、电话、状态、订单数
- 数据来源：复用 `/api/admin/stores` 接口，前端按 `businessCategory` 分组

### 1.4 权限配置
- `permissions['总管理员'].navigation` 数组增加 `'store-categories'`
- `permissions['区域管理员'].navigation` 数组增加 `'store-categories'`

---

## Task 2：BD管理组织架构

### 2.1 后端：BD数据模型（支持层级树形结构）
在 `adminService.js` 中新增 `getBDTeamModel()` 方法：
```javascript
getBDTeamModel() {
  const bdSchema = new mongoose.Schema({
    bdNo: { type: String, unique: true, index: true },
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    region: String,          // 负责区域（如"华东区"）
    level: { type: String, enum: ['junior', 'senior', 'manager', 'director'], default: 'junior' },
    teamName: String,        // 所属团队名称
    parentBdId: String,      // 上级BD的_id（树形结构，空=顶级）
    children: [{ type: String }], // 下级BD的_id列表（辅助查询）
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    storeCount: { type: Number, default: 0 },  // 管理门店数
    totalOrders: { type: Number, default: 0 },
    stats: {
      monthlyNewStores: { type: Number, default: 0 },
      monthlyOrders: { type: Number, default: 0 }
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  });
  return mongoose.models.BDTeam || mongoose.model('BDTeam', bdSchema);
}
```
在 constructor 中初始化 `this.BDTeam = this.getBDTeamModel()`

### 2.2 后端：BD CRUD API（adminService.js + adminRoutes.js）
| 方法 | 路由 | 说明 |
|------|------|------|
| GET | `/api/admin/bd-team` | BD列表（支持分页、搜索、按状态筛选） |
| GET | `/api/admin/bd-team/active` | 仅返回 active 状态的BD（供下拉选择） |
| GET | `/api/admin/bd-team/:id` | BD详情 |
| POST | `/api/admin/bd-team` | 新增BD |
| PUT | `/api/admin/bd-team/:id` | 编辑BD |
| DELETE | `/api/admin/bd-team/:id` | 删除BD（软删除→inactive） |

### 2.3 侧边栏：门店入驻申请增加"BD管理"子菜单
- 在 `admin.html` 门店入驻申请 submenu（`#store-registration`）的"审批管理"之后，追加：
  ```html
  <li><a href="#bd-management" class="nav-link ...">
      <i class="fa fa-id-badge w-5 text-center"></i><span>BD管理</span>
  </a></li>
  ```

### 2.4 BD管理内容区域
- 新增 `bd-management-content` section
- 顶部：统计卡片（BD总数、活跃BD、本月新增门店TOP、本月订单TOP）
- 中部：BD列表表格（姓名、电话、区域、层级、团队、状态、门店数、操作）
- 新增BD弹窗（模态框表单）
- 编辑BD弹窗

### 2.5 门店入驻申请表改造
- 将 BD姓名 `<input>` 改为 `<select>` 下拉框
- 页面加载时调用 `/api/admin/bd-team/active` 获取BD列表填充下拉
- 选择BD后自动填充BD联系电话

### 2.6 权限配置
- 所有角色 navigation 增加 `'bd-management'`

---

## Task 3：客服中心 + 客服智能体

### 3.1 后端：客服工单模型
在 `adminService.js` 新增 `getServiceTicketModel()` 方法：
```javascript
getServiceTicketModel() {
  const ticketSchema = new mongoose.Schema({
    ticketNo: { type: String, unique: true, index: true },
    orderId: String,         // 关联订单
    orderNo: String,
    storeId: String,
    storeName: String,
    customerId: String,
    customerName: String,
    customerPhone: String,
    category: { type: String, enum: ['order_status', 'quality', 'refund', 'delivery', 'payment', 'complaint', 'other'] },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    title: String,
    description: String,
    status: { type: String, enum: ['open', 'processing', 'resolved', 'closed'], default: 'open' },
    assignedTo: String,      // 'ai_agent' 或人工客服ID
    resolution: String,
    conversations: [{
      sender: { type: String, enum: ['customer', 'ai_agent', 'human_agent', 'system'] },
      content: String,
      time: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  });
  return mongoose.models.ServiceTicket || mongoose.model('ServiceTicket', ticketSchema);
}
```

### 3.2 后端：客服智能体（规则引擎，一号员工）
在 `adminService.js` 新增方法：
- `async createTicket(data)` - 创建工单（支持admin手动 + C端提交），自动触发智能体首次响应
- `async aiAgentRespond(ticketId, userMessage)` - 智能体核心规则引擎：
  - **订单状态查询**：关键词包含"订单/状态/进度/到哪了" → 查DB获取订单状态 → 回复当前状态+预计时间
  - **退款问题**：关键词包含"退款/退钱/退还" → 回复退款流程说明（3-5个工作日等）
  - **配送问题**：关键词包含"配送/快递/取件/送货" → 查配送状态并回复
  - **支付问题**：关键词包含"支付/付款/扣款/充值" → 回复支付状态
  - **投诉/投诉**：关键词包含"投诉/不满/差评/举报" → 标记urgent优先级，自动转人工
  - **兜底**：无法识别 → 回复"已记录您的问题，将为您转接人工客服"
- `async getTickets(params)` - 工单列表（支持按状态/优先级/门店筛选）
- `async updateTicket(ticketId, data)` - 更新工单状态/分配
- `async getTicketStats()` - 客服统计数据
- `async submitTicketFromC(data)` - C端用户提交工单接口（通过orderId自动关联）

### 3.3 后端：客服API路由（adminRoutes.js + authRoutes.js）
**Admin端（adminRoutes.js）**：
| 方法 | 路由 | 说明 |
|------|------|------|
| GET | `/api/admin/service-tickets` | 工单列表 |
| GET | `/api/admin/service-tickets/stats` | 客服统计 |
| GET | `/api/admin/service-tickets/:id` | 工单详情 |
| POST | `/api/admin/service-tickets` | 创建工单 |
| POST | `/api/admin/service-tickets/:id/chat` | 发送消息（触发智能体响应） |
| PUT | `/api/admin/service-tickets/:id` | 更新工单状态/分配 |

**C端（authRoutes.js 或公共路由）**：
| 方法 | 路由 | 说明 |
|------|------|------|
| POST | `/api/service-tickets/submit` | C端用户提交工单（需登录，自动关联orderId） |
| GET | `/api/service-tickets/my` | C端用户查看自己的工单列表 |
| GET | `/api/service-tickets/:id` | C端查看工单详情+对话记录 |

### 3.4 侧边栏：业务管理增加"客服中心"子菜单
- 在 `admin.html` 业务管理 submenu（`#business-submenu`）的"全部会员"之后、分隔线之前，追加：
  ```html
  <li><a href="#customer-service" class="nav-link ...">
      <i class="fa fa-headphones w-5 text-center"></i><span>客服中心</span>
  </a></li>
  ```

### 3.5 客服中心内容区域
- 新增 `customer-service-content` section，包含：
  - **顶部统计卡片**：今日工单、待处理、AI处理中、已解决
  - **左侧面板**：工单列表（可按状态/优先级筛选）
  - **右侧面板**：对话界面
    - 顶部显示工单信息（工单号、客户、关联订单、状态）
    - 中部消息列表（区分客户/AI/人工消息样式）
    - 底部输入框 + 发送按钮
  - **智能体状态指示器**：显示"AI一号员工在线"绿色标识

### 3.6 权限配置
- 所有角色 navigation 增加 `'customer-service'`

---

## 实现顺序

1. **Task 1**（门店归类）- 改动最小，主要是前端
2. **Task 2**（BD管理）- 涉及新模型+CRUD+表单改造
3. **Task 3**（客服中心）- 最复杂，涉及新模型+智能体逻辑+对话UI

## BD层级说明
- BD采用 `parentBdId` 字段实现树形结构（director→manager→senior→junior）
- 前端BD管理界面支持展开/折叠查看下级BD
- 新增BD时可选择上级BD，自动维护 parentBdId + children 关系

## 智能体说明
- 基于关键词匹配的规则引擎，无需外部API
- 所有自动回复标记 sender='ai_agent'，人工回复 sender='human_agent'
- 智能体在线状态在客服中心顶部绿色指示灯展示

## 工单来源说明
- Admin端：客服中心手动创建工单
- C端：通过 `/api/service-tickets/submit` 接口提交（关联orderId）
- 创建后智能体自动首次响应

## 验证方式
1. 启动后端服务 `node backend/server.js`
2. 访问 `http://localhost:3000/admin.html`
3. 验证侧边栏三个新菜单项均可见可点击
4. **门店归类**：切换品类tab，确认门店按品类分组显示
5. **BD管理**：
   - 新增BD（选择上级BD，验证层级关系）
   - 编辑BD、查看BD列表（树形展开/折叠）
   - 门店入驻表单：下拉选择BD → 电话自动填充
6. **客服中心**：
   - 手动创建工单 → 查看AI自动回复
   - 在对话框输入消息 → 观察规则引擎响应
   - 验证工单统计卡片数据
   - C端提交工单（可通过API测试）→ admin客服中心可见
