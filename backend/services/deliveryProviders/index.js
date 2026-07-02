/**
 * 配送服务商统一入口
 * 
 * 模式说明：
 *   - real:  已配置服务商API密钥，通过真实API创建/查询/取消配送
 *   - mock:  未配置密钥，返回合理模拟数据供开发测试
 * 
 * 环境变量映射：
 *   美团:  MEITUAN_APP_ID / MEITUAN_APP_SECRET
 *   京东:  DADA_APP_KEY / DADA_APP_SECRET / DADA_SOURCE_ID
 *   淘宝:  TAOBAO_FENGNIAO_APP_ID / TAOBAO_FENGNIAO_SECRET / TAOBAO_MERCHANT_ID
 *   顺丰:  SF_PARTNER_ID / SF_CHECK_WORD
 */

const MeituanProvider = require('./meituan');
const JingdongProvider = require('./jingdong');
const TaobaoProvider = require('./taobao');
const ShunfengProvider = require('./shunfeng');

class DeliveryProviderManager {
  constructor() {
    this.providers = {
      meituan: new MeituanProvider(),
      jingdong: new JingdongProvider(),
      taobao: new TaobaoProvider(),
      shunfeng: new ShunfengProvider()
    };
  }

  /** 获取所有提供商 */
  getAll() {
    return this.providers;
  }

  /** 获取指定提供商 */
  get(name) {
    return this.providers[name] || null;
  }

  /** 获取所有提供商的状态信息 */
  getStatus() {
    return Object.entries(this.providers).map(([key, provider]) => ({
      code: key,
      name: provider.displayName,
      mode: provider.getMode(),
      hasCredentials: !provider.isMockMode
    }));
  }

  /** 获取真实的提供商列表（已配密钥的） */
  getRealProviders() {
    return Object.entries(this.providers)
      .filter(([_, p]) => !p.isMockMode)
      .map(([key, p]) => ({ code: key, name: p.displayName }));
  }

  /** 创建配送订单 */
  async createOrder(providerName, params) {
    const provider = this.get(providerName);
    if (!provider) return { success: false, error: `未知服务商: ${providerName}` };
    return await provider.createOrder(params);
  }

  /** 查询配送状态 */
  async queryOrder(providerName, platformOrderId) {
    const provider = this.get(providerName);
    if (!provider) return { success: false, error: `未知服务商: ${providerName}` };
    return await provider.queryOrder(platformOrderId);
  }

  /** 取消配送 */
  async cancelOrder(providerName, platformOrderId, reason) {
    const provider = this.get(providerName);
    if (!provider) return { success: false, error: `未知服务商: ${providerName}` };
    return await provider.cancelOrder(platformOrderId, reason);
  }

  /** 查询价格 */
  async queryPrice(providerName, params) {
    const provider = this.get(providerName);
    if (!provider) return { success: false, error: `未知服务商: ${providerName}` };
    return await provider.queryPrice(params);
  }
}

module.exports = new DeliveryProviderManager();
