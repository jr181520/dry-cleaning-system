# C端微信登录改造方案

## 改造目标

统一C端（网页）和微信小程序的用户身份，使用相同的 `openid` 作为用户标识，实现订单数据的跨平台同步。

## 问题分析

### 改造前的用户标识

| 平台 | 用户标识 | 问题 |
|------|---------|------|
| 微信小程序 | `openid` | ✅ 正确 |
| C端网页 | `guest_xxx` | ❌ 每次访问生成新的guest ID |
| C端已登录用户 | `phone` (localStorage) | ❌ 与小程序openid不关联 |

**结果**：C端和小程序的订单数据无法共享，用户需要分别下单。

### 改造后的用户标识

| 平台 | 用户标识 | 说明 |
|------|---------|------|
| 微信小程序 | `openid` | 微信授权获取 |
| C端网页 | `openid` (localStorage) | 微信扫码登录获取 |
| 后端数据库 | `openid` 字段 | 统一存储 |

**结果**：只要是同一个微信用户，在小程序和网页端都能看到相同的订单。

## 技术方案

### 1. 后端改造

#### 1.1 用户模型添加 openid 字段

**文件**: `backend/modules/common/services/authService.js`

```javascript
// 用户 Schema
const userSchema = new mongoose.Schema({
  // ... 其他字段
  openid: { type: String, sparse: true, index: true }, // 微信openid
  phone: { type: String, sparse: true, index: true }, // 移除unique约束
  // ...
});

// openid 索引
userSchema.index({ openid: 1 });
```

#### 1.2 微信登录方法改造

**文件**: `backend/modules/common/services/authService.js`

```javascript
async wechatLogin(openid, userData = {}) {
  // 1. 优先通过openid查找用户
  let user = await User.findOne({ openid: openid });
  
  // 2. 如果没找到，尝试旧数据兼容
  if (!user) {
    user = await User.findOne({ phone: openid, createdFrom: 'wechat' });
    if (user) {
      user.openid = openid; // 迁移旧数据
      await user.save();
    }
  }
  
  // 3. 新用户自动注册
  if (!user) {
    user = await User.create({
      userNo: 'U' + Date.now(),
      openid: openid, // 存储openid
      createdFrom: userData.platform || 'wechat'
    });
  }
  
  return { user, token, openid };
}
```

#### 1.3 添加微信网页授权接口

**文件**: `backend/modules/common/routes/authRoutes.js`

新增接口：
- `GET /api/auth/wechat/authorize` - 生成微信授权URL
- `GET /api/auth/wechat/callback` - 授权回调处理

### 2. C端改造

#### 2.1 登录页面添加微信登录

**文件**: `c-login.html`

```javascript
// 微信网页登录
async function wechatWebLogin() {
  // 1. 获取授权URL
  const response = await fetch(`${API_BASE}/wechat/authorize`);
  const result = await response.json();
  
  // 2. 跳转到微信授权页面
  window.location.href = result.data.authorizeUrl;
}

// 微信回调处理
if (urlParams.get('wechat_login') === '1') {
  const openid = urlParams.get('openid');
  const token = urlParams.get('token');
  
  // 保存登录信息
  localStorage.setItem('userToken', token);
  localStorage.setItem('userOpenid', openid); // ✅ 关键：保存openid
}
```

#### 2.2 下单页面使用 openid

**文件**: `c-order.html`

```javascript
// 获取用户ID（优先使用openid）
let userId = localStorage.getItem('userOpenid') || localStorage.getItem('userId');
if (!userId) {
  userId = 'guest_' + Date.now();
}

const orderData = {
  userId: userId,
  openid: localStorage.getItem('userOpenid') || userId,
  // ...
};
```

#### 2.3 订单列表使用 openid 查询

**文件**: `c-orders.html`

```javascript
// 获取用户ID
const openid = localStorage.getItem('userOpenid');
const userId = openid || localStorage.getItem('userId');

// 查询订单
const response = await fetch(`http://localhost:3000/api/cleaning/orders?userId=${userId}`);
```

### 3. 后端订单查询改造

**文件**: `backend/modules/cleaning/routes.js`

```javascript
router.get('/orders', async (req, res) => {
  const { userId, openid } = req.query;
  
  // 支持 userId 或 openid 查询
  const queryUserId = userId || openid;
  
  const result = await orderService.getOrders({
    userId: queryUserId,
    roles: req.user?.roles || ['customer']
  });
  
  res.json({ success: true, data: result });
});
```

## 数据迁移

### 旧用户数据迁移

后端代码已包含自动迁移逻辑：

```javascript
// 在 wechatLogin 中
if (!user) {
  // 尝试查找旧数据
  user = await User.findOne({ phone: openid, createdFrom: 'wechat' });
  
  if (user) {
    // 自动迁移openid
    user.openid = openid;
    await user.save();
  }
}
```

### 手动迁移脚本（如需要）

```javascript
// 在 MongoDB 中执行
db.users.updateMany(
  { createdFrom: 'wechat', openid: { $exists: false } },
  [{ $set: { openid: '$phone' } }]
);
```

## 测试验证

### 测试脚本

双击运行: `测试C端微信登录.bat`

### 手动测试步骤

#### 1. 测试后端API

```bash
# 测试微信登录
curl -X POST http://localhost:3000/api/auth/wechat \
  -H "Content-Type: application/json" \
  -d '{"openid":"test123","nickname":"测试用户"}'
```

#### 2. 测试C端登录

1. 打开浏览器访问: `http://localhost:3000/c-login.html`
2. 点击微信登录按钮
3. 如果未配置微信参数，会自动使用测试模式
4. 登录成功后，检查 localStorage：
   - `userOpenid`: 微信openid
   - `userToken`: 登录token

#### 3. 测试订单同步

1. 在C端下一个订单
2. 打开微信开发者工具
3. 使用相同的微信账号登录小程序
4. 查看订单列表，应该能看到C端下的订单

#### 4. 测试小程序登录

1. 在小程序中登录
2. 检查 localStorage：`openid`
3. 下单
4. 在C端查看订单，应该能看到小程序下的订单

## 微信开放平台配置

### 申请网站应用

1. 访问微信开放平台: https://open.weixin.qq.com
2. 创建网站应用
3. 配置授权回调域
4. 获取 AppID 和 AppSecret

### 环境变量配置

在 `backend/.env` 中添加：

```env
# 微信网页授权（可选，不配置则使用测试模式）
WX_WEB_APP_ID=your_web_appid
WX_WEB_APP_SECRET=your_web_appsecret
WX_WEB_REDIRECT_URI=https://yourdomain.com/api/auth/wechat/callback

# 微信小程序（已有）
WX_MINI_APP_ID=your_mini_appid
WX_MINI_APP_SECRET=your_mini_appsecret
```

## 注意事项

### 1. openid 的唯一性

- 同一个微信用户在不同的应用（小程序/网页）中的 openid 是不同的
- 只有相同应用下的 openid 才能互通
- 建议申请微信 UnionID，实现跨应用用户识别

### 2. 测试模式

未配置微信参数时，系统会自动使用测试模式：
- 生成模拟 openid: `oTest_xxx`
- 仍能完整测试登录、下单、订单同步流程

### 3. 数据兼容性

- 系统已兼容旧的 `guest_xxx` 用户
- 旧用户使用微信登录后，会自动迁移 openid
- 不影响现有订单数据

## 后续优化建议

### 1. UnionID 迁移

申请微信 UnionID 后，可以实现：
- 同一个微信用户在不同应用下使用相同身份
- 小程序、网页、公众号数据完全互通

### 2. 用户绑定

- 微信登录后，可绑定手机号
- 绑定后可通过手机号查找用户
- 支持多种登录方式

### 3. 单点登录

- 实现网页和小程序的状态同步
- 使用 WebSocket 推送订单状态更新
- 跨设备通知

## 文件清单

### 修改的文件

1. `backend/modules/common/services/authService.js` - 添加 openid 字段和迁移逻辑
2. `backend/modules/common/routes/authRoutes.js` - 添加微信授权接口
3. `backend/modules/cleaning/routes.js` - 订单查询支持 openid
4. `c-login.html` - 添加微信登录按钮和回调处理
5. `c-order.html` - 使用 openid 作为用户标识
6. `c-orders.html` - 使用 openid 查询订单

### 新增的文件

1. `测试C端微信登录.bat` - 测试脚本
2. `C端微信登录改造说明.md` - 本文档

## 常见问题

### Q: 为什么需要微信登录？

**A**: 
- 微信小程序使用微信授权登录，自动获取 openid
- C端网页原本没有用户标识，每次访问生成新的 guest ID
- 导致同一用户在小程序和网页的订单无法关联
- 通过微信登录统一用户身份，解决数据同步问题

### Q: 如何区分测试环境和生产环境？

**A**: 
- **测试环境**：未配置微信参数，系统自动使用测试模式
- **生产环境**：配置微信开放平台参数后，使用真实的微信授权

### Q: 旧用户怎么办？

**A**: 
- 旧用户使用微信登录后，会自动迁移 openid
- 如果手机号已绑定，可以通过手机号关联用户
- 不影响现有订单数据

### Q: 如何申请微信开放平台？

**A**: 
1. 访问微信开放平台官网
2. 完成开发者资质认证（需企业认证）
3. 创建网站应用
4. 填写应用信息和授权回调域
5. 等待审核通过后获取 AppID 和 AppSecret

## 总结

通过本次改造，实现了以下目标：

1. ✅ C端网页支持微信登录
2. ✅ 统一使用 openid 作为用户标识
3. ✅ C端和小程序订单数据同步
4. ✅ 向后兼容旧数据和 guest 用户
5. ✅ 提供测试模式，无需真实微信账号即可测试

改造完成后，用户可以通过微信扫码在C端登录，下单后可以在小程序中查看和管理订单，反之亦然。
