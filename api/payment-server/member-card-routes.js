/**
 * 会员卡API路由
 */

const express = require('express');
const router = express.Router();
const memberCard = require('./member-card');

/**
 * POST /api/member-card/create
 * 创建会员卡
 */
router.post('/create', async (req, res) => {
    try {
        const {
            userId,
            userName,
            phone,
            cardType,
            storeId,
            storeName,
            initialBalance
        } = req.body;

        if (!userId || !userName || !phone) {
            return res.json({
                success: false,
                error: '缺少必要参数'
            });
        }

        const result = memberCard.createCard({
            userId,
            userName,
            phone,
            cardType: cardType || 'system',
            storeId,
            storeName,
            initialBalance: initialBalance || 0
        });

        res.json(result);
    } catch (error) {
        console.error('[会员卡] 创建失败:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/member-card/info/:cardId
 * 查询会员卡信息
 */
router.get('/info/:cardId', async (req, res) => {
    try {
        const { cardId } = req.params;
        const result = memberCard.getCardInfo(cardId);
        res.json(result);
    } catch (error) {
        console.error('[会员卡] 查询失败:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/member-card/user/:userId
 * 查询用户的所有会员卡
 */
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = memberCard.getUserCards(userId);
        res.json(result);
    } catch (error) {
        console.error('[会员卡] 查询失败:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/member-card/verify
 * 验证并扣除会员卡余额
 */
router.post('/verify', async (req, res) => {
    try {
        const {
            cardId,
            cardType,
            amount,
            storeId
        } = req.body;

        if (!cardId || !amount) {
            return res.json({
                success: false,
                error: '缺少必要参数'
            });
        }

        const result = await memberCard.verifyAndDeduct(cardId, cardType, amount, storeId);
        res.json(result);
    } catch (error) {
        console.error('[会员卡] 消费失败:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/member-card/recharge
 * 充值会员卡
 */
router.post('/recharge', async (req, res) => {
    try {
        const {
            cardId,
            amount,
            userId
        } = req.body;

        if (!cardId || !amount) {
            return res.json({
                success: false,
                error: '缺少必要参数'
            });
        }

        const result = await memberCard.recharge(cardId, amount, userId);
        res.json(result);
    } catch (error) {
        console.error('[会员卡] 充值失败:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/member-card/transactions/:cardId
 * 获取会员卡交易记录
 */
router.get('/transactions/:cardId', async (req, res) => {
    try {
        const { cardId } = req.params;
        const { limit = 10 } = req.query;
        const result = memberCard.getCardTransactions(cardId, parseInt(limit));
        res.json(result);
    } catch (error) {
        console.error('[会员卡] 查询交易记录失败:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/member-card/verify-password
 * 验证会员卡密码
 */
router.post('/verify-password', async (req, res) => {
    try {
        const { cardId, password } = req.body;

        if (!cardId || !password) {
            return res.json({
                success: false,
                error: '缺少必要参数'
            });
        }

        const result = memberCard.verifyPassword(cardId, password);
        res.json(result);
    } catch (error) {
        console.error('[会员卡] 验证密码失败:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/member-card/change-password
 * 修改会员卡密码
 */
router.post('/change-password', async (req, res) => {
    try {
        const { cardId, oldPassword, newPassword } = req.body;

        if (!cardId || !oldPassword || !newPassword) {
            return res.json({
                success: false,
                error: '缺少必要参数'
            });
        }

        const result = memberCard.changePassword(cardId, oldPassword, newPassword);
        res.json(result);
    } catch (error) {
        console.error('[会员卡] 修改密码失败:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/member-card/toggle-status
 * 挂失/解挂会员卡
 */
router.post('/toggle-status', async (req, res) => {
    try {
        const { cardId, status } = req.body;

        if (!cardId || !status) {
            return res.json({
                success: false,
                error: '缺少必要参数'
            });
        }

        const result = memberCard.toggleCardStatus(cardId, status);
        res.json(result);
    } catch (error) {
        console.error('[会员卡] 修改状态失败:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/member-card/store/:storeId
 * 查询门店可用会员卡
 */
router.get('/store/:storeId', async (req, res) => {
    try {
        const { storeId } = req.params;
        const result = memberCard.getStoreCards(storeId);
        res.json(result);
    } catch (error) {
        console.error('[会员卡] 查询门店卡失败:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/member-card/config
 * 获取会员卡配置
 */
router.get('/config', async (req, res) => {
    res.json({
        success: true,
        data: {
            minRecharge: memberCard.SYSTEM_CARDS.minRecharge,
            maxRecharge: memberCard.SYSTEM_CARDS.maxRecharge,
            discountRate: memberCard.SYSTEM_CARDS.discountRate,
            pointsRate: memberCard.SYSTEM_CARDS.pointsRate
        }
    });
});

module.exports = router;
