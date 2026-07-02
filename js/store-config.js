/**
 * 店面配置管理模块 (Store Config Module)
 * 以商家ID为单位管理：服务类别、服务价格、优惠促销
 * 数据存储在 localStorage，key: store_${storeId}_config
 * v1.0 2025-06-25
 */

(function(global) {
    'use strict';

    var DEFAULT_CONFIG = {
        categories: [
            { id: 'cat_1', name: '衣物清洗', icon: '👔' },
            { id: 'cat_2', name: '鞋子护理', icon: '👟' },
            { id: 'cat_3', name: '箱包洗护', icon: '👜' },
            { id: 'cat_4', name: '家纺清洗', icon: '🛏️' },
            { id: 'cat_5', name: '特殊护理', icon: '✨' }
        ],
        services: [
            { id: 'svc_1', name: '西装干洗', category: '衣物清洗', price: 50, icon: '👔', desc: '专业熨烫定型', enabled: true },
            { id: 'svc_2', name: '衬衫清洗', category: '衣物清洗', price: 30, icon: '👕', desc: '轻柔手洗护理', enabled: true },
            { id: 'svc_3', name: '羽绒服清洗', category: '衣物清洗', price: 80, icon: '🧥', desc: '杀菌除螨护理', enabled: true },
            { id: 'svc_4', name: '运动鞋清洗', category: '鞋子护理', price: 40, icon: '👟', desc: '深度清洁保养', enabled: true },
            { id: 'svc_5', name: '皮鞋护理', category: '鞋子护理', price: 45, icon: '👞', desc: '真皮保养上光', enabled: true },
            { id: 'svc_6', name: '皮包护理', category: '箱包洗护', price: 100, icon: '👜', desc: '奢侈品级养护', enabled: true },
            { id: 'svc_7', name: '床单被罩', category: '家纺清洗', price: 60, icon: '🛏️', desc: '高温杀菌洗涤', enabled: true },
            { id: 'svc_8', name: '沙发清洗', category: '家纺清洗', price: 120, icon: '🛋️', desc: '深度除螨清洁', enabled: true }
        ],
        promotions: [
            { id: 'promo_1', type: 'discount', name: '自取9折', discountPercent: 10, condition: 'pickup', desc: '到店自取享9折优惠', enabled: true },
            { id: 'promo_2', type: 'full_reduce', name: '满100减10', threshold: 100, reduce: 10, desc: '订单满100元立减10元', enabled: false },
            { id: 'promo_3', type: 'discount', name: '首单8折', discountPercent: 20, condition: 'first_order', desc: '新用户首单享8折', enabled: false }
        ]
    };

    // 获取当前门店ID
    function getCurrentStoreId() {
        try {
            var currentStore = JSON.parse(localStorage.getItem('currentStore') || '{}');
            var storeUser = JSON.parse(localStorage.getItem('storeUser') || '{}');
            return currentStore.storeId || storeUser.storeId || 'ST001';
        } catch (e) {
            return 'ST001';
        }
    }

    // 获取门店配置
    function getConfig(storeId) {
        storeId = storeId || getCurrentStoreId();
        try {
            var raw = localStorage.getItem('store_' + storeId + '_config');
            if (raw) {
                var config = JSON.parse(raw);
                // 合并默认值，确保所有字段存在
                return mergeDefaults(config);
            }
        } catch (e) {
            console.warn('[StoreConfig] 读取配置失败:', e);
        }
        // 返回带 storeId 的默认配置
        var def = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        def.storeId = storeId;
        return def;
    }

    function mergeDefaults(config) {
        var def = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        if (!config.categories || !Array.isArray(config.categories)) config.categories = def.categories;
        if (!config.services || !Array.isArray(config.services)) config.services = def.services;
        if (!config.promotions || !Array.isArray(config.promotions)) config.promotions = def.promotions;
        return config;
    }

    // 保存门店配置
    function saveConfig(storeId, config) {
        storeId = storeId || getCurrentStoreId();
        config.storeId = storeId;
        config.updatedAt = Date.now();
        try {
            localStorage.setItem('store_' + storeId + '_config', JSON.stringify(config));
            // 同时同步到后端（如果可用）
            syncToBackend(storeId, config);
            return { success: true };
        } catch (e) {
            console.error('[StoreConfig] 保存配置失败:', e);
            return { success: false, error: e.message };
        }
    }

    // 同步到后端API
    function syncToBackend(storeId, config) {
        try {
            var apiBase = (window.location.origin || '') + '/api';
            var payload = JSON.stringify({
                storeId: storeId,
                categories: config.categories,
                services: config.services,
                promotions: config.promotions,
                updatedAt: config.updatedAt
            });
            // 使用 fetch 异步更新，不阻塞
            if (typeof fetch !== 'undefined') {
                fetch(apiBase + '/cleaning/store-config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payload
                }).catch(function() {});
            }
        } catch (e) {}
    }

    // 重置为默认配置
    function resetConfig(storeId) {
        storeId = storeId || getCurrentStoreId();
        var def = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        def.storeId = storeId;
        return saveConfig(storeId, def);
    }

    // 获取某个门店的可用于C端的服务列表
    function getPublicServices(storeId) {
        var config = getConfig(storeId);
        return (config.services || []).filter(function(s) { return s.enabled !== false; });
    }

    // 获取某个门店的启用的优惠列表
    function getPublicPromotions(storeId) {
        var config = getConfig(storeId);
        return (config.promotions || []).filter(function(p) { return p.enabled !== false; });
    }

    // 计算优惠金额
    function calculatePromotionDiscount(storeId, subtotal, deliveryMethod, isFirstOrder) {
        var promotions = getPublicPromotions(storeId);
        var totalDiscount = 0;
        var appliedPromos = [];

        promotions.forEach(function(promo) {
            if (promo.type === 'discount') {
                if (promo.condition === 'pickup' && deliveryMethod === 'pickup') {
                    var d = Math.round(subtotal * promo.discountPercent / 100);
                    totalDiscount += d;
                    appliedPromos.push({ name: promo.name, amount: d });
                } else if (promo.condition === 'first_order' && isFirstOrder) {
                    var d2 = Math.round(subtotal * promo.discountPercent / 100);
                    totalDiscount += d2;
                    appliedPromos.push({ name: promo.name, amount: d2 });
                } else if (!promo.condition) {
                    var d3 = Math.round(subtotal * promo.discountPercent / 100);
                    totalDiscount += d3;
                    appliedPromos.push({ name: promo.name, amount: d3 });
                }
            } else if (promo.type === 'full_reduce') {
                if (subtotal >= promo.threshold) {
                    totalDiscount += promo.reduce;
                    appliedPromos.push({ name: promo.name, amount: promo.reduce });
                }
            }
        });

        return { totalDiscount: totalDiscount, appliedPromos: appliedPromos };
    }

    // ---- 生成唯一ID ----
    function genId(prefix) {
        return (prefix || 'id') + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }

    // ============ 暴露 API ============
    global.StoreConfig = {
        getCurrentStoreId: getCurrentStoreId,
        getConfig: getConfig,
        saveConfig: saveConfig,
        resetConfig: resetConfig,
        getPublicServices: getPublicServices,
        getPublicPromotions: getPublicPromotions,
        calculatePromotionDiscount: calculatePromotionDiscount,
        genId: genId,
        DEFAULT_CONFIG: DEFAULT_CONFIG
    };

})(window);
