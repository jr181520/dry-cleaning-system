# 总后台系统部署与测试规格

## 1. 本地开发环境调试

### 1.1 环境准备
- **开发工具**: VS Code 或其他IDE
- **运行环境**: Node.js 16+
- **依赖管理**: npm 或 yarn
- **本地服务器**: Python http.server 或 Node.js http-server

### 1.2 调试流程
1. **启动本地服务器**:
   ```bash
   # 使用Python内置服务器
   python -m http.server 8000
   
   # 或使用Node.js http-server
   npx http-server -p 8000
   ```

2. **访问应用**:
   - 打开浏览器访问 `http://localhost:8000/admin.html`
   - 检查仪表盘是否正常加载
   - 验证所有功能模块是否可访问

3. **核心流程验证**:
   - 仪表盘数据加载和更新
   - 导航菜单功能
   - 数据CRUD操作
   - 图表渲染
   - 搜索功能
   - 响应式布局

4. **调试工具**:
   - 浏览器开发者工具
   - Console日志
   - Network请求监控
   - LocalStorage数据检查

## 2. 预发布环境部署

### 2.1 环境配置
- **预发布环境**: 专用测试服务器
- **部署路径**: `/var/www/preprod/dry_cleaning_system`
- **访问地址**: `http://preprod.example.com/dry_cleaning_system`

### 2.2 部署流程
1. **构建流程**:
   - 压缩静态文件
   - 优化资源加载
   - 生成部署包

2. **部署脚本**:
   ```bash
   #!/bin/bash
   
   # 项目根目录
   cd /path/to/dry_cleaning_system
   
   # 构建
   npm run build || echo "Build skipped (no build script)"
   
   # 部署到预发布环境
   rsync -av --delete ./* preprod:/var/www/preprod/dry_cleaning_system/
   
   # 验证部署
   curl -I http://preprod.example.com/dry_cleaning_system/admin.html
   ```

3. **部署触发条件**:
   - 本地调试通过后
   - 代码提交到特定分支
   - 手动触发部署命令

## 3. 冒烟测试

### 3.1 测试内容
1. **基础功能测试**:
   - 页面加载速度
   - 导航菜单功能
   - 仪表盘数据显示
   - 图表渲染
   - 搜索功能

2. **数据操作测试**:
   - 客户管理CRUD
   - 物品管理CRUD
   - 数据保存和读取

3. **响应式测试**:
   - 不同屏幕尺寸
   - 移动端适配

### 3.2 测试脚本
```bash
#!/bin/bash

# 冒烟测试脚本
echo "开始冒烟测试..."

# 测试页面可访问性
curl -s -o /dev/null -w "%{http_code}" http://preprod.example.com/dry_cleaning_system/admin.html

# 测试API接口
curl -s -o /dev/null -w "%{http_code}" http://preprod.example.com/api/dashboard/today-metrics

# 测试资源加载
echo "测试静态资源..."
curl -s -o /dev/null http://preprod.example.com/dry_cleaning_system/assets/css/style.css
curl -s -o /dev/null http://preprod.example.com/dry_cleaning_system/assets/js/script.js

echo "冒烟测试完成！"
```

## 4. 生产环境部署

### 4.1 部署限制
- **禁止自动部署**: 必须手动批准
- **部署前检查**: 预发布环境测试通过
- **部署时间**: 低峰期（如凌晨）

### 4.2 部署流程
1. **部署前准备**:
   - 备份生产环境数据
   - 确认预发布环境测试通过
   - 准备回滚方案

2. **手动部署**:
   ```bash
   # 手动执行部署命令
   rsync -av --delete preprod:/var/www/preprod/dry_cleaning_system/ prod:/var/www/prod/dry_cleaning_system/
   ```

3. **部署后验证**:
   - 访问生产环境
   - 验证核心功能
   - 监控系统运行状态

## 5. 状态报告机制

### 5.1 每步完成后输出
1. **本地调试完成**:
   - 输出调试结果
   - 列出发现的问题和解决方案
   - 下一步计划: 部署到预发布环境

2. **预发布部署完成**:
   - 输出部署状态
   - 冒烟测试结果
   - 下一步计划: 等待生产环境部署批准

3. **生产部署完成**:
   - 输出部署状态
   - 生产环境验证结果
   - 下一步计划: 系统监控

### 5.2 自动化报告
- **Slack/Email通知**
- **部署日志**
- **测试结果报告**

## 6. 技术实现

### 6.1 配置文件
```json
// deploy.config.json
{
  "local": {
    "port": 8000,
    "path": "./"
  },
  "preprod": {
    "url": "http://preprod.example.com",
    "path": "/var/www/preprod/dry_cleaning_system",
    "autoDeploy": true
  },
  "prod": {
    "url": "http://prod.example.com",
    "path": "/var/www/prod/dry_cleaning_system",
    "autoDeploy": false
  }
}
```

### 6.2 部署脚本
```javascript
// deploy.js
const fs = require('fs');
const { execSync } = require('child_process');
const config = require('./deploy.config.json');

async function deploy(env) {
  console.log(`开始部署到 ${env} 环境...`);
  
  if (env === 'prod' && !config.prod.autoDeploy) {
    console.error('错误: 生产环境禁止自动部署，请手动执行');
    return;
  }
  
  try {
    // 执行部署命令
    const deployCmd = `rsync -av --delete ./* ${env}:${config[env].path}/`;
    execSync(deployCmd, { stdio: 'inherit' });
    
    console.log(`${env} 环境部署完成！`);
    
    if (env === 'preprod') {
      console.log('开始执行冒烟测试...');
      execSync('./smoke-test.sh', { stdio: 'inherit' });
    }
    
    console.log(`当前状态: ${env} 环境部署成功`);
    console.log(`下一步计划: ${env === 'local' ? '部署到预发布环境' : env === 'preprod' ? '等待生产环境部署批准' : '系统监控'}`);
    
  } catch (error) {
    console.error(`部署失败: ${error.message}`);
  }
}

// 执行部署
const env = process.argv[2] || 'local';
deploy(env);
```

## 7. 风险控制

### 7.1 部署风险
- **数据丢失**: 部署前备份
- **服务中断**: 低峰期部署
- **配置错误**: 环境配置验证

### 7.2 回滚方案
```bash
# 回滚脚本
#!/bin/bash

# 从备份恢复
cp -r /var/www/backup/dry_cleaning_system/* /var/www/prod/dry_cleaning_system/

echo "系统已回滚到备份版本"
```

## 8. 结论

本规格文档详细描述了总后台系统的部署与测试流程，包括本地调试、预发布环境部署、冒烟测试和生产环境部署。通过严格的流程控制和状态报告机制，确保系统部署的安全性和可靠性。