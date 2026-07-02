/**
 * 配送服务（v2 - 真实API对接版）
 * 
 * 架构：
 *   deliveryService.js（本文件）
 *     ├── 定价计算 + 报价排序（纯业务逻辑）
 *     └── 调用 → deliveryProviders/（真实/模拟API层）
 *           ├── meituan.js   美团跑腿
 *           ├── jingdong.js  京东秒送（达达）
 *           ├── taobao.js    淘宝闪送（蜂鸟）
 *           └── shunfeng.js  顺丰同城
 * 
 * 模式：
 *   - 已配置密钥 → 调用真实服务商API
 *   - 未配置密钥 → 返回合理模拟数据
 */

const deliveryProviders = require('../../../services/deliveryProviders');

// 服务商名称映射：旧代码 → 新provider键名
const PROVIDER_MAP = {
  'meituan': 'meituan',
  'dada': 'jingdong',
  'jd': 'jingdong',
  'jingdong': 'jingdong',
  'shunfeng': 'shunfeng',
  'sf': 'shunfeng',
  'taobao': 'taobao',
  'tb': 'taobao'
};

class DeliveryService {
  constructor() {
    this.providers = ['meituan', 'jingdong', 'taobao', 'shunfeng'];
  }

  /** 标准化提供商标识 */
  _normalizeProvider(raw) {
    return PROVIDER_MAP[raw] || raw;
  }

  /**
   * 创建配送订单（根据服务商类型调用对应服务商API）
   */
  async createDelivery(params) {
    const { provider, orderId, pickup, delivery, callbackUrl } = params;
    const normalizedProvider = this._normalizeProvider(provider);

    const providerInst = deliveryProviders.get(normalizedProvider);
    if (!providerInst) {
      return { success: false, error: `不支持的配送平台: ${provider}` };
    }

    const result = await providerInst.createOrder({
      orderId,
      pickup,
      delivery,
      callbackUrl,
      goodsDesc: params.goodsDesc || '干洗衣物',
      weight: params.weight || 1
    });

    if (result.success) {
      console.log(`[配送] $顺序 = "provider" | kind = provider.displayName} 下单成功: ${result.platformOrderId} (模式: ${result._mode || 'real'})`);
    } else {
      console.error(`[配送] ${providerInst.displayName} 下单失败:`, result.error);
    }

    return result;
  }

  /**
   * 查询配送状态（调用真实服务商API）
   */
  async queryDelivery(deliveryId, provider) {
    const normalizedProvider = this._normalizeProvider(provider);
    const providerInst = deliveryProviders.get(normalizedProvider);

    if (!providerInst) {
      return { success: false, error: '不支持的配送平台' };
    }

    const result = await providerInst.queryOrder(deliveryId);

    // 标准化响应格式（兼容旧接口调用者）
    if (result.success) {
      return {
        success: true,
        provider: normalizedProvider,
        data: {
          status: result.status,
          driverName: result.driver?.name || '',
          driverPhone: result.driver?.phone || '',
          estimatedTime: result.eta || null,
          distance: result.distance || null,
          _mode: result._mode || 'real'
        }
      };
    }
    return result;
  }

  /**
   * 取消配送（调用真实服务商API）
   */
  async cancelDelivery(deliveryId, provider, reason) {
    const normalizedProvider = this._normalizeProvider(provider);
    const providerInst = deliveryProviders.get(normalizedProvider);

    if (!providerInst) {
      return { success: false, error: '不支持的配送平台' };
    }

    return await providerInst.cancelOrder(deliveryId, reason);
  }

  // ─── 以下为定价/报价业务逻辑（不依赖外部API）───

  /**
   * 各服务商定价规则
   */
  getProviderPricingConfig(provider) {
    const configs = {
      meituan: {
        code: 'meituan', name: '美团跑腿', icon: '🛵',
        base: 5, perKm: 2, minFee: 8,
        sharedDiscount: 0.35,
        rating: 4.9,
        promo: { type: 'newUser', amount: 3, info: '新用户首单立减¥3' }
      },
      jingdong: {
        code: 'jingdong', name: '京东秒送', icon: '🚚',
        base: 4.5, perKm: 2.5, minFee: 10,
        sharedDiscount: 0.40,
        rating: 4.8,
        promo: { type: 'percent', amount: 0.15, info: '平日85折优惠' }
      },
      shunfeng: {
        code: 'shunfeng', name: '顺丰同城', icon: '✈️',
        base: 6, perKm: 2, minFee: 12,
        sharedDiscount: 0.30,
        rating: 4.9,
        promo: { type: 'fullReduction', threshold: 50, amount: 5, info: '满¥50减¥5' }
      },
      taobao: {
        code: 'taobao', name: '淘宝闪送', icon: '🛒',
        base: 5.5, perKm: 1.8, minFee: 9,
        sharedDiscount: 0.38,
        rating: 4.7,
        promo: { type: 'limited', amount: 3, info: '限时优惠¥3' }
      }
    };
    return configs[provider] || null;
  }

  /** 获取所有可用服务商列表 */
  getProviderList() {
    // 检查各服务商的接入模式
    return this.providers.map(p => {
      const config = this.getProviderPricingConfig(p);
      const providerInst = deliveryProviders.get(p);
      return {
        ...config,
        mode: providerInst ? providerInst.getMode() : 'mock',
        enabled: true  // 所有服务商在前端均可选
      };
    });
  }

  /**
   * 一键获取所有服务商报价（含一对一和拼单两种模式）
   */
  async getAllQuotes(params) {
    const { pickup, delivery, distance, serviceTotal, isNewUser } = params;

    const quotes = this.providers.map(provider =>
      this.calculateProviderFee({ provider, pickup, delivery, distance, serviceTotal, isNewUser })
    ).filter(Boolean);

    return { success: true, data: quotes };
  }

  /**
   * 计算单个服务商费用（含一对一/拼单两种模式）
   */
  calculateProviderFee(params) {
    const { provider, pickup, delivery, serviceTotal, isNewUser } = params;
    const config = this.getProviderPricingConfig(provider);
    if (!config) return null;

    let distance = params.distance;
    if (!distance && pickup && delivery) {
      distance = this.calculateDistance(
        pickup.latitude, pickup.longitude,
        delivery.latitude, delivery.longitude
      );
    }
    if (!distance || isNaN(distance)) distance = 3;

    // 一对一（solo）计费
    let soloBaseFee = Math.max(config.minFee, config.base + distance * config.perKm);
    let soloDiscount = 0;
    let soloDiscountInfo = '';

    if (config.promo) {
      const promo = config.promo;
      if (promo.type === 'newUser' && isNewUser) {
        soloDiscount = promo.amount;
        soloDiscountInfo = promo.info;
      } else if (promo.type === 'percent') {
        soloDiscount = Math.round(soloBaseFee * promo.amount * 100) / 100;
        soloDiscountInfo = promo.info;
      } else if (promo.type === 'fullReduction' && (serviceTotal || 0) >= promo.threshold) {
        soloDiscount = promo.amount;
        soloDiscountInfo = promo.info;
      } else if (promo.type === 'limited') {
        soloDiscount = Math.min(promo.amount, soloBaseFee);
        soloDiscountInfo = promo.info;
      }
    }

    let soloActualFee = Math.max(1, soloBaseFee - soloDiscount);
    soloBaseFee = Math.round(soloBaseFee * 100) / 100;
    soloDiscount = Math.round(soloDiscount * 100) / 100;
    soloActualFee = Math.round(soloActualFee * 100) / 100;

    // 拼单（shared）计费
    let sharedBaseFee = soloBaseFee * (1 - config.sharedDiscount);
    let sharedActualFee = Math.max(1, sharedBaseFee - soloDiscount);
    sharedBaseFee = Math.round(sharedBaseFee * 100) / 100;
    sharedActualFee = Math.round(sharedActualFee * 100) / 100;

    const estimatedMinutes = Math.round(distance * 3) + 10;

    return {
      id: config.code,
      name: config.name,
      icon: config.icon,
      rating: config.rating,
      distance: Math.round(distance * 100) / 100,
      distanceUnit: 'km',
      estimatedMinutes,
      estimatedTime: `${estimatedMinutes}-${estimatedMinutes + 15}分钟`,
      hasDiscount: soloDiscount > 0,
      discountInfo: soloDiscountInfo,
      pricing: {
        solo: {
          originalFee: soloBaseFee,
          discount: soloDiscount,
          actualFee: soloActualFee
        },
        shared: {
          originalFee: sharedBaseFee,
          discount: Math.round((soloBaseFee - sharedActualFee) * 100) / 100,
          actualFee: sharedActualFee
        }
      }
    };
  }

  /** 估算配送费用（兼容旧接口） */
  async estimateFee(params) {
    const { provider, pickup, delivery, deliveryType, serviceTotal, isNewUser } = params;
    const result = this.calculateProviderFee({
      provider: provider || 'meituan',
      pickup, delivery,
      serviceTotal, isNewUser
    });

    if (!result) {
      return { success: false, error: 'unknown_provider', message: '不支持的服务商' };
    }

    const pricing = deliveryType === 'shared' ? result.pricing.shared : result.pricing.solo;
    return {
      success: true,
      data: {
        provider: result.id,
        distance: result.distance,
        distanceUnit: result.distanceUnit,
        fee: pricing.actualFee,
        originalFee: pricing.originalFee,
        discount: pricing.discount,
        currency: 'CNY',
        estimatedMinutes: result.estimatedMinutes,
        estimatedTime: result.estimatedTime,
        hasDiscount: result.hasDiscount,
        discountInfo: result.discountInfo,
        deliveryType: deliveryType || 'solo'
      }
    };
  }

  /** 计算两点间距离（Haversine公式） */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /** 获取支持的配送平台（含接入模式） */
  getAvailableProviders() {
    const statusList = deliveryProviders.getStatus();
    return this.providers.map(p => {
      const config = this.getProviderPricingConfig(p);
      const st = statusList.find(s => s.code === p);
      return {
        code: p,
        name: config?.name || p,
        enabled: true,
        mode: st?.mode || 'mock'
      };
    });
  }
}

module.exports = new DeliveryService();
