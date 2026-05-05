/**
 * 账户余额和结算服务
 * 负责用户余额管理、门店结算
 */

const crypto = require('crypto');

class BalanceService {
  constructor() {
    // 模拟数据库
    this.userBalances = new Map();      // 用户余额
    this.transactions = [];             // 交易记录
    this.storeBalances = new Map();     // 门店余额
    this.storeSettlements = [];         // 结算记录
    
    // 初始化一些测试数据
    this.initTestData();
  }

  /**
   * 初始化测试数据
   */
  initTestData() {
    // 测试用户余额
    this.userBalances.set('user_001', {
      userId: 'user_001',
      balance: 500.00,
      frozenBalance: 0,
      totalRecharge: 1000.00,
      totalConsume: 500.00,
      createdAt: new Date('2025-01-01').toISOString(),
      updatedAt: new Date().toISOString()
    });

    // 测试门店余额
    const stores = ['store_001', 'store_002', 'store_003'];
    stores.forEach((storeId, index) => {
      this.storeBalances.set(storeId, {
        storeId: storeId,
        storeName: `干洗店${index + 1}`,
        availableBalance: 0,
        frozenBalance: 0,
        totalAmount: 0,
        totalWithdraw: 0,
        pendingSettlement: 0,
        lastSettlementAt: null,
        createdAt: new Date('2025-01-01').toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
  }

  /**
   * 获取用户余额
   * @param {string} userId - 用户ID
   */
  async getUserBalance(userId) {
    let userBalance = this.userBalances.get(userId);
    
    if (!userBalance) {
      userBalance = {
        userId: userId,
        balance: 0,
        frozenBalance: 0,
        totalRecharge: 0,
        totalConsume: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.userBalances.set(userId, userBalance);
    }
    
    return {
      success: true,
      data: {
        userId: userId,
        balance: userBalance.balance,
        frozenBalance: userBalance.frozenBalance,
        availableBalance: userBalance.balance - userBalance.frozenBalance
      }
    };
  }

  /**
   * 扣减用户余额
   * @param {string} userId - 用户ID
   * @param {number} amount - 扣减金额
   * @param {string} orderId - 订单ID
   * @param {string} description - 描述
   */
  async deductBalance(userId, amount, orderId, description = '') {
    const userBalance = this.userBalances.get(userId);
    
    if (!userBalance) {
      return {
        success: false,
        error: '用户账户不存在'
      };
    }

    if (userBalance.balance < amount) {
      return {
        success: false,
        error: '余额不足',
        availableBalance: userBalance.balance,
        requiredAmount: amount
      };
    }

    // 扣减余额
    userBalance.balance -= amount;
    userBalance.totalConsume += amount;
    userBalance.updatedAt = new Date().toISOString();

    // 记录交易
    const transaction = {
      id: `TXN${Date.now()}${crypto.randomBytes(4).toString('hex')}`,
      userId: userId,
      orderId: orderId,
      type: 'consume',
      amount: -amount,
      balanceBefore: userBalance.balance + amount,
      balanceAfter: userBalance.balance,
      description: description,
      paymentMethod: 'balance',
      status: 'success',
      createdAt: new Date().toISOString()
    };
    this.transactions.push(transaction);

    return {
      success: true,
      data: {
        transactionId: transaction.id,
        balance: userBalance.balance,
        amount: amount
      }
    };
  }

  /**
   * 增加用户余额（充值）
   * @param {string} userId - 用户ID
   * @param {number} amount - 充值金额
   * @param {string} channel - 充值渠道
   */
  async addBalance(userId, amount, channel = 'recharge') {
    let userBalance = this.userBalances.get(userId);
    
    if (!userBalance) {
      userBalance = {
        userId: userId,
        balance: 0,
        frozenBalance: 0,
        totalRecharge: 0,
        totalConsume: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.userBalances.set(userId, userBalance);
    }

    const balanceBefore = userBalance.balance;
    userBalance.balance += amount;
    userBalance.totalRecharge += amount;
    userBalance.updatedAt = new Date().toISOString();

    // 记录交易
    const transaction = {
      id: `TXN${Date.now()}${crypto.randomBytes(4).toString('hex')}`,
      userId: userId,
      type: 'recharge',
      amount: amount,
      balanceBefore: balanceBefore,
      balanceAfter: userBalance.balance,
      description: '账户充值',
      paymentMethod: channel,
      status: 'success',
      createdAt: new Date().toISOString()
    };
    this.transactions.push(transaction);

    return {
      success: true,
      data: {
        transactionId: transaction.id,
        balance: userBalance.balance,
        amount: amount
      }
    };
  }

  /**
   * 获取用户交易记录
   * @param {string} userId - 用户ID
   * @param {number} page - 页码
   * @param {number} limit - 每页数量
   */
  async getUserTransactions(userId, page = 1, limit = 20) {
    const userTransactions = this.transactions
      .filter(t => t.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const total = userTransactions.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    
    return {
      success: true,
      data: {
        transactions: userTransactions.slice(start, end),
        total: total,
        page: page,
        limit: limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * 获取门店账户信息
   * @param {string} storeId - 门店ID
   */
  async getStoreBalance(storeId) {
    let storeBalance = this.storeBalances.get(storeId);
    
    if (!storeBalance) {
      return {
        success: false,
        error: '门店不存在'
      };
    }
    
    return {
      success: true,
      data: storeBalance
    };
  }

  /**
   * 订单完成后，平台收款并计算门店应结算金额
   * @param {Object} orderInfo - 订单信息
   */
  async recordOrderPayment(orderInfo) {
    const { orderId, storeId, totalAmount, deliveryFee = 0, platformFeeRate = 0.10 } = orderInfo;
    
    // 计算平台服务费
    const storeServiceAmount = totalAmount - deliveryFee;
    const platformFee = storeServiceAmount * platformFeeRate;
    const storeSettlementAmount = storeServiceAmount - platformFee;
    
    // 更新门店待结算金额
    const storeBalance = this.storeBalances.get(storeId);
    if (storeBalance) {
      storeBalance.pendingSettlement += storeSettlementAmount;
      storeBalance.totalAmount += storeSettlementAmount;
      storeBalance.updatedAt = new Date().toISOString();
    }

    // 记录结算流水
    const settlement = {
      id: `STL${Date.now()}`,
      orderId: orderId,
      storeId: storeId,
      orderAmount: totalAmount,
      deliveryFee: deliveryFee,
      platformFee: platformFee,
      storeSettlementAmount: storeSettlementAmount,
      status: 'pending',  // pending -> settled -> withdrawn
      createdAt: new Date().toISOString()
    };
    this.storeSettlements.push(settlement);

    return {
      success: true,
      data: {
        settlementId: settlement.id,
        orderAmount: totalAmount,
        platformFee: platformFee,
        storeSettlementAmount: storeSettlementAmount
      }
    };
  }

  /**
   * 定期结算给门店（模拟）
   * @param {string} storeId - 门店ID
   * @param {number} settlementCycle - 结算周期（天）
   */
  async settleToStore(storeId, settlementCycle = 7) {
    const storeBalance = this.storeBalances.get(storeId);
    if (!storeBalance) {
      return {
        success: false,
        error: '门店不存在'
      };
    }

    // 查找已完成的待结算订单
    const pendingSettlements = this.storeSettlements.filter(s => 
      s.storeId === storeId && 
      s.status === 'pending'
    );

    if (pendingSettlements.length === 0) {
      return {
        success: false,
        error: '没有待结算的订单'
      };
    }

    // 计算总金额
    const totalAmount = pendingSettlements.reduce((sum, s) => sum + s.storeSettlementAmount, 0);

    // 更新门店余额
    storeBalance.availableBalance += totalAmount;
    storeBalance.pendingSettlement -= totalAmount;
    storeBalance.lastSettlementAt = new Date().toISOString();
    storeBalance.updatedAt = new Date().toISOString();

    // 更新结算状态
    pendingSettlements.forEach(s => {
      s.status = 'settled';
      s.settledAt = new Date().toISOString();
    });

    return {
      success: true,
      data: {
        storeId: storeId,
        settledAmount: totalAmount,
        availableBalance: storeBalance.availableBalance,
        orderCount: pendingSettlements.length,
        settledAt: new Date().toISOString()
      }
    };
  }

  /**
   * 门店提现
   * @param {string} storeId - 门店ID
   * @param {number} amount - 提现金额
   * @param {string} bankAccount - 银行账户
   */
  async storeWithdraw(storeId, amount, bankAccount) {
    const storeBalance = this.storeBalances.get(storeId);
    
    if (!storeBalance) {
      return {
        success: false,
        error: '门店不存在'
      };
    }

    if (storeBalance.availableBalance < amount) {
      return {
        success: false,
        error: '余额不足',
        availableBalance: storeBalance.availableBalance,
        requestedAmount: amount
      };
    }

    // 最小提现金额
    if (amount < 100) {
      return {
        success: false,
        error: '最小提现金额为100元'
      };
    }

    // 冻结提现金额
    storeBalance.availableBalance -= amount;
    storeBalance.frozenBalance += amount;
    storeBalance.totalWithdraw += amount;
    storeBalance.updatedAt = new Date().toISOString();

    // 记录提现申请
    const withdrawal = {
      id: `WD${Date.now()}`,
      storeId: storeId,
      storeName: storeBalance.storeName,
      amount: amount,
      bankAccount: bankAccount,
      status: 'processing', // processing -> success -> failed
      fee: amount * 0.006, // 提现手续费（千分之6）
      createdAt: new Date().toISOString()
    };

    // 模拟提现处理（实际应该调用银行/支付机构API）
    setTimeout(() => {
      storeBalance.frozenBalance -= amount;
      withdrawal.status = 'success';
      withdrawal.completedAt = new Date().toISOString();
      storeBalance.updatedAt = new Date().toISOString();
    }, 5000); // 5秒后自动完成（模拟）

    return {
      success: true,
      data: {
        withdrawalId: withdrawal.id,
        amount: amount,
        fee: withdrawal.fee,
        netAmount: amount - withdrawal.fee,
        status: 'processing',
        estimatedTime: '1-3个工作日'
      }
    };
  }

  /**
   * 获取门店结算记录
   * @param {string} storeId - 门店ID
   * @param {Object} filters - 过滤条件
   */
  async getStoreSettlements(storeId, filters = {}) {
    let settlements = this.storeSettlements.filter(s => s.storeId === storeId);
    
    if (filters.status) {
      settlements = settlements.filter(s => s.status === filters.status);
    }
    
    if (filters.startDate) {
      settlements = settlements.filter(s => 
        new Date(s.createdAt) >= new Date(filters.startDate)
      );
    }
    
    if (filters.endDate) {
      settlements = settlements.filter(s => 
        new Date(s.createdAt) <= new Date(filters.endDate)
      );
    }

    // 按时间倒序
    settlements.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // 计算统计
    const stats = {
      totalOrders: settlements.length,
      totalAmount: settlements.reduce((sum, s) => sum + s.orderAmount, 0),
      totalPlatformFee: settlements.reduce((sum, s) => sum + s.platformFee, 0),
      totalSettlement: settlements.reduce((sum, s) => sum + s.storeSettlementAmount, 0)
    };

    return {
      success: true,
      data: {
        settlements: settlements,
        stats: stats
      }
    };
  }

  /**
   * 生成财务报表
   * @param {Object} params - 报表参数
   */
  async generateReport(params) {
    const { startDate, endDate, storeId, type = 'daily' } = params;
    
    // 获取结算记录
    let settlements = this.storeSettlements;
    
    if (storeId) {
      settlements = settlements.filter(s => s.storeId === storeId);
    }
    
    if (startDate) {
      settlements = settlements.filter(s => 
        new Date(s.createdAt) >= new Date(startDate)
      );
    }
    
    if (endDate) {
      settlements = settlements.filter(s => 
        new Date(s.createdAt) <= new Date(endDate)
      );
    }

    // 按日期分组
    const dailyStats = {};
    settlements.forEach(s => {
      const date = s.createdAt.split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = {
          date: date,
          orderCount: 0,
          orderAmount: 0,
          platformFee: 0,
          storeAmount: 0
        };
      }
      dailyStats[date].orderCount++;
      dailyStats[date].orderAmount += s.orderAmount;
      dailyStats[date].platformFee += s.platformFee;
      dailyStats[date].storeAmount += s.storeSettlementAmount;
    });

    const reportData = Object.values(dailyStats).sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );

    return {
      success: true,
      data: {
        reportType: type,
        startDate: startDate,
        endDate: endDate,
        storeId: storeId,
        summary: {
          totalOrders: settlements.length,
          totalAmount: settlements.reduce((sum, s) => sum + s.orderAmount, 0),
          totalPlatformFee: settlements.reduce((sum, s) => sum + s.platformFee, 0),
          totalStoreAmount: settlements.reduce((sum, s) => sum + s.storeSettlementAmount, 0)
        },
        dailyStats: reportData
      }
    };
  }
}

module.exports = new BalanceService();
