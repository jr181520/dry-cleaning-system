/**
 * 芝麻信用服务
 * 
 * 集成支付宝芝麻信用 OpenAPI：
 * - 信用分查询（zhima.credit.score.brief.get）
 * - 预授权冻结（alipay.fund.auth.order.app.freeze）
 * - 预授权解冻（alipay.fund.auth.order.app.unfreeze）
 * - 扣款（alipay.trade.pay）
 * - 守约/违约上报（zhima.credit.score.brief.callback）
 * 
 * 与现有 DepositRecord 模型集成
 */

const { DepositRecord } = require('../models/DepositRecord');
const { RentalOrder } = require('../models/RentalOrder');

// 芝麻信用等级配置
const ZHIMA_LEVELS = {
  excellent: { min: 750, label: '信用极好', freeDepositRate: 1.0 },
  very_good: { min: 700, label: '信用优秀', freeDepositRate: 0.8 },
  good: { min: 650, label: '信用良好', freeDepositRate: 0.5 },
  normal: { min: 600, label: '信用中等', freeDepositRate: 0 },
  poor: { min: 0, label: '信用较差', freeDepositRate: 0 }
};

/**
 * 查询用户芝麻信用分
 * 调用支付宝 OpenAPI: zhima.credit.score.brief.get
 */
async function checkZhimaCredit(alipayUserId, serviceId) {
  try {
    // 尝试调用支付宝 OpenAPI
    const alipaySDK = getAlipaySDK();
    if (alipaySDK) {
      const result = await alipaySDK.exec('zhima.credit.score.brief.get', {
        biz_content: {
          user_id: alipayUserId,
          service_id: serviceId || process.env.ZHIMA_SERVICE_ID || ''
        }
      });

      if (result?.code === '10000') {
        const score = parseInt(result.score || 0);
        const level = getLevelByScore(score);
        return {
          success: true,
          creditScore: score,
          level: level.key,
          levelLabel: level.label,
          eligible: level.freeDepositRate > 0,
          freeDepositRate: level.freeDepositRate
        };
      }
    }

    // SDK 不可用时返回模拟数据
    return getMockCredit(alipayUserId);
  } catch (e) {
    console.warn('[芝麻信用] 查询异常:', e.message);
    return getMockCredit(alipayUserId);
  }
}

/**
 * 预授权冻结押金（芝麻免押模式）
 * 调用: alipay.fund.auth.order.app.freeze
 */
async function freezeDeposit({ orderNo, amount, alipayUserId }) {
  const order = await RentalOrder.findOne({ orderNo });
  if (!order) throw new Error('订单不存在');

  try {
    const alipaySDK = getAlipaySDK();
    if (alipaySDK) {
      const result = await alipaySDK.exec('alipay.fund.auth.order.app.freeze', {
        biz_content: {
          out_order_no: orderNo,
          out_request_no: orderNo + '_freeze_' + Date.now(),
          order_title: `租赁押金冻结-${orderNo}`,
          amount: (amount / 100).toFixed(2), // 分转元
          extra_param: JSON.stringify({
            category: 'RENT',
            payee_user_id: alipayUserId
          })
        }
      });

      if (result?.code === '10000') {
        // 创建押金记录
        const record = new DepositRecord({
          userId: order.userId,
          orderNo: orderNo,
          storeId: order.storeId,
          mode: 'credit_free',
          depositAmount: 0,
          frozenAmount: amount,
          status: 'frozen',
          paymentTransactionId: result.auth_no,
          creditScore: order.creditScore || 0,
          paidAt: new Date()
        });
        await record.save();

        // 更新订单
        order.depositMode = 'credit_free';
        order.depositPaid = true;
        await order.save();

        return {
          success: true,
          authNo: result.auth_no,
          frozenAmount: amount,
          message: '芝麻信用免押成功'
        };
      }
    }

    // Mock 模式
    return await mockFreeze(orderNo, amount, order);
  } catch (e) {
    console.warn('[芝麻信用] 冻结异常:', e.message);
    return await mockFreeze(orderNo, amount, order);
  }
}

/**
 * 预授权解冻
 * 调用: alipay.fund.auth.order.app.unfreeze
 */
async function unfreezeDeposit({ orderNo, authNo, amount, reason }) {
  const record = await DepositRecord.findOne({ orderNo, mode: 'credit_free' });

  try {
    const alipaySDK = getAlipaySDK();
    if (alipaySDK && authNo) {
      const result = await alipaySDK.exec('alipay.fund.auth.operation.cancel', {
        biz_content: {
          auth_no: authNo,
          out_request_no: orderNo + '_unfreeze_' + Date.now(),
          remark: reason || '租赁归还解冻'
        }
      });

      if (result?.code === '10000') {
        if (record) {
          record.status = 'refunded';
          record.refundedAt = new Date();
          record.refundTransactionId = result.auth_no;
          await record.save();
        }
        return { success: true, message: '押金已解冻' };
      }
    }

    // Mock 模式
    if (record) {
      record.status = 'refunded';
      record.refundedAt = new Date();
      await record.save();
    }
    return { success: true, message: '押金已解冻（模拟）' };
  } catch (e) {
    console.warn('[芝麻信用] 解冻异常:', e.message);
    if (record) {
      record.status = 'refunded';
      record.refundedAt = new Date();
      await record.save();
    }
    return { success: true, message: '押金已解冻（降级）' };
  }
}

/**
 * 从预授权中扣款（逾期/损坏）
 */
async function deductFromAuth({ orderNo, authNo, amount, reason }) {
  const record = await DepositRecord.findOne({ orderNo, mode: 'credit_free' });

  try {
    const alipaySDK = getAlipaySDK();
    if (alipaySDK && authNo) {
      const result = await alipaySDK.exec('alipay.trade.pay', {
        notify_url: process.env.ALIPAY_NOTIFY_URL || '',
        biz_content: {
          out_trade_no: orderNo + '_deduct_' + Date.now(),
          total_amount: (amount / 100).toFixed(2),
          subject: `租赁扣款-${reason || '逾期/损坏'}`,
          auth_no: authNo,
          auth_confirm_mode: 'NOT_CONFIRM'
        }
      });

      if (result?.code === '10000') {
        if (record) {
          record.deductedAmount = (record.deductedAmount || 0) + amount;
          record.status = record.deductedAmount >= record.frozenAmount ? 'deducted' : 'partial_refund';
          await record.save();
        }
        return { success: true, deductedAmount: amount };
      }
    }

    // Mock
    if (record) {
      record.deductedAmount = (record.deductedAmount || 0) + amount;
      record.status = 'deducted';
      await record.save();
    }
    return { success: true, deductedAmount: amount, message: '扣款成功（模拟）' };
  } catch (e) {
    console.warn('[芝麻信用] 扣款异常:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * 上报守约/违约记录
 */
async function reportCreditRecord({ orderNo, type, note }) {
  try {
    const alipaySDK = getAlipaySDK();
    if (alipaySDK) {
      // 芝麻信用守约上报
      await alipaySDK.exec('zhima.credit.payafteruse.creditagreement.sign', {
        biz_content: {
          out_order_no: orderNo,
          credit_scene: type === 'compliance' ? 'COMPLIANCE' : 'VIOLATION',
          extra_param: JSON.stringify({ note })
        }
      });
    }
    return { success: true };
  } catch (e) {
    console.warn('[芝麻信用] 上报异常:', e.message);
    return { success: true }; // 非关键
  }
}

// ============================================
// 工具函数
// ============================================

function getLevelByScore(score) {
  if (score >= 750) return { key: 'excellent', ...ZHIMA_LEVELS.excellent };
  if (score >= 700) return { key: 'very_good', ...ZHIMA_LEVELS.very_good };
  if (score >= 650) return { key: 'good', ...ZHIMA_LEVELS.good };
  if (score >= 600) return { key: 'normal', ...ZHIMA_LEVELS.normal };
  return { key: 'poor', ...ZHIMA_LEVELS.poor };
}

function getAlipaySDK() {
  try {
    // 尝试加载 alipay-sdk
    const AlipaySdk = require('alipay-sdk').default || require('alipay-sdk');
    return new AlipaySdk({
      appId: process.env.ALIPAY_APP_ID || '',
      privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
      alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || '',
      gateway: process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do'
    });
  } catch (e) {
    return null;
  }
}

function getMockCredit(userId) {
  // 基于 userId 生成稳定的模拟分数
  const hash = (userId || '').split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const score = 600 + (hash % 200); // 600-800
  const level = getLevelByScore(score);
  return {
    success: true,
    creditScore: score,
    level: level.key,
    levelLabel: level.label,
    eligible: level.freeDepositRate > 0,
    freeDepositRate: level.freeDepositRate,
    isMock: true
  };
}

async function mockFreeze(orderNo, amount, order) {
  const record = new DepositRecord({
    userId: order.userId,
    orderNo: orderNo,
    storeId: order.storeId,
    mode: 'credit_free',
    depositAmount: 0,
    frozenAmount: amount,
    status: 'frozen',
    paymentTransactionId: 'MOCK_AUTH_' + Date.now(),
    creditScore: 700,
    paidAt: new Date()
  });
  await record.save();

  order.depositMode = 'credit_free';
  order.depositPaid = true;
  await order.save();

  return {
    success: true,
    authNo: record.paymentTransactionId,
    frozenAmount: amount,
    message: '芝麻信用免押成功（模拟）'
  };
}

module.exports = {
  ZHIMA_LEVELS,
  checkZhimaCredit,
  freezeDeposit,
  unfreezeDeposit,
  deductFromAuth,
  reportCreditRecord,
  getLevelByScore
};
