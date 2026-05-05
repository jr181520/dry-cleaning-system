# 快速开始指南

## 前置要求

- Node.js >= 16.x
- npm >= 8.x
- MongoDB >= 6.0 或 MySQL >= 8.0（任选其一）

## 安装步骤

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 配置环境变量

.env 文件已自动创建，编辑 `backend/.env`:

**使用 MongoDB（推荐）:**
```env
DB_TYPE=mongodb
MONGODB_URI=mongodb://localhost:27017/dry_cleaning
```

**使用 MongoDB Atlas（云数据库）:**
```env
DB_TYPE=mongodb
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dry_cleaning
```

**使用 MySQL:**
```env
DB_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=dry_cleaning
```

### 3. 启动数据库服务

**MongoDB:**
```bash
# macOS (Homebrew)
brew services start mongodb-community

# Windows
net start MongoDB

# Linux
sudo systemctl start mongod
```

**MySQL:**
```bash
# macOS
brew services start mysql

# Windows
net start MySQL

# Linux
sudo systemctl start mysql
```

### 4. 初始化数据库

```bash
# 初始化数据库结构
npm run db:init

# 创建测试数据（可选）
npm run db:seed
```

### 5. 启动服务

```bash
# 生产模式
npm start

# 开发模式（自动重启）
npm run dev
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm start` | 启动服务 |
| `npm run dev` | 开发模式（nodemon） |
| `npm run db:init` | 初始化数据库 |
| `npm run db:seed` | 创建测试数据 |
| `npm run db:reset` | 重置数据库（初始化+种子数据） |
| `npm run migrate:mysql` | 执行 MySQL 迁移（仅 MySQL） |

## 测试账号

创建种子数据后可使用：

| 角色 | 手机号 | 说明 |
|------|--------|------|
| 普通用户 | 13800138001 | 金卡会员 |
| 普通用户 | 13900139002 | 银卡会员 |
| 门店老板 | 13700137001 | 拥有两家门店 |
| 门店员工 | 13600136001 | 旗舰店员工 |

## 验证服务

启动服务后访问：

- API 基地址: http://localhost:3000
- 健康检查: http://localhost:3000/api/health
- 模块状态: http://localhost:3000/api/system/modules

## 故障排除

### MongoDB 连接失败

1. 确认 MongoDB 服务已启动:
   ```bash
   mongosh
   ```

2. 检查连接字符串是否正确

3. 如果使用 MongoDB Atlas，确保 IP 白名单已配置

### MySQL 连接失败

1. 确认 MySQL 服务已启动:
   ```bash
   mysql -u root -p
   ```

2. 检查用户名密码是否正确

3. 确保数据库已创建:
   ```sql
   CREATE DATABASE dry_cleaning;
   ```

### 端口被占用

修改 `backend/.env`:
```env
PORT=3001
```

## 下一步

1. ✅ 数据库连接成功
2. ⬜ 实现干洗模块 API
3. ⬜ 开发前端页面
4. ⬜ 配置微信支付
5. ⬜ 部署上线
