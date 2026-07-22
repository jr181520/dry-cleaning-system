/**
 * C端用户数据隔离工具模块
 * 
 * 核心功能：将 localStorage 中的订单数据按 userId 命名空间隔离，
 * 确保同一浏览器上不同用户只能看到自己的订单数据。
 * 
 * 使用方式：所有C端页面在 <head> 中引入此脚本，
 * 然后用 getUserOrders()/setUserOrders() 替代直接读写 localStorage('orders')。
 */

(function() {
    'use strict';

    // ==========================================
    // 用户身份获取
    // ==========================================

    /**
     * 获取当前登录用户ID
     * 优先级：userOpenid > userId > 'guest'
     */
    window.getCurrentUserId = function() {
        return localStorage.getItem('userOpenid') 
            || localStorage.getItem('userId') 
            || 'guest';
    };

    // ==========================================
    // 用户隔离的 localStorage key 生成
    // ==========================================

    /** 获取当前用户的订单存储 key */
    window.getUserOrdersKey = function() {
        return 'orders_' + getCurrentUserId();
    };

    /** 获取当前用户的同步订单存储 key */
    window.getUserCOrdersKey = function() {
        return 'c_orders_' + getCurrentUserId();
    };

    /** 获取当前用户的订单备份存储 key */
    window.getUserOrdersBackupKey = function() {
        return 'orders_backup_' + getCurrentUserId();
    };

    /** 获取当前用户的订单备份时间存储 key */
    window.getUserOrdersBackupTimeKey = function() {
        return 'orders_backup_time_' + getCurrentUserId();
    };

    // ==========================================
    // 用户隔离的订单读写函数
    // ==========================================

    /**
     * 读取当前用户的所有订单
     * @returns {Array} 当前用户的订单数组
     */
    window.getUserOrders = function() {
        try {
            return JSON.parse(localStorage.getItem(getUserOrdersKey()) || '[]');
        } catch(e) {
            console.error('[UserDataIsolation] 读取用户订单失败:', e);
            return [];
        }
    };

    /**
     * 写入当前用户的订单列表
     * 自动给每个订单打上 userId 标记
     * @param {Array} orders - 订单数组
     */
    window.setUserOrders = function(orders) {
        try {
            const uid = getCurrentUserId();
            // 写入时自动给每个订单打上 userId 标记
            if (Array.isArray(orders)) {
                orders.forEach(function(o) {
                    if (o && !o.userId) o.userId = uid;
                });
            }
            localStorage.setItem(getUserOrdersKey(), JSON.stringify(orders));
        } catch(e) {
            console.error('[UserDataIsolation] 写入用户订单失败:', e);
        }
    };

    /**
     * 读取当前用户的同步订单
     * @returns {Array} 同步订单数组
     */
    window.getUserCOrders = function() {
        try {
            return JSON.parse(localStorage.getItem(getUserCOrdersKey()) || '[]');
        } catch(e) {
            console.error('[UserDataIsolation] 读取用户同步订单失败:', e);
            return [];
        }
    };

    /**
     * 写入当前用户的同步订单
     * @param {Array} orders - 订单数组
     */
    window.setUserCOrders = function(orders) {
        try {
            localStorage.setItem(getUserCOrdersKey(), JSON.stringify(orders));
        } catch(e) {
            console.error('[UserDataIsolation] 写入用户同步订单失败:', e);
        }
    };

    /**
     * 读取当前用户的订单备份
     * @returns {Array} 备份订单数组
     */
    window.getUserOrdersBackup = function() {
        try {
            return JSON.parse(localStorage.getItem(getUserOrdersBackupKey()) || '[]');
        } catch(e) {
            return [];
        }
    };

    /**
     * 写入当前用户的订单备份
     * @param {Array} orders - 订单数组
     */
    window.setUserOrdersBackup = function(orders) {
        try {
            localStorage.setItem(getUserOrdersBackupKey(), JSON.stringify(orders));
            localStorage.setItem(getUserOrdersBackupTimeKey(), new Date().toISOString());
        } catch(e) {
            console.error('[UserDataIsolation] 写入用户订单备份失败:', e);
        }
    };

    /**
     * 获取当前用户的订单备份时间
     * @returns {string|null} ISO时间字符串
     */
    window.getUserOrdersBackupTime = function() {
        return localStorage.getItem(getUserOrdersBackupTimeKey());
    };

    // ==========================================
    // 登录/登出 数据管理
    // ==========================================

    /**
     * 登录时迁移旧数据（首次升级兼容）
     * 将全局 'orders' key 中属于当前用户的订单迁移到用户隔离 key
     */
    window.migrateLegacyOrdersOnLogin = function() {
        try {
            const uid = getCurrentUserId();
            const userKey = getUserOrdersKey();
            
            // 如果用户隔离 key 已有数据，不需要迁移
            if (localStorage.getItem(userKey)) return;
            
            // 尝试从全局 'orders' key 迁移
            const oldOrders = JSON.parse(localStorage.getItem('orders') || '[]');
            if (oldOrders.length === 0) return;
            
            // 筛选属于当前用户的订单（无 userId 标记的视为所有用户共有，不迁移）
            const userOrders = oldOrders.filter(function(o) {
                return o.userId === uid;
            });
            
            if (userOrders.length > 0) {
                setUserOrders(userOrders);
                console.log('[UserDataIsolation] 迁移了', userOrders.length, '条订单给用户', uid);
            }
            
            // 同时迁移 c_orders
            const oldCOrders = JSON.parse(localStorage.getItem('c_orders') || '[]');
            if (oldCOrders.length > 0) {
                const userCOrders = oldCOrders.filter(function(o) {
                    return o.userId === uid;
                });
                if (userCOrders.length > 0) {
                    setUserCOrders(userCOrders);
                }
            }
        } catch(e) {
            console.error('[UserDataIsolation] 迁移旧数据失败:', e);
        }
    };

    /**
     * 登出时清理当前用户的数据
     * 只清理当前用户的隔离数据，不影响其他用户
     */
    window.clearUserDataOnLogout = function() {
        try {
            const uid = getCurrentUserId();
            localStorage.removeItem(getUserOrdersKey());
            localStorage.removeItem(getUserCOrdersKey());
            localStorage.removeItem(getUserOrdersBackupKey());
            localStorage.removeItem(getUserOrdersBackupTimeKey());
            localStorage.removeItem('currentOrder');
            console.log('[UserDataIsolation] 已清理用户', uid, '的数据');
        } catch(e) {
            console.error('[UserDataIsolation] 清理用户数据失败:', e);
        }
    };

    console.log('[UserDataIsolation] 用户数据隔离模块已加载');
})();
