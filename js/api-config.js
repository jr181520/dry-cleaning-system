/**
 * 统一API配置
 * 所有前端页面都应该使用这个配置文件来获取API地址
 * 
 * 使用方法：
 * <script src="js/api-config.js"></script>
 * <script>
 *     console.log(API_CONFIG.baseUrl);  // http://localhost:3000
 * </script>
 */

const API_CONFIG = {
    // API基础地址 - 根据当前页面端口自动检测
    get baseUrl() {
        // 优先使用当前页面端口
        const currentPort = window.location.port || 3000;
        return `http://localhost:${currentPort}/api`;
    },
    
    // API版本
    version: 'v1',
    
    // 超时设置（毫秒）
    timeout: 10000,
    
    // API端点 - 所有接口路径（相对于 /api）
    endpoints: {
        // 订单相关
        orders: '/cleaning/orders',
        adminOrders: '/admin/orders',
        storeOrders: (storeId) => `/cleaning/store/${storeId}/orders`,
        
        // 支付相关
        payment: '/payment',
        paymentCreate: '/payment/create',
        paymentQuery: (orderId) => `/payment/query/${orderId}`,
        paymentCallback: '/payment/callback',
        
        // 会员卡相关
        memberCard: '/member-card',
        memberCardInfo: (cardId) => `/member-card/info/${cardId}`,
        memberCardUser: (userId) => `/member-card/user/${userId}`,
        memberCardRecharge: '/member-card/recharge',
        memberCardDeduct: '/member-card/deduct',
        
        // POS相关
        pos: '/pos',
        posCreate: '/pos/create',
        
        // 余额相关
        balance: '/balance',
        balanceRecharge: '/balance/recharge',
        
        // 门店相关
        stores: '/stores',
        storeInfo: (storeId) => `/stores/${storeId}`,
        storeStaffDetail: (storeId) => `/stores/${storeId}/staff/detail`,
        storeStaffCreate: (storeId) => `/stores/${storeId}/staff/create`,
        storeStaffDelete: (storeId, staffId) => `/stores/${storeId}/staff/${staffId}`,
        storeStaffRole: (storeId, staffId) => `/stores/${storeId}/staff/${staffId}/role`,
        
        // 认证相关
        staffLogin: '/auth/staff-login',
        
        // 连锁管理相关
        chains: '/admin/chains',
        chainDetail: (chainId) => `/admin/chains/${chainId}`,
        chainDashboard: (chainId) => `/admin/chains/${chainId}/dashboard`,
        chainOrders: (chainId) => `/admin/chains/${chainId}/orders`,
        chainStoreAdd: (chainId, storeId) => `/admin/chains/${chainId}/stores/${storeId}`,
        chainStoreRemove: (chainId, storeId) => `/admin/chains/${chainId}/stores/${storeId}`,
        unchainedStores: '/admin/unchained-stores',
        
        // 其他
        health: '/health',
        modules: '/system/modules'
    },
    
    // 获取完整的API URL
    getUrl(endpoint) {
        return `${this.baseUrl}${endpoint}`;
    },
    
    // 认证Token管理
    _authToken: null,
    
    setAuthToken(token) {
        this._authToken = token;
        if (token) {
            localStorage.setItem('auth_token', token);
        } else {
            localStorage.removeItem('auth_token');
        }
    },
    
    getAuthToken() {
        if (!this._authToken) {
            this._authToken = localStorage.getItem('auth_token');
        }
        return this._authToken;
    },
    
    clearAuth() {
        this._authToken = null;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('storeUser');
        localStorage.removeItem('currentStore');
    },
    
    // 通用的fetch封装（自动带认证头）
    async request(endpoint, options = {}) {
        const url = this.getUrl(endpoint);
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        // 自动附加认证Token
        const token = this.getAuthToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const config = {
            headers,
            ...options
        };
        // 移除自定义timeout属性（fetch不支持）
        delete config.timeout;
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            config.signal = controller.signal;
            
            const response = await fetch(url, config);
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const err = new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
                err.status = response.status;
                err.data = errorData;
                throw err;
            }
            
            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error(`[API] 请求超时: ${endpoint}`);
                throw new Error('请求超时');
            }
            console.error(`[API] 请求失败: ${endpoint}`, error);
            throw error;
        }
    },
    
    // GET请求
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
    },
    
    // POST请求
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
};

// 便捷方法 - 直接调用API
const API = {
    // 订单
    async getOrders() {
        return API_CONFIG.get(API_CONFIG.endpoints.adminOrders);
    },
    
    async getStoreOrders(storeId) {
        return API_CONFIG.get(API_CONFIG.endpoints.storeOrders(storeId));
    },
    
    async createOrder(orderData) {
        return API_CONFIG.post(API_CONFIG.endpoints.orders, orderData);
    },
    
    // 支付
    async createPayment(paymentData) {
        return API_CONFIG.post(API_CONFIG.endpoints.paymentCreate, paymentData);
    },
    
    // 会员卡
    async getMemberCard(cardId) {
        return API_CONFIG.get(API_CONFIG.endpoints.memberCardInfo(cardId));
    },
    
    async rechargeMemberCard(data) {
        return API_CONFIG.post(API_CONFIG.endpoints.memberCardRecharge, data);
    },
    
    // 门店
    async getStores() {
        return API_CONFIG.get(API_CONFIG.endpoints.stores);
    },
    
    // 健康检查
    async healthCheck() {
        return API_CONFIG.get(API_CONFIG.endpoints.health);
    }
};

// 输出到全局
window.API_CONFIG = API_CONFIG;
window.API = API;
window.API_BASE_URL = API_CONFIG.baseUrl;

// 打印配置信息（仅开发模式）
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('%c[API配置] 初始化完成', 'color: green; font-weight: bold');
    console.log(`  API地址: ${API_CONFIG.baseUrl}`);
    console.log('  可用方法: API.getOrders(), API.createPayment() 等');
}
