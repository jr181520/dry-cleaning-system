/**
 * 芝麻信用工具（支付宝小程序版）
 * 
 * 集成芝麻信用免押能力：
 * - 信用分查询
 * - 免押资格判定
 * - 预授权冻结/解冻
 * - 守约/违约记录上报
 */

const app = getApp();

// 芝麻信用免押阈值（可由商家配置）
const ZHIMA_THRESHOLDS = {
  low: 550,      // 低门槛（小额免押）
  medium: 650,   // 中等（标准免押）
  high: 750      // 高门槛（高价值免押）
};

/**
 * 查询用户芝麻信用分
 * 需要用户先授权
 */
async function getZhimaScore() {
  try {
    const result = await app.request('/rental/deposit/zhima-check', {
      userId: (app.globalData.userInfo || {}).userId
    }, 'POST');

    if (result && result.success) {
      const { creditScore, eligible, level } = result.data || {};
      app.globalData.zhimaCreditScore = creditScore;
      return { score: creditScore, eligible, level };
    }
    return { score: 0, eligible: false, level: 'unknown' };
  } catch (e) {
    console.warn('[芝麻信用] 查询失败:', e);
    return { score: 0, eligible: false, level: 'unknown' };
  }
}

/**
 * 检查用户是否满足免押条件
 * @param {number} depositAmount - 押金金额
 * @param {number} threshold - 商家设定的信用阈值
 */
async function checkFreezeDeposit(depositAmount, threshold) {
  const scoreResult = await getZhimaScore();
  const requiredThreshold = threshold || ZHIMA_THRESHOLDS.medium;

  if (scoreResult.score >= requiredThreshold) {
    return {
      eligible: true,
      score: scoreResult.score,
      requiredScore: requiredThreshold,
      message: `芝麻分${scoreResult.score}，满足免押条件（需${requiredThreshold}分）`,
      depositAmount: 0
    };
  }

  return {
    eligible: false,
    score: scoreResult.score,
    requiredScore: requiredThreshold,
    message: `芝麻分${scoreResult.score}，未达到免押标准（需${requiredThreshold}分）`,
    depositAmount: depositAmount
  };
}

/**
 * 发起芝麻信用预授权冻结（免押金）
 * 调用后端 -> 支付宝 OpenAPI
 */
async function freezeDeposit(params) {
  const { orderNo, amount, depositMode } = params;

  try {
    const result = await app.request('/rental/deposit/zhima-freeze', {
      orderNo,
      amount,
      depositMode: depositMode || 'credit_free'
    }, 'POST');

    if (result && result.success) {
      my.showToast({ content: '芝麻信用免押成功', type: 'success' });
      return { success: true, authNo: (result.data || {}).authNo };
    }
    return { success: false, error: (result || {}).error || '免押授权失败' };
  } catch (e) {
    return { success: false, error: e.message || '网络异常' };
  }
}

/**
 * 解冻预授权（归还物品时）
 */
async function unfreezeDeposit(orderNo) {
  try {
    const result = await app.request('/rental/deposit/zhima-unfreeze', {
      orderNo
    }, 'POST');

    if (result && result.success) {
      my.showToast({ content: '押金已解冻', type: 'success' });
      return { success: true };
    }
    return { success: false, error: (result || {}).error || '解冻失败' };
  } catch (e) {
    return { success: false, error: e.message || '网络异常' };
  }
}

/**
 * 上报守约记录（按时归还）
 * 提升用户芝麻信用
 */
async function reportCompliance(orderNo) {
  try {
    await app.request('/rental/deposit/zhima-report', {
      orderNo,
      type: 'compliance',
      note: '按时归还，守约完成'
    }, 'POST');
  } catch (e) { /* 非关键操作 */ }
}

/**
 * 上报违约记录（逾期/损坏）
 * 可能影响用户芝麻信用
 */
async function reportViolation(orderNo, reason) {
  try {
    await app.request('/rental/deposit/zhima-report', {
      orderNo,
      type: 'violation',
      note: reason
    }, 'POST');
  } catch (e) { /* 非关键操作 */ }
}

/**
 * 打开芝麻信用页面（引导用户提升信用分）
 */
function openZhimaPage() {
  my.navigateToAlipayPage({
    path: 'zhima-credit-index',
    fail: () => {
      // 降级：打开支付宝信用生活 H5
      my.openURL({
        url: 'https://render.alipay.com/p/yuyan/180020010001196102/index.html',
        fail: () => {
          my.showToast({ content: '无法打开芝麻信用', type: 'fail' });
        }
      });
    }
  });
}

/**
 * 获取芝麻信用等级描述
 */
function getLevelDesc(score) {
  if (score >= 750) return { level: 'excellent', label: '信用极好', color: '#1677ff' };
  if (score >= 700) return { level: 'very_good', label: '信用优秀', color: '#10b981' };
  if (score >= 650) return { level: 'good', label: '信用良好', color: '#059669' };
  if (score >= 600) return { level: 'normal', label: '信用中等', color: '#f59e0b' };
  return { level: 'poor', label: '信用较差', color: '#ef4444' };
}

module.exports = {
  ZHIMA_THRESHOLDS,
  getZhimaScore,
  checkFreezeDeposit,
  freezeDeposit,
  unfreezeDeposit,
  reportCompliance,
  reportViolation,
  openZhimaPage,
  getLevelDesc
};
