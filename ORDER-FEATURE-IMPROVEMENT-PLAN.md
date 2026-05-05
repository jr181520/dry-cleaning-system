# 订单功能完善方案

## 一、需求分析

### 1.1 客服中心功能
- 在m-index（门店端）添加客服中心入口
- 连接消息中心，实现用户与门店的实时通讯
- 门店端能够回复用户的疑问

### 1.2 订单状态完善
扩展订单状态流程：
```
pending（待支付） → paid（已支付/待处理） → cleaning（清洗中） → cleaned（清洗完成） → ready（待取件） → completed（已完成）
```

### 1.3 管理后台订单同步
- admin.html订单管理区域需要从localStorage读取订单数据
- 实现订单列表展示、筛选、状态更新功能

### 1.4 m-admin账号切换
- 添加退出登录按钮
- 添加切换账号功能

### 1.5 文档和功能同步
- 同步测试文档
- 确保index和admin订单功能一致

---

## 二、技术实现

### 2.1 订单状态定义
```javascript
const ORDER_STATUS = {
    pending: { text: '待支付', color: 'gray' },
    paid: { text: '待处理', color: 'blue' },
    cleaning: { text: '清洗中', color: 'yellow' },
    cleaned: { text: '清洗完成', color: 'purple' },
    ready: { text: '待取件', color: 'orange' },
    completed: { text: '已完成', color: 'green' },
    cancelled: { text: '已取消', color: 'red' }
};
```

### 2.2 客服消息结构
```javascript
{
    id: 'msg_xxx',
    orderId: 'ORD20260426xxx',
    customerId: 'user_xxx',
    storeId: 'ST001',
    messages: [
        { sender: 'customer', content: '咨询内容', time: '时间' },
        { sender: 'store', content: '回复内容', time: '时间' }
    ],
    status: 'open', // open, resolved
    createdAt: '时间',
    updatedAt: '时间'
}
```

### 2.3 localStorage数据结构
```javascript
// 订单数据
localStorage.setItem('store_orders', JSON.stringify(orders))

// 客服消息
localStorage.setItem('customer_messages', JSON.stringify(messages))

// 同步到所有端
localStorage.setItem('all_orders', JSON.stringify(orders))
```

---

## 三、实现文件清单

### 3.1 需要修改的文件
1. **m-index.html** - 门店端
   - 添加客服中心入口和功能
   - 完善订单状态更新功能（添加清洗、完成、取件等按钮）

2. **admin.html** - 总后台管理
   - 实现订单管理完整功能
   - 添加从localStorage读取订单的逻辑

3. **m-admin.html** - 移动端总后台
   - 添加账号切换/退出登录功能

4. **c-orders.html** - C端订单列表
   - 完善订单状态显示

### 3.2 需要新建的文件
1. **客服中心功能** - 集成到m-index.html

---

## 四、测试方案

### 4.1 测试流程
1. C端用户下单，选择门店
2. 门店端登录，查看待处理订单
3. 门店端更新订单状态：待处理 → 清洗中 → 清洗完成 → 待取件
4. C端查看订单进度
5. 用户与门店进行通讯
6. 总后台查看所有订单

### 4.2 测试数据
使用test-full-simulation.html创建测试订单

---

## 五、注意事项

1. 所有订单数据使用localStorage统一存储
2. 门店端只能看到属于自己门店的订单
3. 总后台可以看到所有订单
4. 客服消息需要关联订单
5. 状态更新需要同步到C端、门店端、总后台
