/**
 * 工具函数库（支付宝小程序版）
 */

function formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return format
    .replace('YYYY', d.getFullYear())
    .replace('MM', pad(d.getMonth() + 1))
    .replace('DD', pad(d.getDate()))
    .replace('HH', pad(d.getHours()))
    .replace('mm', pad(d.getMinutes()))
    .replace('ss', pad(d.getSeconds()));
}

function formatMoney(amount, currency = '¥') {
  return `${currency}${parseFloat(amount || 0).toFixed(2)}`;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function debounce(func, wait = 300) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

function throttle(func, limit = 300) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  const copy = {};
  Object.keys(obj).forEach(key => { copy[key] = deepClone(obj[key]); });
  return copy;
}

function validatePhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showLoading(title = '加载中...') {
  my.showLoading({ content: title });
}

function hideLoading() {
  my.hideLoading();
}

function showToast(content, type = 'none', duration = 2000) {
  my.showToast({ content, type, duration });
}

function getRect(selector) {
  return new Promise((resolve) => {
    my.createSelectorQuery()
      .select(selector)
      .boundingClientRect()
      .exec((ret) => {
        resolve(ret && ret[0] ? ret[0] : null);
      });
  });
}

module.exports = {
  formatDate, formatMoney, generateId,
  debounce, throttle, deepClone,
  validatePhone, validateEmail,
  showLoading, hideLoading, showToast, getRect
};
