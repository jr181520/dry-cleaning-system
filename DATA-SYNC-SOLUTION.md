# 干洗店系统 - 数据同步方案

**日期**: 2026-04-26  
**版本**: 1.0

---

## 📋 问题背景

用户反映：**C端显示订单已支付待处理，但m-index和admin显示订单未支付**

### 原因分析

目前系统中存在**两套独立的订单数据**：

1. **C端订单** (`localStorage.getItem('orders')`)
   - 存储在C端用户的浏览器中
   - C端下单后立即存储到这里
   - 包含完整的订单信息（支付状态等）

2. **门店端订单** (`localStorage.getItem('store_orders')`)
   - 存储在门店端的浏览器中
   - 需要手动同步或通过特定机制更新
   - admin后台也从这里读取

**问题根源**：两套数据没有自动同步机制，导致C端已支付的订单在门店端看不到。

---

## 🔄 数据同步方案

### 方案1：基于轮询的API同步（推荐 - 适合当前系统）

**原理**：定时向服务器请求最新订单数据，更新本地localStorage

**优点**：
- 实现简单，稳定可靠
- 适合中小型应用
- 不需要WebSocket服务器
- 易于调试和维护

**缺点**：
- 有延迟（取决于轮询间隔）
- 对服务器有一定压力

**实现代码**：

```javascript
// 数据同步管理器
const OrderSyncManager = {
    // 配置
    config: {
        apiBaseUrl: 'http://localhost:3000/api', // API地址
        syncInterval: 5000, // 5秒同步一次
        syncTimer: null,
        isEnabled: false
    },
    
    // 启动同步
    start: function() {
        if (this.config.isEnabled) return;
        
        console.log('【同步】启动订单数据同步...');
        this.config.isEnabled = true;
        
        // 立即执行一次同步
        this.sync();
        
        // 设置定时同步
        this.config.syncTimer = setInterval(() => {
            this.sync();
        }, this.config.syncInterval);
    },
    
    // 停止同步
    stop: function() {
        if (this.config.syncTimer) {
            clearInterval(this.config.syncTimer);
            this.config.syncTimer = null;
        }
        this.config.isEnabled = false;
        console.log('【同步】停止订单数据同步');
    },
    
    // 执行同步
    sync: async function() {
        try {
            console.log('【同步】正在同步订单数据...');
            
            // 1. 从服务器获取最新订单
            const response = await fetch(`${this.config.apiBaseUrl}/orders`);
            const serverOrders = await response.json();
            
            // 2. 合并到本地
            this.mergeOrders(serverOrders);
            
            // 3. 上传本地未同步的订单
            await this.uploadLocalOrders();
            
            console.log('【同步】同步完成');
            
        } catch (error) {
            console.error('【同步】同步失败:', error);
        }
    },
    
    // 合并订单数据
    mergeOrders: function(serverOrders) {
        const localStoreOrders = JSON.parse(localStorage.getItem('store_orders') || '[]');
        const localCOrders = JSON.parse(localStorage.getItem('orders') || '[]');
        
        // 合并门店订单
        serverOrders.forEach(serverOrder => {
            const exists = localStoreOrders.find(o => o.orderId === serverOrder.orderId);
            if (!exists) {
                localStoreOrders.push(serverOrder);
            } else {
                // 如果本地数据较旧，更新为服务器数据
                const localTime = new Date(exists.updatedAt || 0);
                const serverTime = new Date(serverOrder.updatedAt || 0);
                if (serverTime > localTime) {
                    Object.assign(exists, serverOrder);
                }
            }
        });
        
        localStorage.setItem('store_orders', JSON.stringify(localStoreOrders));
        
        // 同样合并C端订单
        localStorage.setItem('orders', JSON.stringify(localStoreOrders));
        
        // 触发UI更新
        window.dispatchEvent(new Event('ordersUpdated'));
    },
    
    // 上传本地订单到服务器
    uploadLocalOrders: async function() {
        const localStoreOrders = JSON.parse(localStorage.getItem('store_orders') || '[]');
        
        // 找出未同步的订单
        const unsyncedOrders = localStoreOrders.filter(o => !o.syncedToServer);
        
        for (const order of unsyncedOrders) {
            try {
                await fetch(`${this.config.apiBaseUrl}/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(order)
                });
                
                // 标记为已同步
                order.syncedToServer = true;
            } catch (error) {
                console.error('上传订单失败:', order.orderId, error);
            }
        }
        
        localStorage.setItem('store_orders', JSON.stringify(localStoreOrders));
    }
};
```

**使用方法**：

```javascript
// 在m-index.html的初始化代码中添加：
document.addEventListener('DOMContentLoaded', function() {
    // ... 其他初始化代码 ...
    
    // 启动订单同步
    OrderSyncManager.start();
    
    // 监听订单更新事件，刷新UI
    window.addEventListener('ordersUpdated', function() {
        loadOrderList();
        loadStoreOrders();
    });
});

// 在页面离开时停止同步
window.addEventListener('beforeunload', function() {
    OrderSyncManager.stop();
});
```

---

### 方案2：基于WebSocket的实时同步（进阶）

**原理**：使用WebSocket建立持久连接，服务器主动推送订单更新

**优点**：
- 实时性极高（毫秒级）
- 服务器主动推送，效率高
- 支持更多实时场景（聊天、通知等）

**缺点**：
- 实现复杂
- 需要WebSocket服务器
- 连接管理复杂
- 不适合所有环境

---

## 📱 微信小程序与C端的数据同步

### 架构说明

微信小程序和C端（H5）本质上是两个不同的前端应用，它们共享同一个后端服务器。

```
┌─────────────────┐
│  微信小程序端   │
│  (微信环境)     │
└────────┬────────┘
         │
         │ HTTP/WebSocket
         ↓
┌─────────────────────────────────┐
│       后端服务器 (Node.js)       │
│       localhost:3000            │
│       - REST API                │
│       - WebSocket Server        │
│       - MongoDB数据库           │
└────────────────┬────────────────┘
                 │
         ┌───────┴────────┐
         ↓                ↓
┌─────────────┐    ┌─────────────┐
│  C端H5应用  │    │ 门店端应用  │
│ (浏览器环境) │    │  (m-index)  │
└─────────────┘    └─────────────┘
```

### 同步方案

#### 统一API接口（推荐）

**原理**：所有前端应用都通过相同的API接口与后端交互

**优势**：
1. 数据一致性有保障
2. 易于维护和扩展
3. 支持多端同步
4. 便于添加微信小程序

---

## 🔧 扫码功能方案

### 扫码更新物品状态流程

```
1. 物品入库 → 生成唯一二维码/条形码
2. 粘贴标签 → 每件物品独立标签
3. 扫码识别 → 扫描枪或手机扫码
4. 自动定位 → 找到对应的订单和物品
5. 状态更新 → 自动更新物品状态
6. 通知客户 → 发送微信/短信通知
```

### 已实现功能

在m-index.html中，我已经实现了物品状态管理功能：

```javascript
// 查看订单详情时，可以看到物品状态管理区域
// 每个物品都有独立的状态选择器
// 支持扫码更新（预留接口）
```

---

## 🎯 推荐实施方案

### 当前阶段（开发测试期）

**推荐使用**：方案1 - 轮询同步

**理由**：
1. 实现简单，快速见效
2. 不需要额外的基础设施
3. 易于调试和修改
4. 适合当前的数据量

**实现步骤**：
1. 添加OrderSyncManager到所有前端页面
2. 设置5-10秒的同步间隔
3. 实现基本的API接口
4. 测试数据同步是否正常

### 下一阶段（生产环境）

**推荐使用**：方案1 + 方案2 混合

**策略**：
1. 主要使用轮询同步（简单可靠）
2. 对于需要实时性的场景（如新订单通知）使用WebSocket
3. 使用微信小程序云开发同步小程序数据

---

## 📝 已完成的改进

### 1. m-index.html 账号切换功能 ✅

**位置**：右上角人头图标

**功能**：
- 点击用户头像打开下拉菜单
- 显示当前账号信息
- 切换账号（ST001/ST002/ST003）
- 查看个人信息
- 退出登录

### 2. m-index.html 订单物品状态管理 ✅

**位置**：订单详情弹窗中的"物品状态管理"区域

**功能**：
- 查看每个物品的当前状态
- 手动更新物品状态（待处理→清洗中→已清洗→待取件→已完成）
- 预留扫码更新接口

### 3. 订单状态完整流转 ✅

```
待支付 (pending)
    ↓
待处理 (paid) ← C端下单支付
    ↓
清洗中 (cleaning)
    ↓
清洗完成 (cleaned)
    ↓
待取件 (ready)
    ↓
已完成 (completed)
```

---

## 📋 待实施清单

### Phase 1: 紧急修复（数据同步）

- [ ] 在m-index.html添加OrderSyncManager
- [ ] 在admin.html添加OrderSyncManager
- [ ] 实现后端/api/orders接口
- [ ] 测试C端下单后门店端能否看到

### Phase 2: 功能完善（扫码功能）

- [ ] 设计物品二维码格式
- [ ] 实现二维码生成功能
- [ ] 实现扫码枪监听
- [ ] 实现扫码更新物品状态

### Phase 3: 生产准备

- [ ] 实现WebSocket实时推送
- [ ] 添加同步状态指示器
- [ ] 实现离线模式
- [ ] 性能优化

---

## ❓ 常见问题

### Q1: 轮询会不会给服务器太大压力？

**A**: 对于中小型应用（订单量 < 1000/天），5-10秒轮询完全没问题。可以根据实际情况调整间隔。

### Q2: 网络不稳定时怎么办？

**A**: 
1. 添加重试机制
2. 使用本地缓存作为后备
3. 实现离线队列，网络恢复后批量上传

### Q3: 小程序和H5数据如何保证一致性？

**A**: 
1. 都调用同一个后端API
2. 使用WebSocket广播更新
3. 定期轮询同步

### Q4: 扫码功能需要什么设备？

**A**: 
1. 扫码枪（USB接口，模拟键盘输入）
2. 手机摄像头（网页调用摄像头）
3. 小程序扫码API（wx.scanCode）

---

**文档创建时间**: 2026-04-26  
**最后更新**: 2026-04-26  
**负责人**: AI Assistant
