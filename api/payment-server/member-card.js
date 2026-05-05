/**
 * 会员卡系统
 * 支持C端自有系统会员卡（跨商家）和商家专属会员卡
 */

const crypto = require('crypto');

// 会员卡数据存储
const memberCards = new Map();
const cardTransactions = new Map();

// 系统会员卡配置
const SYSTEM_CARDS = {
    discountRate: 0.95, // 95折
    pointsRate: 0.02,   // 2%积分
    minRecharge: 100,
    maxRecharge: 10000
};

// 初始化示例数据
function initSampleData() {
    // 示例：C端系统会员卡
    const systemCard1 = {
        cardId: 'SYS_001',
        cardType: 'system',
        cardName: '干洗平台会员卡',
        cardLevel: 'gold',
        balance: 500.00,
        password: '123456', // 实际应该加密存储
        userId: 'user_001',
        userName: '张三',
        phone: '13800138001',
        issueDate: '2024-01-01',
        validUntil: '2029-12-31',
        storeIds: [], // 空数组表示所有商家可用
        status: 'active',
        transactions: []
    };
    memberCards.set(systemCard1.cardId, systemCard1);

    // 示例：商家专属会员卡
    const storeCard1 = {
        cardId: 'STO_001_ST001',
        cardType: 'store',
        cardName: '干洗店旗舰店会员卡',
        cardLevel: 'silver',
        balance: 200.00,
        password: '123456',
        userId: 'user_002',
        userName: '李四',
        phone: '13800138002',
        issueDate: '2024-02-01',
        validUntil: '2025-12-31',
        storeIds: ['ST001'], // 只在ST001可用
        storeName: '干洗店旗舰店',
        status: 'active',
        transactions: []
    };
    memberCards.set(storeCard1.cardId, storeCard1);
}

initSampleData();

/**
 * 创建会员卡
 */
function createCard(params) {
    const {
        userId,
        userName,
        phone,
        cardType = 'system', // system: 系统卡, store: 商家卡
        storeId,
        storeName,
        initialBalance = 0
    } = params;

    // 生成卡号
    const prefix = cardType === 'system' ? 'SYS' : 'STO';
    const cardId = `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // 默认密码
    const password = '123456';

    const card = {
        cardId,
        cardType,
        cardName: cardType === 'system' ? '干洗平台会员卡' : `${storeName}会员卡`,
        cardLevel: initialBalance >= 1000 ? 'gold' : (initialBalance >= 500 ? 'silver' : 'bronze'),
        balance: initialBalance,
        password,
        userId,
        userName,
        phone,
        issueDate: new Date().toISOString().split('T')[0],
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        storeIds: cardType === 'store' ? [storeId] : [],
        storeName: cardType === 'store' ? storeName : null,
        status: 'active',
        transactions: []
    };

    memberCards.set(cardId, card);

    console.log(`[会员卡] 创建${cardType === 'system' ? '系统' : '商家'}会员卡: ${cardId}`);

    return {
        success: true,
        data: {
            cardId: card.cardId,
            cardType: card.cardType,
            cardName: card.cardName,
            balance: card.balance,
            password: card.password, // 首次返回密码
            cardLevel: card.cardLevel
        }
    };
}

/**
 * 查询会员卡信息
 */
function getCardInfo(cardId) {
    const card = memberCards.get(cardId);
    if (!card) {
        return {
            success: false,
            error: '会员卡不存在'
        };
    }

    return {
        success: true,
        data: {
            cardId: card.cardId,
            cardType: card.cardType,
            cardName: card.cardName,
            cardLevel: card.cardLevel,
            balance: card.balance,
            userName: card.userName,
            phone: card.phone.substring(0, 3) + '****' + card.phone.substring(7),
            validUntil: card.validUntil,
            storeIds: card.storeIds,
            storeName: card.storeName,
            status: card.status
        }
    };
}

/**
 * 查询用户的所有会员卡
 */
function getUserCards(userId) {
    const cards = [];
    memberCards.forEach(card => {
        if (card.userId === userId) {
            cards.push({
                cardId: card.cardId,
                cardType: card.cardType,
                cardName: card.cardName,
                cardLevel: card.cardLevel,
                balance: card.balance,
                storeName: card.storeName,
                status: card.status
            });
        }
    });

    return {
        success: true,
        data: cards
    };
}

/**
 * 验证并扣除会员卡余额
 */
async function verifyAndDeduct(cardId, cardType, amount, storeId = null) {
    const card = memberCards.get(cardId);
    if (!card) {
        return {
            success: false,
            error: '会员卡不存在'
        };
    }

    if (card.status !== 'active') {
        return {
            success: false,
            error: '会员卡已停用'
        };
    }

    // 检查有效期
    if (new Date() > new Date(card.validUntil)) {
        return {
            success: false,
            error: '会员卡已过期'
        };
    }

    // 检查商家专属卡的使用范围
    if (card.cardType === 'store' && storeId) {
        if (!card.storeIds.includes(storeId)) {
            return {
                success: false,
                error: `此卡只能在【${card.storeName}】使用`
            };
        }
    }

    // 检查余额
    if (card.balance < amount) {
        return {
            success: false,
            error: `余额不足，当前余额: ¥${card.balance.toFixed(2)}`
        };
    }

    // 扣除余额
    card.balance -= amount;

    // 记录交易
    const transaction = {
        type: 'consume',
        amount: amount,
        balance: card.balance,
        storeId: storeId,
        storeName: card.storeName || '平台',
        time: new Date().toISOString()
    };
    card.transactions.push(transaction);
    cardTransactions.set(transaction, card.cardId);

    // 更新会员卡
    memberCards.set(cardId, card);

    console.log(`[会员卡] 消费: 卡号 ${cardId}, 消费 ¥${amount}, 剩余 ¥${card.balance}`);

    return {
        success: true,
        balance: card.balance,
        transaction: transaction
    };
}

/**
 * 充值会员卡
 */
async function recharge(cardId, amount, userId) {
    const card = memberCards.get(cardId);
    if (!card) {
        return {
            success: false,
            error: '会员卡不存在'
        };
    }

    if (card.status !== 'active') {
        return {
            success: false,
            error: '会员卡已停用'
        };
    }

    if (amount < SYSTEM_CARDS.minRecharge) {
        return {
            success: false,
            error: `最低充值金额: ¥${SYSTEM_CARDS.minRecharge}`
        };
    }

    if (amount > SYSTEM_CARDS.maxRecharge) {
        return {
            success: false,
            error: `单次最高充值: ¥${SYSTEM_CARDS.maxRecharge}`
        };
    }

    // 赠送金额（根据充值金额）
    let bonus = 0;
    if (amount >= 1000) {
        bonus = amount * 0.1; // 10%赠送
    } else if (amount >= 500) {
        bonus = amount * 0.05; // 5%赠送
    }

    const totalAdded = amount + bonus;

    // 更新余额
    card.balance += totalAdded;

    // 记录交易
    const transaction = {
        type: 'recharge',
        amount: amount,
        bonus: bonus,
        total: totalAdded,
        balance: card.balance,
        userId: userId,
        time: new Date().toISOString()
    };
    card.transactions.push(transaction);
    cardTransactions.set(transaction, card.cardId);

    // 更新会员卡
    memberCards.set(cardId, card);

    console.log(`[会员卡] 充值: 卡号 ${cardId}, 充值 ¥${amount}, 赠送 ¥${bonus}, 剩余 ¥${card.balance}`);

    return {
        success: true,
        data: {
            cardId: card.cardId,
            rechargeAmount: amount,
            bonus: bonus,
            totalAdded: totalAdded,
            balance: card.balance,
            transaction: transaction
        }
    };
}

/**
 * 获取会员卡交易记录
 */
function getCardTransactions(cardId, limit = 10) {
    const card = memberCards.get(cardId);
    if (!card) {
        return {
            success: false,
            error: '会员卡不存在'
        };
    }

    const transactions = card.transactions.slice(-limit).reverse();

    return {
        success: true,
        data: transactions
    };
}

/**
 * 验证会员卡密码
 */
function verifyPassword(cardId, password) {
    const card = memberCards.get(cardId);
    if (!card) {
        return {
            success: false,
            error: '会员卡不存在'
        };
    }

    if (card.password !== password) {
        return {
            success: false,
            error: '密码错误'
        };
    }

    return {
        success: true,
        data: {
            cardId: card.cardId,
            verified: true
        }
    };
}

/**
 * 修改会员卡密码
 */
function changePassword(cardId, oldPassword, newPassword) {
    const card = memberCards.get(cardId);
    if (!card) {
        return {
            success: false,
            error: '会员卡不存在'
        };
    }

    if (card.password !== oldPassword) {
        return {
            success: false,
            error: '原密码错误'
        };
    }

    card.password = newPassword;
    memberCards.set(cardId, card);

    return {
        success: true,
        message: '密码修改成功'
    };
}

/**
 * 挂失/解挂会员卡
 */
function toggleCardStatus(cardId, status) {
    const card = memberCards.get(cardId);
    if (!card) {
        return {
            success: false,
            error: '会员卡不存在'
        };
    }

    card.status = status;
    memberCards.set(cardId, card);

    return {
        success: true,
        data: {
            cardId: card.cardId,
            status: card.status
        }
    };
}

/**
 * 查询门店可用会员卡
 */
function getStoreCards(storeId) {
    const cards = [];
    memberCards.forEach(card => {
        // 系统卡所有门店可用
        if (card.cardType === 'system' && card.status === 'active') {
            cards.push({
                cardId: card.cardId,
                cardType: card.cardType,
                cardName: card.cardName,
                cardLevel: card.cardLevel,
                balance: card.balance,
                usable: true
            });
        }
        // 商家专属卡
        else if (card.cardType === 'store' && card.storeIds.includes(storeId) && card.status === 'active') {
            cards.push({
                cardId: card.cardId,
                cardType: card.cardType,
                cardName: card.cardName,
                cardLevel: card.cardLevel,
                balance: card.balance,
                storeName: card.storeName,
                usable: true
            });
        }
    });

    return {
        success: true,
        data: cards
    };
}

module.exports = {
    createCard,
    getCardInfo,
    getUserCards,
    verifyAndDeduct,
    recharge,
    getCardTransactions,
    verifyPassword,
    changePassword,
    toggleCardStatus,
    getStoreCards,
    SYSTEM_CARDS,
    memberCards // 导出用于直接访问
};
