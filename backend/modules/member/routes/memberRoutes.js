/**
 * 会员信息路由
 * GET /api/member/info - 获取当前用户会员信息
 */

const express = require('express');
const router = express.Router();
const memberService = require('../services/memberService');
const { optionalAuth } = require('../../common/middlewares/auth');

/**
 * GET /api/member/info
 * 获取会员信息（积分/余额/等级/折扣等）
 * 可选认证：有token返回真实数据，无token返回模拟数据
 */
router.get('/info', optionalAuth, async (req, res) => {
  try {
    let result;

    if (req.user && req.user.id) {
      // 有用户身份，查询真实数据
      result = await memberService.getMemberInfo(req.user.id);
    } else {
      // 无用户身份，返回模拟数据
      result = {
        success: true,
        member: {
          name: '黄金会员',
          points: 5800,
          balance: 320.00,
          discount: '8.5折',
          expireDate: '2026-12-31'
        }
      };
    }

    res.json(result);
  } catch (error) {
    console.error('[会员路由] 获取会员信息失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
