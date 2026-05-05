/**
 * 工具函数库
 */

/**
 * 格式化日期
 * @param {Date|string} date - 日期对象或日期字符串
 * @param {string} format - 格式化模板，默认 'YYYY-MM-DD HH:mm:ss'
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * 格式化金额
 * @param {number} amount - 金额
 * @param {string} currency - 货币符号，默认 '¥'
 * @returns {string} 格式化后的金额字符串
 */
function formatMoney(amount, currency = '¥') {
  return `${currency}${parseFloat(amount).toFixed(2)}`;
}

/**
 * 生成唯一ID
 * @returns {string} 唯一ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * 节流函数
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 限制时间（毫秒）
 * @returns {Function} 节流后的函数
 */
function throttle(func, limit = 300) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * 深拷贝
 * @param {any} obj - 要拷贝的对象
 * @returns {any} 拷贝后的对象
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (obj instanceof Object) {
    const copy = {};
    Object.keys(obj).forEach(key => {
      copy[key] = deepClone(obj[key]);
    });
    return copy;
  }
}

/**
 * 验证手机号
 * @param {string} phone - 手机号
 * @returns {boolean} 是否为有效手机号
 */
function validatePhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

/**
 * 验证邮箱
 * @param {string} email - 邮箱
 * @returns {boolean} 是否为有效邮箱
 */
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * 显示loading提示
 * @param {string} title - 提示文字
 */
function showLoading(title = '加载中...') {
  wx.showLoading({
    title,
    mask: true
  });
}

/**
 * 隐藏loading提示
 */
function hideLoading() {
  wx.hideLoading();
}

/**
 * 显示Toast提示
 * @param {string} title - 提示文字
 * @param {string} icon - 图标类型
 * @param {number} duration - 显示时长（毫秒）
 */
function showToast(title, icon = 'none', duration = 2000) {
  wx.showToast({
    title,
    icon,
    duration
  });
}

/**
 * 获取元素样式
 * @param {string} selector - 选择器
 * @returns {Promise} 返回元素样式Promise
 */
function getRect(selector) {
  return new Promise((resolve) => {
    wx.createSelectorQuery()
      .select(selector)
      .boundingClientRect((rect) => {
        resolve(rect);
      })
      .exec();
  });
}

module.exports = {
  formatDate,
  formatMoney,
  generateId,
  debounce,
  throttle,
  deepClone,
  validatePhone,
  validateEmail,
  showLoading,
  hideLoading,
  showToast,
  getRect
};
