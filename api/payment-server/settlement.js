/**
 * 资金结算系统
 * 负责平台资金管理、门店结算、提现处理
 */

class SettlementSystem {
  constructor() {
    // 结算周期配置（天）
    this.settlementCycle = 7; // T+7结算
    
    // 平台服务费比例
    this.platformFeeRate = 0.05; // 5%平台服务费
    
    // 结算状态
    this.settlementStatus = {
      pending: 'pending',      // 待结算
      processing: 'processing', // 结算中
      completed: 'completed',   // 已结算
      failed: 'failed'          // 结算失败
    };
  }

  /**
   * 计算订单分账
   * @param {Object} order - 订单信息
   * @returns {Object} 分账结果
   */
  calculateDistribution(order) {
    const totalAmount = order.totalAmount; // 订单总金额
    const platformFee = totalAmount * this.platformFeeRate; // 平台服务费
    const storeAmount = totalAmount - platformFee; // 门店应得金额
    
    return {
      orderId: order.orderId,
      totalAmount: totalAmount,
      platformFee: platformFee,
      platformFeeRate: this.platformFeeRate,
      storeAmount: storeAmount,
      storeId: order.storeId,
      status: this.settlementStatus.pending,
      calculatedAt: new Date().toISOString()
    };
  }

  /**
   * 结算订单
   * @param {string} orderId - 订单ID
   * @returns {Object} 结算结果
   */
  async settleOrder(orderId) {
    try {
      // 1. 获取订单信息
      const order = await this.getOrder(orderId);
      if (!order) {
        throw new Error('订单不存在');
      }
      
      // 2. 检查是否已结算
      if (order.settled) {
        throw new Error('订单已结算');
      }
      
      // 3. 计算分账
      const distribution = this.calculateDistribution(order);
      
      // 4. 更新订单结算状态
      await this.updateOrderSettlement(orderId, {
        settled: true,
        settlementTime: new Date().toISOString(),
        platformFee: distribution.platformFee,
        storeAmount: distribution.storeAmount
      });
      
      // 5. 更新门店账户余额
      await this.updateStoreBalance(order.storeId, distribution.storeAmount);
      
      return {
        success: true,
        orderId: orderId,
        distribution: distribution,
        message: '订单结算成功'
      };
      
    } catch (error) {
      console.error('结算订单失败:', error);
      return {
        success: false,
        orderId: orderId,
        message: error.message
      };
    }
  }

  /**
   * 批量结算门店订单
   * @param {string} storeId - 门店ID
   * @param {string} startDate - 开始日期
   * @param {string} endDate - 结束日期
   * @returns {Object} 批量结算结果
   */
  async batchSettleOrders(storeId, startDate, endDate) {
    try {
      // 1. 查询待结算订单
      const orders = await this.getPendingSettlementOrders(storeId, startDate, endDate);
      
      if (orders.length === 0) {
        return {
          success: true,
          totalOrders: 0,
          totalAmount: 0,
          message: '没有待结算的订单'
        };
      }
      
      // 2. 计算总金额
      let totalAmount = 0;
      let platformFeeTotal = 0;
      let storeAmountTotal = 0;
      
      const distributions = [];
      
      for (const order of orders) {
        const dist = this.calculateDistribution(order);
        totalAmount += dist.totalAmount;
        platformFeeTotal += dist.platformFee;
        storeAmountTotal += dist.storeAmount;
        distributions.push(dist);
        
        // 更新订单结算状态
        await this.updateOrderSettlement(order.orderId, {
          settled: true,
          settlementTime: new Date().toISOString(),
          platformFee: dist.platformFee,
          storeAmount: dist.storeAmount
        });
      }
      
      // 3. 批量更新门店账户余额
      await this.updateStoreBalance(storeId, storeAmountTotal);
      
      // 4. 创建结算记录
      const settlementRecord = {
        settlementId: 'ST' + Date.now(),
        storeId: storeId,
        startDate: startDate,
        endDate: endDate,
        totalOrders: orders.length,
        totalAmount: totalAmount,
        platformFee: platformFeeTotal,
        storeAmount: storeAmountTotal,
        status: this.settlementStatus.completed,
        createdAt: new Date().toISOString()
      };
      
      await this.saveSettlementRecord(settlementRecord);
      
      return {
        success: true,
        settlementId: settlementRecord.settlementId,
        totalOrders: orders.length,
        totalAmount: totalAmount,
        platformFee: platformFeeTotal,
        storeAmount: storeAmountTotal,
        message: `成功结算${orders.length}笔订单，共计${storeAmountTotal}元`
      };
      
    } catch (error) {
      console.error('批量结算失败:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 门店申请提现
   * @param {string} storeId - 门店ID
   * @param {number} amount - 提现金额
   * @param {string} bankAccount - 银行账户
   * @returns {Object} 提现结果
   */
  async requestWithdraw(storeId, amount, bankAccount) {
    try {
      // 1. 检查门店余额
      const storeBalance = await this.getStoreBalance(storeId);
      
      if (storeBalance < amount) {
        throw new Error(`余额不足，当前余额：${storeBalance}元`);
      }
      
      // 2. 检查提现限额
      const minWithdraw = 100; // 最低提现金额
      const maxWithdraw = 50000; // 最高提现金额
      
      if (amount < minWithdraw) {
        throw new Error(`最低提现金额：${minWithdraw}元`);
      }
      
      if (amount > maxWithdraw) {
        throw new Error(`最高提现金额：${maxWithdraw}元`);
      }
      
      // 3. 创建提现申请
      const withdrawRecord = {
        withdrawId: 'WD' + Date.now(),
        storeId: storeId,
        amount: amount,
        bankAccount: bankAccount,
        status: 'pending', // pending, processing, completed, failed
        createdAt: new Date().toISOString(),
        estimatedArrival: this.getEstimatedArrival()
      };
      
      await this.saveWithdrawRecord(withdrawRecord);
      
      // 4. 冻结提现金额（从可用余额中扣除）
      await this.freezeStoreBalance(storeId, amount);
      
      return {
        success: true,
        withdrawId: withdrawRecord.withdrawId,
        amount: amount,
        estimatedArrival: withdrawRecord.estimatedArrival,
        message: '提现申请已提交'
      };
      
    } catch (error) {
      console.error('提现申请失败:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 获取门店财务报告
   * @param {string} storeId - 门店ID
   * @param {string} startDate - 开始日期
   * @param {string} endDate - 结束日期
   * @returns {Object} 财务报告
   */
  async getStoreFinancialReport(storeId, startDate, endDate) {
    try {
      // 1. 查询结算记录
      const settlements = await this.getSettlementRecords(storeId, startDate, endDate);
      
      // 2. 查询提现记录
      const withdrawals = await this.getWithdrawRecords(storeId, startDate, endDate);
      
      // 3. 计算统计数据
      const totalSettlement = settlements.reduce((sum, s) => sum + s.storeAmount, 0);
      const totalPlatformFee = settlements.reduce((sum, s) => sum + s.platformFee, 0);
      const totalWithdraw = withdrawals
        .filter(w => w.status === 'completed')
        .reduce((sum, w) => sum + w.amount, 0);
      
      // 4. 获取当前余额
      const currentBalance = await this.getStoreBalance(storeId);
      const frozenBalance = await this.getStoreFrozenBalance(storeId);
      
      return {
        success: true,
        report: {
          storeId: storeId,
          period: {
            startDate: startDate,
            endDate: endDate
          },
          summary: {
            totalOrders: settlements.reduce((sum, s) => sum + s.totalOrders, 0),
            totalSettlement: totalSettlement,
            totalPlatformFee: totalPlatformFee,
            totalWithdraw: totalWithdraw,
            currentBalance: currentBalance,
            frozenBalance: frozenBalance,
            availableBalance: currentBalance - frozenBalance
          },
          settlements: settlements,
          withdrawals: withdrawals,
          generatedAt: new Date().toISOString()
        }
      };
      
    } catch (error) {
      console.error('获取财务报告失败:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 获取预计到账时间
   * @returns {string} 预计到账时间
   */
  getEstimatedArrival() {
    const now = new Date();
    const arrivalDate = new Date(now.getTime() + (this.settlementCycle * 24 * 60 * 60 * 1000));
    return arrivalDate.toISOString().split('T')[0];
  }

  // ==================== 模拟数据存储 ====================
  
  // 模拟数据库存储
  store database = {
    orders: new Map(),
    settlements: new Map(),
    withdrawals: new Map(),
    storeBalances: new Map(),
    storeFrozenBalances: new Map()
  };

  async getOrder(orderId) {
    return this.database.orders.get(orderId);
  }

  async updateOrderSettlement(orderId, settlementInfo) {
    const order = this.database.orders.get(orderId);
    if (order) {
      Object.assign(order, settlementInfo);
      this.database.orders.set(orderId, order);
    }
  }

  async getPendingSettlementOrders(storeId, startDate, endDate) {
    const orders = [];
    for (const [orderId, order] of this.database.orders) {
      if (order.storeId === storeId && !order.settled) {
        orders.push(order);
      }
    }
    return orders;
  }

  async updateStoreBalance(storeId, amount) {
    const currentBalance = this.database.storeBalances.get(storeId) || 0;
    this.database.storeBalances.set(storeId, currentBalance + amount);
  }

  async freezeStoreBalance(storeId, amount) {
    const currentFrozen = this.database.storeFrozenBalances.get(storeId) || 0;
    this.database.storeFrozenBalances.set(storeId, currentFrozen + amount);
    
    const currentBalance = this.database.storeBalances.get(storeId) || 0;
    this.database.storeBalances.set(storeId, currentBalance - amount);
  }

  async getStoreBalance(storeId) {
    return this.database.storeBalances.get(storeId) || 0;
  }

  async getStoreFrozenBalance(storeId) {
    return this.database.storeFrozenBalances.get(storeId) || 0;
  }

  async saveSettlementRecord(record) {
    this.database.settlements.set(record.settlementId, record);
  }

  async getSettlementRecords(storeId, startDate, endDate) {
    const records = [];
    for (const [id, record] of this.database.settlements) {
      if (record.storeId === storeId) {
        records.push(record);
      }
    }
    return records;
  }

  async saveWithdrawRecord(record) {
    this.database.withdrawals.set(record.withdrawId, record);
  }

  async getWithdrawRecords(storeId, startDate, endDate) {
    const records = [];
    for (const [id, record] of this.database.withdrawals) {
      if (record.storeId === storeId) {
        records.push(record);
      }
    }
    return records;
  }
}

module.exports = SettlementSystem;
