# Git 代码推送指南

## 当前状态

已完成以下代码更改的本地提交：

### 提交1: `feat: 完成连锁企业管理平台开发`
**修改内容：**
- 新增连锁企业管理平台前端页面 (`chain-admin.html`)
- 新增连锁后台API路由模块 (`chainAdminRoutes.js`)
- 完善结算中心功能，支持门店结算权限管理
- 新增价格管理模块 (`priceRoutes.js`, `priceService.js`)
- 新增品类管理模块 (`categoryRoutes.js`, `categoryService.js`)
- 新增数据层级权限服务 (`dataHierarchyService.js`)
- 新增会员管理模块
- 新增配送提供者模块
- 新增消息服务和通知中心
- 完善C端页面和小程序功能

**技术特性：**
- 数据层级权限控制，确保连锁管理员只能访问自己连锁的数据
- 完整的结算中心，支持结算单创建、管理、门店结算权限配置
- 响应式设计，支持桌面和移动端访问
- 模块化架构，前后端分离
- 安全认证，JWT令牌认证
- 新增测试工具和启动脚本

### 提交2: `chore: 添加代码推送脚本，方便后续同步`
**修改内容：**
- 新增 `推送代码.bat` - 一键推送脚本

## 如何手动推送代码

由于网络连接问题，自动推送失败。请按照以下步骤手动推送：

### 方法1：使用命令行推送
```bash
cd "d:\Trae CN\bin\dry_cleaning_system"
git push origin master
```

### 方法2：使用GitHub Desktop
1. 打开GitHub Desktop
2. 选择当前仓库
3. 点击 "Push origin" 按钮

### 方法3：使用推送脚本
运行 `推送代码.bat` 脚本：
1. 双击 `推送代码.bat`
2. 脚本会自动尝试推送

## 网络问题解决方案

如果遇到网络连接问题，请尝试：

### 1. 检查网络连接
```bash
ping github.com
```

### 2. 使用SSH代替HTTPS
```bash
# 设置SSH远程URL
git remote set-url origin git@github.com:jr181520/dry-cleaning-system.git

# 然后推送
git push origin master
```

### 3. 使用GitHub CLI
```bash
# 如果有安装GitHub CLI
gh repo sync
```

### 4. 使用代理（如果需要）
```bash
# 设置Git代理
git config --global http.proxy http://proxy.example.com:8080
git config --global https.proxy https://proxy.example.com:8080

# 推送
git push origin master

# 推送完成后取消代理
git config --global --unset http.proxy
git config --global --unset https.proxy
```

## 重要文件说明

### 新增的核心文件：
1. **`chain-admin.html`** - 连锁企业管理平台前端界面
2. **`backend/modules/admin/routes/chainAdminRoutes.js`** - 连锁后台API路由
3. **`backend/modules/admin/services/adminService.js`** - 增强的管理服务
4. **`CHAIN_ADMIN_PLATFORM.md`** - 平台功能说明文档
5. **`启动连锁管理平台.bat`** - 一键启动脚本
6. **`test-chain-admin-api.js`** - API测试脚本
7. **`test-chain-admin.html`** - 网页测试工具

### 已提交的文件统计：
- 110个文件被修改
- 新增34,493行代码
- 删除3,448行代码
- 新增43个文件

## 下一步操作

1. **推送代码**：按照上述方法推送代码到GitHub
2. **测试平台**：运行 `启动连锁管理平台.bat` 测试连锁管理平台
3. **使用说明**：查看 `CHAIN_ADMIN_PLATFORM.md` 了解功能详情
4. **PM2配置**：如需开机自启动，运行 `安装并启动PM2.bat` 和 `PM2开机自启动.bat`

## 联系支持

如果仍然无法推送，请：
1. 检查GitHub账户权限
2. 确认仓库是否存在
3. 联系网络管理员检查防火墙设置
4. 或者将代码打包通过其他方式分享