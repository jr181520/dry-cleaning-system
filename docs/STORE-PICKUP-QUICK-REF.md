# 门店自提功能 - 快速参考

## 一句话总结

用户在线下单（门店自提） → 到店扫码 → M端亮灯 → 店员拣货 → 扫码/手动出库 → 用户取件完成

---

## 核心流程

```
┌─────────────────────────────────────────────────────────────┐
│  C端（下单）                    M端（门店管理）              │
│  ───────────                   ──────────────              │
│  1. 下单，选择「门店自提」                                       │
│  2. 支付完成                                                        │
│  3. 到店扫码                                                         │
│  4. 点击「到店取件」───────→ 收到灯条请求                       │
│                                  5. 激活灯条                       │
│                                  6. 拣货打包                       │
│                                  7. 扫码/手动出库 ──→ 灯条熄灭    │
│                                  8. 所有物品出库                   │
│  9. 收到「物品已备好」                                            │
│  10. 确认取件 ─────────────────────────────────────────→ 完成！ │
└─────────────────────────────────────────────────────────────┘
```

---

## 关键文件

| 文件 | 说明 |
|------|------|
| `js/store-pickup.js` | 门店自提核心逻辑 |
| `js/store-pickup-m.js` | M端订单管理 |
| `c-store-pickup.html` | C端扫码取件页面 |
| `m-index.html` | M端管理页面（已集成） |
| `docs/STORE-PICKUP-DESIGN.md` | 完整设计方案 |
| `STORE-PICKUP-TEST-GUIDE.md` | 测试指南 |

---

## 状态流转

```
订单状态：
awaiting_store_confirm → ready → completed
  （待备货）              （已备好）   （已完成）

物品状态：
pending → checked_out
  （待出库）    （已出库）

灯条状态：
off → on → off
     （亮起） （熄灭）
```

---

## 快速测试

### 1. 创建测试订单

```javascript
const order = {
    orderId: 'TEST' + Date.now(),
    deliveryMethod: 'pickup',
    status: 'awaiting_store_confirm',
    customerName: '测试用户',
    customerPhone: '13800138000',
    items: [
        { name: '西装干洗', quantity: 1, price: 50, itemStatus: 'pending' }
    ],
    fees: { total: 50 }
};

const orders = JSON.parse(localStorage.getItem('store_orders') || '[]');
orders.unshift(order);
localStorage.setItem('store_orders', JSON.stringify(orders));
```

### 2. 测试步骤

1. **M端查看**：刷新 `m-index.html` → 进入「订单管理」
2. **激活灯条**：点击「激活灯条」按钮
3. **出库**：点击物品的「出库」按钮
4. **完成**：点击「完成取件」

---

## 常用调试

```javascript
// 查看灯条绑定
localStorage.getItem('light_bindings')

// 查看待取件订单
JSON.parse(localStorage.getItem('store_orders'))
  .filter(o => o.deliveryMethod === 'pickup')

// 清除所有灯条
localStorage.removeItem('light_bindings')
localStorage.removeItem('store_light_request')
```

---

## 功能特点

✅ 实时灯条指示  
✅ 扫码/手动双模式出库  
✅ 物品级精确管理  
✅ C端/M端数据同步  
✅ 状态自动流转  
✅ 订单完成通知  

---

## 后续可扩展

- 🔔 微信消息通知
- 📊 数据统计分析
- 💡 RGB智能灯条集成
- 🏪 多门店管理

---

**更新时间：** 2025-05-07
