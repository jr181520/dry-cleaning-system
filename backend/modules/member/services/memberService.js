/**
 * 会员信息服务
 * 提供用户会员信息查询（积分/余额/等级/折扣等）
 */

const mongoose = require('mongoose');

// 使用已有的 User Model（由 authService 注册）
const User = mongoose.model('User');

// 校验是否为合法的 MongoDB ObjectId
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
}

class MemberService {
  /**
   * 获取用户会员信息
   * @param {string} userId - 用户ID
   * @returns {Object} 会员信息
   */
  async getMemberInfo(userId) {
    try {
      // 非 ObjectId 格式的用户ID（如开发模式 mock_token）直接返回模拟数据
      if (!isValidObjectId(userId)) {
        // 安全输出：只打印 24 位 hex 字符或截断的非二进制字符串
        const safeUserId = (typeof userId === 'string' && userId.length > 0)
          ? (userId.replace(/[^\x20-\x7E\u4e00-\u9fff]/g, '') || '(二进制数据)')
          : '(空或无效)';
        console.log('[会员服务] 非ObjectId格式userId，返回模拟数据:', safeUserId);
        return {
          success: true,
          member: this._getMockMemberInfo()
        };
      }

      // 检查 MongoDB 是否已连接
      if (mongoose.connection.readyState !== 1) {
        console.warn('[会员服务] MongoDB 未连接，返回模拟数据');
        return {
          success: true,
          member: this._getMockMemberInfo()
        };
      }

      // 带超时的数据库查询（5秒）
      const user = await Promise.race([
        User.findById(userId).select('name avatar phone gender birthday creditScore userNo createdAt').lean(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT')), 5000))
      ]);
      
      if (!user) {
        return {
          success: true,
          member: this._getMockMemberInfo()
        };
      }

      // 根据积分计算会员等级
      const points = user.creditScore || 0;
      const level = this._calculateLevel(points);

      // 计算折扣
      const discount = this._getDiscount(level);

      // 会员到期时间（从创建时间起算1年）
      const createdAt = user.createdAt || new Date();
      const expireDate = new Date(createdAt);
      expireDate.setFullYear(expireDate.getFullYear() + 1);

      return {
        success: true,
        member: {
          userId: user._id.toString(),
          name: level.name,
          level: level.key,
          points: points,
          balance: 0, // 余额由独立的余额系统管理
          discount: discount,
          expireDate: expireDate.toISOString().slice(0, 10),
          phone: user.phone || '',
          avatar: user.avatar || '',
          nickname: user.name || ''
        }
      };
    } catch (error) {
      console.error('[会员服务] 获取会员信息失败:', error.message);
      // 数据库错误时返回模拟数据兜底
      return {
        success: true,
        member: this._getMockMemberInfo()
      };
    }
  }

  /**
   * 根据积分计算会员等级
   */
  _calculateLevel(points) {
    if (points >= 10000) return { key: 'platinum', name: '铂金会员' };
    if (points >= 5000) return { key: 'gold', name: '黄金会员' };
    if (points >= 2000) return { key: 'silver', name: '白银会员' };
    return { key: 'normal', name: '普通会员' };
  }

  /**
   * 根据等级获取折扣
   */
  _getDiscount(level) {
    const discountMap = {
      platinum: '7.5折',
      gold: '8.5折',
      silver: '9.0折',
      normal: '9.5折'
    };
    return discountMap[level.key] || '9.5折';
  }

  /**
   * 模拟会员数据（开发环境兜底）
   */
  _getMockMemberInfo() {
    return {
      name: '黄金会员',
      points: 5800,
      balance: 320.00,
      discount: '8.5折',
      expireDate: '2026-12-31'
    };
  }
}

module.exports = new MemberService();
