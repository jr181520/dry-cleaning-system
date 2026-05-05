# 仪表盘API数据响应方案

## 1. 当前状态分析

### 数据结构
- **省份数据 (provincesData)**: 包含name, stores, orders, revenue, recharge, members, avgOrderValue
- **核心指标**: todayGMV, todayNewCustomers, todayNewRecharge, todayActiveUsers
- **月度数据**: 包含labels, revenue, orders, customers数组

### 现有函数
- `calculateDashboardValues()`: 计算仪表盘数值，更新DOM元素
- `initDashboardCharts(provincesData)`: 初始化Chart.js图表
- `window.addEventListener('DOMContentLoaded', calculateDashboardValues)`: 页面加载时调用

### 问题
1. 使用模拟数据，未连接真实API
2. 指标变动后未实现自动响应式更新
3. 图表数据更新需要手动调用函数
4. 缺少错误处理和数据验证

---

## 2. 目标

### 功能目标
1. **API数据获取**: 创建API服务层，从后端获取真实数据
2. **响应式更新**: 指标变动时自动更新UI，无需刷新页面
3. **数据缓存**: 使用localStorage缓存数据，减少API请求
4. **定时刷新**: 支持配置刷新间隔，自动更新数据
5. **错误处理**: 网络错误时显示友好提示，使用缓存数据

### 性能目标
1. 首次加载时间 < 2秒
2. 数据刷新响应时间 < 500ms
3. 支持离线模式（使用缓存数据）

---

## 3. 实施计划

### 3.1 创建API服务层

```javascript
// Dashboard API Service
const DashboardAPI = {
    // API基础配置
    baseURL: '/api/dashboard',

    // 获取今日核心指标
    async getTodayMetrics() {
        const response = await fetch(`${this.baseURL}/today-metrics`);
        if (!response.ok) throw new Error('获取今日指标失败');
        return response.json();
    },

    // 获取月度趋势数据
    async getMonthlyTrend(months = 6) {
        const response = await fetch(`${this.baseURL}/monthly-trend?months=${months}`);
        if (!response.ok) throw new Error('获取月度趋势失败');
        return response.json();
    },

    // 获取区域分布数据
    async getRegionDistribution() {
        const response = await fetch(`${this.baseURL}/region-distribution`);
        if (!response.ok) throw new Error('获取区域分布失败');
        return response.json();
    },

    // 获取完整仪表盘数据
    async getAllData() {
        const [metrics, monthly, regions] = await Promise.all([
            this.getTodayMetrics(),
            this.getMonthlyTrend(),
            this.getRegionDistribution()
        ]);
        return { metrics, monthly, regions };
    }
};
```

### 3.2 创建数据响应式更新机制

```javascript
// Dashboard响应式更新管理器
class DashboardReactivity {
    constructor() {
        this.cache = new Map();
        this.refreshInterval = 30000; // 30秒刷新一次
        this.refreshTimer = null;
        this.listeners = [];
    }

    // 订阅数据变化
    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    // 通知所有订阅者
    notify(data) {
        this.listeners.forEach(cb => cb(data));
    }

    // 更新指标卡片
    updateMetricsCard(elementId, value, change = null) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = this.formatValue(value);
            if (change !== null) {
                const changeElement = element.nextElementSibling;
                if (changeElement && changeElement.classList.contains('change-indicator')) {
                    changeElement.innerHTML = this.formatChange(change);
                }
            }
        }
    }

    // 刷新所有数据
    async refresh() {
        try {
            const data = await DashboardAPI.getAllData();
            this.cache.set('lastData', data);
            this.cache.set('lastUpdate', Date.now());
            localStorage.setItem('dashboardCache', JSON.stringify({
                data,
                timestamp: Date.now()
            }));
            this.notify(data);
            return data;
        } catch (error) {
            console.error('数据刷新失败:', error);
            // 使用缓存数据
            const cached = this.getCachedData();
            if (cached) {
                this.notify(cached);
                return cached;
            }
            throw error;
        }
    }

    // 获取缓存数据
    getCachedData() {
        try {
            const cached = localStorage.getItem('dashboardCache');
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                // 缓存超过5分钟视为过期
                if (Date.now() - timestamp < 300000) {
                    return data;
                }
            }
        } catch (e) {}
        return null;
    }

    // 格式化数值
    formatValue(value) {
        if (typeof value === 'number') {
            return value.toLocaleString();
        }
        return value;
    }

    // 格式化变化百分比
    formatChange(change) {
        const isPositive = change >= 0;
        const icon = isPositive ? 'fa-arrow-up' : 'fa-arrow-down';
        const color = isPositive ? 'text-green-600' : 'text-red-600';
        return `<i class="fa ${icon} ${color} mr-1"></i>较昨日 ${isPositive ? '+' : ''}${change.toFixed(1)}%`;
    }

    // 启动定时刷新
    startAutoRefresh(interval = this.refreshInterval) {
        this.stopAutoRefresh();
        this.refreshTimer = setInterval(() => this.refresh(), interval);
    }

    // 停止定时刷新
    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }
}
```

### 3.3 修改现有函数

#### calculateDashboardValues()
```javascript
async function calculateDashboardValues() {
    const dashboard = window.dashboardReactivity;

    try {
        // 尝试从API获取数据
        const data = await dashboard.refresh();

        // 更新核心指标
        dashboard.updateMetricsCard('today-gmv', data.metrics.gmv, data.metrics.gmvChange);
        dashboard.updateMetricsCard('today-new-customers', data.metrics.newCustomers, data.metrics.newCustomersChange);
        dashboard.updateMetricsCard('today-new-recharge', data.metrics.newRecharge, data.metrics.newRechargeChange);
        dashboard.updateMetricsCard('today-active-users', data.metrics.activeUsers, data.metrics.activeUsersChange);

    } catch (error) {
        console.error('初始化仪表盘数据失败:', error);
        // 使用缓存数据或默认值
        const cached = dashboard.getCachedData();
        if (cached) {
            applyDashboardData(cached);
        }
    }
}
```

#### initDashboardCharts()
```javascript
function initDashboardCharts(data) {
    const chartData = data.monthly || data;
    const regionData = data.regions || [];

    // 月度收入趋势
    renderRevenueChart(chartData);

    // 月度活跃用户趋势
    renderUsersChart(chartData);

    // 区域贡献分布
    renderRegionChart(regionData);
}
```

---

## 4. 文件修改清单

### 4.1 admin.html
1. 添加API服务层代码 (约80行)
2. 添加DashboardReactivity类 (约150行)
3. 修改calculateDashboardValues函数 (约30行)
4. 修改initDashboardCharts函数 (约20行)
5. 添加错误处理和缓存逻辑 (约50行)

### 4.2 新增文件
- 无需新增文件，所有代码集成到admin.html中

---

## 5. API接口规范 (后端需实现)

### GET /api/dashboard/today-metrics
```json
{
  "gmv": 68930,
  "gmvChange": 12.5,
  "newCustomers": 156,
  "newCustomersChange": 8.2,
  "newRecharge": 25680,
  "newRechargeChange": 15.3,
  "activeUsers": 1284,
  "activeUsersChange": 5.7
}
```

### GET /api/dashboard/monthly-trend?months=6
```json
{
  "labels": ["1月", "2月", "3月", "4月", "5月", "6月"],
  "revenue": [45000, 52000, 48000, 61000, 68000, 72000],
  "orders": [120, 145, 130, 168, 185, 198],
  "customers": [850, 920, 880, 1050, 1180, 1284]
}
```

### GET /api/dashboard/region-distribution
```json
{
  "regions": [
    { "name": "北京市", "revenue": 12850 },
    { "name": "上海市", "revenue": 8520 },
    { "name": "广东省", "revenue": 20500 },
    { "name": "江苏省", "revenue": 11360 },
    { "name": "浙江省", "revenue": 15700 }
  ]
}
```

---

## 6. 风险和注意事项

### 6.1 API兼容性
- 当前使用模拟数据，前端准备好接收真实API数据
- 需要后端实现对应接口

### 6.2 性能考虑
- 缓存策略：localStorage缓存5分钟有效期
- 节流刷新：避免频繁API请求
- 增量更新：只更新变化的数据

### 6.3 错误处理
- 网络失败时使用缓存数据
- API返回错误时显示友好提示
- 保留降级方案（使用模拟数据）