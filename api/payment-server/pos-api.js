/**
 * POS系统API接口
 * 预留POS机支付接口，支持扫码支付
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// 模拟数据库
const posOrders = new Map();
const cashPayments = new Map();

// POS系统配置
const POS_CONFIG = {
    apiVersion: '1.0.0',
    supportedMethods: ['qrcode', 'card', 'cash', 'scan'],
    scanQRTimeout: 300 // 5分钟超时
};

/**
 * POST /api/pos/create
 * 创建POS订单（用于现金支付场景）
 */
router.post('/create', async (req, res) => {
    try {
        const { 
            orderId, 
            storeId, 
            amount, 
            customerPhone,
            items,
            operator
        } = req.body;

        // 参数验证
        if (!orderId || !storeId || !amount) {
            return res.json({
                success: false,
                error: '缺少必要参数',
                required: ['orderId', 'storeId', 'amount']
            });
        }

        // 检查是否已存在
        if (posOrders.has(orderId)) {
            return res.json({
                success: true,
                data: posOrders.get(orderId),
                message: '订单已存在'
            });
        }

        // 生成支付二维码
        const paymentQRId = `POS_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const qrCodeData = {
            type: 'pos_payment',
            orderId: orderId,
            storeId: storeId,
            amount: amount,
            paymentId: paymentQRId,
            timestamp: Date.now(),
            expires: Date.now() + POS_CONFIG.scanQRTimeout * 1000
        };

        // 生成二维码URL（实际应用中调用二维码生成服务）
        const qrCodeUrl = `https://pay.drycleaning-system.com/qr/${paymentQRId}`;

        const posOrder = {
            orderId,
            storeId,
            amount,
            customerPhone,
            items,
            operator: operator || 'system',
            paymentId: paymentQRId,
            qrCode: qrCodeUrl,
            qrCodeData: qrCodeData,
            status: 'pending',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + POS_CONFIG.scanQRTimeout * 1000).toISOString()
        };

        posOrders.set(orderId, posOrder);

        console.log(`[POS] 创建订单: ${orderId}, 金额: ¥${amount}, 二维码: ${qrCodeUrl}`);

        res.json({
            success: true,
            data: {
                orderId: posOrder.orderId,
                paymentId: posOrder.paymentId,
                amount: posOrder.amount,
                qrCode: posOrder.qrCode,
                expiresAt: posOrder.expiresAt,
                status: posOrder.status
            }
        });
    } catch (error) {
        console.error('[POS] 创建订单失败:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/pos/query/:orderId
 * 查询POS订单状态
 */
router.get('/query/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const posOrder = posOrders.get(orderId);

        if (!posOrder) {
            return res.json({
                success: false,
                error: '订单不存在'
            });
        }

        // 检查是否过期
        if (posOrder.status === 'pending' && new Date() > new Date(posOrder.expiresAt)) {
            posOrder.status = 'expired';
            posOrders.set(orderId, posOrder);
        }

        res.json({
            success: true,
            data: {
                orderId: posOrder.orderId,
                paymentId: posOrder.paymentId,
                amount: posOrder.amount,
                status: posOrder.status,
                paidAt: posOrder.paidAt,
                paidMethod: posOrder.paidMethod,
                transactionId: posOrder.transactionId
            }
        });
    } catch (error) {
        console.error('[POS] 查询失败:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/pos/scan
 * POS扫描用户支付二维码
 */
router.post('/scan', async (req, res) => {
    try {
        const { 
            orderId, 
            scanQR,
            operator,
            storeId 
        } = req.body;

        if (!orderId || !scanQR) {
            return res.json({
                success: false,
                error: '缺少必要参数'
            });
        }

        const posOrder = posOrders.get(orderId);
        if (!posOrder) {
            return res.json({
                success: false,
                error: '订单不存在'
            });
        }

        if (posOrder.status !== 'pending') {
            return res.json({
                success: false,
                error: `订单状态异常: ${posOrder.status}`
            });
        }

        // 检查过期
        if (new Date() > new Date(posOrder.expiresAt)) {
            posOrder.status = 'expired';
            posOrders.set(orderId, posOrder);
            return res.json({
                success: false,
                error: '订单已过期'
            });
        }

        // 模拟扫码支付成功
        const transactionId = `CASH_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        posOrder.status = 'paid';
        posOrder.paidAt = new Date().toISOString();
        posOrder.paidMethod = 'scan';
        posOrder.transactionId = transactionId;
        posOrder.scanQR = scanQR;
        posOrder.operator = operator;
        posOrders.set(orderId, posOrder);

        // 记录现金支付
        cashPayments.set(transactionId, {
            orderId,
            storeId,
            amount: posOrder.amount,
            method: 'scan',
            operator,
            paidAt: posOrder.paidAt,
            transactionId
        });

        console.log(`[POS] 扫码支付成功: ${orderId}, 流水号: ${transactionId}`);

        res.json({
            success: true,
            data: {
                orderId: posOrder.orderId,
                transactionId: transactionId,
                amount: posOrder.amount,
                status: 'paid',
                paidAt: posOrder.paidAt
            },
            message: '支付成功'
        });
    } catch (error) {
        console.error('[POS] 扫码失败:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/pos/cash
 * 现金支付（手动输入金额）
 */
router.post('/cash', async (req, res) => {
    try {
        const { 
            orderId, 
            inputAmount,
            receivedAmount,
            change,
            operator,
            storeId 
        } = req.body;

        if (!orderId || !inputAmount) {
            return res.json({
                success: false,
                error: '缺少必要参数'
            });
        }

        const posOrder = posOrders.get(orderId);
        if (!posOrder) {
            return res.json({
                success: false,
                error: '订单不存在'
            });
        }

        // 验证金额
        if (parseFloat(inputAmount) < parseFloat(posOrder.amount)) {
            return res.json({
                success: false,
                error: '收款金额不足'
            });
        }

        const transactionId = `CASH_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        posOrder.status = 'paid';
        posOrder.paidAt = new Date().toISOString();
        posOrder.paidMethod = 'cash';
        posOrder.transactionId = transactionId;
        posOrder.inputAmount = inputAmount;
        posOrder.receivedAmount = receivedAmount || inputAmount;
        posOrder.change = change || 0;
        posOrder.operator = operator;
        posOrders.set(orderId, posOrder);

        // 记录现金支付
        cashPayments.set(transactionId, {
            orderId,
            storeId,
            amount: posOrder.amount,
            inputAmount,
            receivedAmount: receivedAmount || inputAmount,
            change: change || 0,
            method: 'cash',
            operator,
            paidAt: posOrder.paidAt,
            transactionId
        });

        console.log(`[POS] 现金支付: ${orderId}, 收款: ¥${inputAmount}, 找零: ¥${change || 0}`);

        res.json({
            success: true,
            data: {
                orderId: posOrder.orderId,
                transactionId: transactionId,
                amount: posOrder.amount,
                inputAmount: inputAmount,
                receivedAmount: receivedAmount || inputAmount,
                change: change || 0,
                status: 'paid',
                paidAt: posOrder.paidAt
            },
            message: '收款成功'
        });
    } catch (error) {
        console.error('[POS] 现金支付失败:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/pos/card
 * 会员卡支付
 */
router.post('/card', async (req, res) => {
    try {
        const { 
            orderId, 
            cardId,
            cardType, // system: 系统卡, store: 商家卡
            password,
            storeId,
            operator 
        } = req.body;

        if (!orderId || !cardId) {
            return res.json({
                success: false,
                error: '缺少必要参数'
            });
        }

        const posOrder = posOrders.get(orderId);
        if (!posOrder) {
            return res.json({
                success: false,
                error: '订单不存在'
            });
        }

        // 验证会员卡
        const memberCards = require('./member-card');
        const cardResult = await memberCards.verifyAndDeduct(cardId, cardType, posOrder.amount, storeId);

        if (!cardResult.success) {
            return res.json({
                success: false,
                error: cardResult.error
            });
        }

        const transactionId = `CARD_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        posOrder.status = 'paid';
        posOrder.paidAt = new Date().toISOString();
        posOrder.paidMethod = 'member_card';
        posOrder.transactionId = transactionId;
        posOrder.cardId = cardId;
        posOrder.cardType = cardType;
        posOrder.cardBalance = cardResult.balance;
        posOrders.set(orderId, posOrder);

        console.log(`[POS] 会员卡支付: ${orderId}, 卡号: ${cardId}, 余额: ¥${cardResult.balance}`);

        res.json({
            success: true,
            data: {
                orderId: posOrder.orderId,
                transactionId: transactionId,
                cardId: cardId,
                cardType: cardType,
                amount: posOrder.amount,
                balance: cardResult.balance,
                status: 'paid',
                paidAt: posOrder.paidAt
            },
            message: '支付成功'
        });
    } catch (error) {
        console.error('[POS] 会员卡支付失败:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/pos/callback
 * 支付回调通知（供结算中心调用）
 */
router.post('/callback', async (req, res) => {
    try {
        const { orderId, status, transactionId, method, paidAt } = req.body;

        const posOrder = posOrders.get(orderId);
        if (!posOrder) {
            return res.json({
                success: false,
                error: '订单不存在'
            });
        }

        posOrder.status = status;
        posOrder.transactionId = transactionId;
        posOrder.paidAt = paidAt;
        posOrder.paidMethod = method;
        posOrders.set(orderId, posOrder);

        console.log(`[POS] 回调更新: ${orderId}, 状态: ${status}`);

        res.json({
            success: true,
            message: '回调处理成功'
        });
    } catch (error) {
        console.error('[POS] 回调处理失败:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/pos/receipt/:orderId
 * 获取订单小票数据（用于打印）
 */
router.get('/receipt/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const posOrder = posOrders.get(orderId);

        if (!posOrder) {
            return res.json({
                success: false,
                error: '订单不存在'
            });
        }

        // 生成小票数据
        const receipt = {
            header: {
                title: '干洗服务收银小票',
                storeId: posOrder.storeId,
                operator: posOrder.operator,
                date: new Date().toLocaleString('zh-CN')
            },
            order: {
                orderId: posOrder.orderId,
                paymentId: posOrder.paymentId,
                items: posOrder.items || []
            },
            payment: {
                amount: posOrder.amount,
                method: posOrder.paidMethod,
                transactionId: posOrder.transactionId,
                paidAt: posOrder.paidAt
            },
            footer: {
                qrCode: posOrder.qrCode, // 用于扫码支付的二维码
                note: '如需查询订单，请扫描上方二维码'
            }
        };

        res.json({
            success: true,
            data: receipt
        });
    } catch (error) {
        console.error('[POS] 获取小票失败:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/pos/settlement/sync
 * 同步POS订单到结算中心
 */
router.post('/settlement/sync', async (req, res) => {
    try {
        const { orderId } = req.body;

        const posOrder = posOrders.get(orderId);
        if (!posOrder) {
            return res.json({
                success: false,
                error: '订单不存在'
            });
        }

        if (posOrder.status !== 'paid') {
            return res.json({
                success: false,
                error: '订单未支付，无法同步'
            });
        }

        // 调用结算中心API同步订单
        const settlementPayload = {
            orderId: posOrder.orderId,
            storeId: posOrder.storeId,
            amount: posOrder.amount,
            paymentMethod: posOrder.paidMethod,
            transactionId: posOrder.transactionId,
            paidAt: posOrder.paidAt,
            source: 'pos',
            items: posOrder.items
        };

        console.log(`[POS] 同步结算中心:`, settlementPayload);

        // 实际应用中调用结算中心API
        // const settlementResult = await fetch('http://settlement-center/api/sync', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(settlementPayload)
        // });

        res.json({
            success: true,
            data: settlementPayload,
            message: '已同步到结算中心'
        });
    } catch (error) {
        console.error('[POS] 同步结算中心失败:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
