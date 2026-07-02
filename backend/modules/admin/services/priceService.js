/**
 * 门店价格管理服务
 * 
 * 价格体系：
 *   1. 系统默认价格（categoryService 中的 price 字段）
 *   2. 门店自定义价格（覆盖系统默认）
 * 
 * 存储：MongoDB collection "store_prices"
 */
const mongoose = require('mongoose');
const categoryService = require('../../common/services/categoryService');

// =====================
// MongoDB Schema
// =====================
const storePriceSchema = new mongoose.Schema({
  storeId:     { type: String, required: true, index: true },
  categoryId:  { type: String, required: true },
  serviceId:   { type: String, required: true },
  price:       { type: Number, required: true },
  deposit:     { type: Number, default: null },
  unit:        { type: String,  default: null },
  updatedAt:   { type: Date,   default: Date.now }
});
storePriceSchema.index({ storeId: 1, categoryId: 1, serviceId: 1 }, { unique: true });

const StorePrice = mongoose.models.StorePrice || mongoose.model('StorePrice', storePriceSchema);

// =====================
// 服务方法
// =====================

/**
 * 获取品类的服务价格模板列表
 * 优先取门店自定义价格，否则取系统默认
 */
async function getPriceTemplates(categoryId, storeId) {
  const cat = categoryService.getCategory(categoryId);
  if (!cat) throw new Error('品类不存在或未启用');

  // 查门店自定义价格
  let storePrices = [];
  if (storeId) {
    storePrices = await StorePrice.find({ storeId, categoryId }).lean();
  }
  const priceMap = {};
  storePrices.forEach(p => { priceMap[p.serviceId] = p; });

  // 合并系统默认 + 门店自定义
  return cat.services.map(svc => ({
    serviceId:   svc.id,
    name:        svc.name,
    icon:        svc.icon,
    desc:        svc.desc,
    defaultPrice: svc.price,
    defaultDeposit: svc.deposit || null,
    defaultUnit: svc.unit || null,
    // 门店覆盖（如果有）
    customPrice:  priceMap[svc.id] ? priceMap[svc.id].price : null,
    customDeposit: priceMap[svc.id] ? priceMap[svc.id].deposit : null,
    customUnit:   priceMap[svc.id] ? priceMap[svc.id].unit : null,
    isCustomized: !!priceMap[svc.id]
  }));
}

/**
 * 设置单条服务价格
 */
async function setServicePrice({ storeId, categoryId, serviceId, price, deposit, unit }) {
  // 验证品类和服务存在
  const cat = categoryService.getCategory(categoryId);
  if (!cat) throw new Error('品类不存在');
  const svc = cat.services.find(s => s.id === serviceId);
  if (!svc) throw new Error('服务项不存在');

  const update = {
    price,
    updatedAt: new Date()
  };
  if (deposit !== undefined) update.deposit = deposit;
  if (unit !== undefined) update.unit = unit;

  return StorePrice.findOneAndUpdate(
    { storeId, categoryId, serviceId },
    { $set: update },
    { upsert: true, new: true }
  ).lean();
}

/**
 * 批量设置价格
 */
async function batchSetPrices(storeId, categoryId, services) {
  const results = [];
  for (const svc of services) {
    const r = await setServicePrice({
      storeId, categoryId,
      serviceId: svc.serviceId,
      price: svc.price,
      deposit: svc.deposit,
      unit: svc.unit
    });
    results.push(r);
  }
  return results;
}

/**
 * 获取门店所有已设置的价格
 */
async function getStorePrices(storeId, categoryId) {
  const query = { storeId };
  if (categoryId) query.categoryId = categoryId;
  return StorePrice.find(query).lean();
}

/**
 * 删除门店自定义价格（恢复默认）
 */
async function resetPrice(storeId, categoryId, serviceId) {
  await StorePrice.deleteOne({ storeId, categoryId, serviceId });
}

module.exports = {
  getPriceTemplates,
  setServicePrice,
  batchSetPrices,
  getStorePrices,
  resetPrice
};
