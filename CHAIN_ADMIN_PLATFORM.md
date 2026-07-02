# 连锁企业管理平台 - 功能说明

## 概述
连锁企业管理平台是为干洗系统连锁企业提供的管理后台，支持连锁企业对下属门店进行全面管理，包括订单管理、资金管理、结算中心等功能。

## 主要功能模块

### 1. 控制台 (Dashboard)
- **数据总览**：显示连锁企业整体运营数据
+ **今日数据**：今日订单数、今日营收、今日新增用户
+ **累计数据**：总门店数、总用户数、已完成订单数
- **营收趋势**：显示近期的营收变化趋势
- **热门门店**：显示营收最高的门店排名
- **近期订单**：显示最新的订单信息

### 2. 门店管理
- **门店列表**：查看所有下属门店信息
+ **门店基本信息**：名称、编号、地址、联系方式
+ **门店统计信息**：今日订单、今日营收、总用户数
+ **门店状态**：营业状态、评分
- **门店详情**：查看单个门店的详细信息和统计数据
- **门店搜索**：支持按名称、编号搜索门店

### 3. 订单管理
- **订单列表**：查看所有门店的订单
+ **订单筛选**：按状态、门店、日期筛选
+ **订单搜索**：按订单号、客户姓名、电话搜索
- **订单详情**：查看订单详细信息
+ **订单基本信息**：订单号、下单时间、门店
+ **订单内容**：服务项目、数量、价格
+ **订单状态**：待处理、处理中、已完成等
+ **配送信息**：收件人、电话、地址

### 4. 资金管理
- **资金概览**：显示连锁企业资金状况
+ **账户余额**：总余额、可用余额、冻结金额
+ **资金流水**：收入、支出、转账记录
- **门店资金统计**：各门店的资金情况
- **资金趋势**：资金变化趋势分析

### 5. 结算中心 (核心功能)
- **结算概览**：结算数据总览
+ **待结算单数**：需要处理的结算单数量
+ **已完成结算数**：已完成的结算单数量
+ **总结算金额**：所有结算的总金额
+ **待结算门店**：有待结算订单的门店数量
- **结算单管理**：结算单的创建和管理
+ **结算单列表**：查看所有结算单
+ **创建结算单**：为门店生成结算单
+ **结算单详情**：查看结算单详细信息
+ **结算单状态**：待处理、处理中、已完成
- **门店结算权限管理**：管理门店的结算配置
+ **门店类型管理**：自营、加盟、联营
+ **终端结算权限**：控制门店是否开启终端结算
+ **结算比例设置**：设置门店的结算比例
+ **批量配置**：批量更新门店结算配置

### 6. 数据分析
- **门店对比分析**：各门店数据对比
- **用户增长分析**：用户增长趋势分析
- **营收分析**：营收结构分析

### 7. 企业设置
- **企业信息**：连锁企业基本信息
- **套餐管理**：服务套餐设置
- **权限管理**：员工权限设置

## API接口列表

### 认证相关
- `POST /api/auth/staff-login` - 员工登录

### 连锁信息
- `GET /api/chain-admin/info` - 获取连锁企业信息
- `GET /api/chain-admin/dashboard` - 获取仪表盘数据

### 门店管理
- `GET /api/chain-admin/stores` - 获取门店列表
- `GET /api/chain-admin/stores/:id` - 获取门店详情

### 订单管理
- `GET /api/chain-admin/orders` - 获取订单列表
- `GET /api/chain-admin/orders/:id` - 获取订单详情

### 用户管理
- `GET /api/chain-admin/users` - 获取用户列表
- `GET /api/chain-admin/users/:id` - 获取用户详情

### 资金管理
- `GET /api/chain-admin/finance/overview` - 资金概览
- `GET /api/chain-admin/finance/records` - 资金流水记录
- `GET /api/chain-admin/finance/stores` - 门店资金统计
- `GET /api/chain-admin/finance/trend` - 资金趋势

### 结算中心
- `GET /api/chain-admin/settlement/overview` - 结算概览
- `GET /api/chain-admin/settlements` - 结算单列表
- `POST /api/chain-admin/settlements/create` - 创建结算单
- `GET /api/chain-admin/settlement/stores` - 门店结算权限列表
- `PUT /api/chain-admin/settlement/stores/:storeId` - 更新门店结算配置
- `POST /api/chain-admin/settlement/stores/batch-update` - 批量更新门店结算配置

## 数据库模型

### 结算单模型 (Settlement)
```javascript
{
  settlementNo: String,      // 结算单号
  chainId: String,          // 连锁企业ID
  storeId: String,          // 门店ID
  period: String,           // 结算周期
  amount: Number,           // 结算金额
  ratio: Number,            // 结算比例
  status: String,           // 状态: pending/paid/cancelled
  remark: String,           // 备注
  createdBy: String,        // 创建人ID
  createdAt: Date,          // 创建时间
  settlementDate: Date,     // 结算时间
  paidAt: Date,             // 支付时间
  orders: [{                // 包含的订单
    orderId: String,        // 订单ID
    orderNo: String,        // 订单号
    amount: Number,         // 订单金额
    orderDate: Date         // 订单日期
  }]
}
```

## 权限控制

### 角色定义
- **chain_admin**：连锁企业管理员，可以管理自己连锁下的所有门店和数据
- **admin**：超级管理员，可以管理所有连锁企业

### 数据权限
- 连锁管理员只能访问自己连锁企业的数据
- 数据层级权限控制确保数据边界清晰
- 门店数据只能由所属连锁的管理员访问
- 订单数据只能由订单所属门店的连锁管理员访问

## 使用说明

### 1. 启动后端服务
```bash
cd backend
node server.js
```

### 2. 访问平台
- 打开浏览器访问：`http://localhost:3000/chain-admin.html`

### 3. 登录
- 使用连锁管理员账号登录
- 开发模式可以使用默认账号：admin/admin123

### 4. 测试API
- 打开 `test-chain-admin.html` 测试API接口
- 打开 `test-chain-admin-api.js` 运行命令行测试

## 技术特点

### 前端技术
- 纯HTML/CSS/JavaScript实现
- 响应式设计，支持移动端
- 模块化JavaScript代码
- 使用Fetch API进行数据交互
- Tailwind CSS样式框架

### 后端技术
- Node.js + Express框架
- MongoDB数据库
- JWT身份验证
- 数据层级权限控制
- RESTful API设计

### 安全特性
- JWT令牌认证
- 数据权限验证
- 输入验证和过滤
- 防止SQL注入
- 跨域资源共享(CORS)配置

## 部署说明

### 环境要求
- Node.js 14+
- MongoDB 4+
- 现代浏览器

### 部署步骤
1. 安装依赖：`npm install`
2. 配置环境变量：复制 `.env.example` 到 `.env`
3. 启动MongoDB服务
4. 启动后端服务：`node server.js`
5. 访问前端页面

## 故障排除

### 常见问题
1. **API返回401错误**：检查token是否有效，重新登录
2. **API返回403错误**：检查用户权限，确认是否拥有chain_admin角色
3. **API返回404错误**：检查API路径是否正确
4. **数据加载失败**：检查后端服务是否运行，数据库连接是否正常

### 调试方法
1. 查看浏览器开发者工具控制台
2. 检查网络请求状态
3. 查看后端服务日志
4. 使用测试页面验证API

## 未来扩展

### 计划功能
1. **报表导出**：支持数据报表导出为Excel/PDF
2. **消息通知**：系统消息推送
3. **多语言支持**：支持中英文切换
4. **移动端应用**：开发移动端管理APP
5. **API文档**：自动生成API文档

### 优化方向
1. **性能优化**：数据缓存、分页优化
2. **用户体验**：操作流程优化、界面美化
3. **安全性**：增强数据加密、访问控制
4. **监控告警**：系统监控、异常告警

---

**版本**: 1.0.0  
**更新日期**: 2026-07-01  
**维护团队**: 干洗系统开发团队