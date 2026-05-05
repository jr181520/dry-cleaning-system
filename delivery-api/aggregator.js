/**
 * 聚合配送调度器
 * 统一调度美团、达达、顺丰三家配送服务商
 */

const MeituanProvider = require('./providers/meituan');
const DadaProvider = require('./providers/dada');
const ShunfengProvider = require('./providers/shunfeng');
const config = require('./config');

class DeliveryAggregator {
  constructor() {
    this.providers = {};
    this.isProduction = process.env.NODE_ENV === 'production';
    this.initProviders();
  }

  /**
   * 初始化所有配送服务商
   */
  initProviders() {
    // 美团配送
    if (config.meituan.enabled) {
      this.providers.meituan = new MeituanProvider(config.meituan, this.isProduction);
    }

    // 达达/京东秒送
    if (config.dada.enabled) {
      this.providers.dada = new DadaProvider(config.dada, this.isProduction);
    }

    // 顺丰同城
    if (config.shunfeng.enabled) {
      this.providers.shunfeng = new ShunfengProvider(config.shunfeng, this.isProduction);
    }
  }

  /**
   * 获取所有可用服务商
   * @returns {Array} 服务商列表
   */
  getAvailableProviders() {
    return Object.keys(this.providers).map(key => ({
      name: this.providers[key].name,
      displayName: this.providers[key].displayName
    }));
  }

  /**
   * 询价 - 查询多家服务商的配送价格
   * @param {Object} params - 询价参数
   * @returns {Promise<Object>} 询价结果
   */
  async queryPrices(params) {
    const { pickupAddress, dropoffAddress, weight = 1, cityName = '北京' } = params;
    const providerKeys = Object.keys(this.providers);
    const results = [];
    const errors = [];

    // 并行查询所有服务商
    const promises = providerKeys.map(async (key) => {
      try {
        const result = await this.providers[key].queryPrice({
          pickupAddress,
          dropoffAddress,
          weight,
          cityName,
          distance: params.distance
        });
        
        if (result.success) {
          results.push(result);
        } else {
          errors.push({ provider: key, error: result.error });
        }
        
        return result;
      } catch (error) {
        errors.push({ provider: key, error: error.message });
        return null;
      }
    });

    await Promise.allSettled(promises);

    // 按价格排序
    results.sort((a, b) => a.price - b.price);

    return {
      success: true,
      quotes: results,
      errors: errors.length > 0 ? errors : undefined,
      recommended: this.getRecommended(results)
    };
  }

  /**
   * 获取推荐服务商
   * @param {Array} results - 询价结果
   * @returns {Object} 推荐结果
   */
  getRecommended(results) {
    if (!results || results.length === 0) {
      return null;
    }

    const strategy = config.aggregator.defaultStrategy;

    switch (strategy) {
      case 'lowest_price':
        // 最低价
        return results[0];

      case 'fastest':
        // 最快
        return results.reduce((fastest, current) => 
          current.estimateTime < fastest.estimateTime ? current : fastest
        );

      case 'recommended':
      default:
        // 推荐：综合考虑价格和时效
        return results.reduce((best, current) => {
          const bestScore = (100 - best.price) * 0.4 + (60 - best.estimateTime) * 0.6;
          const currentScore = (100 - current.price) * 0.4 + (60 - current.estimateTime) * 0.6;
          return currentScore > bestScore ? current : best;
        });
    }
  }

  /**
   * 创建配送订单
   * @param {Object} params - 订单参数
   * @param {string} [preferredProvider] - 优先选择的服务商
   * @returns {Promise<Object>} 创建结果
   */
  async createOrder(params, preferredProvider = null) {
    const {
      pickupAddress,
      dropoffAddress,
      customerName,
      customerPhone,
      shopName,
      shopPhone,
      goodsDesc,
      weight,
      orderId,
      cityName
    } = params;

    // 如果指定了服务商，直接使用
    if (preferredProvider && this.providers[preferredProvider]) {
      return await this.providers[preferredProvider].createOrder({
        pickupAddress,
        dropoffAddress,
        customerName,
        customerPhone,
        shopName,
        shopPhone,
        goodsDesc,
        weight,
        orderId,
        cityName
      });
    }

    // 否则自动选择最优服务商
    // 先询价获取最优
    const priceResult = await this.queryPrices({
      pickupAddress,
      dropoffAddress,
      weight,
      cityName
    });

    if (!priceResult.recommended) {
      return {
        success: false,
        error: '无可用配送服务商'
      };
    }

    // 使用推荐的服务商创建订单
    const provider = this.providers[priceResult.recommended.provider];
    return await provider.createOrder({
      pickupAddress,
      dropoffAddress,
      customerName,
      customerPhone,
      shopName,
      shopPhone,
      goodsDesc,
      weight,
      orderId,
      cityName
    });
  }

  /**
   * 查询订单状态
   * @param {string} provider - 服务商名称
   * @param {string} platformOrderId - 平台订单号
   * @returns {Promise<Object>} 订单状态
   */
  async queryOrder(provider, platformOrderId) {
    if (!this.providers[provider]) {
      return {
        success: false,
        error: `未知的服务商: ${provider}`
      };
    }

    return await this.providers[provider].queryOrder(platformOrderId);
  }

  /**
   * 取消订单
   * @param {string} provider - 服务商名称
   * @param {string} platformOrderId - 平台订单号
   * @param {string} reason - 取消原因
   * @returns {Promise<Object>} 取消结果
   */
  async cancelOrder(provider, platformOrderId, reason = '') {
    if (!this.providers[provider]) {
      return {
        success: false,
        error: `未知的服务商: ${provider}`
      };
    }

    return await this.providers[provider].cancelOrder(platformOrderId, reason);
  }
}

// 导出单例
module.exports = new DeliveryAggregator();
