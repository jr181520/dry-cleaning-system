/**
 * 信用服务体系
 * V1就开始记录用户履约行为，为未来租赁业务打基础
 */

class CreditService {
  constructor() {
    // 行为积分配置
    this.behaviorScores = {
      // 正向行为
      'order.completed': 5,          // 正常完成订单
      'payment.on_time': 3,          // 准时付款
      'rental.return_on_time': 10,   // 准时归还租赁物品
      'review.submitted': 2,        // 提交评价
      'binding.completed': 5,       // 完成账号绑定
      'identity.verified': 10,       // 完成身份认证
      
      // 负向行为
      'order.cancelled': -10,       // 取消订单
      'order.no_pickup': -15,        // 多次不取件
      'payment.late': -5,            // 延迟付款
      'rental.overdue': -20,         // 租赁逾期
      'rental.damaged': -50,         // 损坏租赁物品
      'report.fraud': -100,          // 被举报欺诈
      'abuse.staff': -30,            // 辱骂门店员工
      'fake.review': -20             // 虚假评价
    };
    
    // 信用等级
    this.creditLevels = [
      { min: 0, max: 30, level: 'poor', label: '信用较差' },
      { min: 31, max: 60, level: 'fair', label: '信用一般' },
      { min: 61, max: 80, level: 'good', label: '信用良好' },
      { min: 81, max: 95, level: 'excellent', label: '信用优秀' },
      { min: 96, max: 100, level: 'outstanding', label: '信用极好' }
    ];
    
    // 押金比例配置
    this.depositRatios = {
      outstanding: 0.3,   // 极好用户押金30%
      excellent: 0.5,     // 优秀用户押金50%
      good: 0.8,         // 良好用户押金80%
      fair: 1.0,          // 一般用户押金100%
      poor: null          // 较差用户不可租
    };
  }
  
  /**
   * 记录用户行为
   * @param {string} userId
   * @param {string} behavior - 行为标识
   * @param {Object} context - 附加上下文
   */
  async recordBehavior(userId, behavior, context = {}) {
    const score = this.behaviorScores[behavior] || 0;
    if (score === 0) return null;
    
    // 更新用户信用分
    const user = await this.getUser(userId);
    if (!user) return null;
    
    const oldScore = user.credit?.fulfillmentScore || 100;
    const newScore = Math.max(0, Math.min(100, oldScore + score));
    
    // 记录历史
    await this.recordHistory(userId, {
      behavior,
      scoreChange: score,
      oldScore,
      newScore,
      ...context
    });
    
    // 更新用户
    await this.updateUserCredit(userId, { fulfillmentScore: newScore });
    
    return { oldScore, newScore, change: score };
  }
  
  /**
   * 获取用户信用信息
   */
  async getUserCredit(userId) {
    // TODO: 从数据库获取
    return {
      userId,
      score: 100,
      level: 'excellent',
      history: []
    };
  }
  
  /**
   * 评估用户租赁资格
   * @param {string} userId
   * @returns {Object} { eligible, reason, depositRatio, creditLimit }
   */
  async assessRentalEligibility(userId) {
    const credit = await this.getUserCredit(userId);
    const levelInfo = this.creditLevels.find(l => 
      credit.score >= l.min && credit.score <= l.max
    );
    
    if (!levelInfo) {
      return { eligible: false, reason: '无法评估信用等级' };
    }
    
    // 检查是否在黑名单
    if (credit.blacklisted) {
      return { eligible: false, reason: credit.blackReason || '您在信用黑名单中' };
    }
    
    // 检查逾期记录
    if (credit.lateReturns > 3) {
      return { eligible: false, reason: '逾期记录过多' };
    }
    
    // 检查取消订单率
    const totalOrders = credit.completedOrders + credit.cancelledOrders;
    if (totalOrders > 0) {
      const cancelRate = credit.cancelledOrders / totalOrders;
      if (cancelRate > 0.3) {
        return { eligible: false, reason: '订单取消率过高' };
      }
    }
    
    // 较差用户不可租
    if (levelInfo.level === 'poor') {
      return { eligible: false, reason: '信用等级不足' };
    }
    
    const depositRatio = this.depositRatios[levelInfo.level];
    const creditLimit = credit.score * 100;  // 信用额度 = 分数 * 100
    
    return {
      eligible: true,
      level: levelInfo.level,
      levelLabel: levelInfo.label,
      depositRatio,
      creditLimit,
      minScore: credit.score
    };
  }
  
  /**
   * 计算押金
   * @param {number} itemValue - 物品价值
   * @param {number} depositRatio - 押金比例
   */
  calculateDeposit(itemValue, depositRatio) {
    return Math.round(itemValue * depositRatio * 100) / 100;
  }
  
  /**
   * 添加黑名单
   */
  async addToBlacklist(userId, reason) {
    await this.updateUserCredit(userId, {
      blacklisted: true,
      blackReason: reason,
      blackAt: new Date()
    });
  }
  
  /**
   * 移除黑名单
   */
  async removeFromBlacklist(userId) {
    await this.updateUserCredit(userId, {
      blacklisted: false,
      blackReason: null,
      blackAt: null
    });
  }
  
  // 内部方法（需要根据实际数据库实现）
  async getUser(userId) { return null; }
  async updateUserCredit(userId, data) { }
  async recordHistory(userId, record) { }
}

module.exports = new CreditService();
