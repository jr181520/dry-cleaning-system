/**
 * 模块守卫中间件
 * 用于检查模块是否启用，未启用的模块返回友好提示
 */

const MODULE_CONFIG = require('../../../config/modules');

/**
 * 创建模块守卫中间件
 * @param {string} moduleName - 模块名：cleaning/recycle/rental
 * @returns {Function} Express中间件
 */
function moduleGuard(moduleName) {
  return (req, res, next) => {
    const module = MODULE_CONFIG.modules[moduleName];
    
    if (!module) {
      return res.status(404).json({
        success: false,
        error: 'module_not_found',
        message: '模块不存在'
      });
    }
    
    if (!module.enabled) {
      return res.status(503).json({
        success: false,
        error: 'service_unavailable',
        code: 'MODULE_NOT_ENABLED',
        message: module.message || '服务暂未开放',
        module: moduleName,
        moduleName: module.name,
        launchDate: module.launchDate || null
      });
    }
    
    // 模块启用，继续
    req.module = moduleName;
    req.moduleConfig = module;
    next();
  };
}

/**
 * 检查多个模块
 * @param  {...string} moduleNames
 */
function moduleGuards(...moduleNames) {
  return moduleNames.map(name => moduleGuard(name));
}

/**
 * 获取模块配置
 */
function getModuleConfig(moduleName) {
  return MODULE_CONFIG.modules[moduleName] || null;
}

/**
 * 获取所有启用的模块
 */
function getEnabledModules() {
  return Object.entries(MODULE_CONFIG.modules)
    .filter(([_, config]) => config.enabled)
    .map(([name, config]) => ({ name, ...config }));
}

/**
 * 检查功能是否启用
 */
function isFeatureEnabled(featureName) {
  const feature = MODULE_CONFIG.features[featureName];
  return feature ? feature.enabled : false;
}

module.exports = {
  moduleGuard,
  moduleGuards,
  getModuleConfig,
  getEnabledModules,
  isFeatureEnabled,
  MODULE_CONFIG
};
