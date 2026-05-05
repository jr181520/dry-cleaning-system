/**
 * 支付服务API配置
 * 预留接口，用于对接微信支付、支付宝、银联等支付平台
 */

const PaymentAPI = {
    // API基础配置
    config: {
        baseUrl: 'https://api.drycleaning-system.com',
        timeout: 30000,
        retryCount: 3
    },

    // 支付方式列表
    paymentMethods: [
        {
            id: 'wechat',
            name: '微信支付',
            icon: 'fa-weixin',
            color: 'green',
            desc: '微信安全支付',
            recommended: true,
            apiEndpoint: '/api/payment/wechat'
        },
        {
            id: 'balance',
            name: '账户余额',
            icon: 'fa-credit-card',
            color: 'yellow',
            desc: '使用账户余额支付',
            recommended: false,
            apiEndpoint: '/api/payment/balance'
        },
        {
            id: 'alipay',
            name: '支付宝',
            icon: 'fa-paypal',
            color: 'blue',
            desc: '跳转支付宝支付',
            recommended: false,
            apiEndpoint: '/api/payment/alipay'
        },
        {
            id: 'unionpay',
            name: '银行卡支付',
            icon: 'fa-cc-visa',
            color: 'purple',
            desc: '银联/银行卡支付',
            recommended: false,
            apiEndpoint: '/api/payment/unionpay'
        }
    ],

    /**
     * 获取支付方式列表
     * @returns {Array} - 支付方式列表
     */
    getPaymentMethods() {
        return this.paymentMethods;
    },

    /**
     * 获取支付方式信息
     * @param {string} methodId - 支付方式ID
     * @returns {Object|null} - 支付方式信息
     */
    getMethod(methodId) {
        return this.paymentMethods.find(m => m.id === methodId) || null;
    },

    /**
     * 创建微信支付订单
     * @param {Object} params - 支付参数
     * @param {string} params.orderId - 订单ID
     * @param {number} params.amount - 支付金额（单位：元）
     * @param {string} params.description - 订单描述
     * @param {string} params.openid - 用户OpenID（小程序）
     * @param {string} params.redirectUrl - 支付成功跳转URL（H5）
     * @returns {Promise<Object>} - 返回支付结果
     */
    async createWechatPay(params) {
        try {
            // 预留API接口
            // const response = await fetch(`${this.config.baseUrl}${this.getMethod('wechat').apiEndpoint}/unified`, {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //         'Authorization': 'Bearer ' + localStorage.getItem('token')
            //     },
            //     body: JSON.stringify({
            //         orderId: params.orderId,
            //         totalAmount: params.amount * 100, // 转为分
            //         description: params.description,
            //         attach: JSON.stringify({
            //             openid: params.openid,
            //             redirectUrl: params.redirectUrl
            //         })
            //     })
            // });
            
            // 模拟返回
            await new Promise(resolve => setTimeout(resolve, 500));
            
            return {
                success: true,
                data: {
                    payment: {
                        timeStamp: String(Date.now()),
                        nonceStr: Math.random().toString(36).substr(2),
                        package: 'prepay_id=' + 'wx' + Date.now(),
                        signType: 'MD5',
                        paySign: 'mock_sign_' + Date.now()
                    },
                    paymentUrl: 'weixin://wxpay/bizpayurl?pr=' + Date.now()
                },
                message: '微信支付订单创建成功'
            };
        } catch (error) {
            console.error('创建微信支付订单失败:', error);
            return {
                success: false,
                message: '支付订单创建失败，请重试'
            };
        }
    },

    /**
     * 余额支付
     * @param {Object} params - 支付参数
     * @param {string} params.orderId - 订单ID
     * @param {number} params.amount - 支付金额
     * @returns {Promise<Object>} - 返回支付结果
     */
    async payWithBalance(params) {
        try {
            // 预留API接口
            // const response = await fetch(`${this.config.baseUrl}${this.getMethod('balance').apiEndpoint}/pay`, {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //         'Authorization': 'Bearer ' + localStorage.getItem('token')
            //     },
            //     body: JSON.stringify({
            //         orderId: params.orderId,
            //         amount: params.amount,
            //         userId: localStorage.getItem('userId')
            //     })
            // });
            
            // 模拟支付
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 检查余额
            const userBalance = parseFloat(localStorage.getItem('userBalance') || '500');
            if (userBalance < params.amount) {
                return {
                    success: false,
                    message: '余额不足，请选择其他支付方式'
                };
            }
            
            // 扣除余额
            localStorage.setItem('userBalance', (userBalance - params.amount).toFixed(2));
            
            return {
                success: true,
                message: '余额支付成功',
                data: {
                    newBalance: userBalance - params.amount
                }
            };
        } catch (error) {
            console.error('余额支付失败:', error);
            return {
                success: false,
                message: '支付失败，请重试'
            };
        }
    },

    /**
     * 创建支付宝支付订单
     * @param {Object} params - 支付参数
     * @param {string} params.orderId - 订单ID
     * @param {number} params.amount - 支付金额
     * @param {string} params.subject - 订单标题
     * @returns {Promise<Object>} - 返回支付结果
     */
    async createAlipayOrder(params) {
        try {
            // 预留API接口
            // const response = await fetch(`${this.config.baseUrl}${this.getMethod('alipay').apiEndpoint}/create`, {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //         'Authorization': 'Bearer ' + localStorage.getItem('token')
            //     },
            //     body: JSON.stringify({
            //         orderId: params.orderId,
            //         totalAmount: params.amount,
            //         subject: params.subject,
            //         productCode: 'FAST_INSTANT_TRADE_PAY'
            //     })
            // });
            
            // 模拟返回
            await new Promise(resolve => setTimeout(resolve, 500));
            
            return {
                success: true,
                data: {
                    payUrl: 'https://openapi.alipay.com/gateway.do?_input_charset=utf-8&code=' + Date.now(),
                    qrCode: 'https://api.drycleaning-system.com/qrcode/alipay/' + params.orderId
                },
                message: '支付宝支付订单创建成功'
            };
        } catch (error) {
            console.error('创建支付宝支付订单失败:', error);
            return {
                success: false,
                message: '支付订单创建失败'
            };
        }
    },

    /**
     * 创建银联支付订单
     * @param {Object} params - 支付参数
     * @param {string} params.orderId - 订单ID
     * @param {number} params.amount - 支付金额
     * @param {string} params.subject - 订单标题
     * @returns {Promise<Object>} - 返回支付结果
     */
    async createUnionpayOrder(params) {
        try {
            // 预留API接口
            // const response = await fetch(`${this.config.baseUrl}${this.getMethod('unionpay').apiEndpoint}/create`, {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //         'Authorization': 'Bearer ' + localStorage.getItem('token')
            //     },
            //     body: JSON.stringify({
            //         orderId: params.orderId,
            //         totalAmount: params.amount,
            //         subject: params.subject
            //     })
            // });
            
            // 模拟返回
            await new Promise(resolve => setTimeout(resolve, 500));
            
            return {
                success: true,
                data: {
                    payUrl: 'https://gateway.95516.com/gateway/api/frontTransReq.do?_txnType=01&orderId=' + params.orderId,
                    tn: 'UnionPay_TN_' + Date.now()
                },
                message: '银联支付订单创建成功'
            };
        } catch (error) {
            console.error('创建银联支付订单失败:', error);
            return {
                success: false,
                message: '支付订单创建失败'
            };
        }
    },

    /**
     * 查询支付状态
     * @param {string} orderId - 订单ID
     * @returns {Promise<Object>} - 返回支付状态
     */
    async queryPayStatus(orderId) {
        try {
            // 预留API接口
            // const response = await fetch(`${this.config.baseUrl}/api/payment/status/${orderId}`);
            
            // 模拟查询
            await new Promise(resolve => setTimeout(resolve, 300));
            
            return {
                success: true,
                data: {
                    orderId: orderId,
                    status: 'paid',
                    paidAt: new Date().toISOString()
                }
            };
        } catch (error) {
            console.error('查询支付状态失败:', error);
            return {
                success: false,
                message: '查询失败'
            };
        }
    },

    /**
     * 申请退款
     * @param {Object} params - 退款参数
     * @param {string} params.orderId - 订单ID
     * @param {number} params.amount - 退款金额
     * @param {string} params.reason - 退款原因
     * @returns {Promise<Object>} - 返回退款结果
     */
    async applyRefund(params) {
        try {
            // 预留API接口
            // const response = await fetch(`${this.config.baseUrl}/api/payment/refund`, {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //         'Authorization': 'Bearer ' + localStorage.getItem('token')
            //     },
            //     body: JSON.stringify({
            //         orderId: params.orderId,
            //         refundAmount: params.amount,
            //         refundReason: params.reason
            //     })
            // });
            
            // 模拟退款
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            return {
                success: true,
                message: '退款申请已提交',
                data: {
                    refundId: 'REFUND-' + Date.now(),
                    refundAmount: params.amount
                }
            };
        } catch (error) {
            console.error('申请退款失败:', error);
            return {
                success: false,
                message: '退款申请失败，请重试'
            };
        }
    },

    /**
     * 获取用户余额
     * @returns {Promise<Object>} - 返回用户余额信息
     */
    async getUserBalance() {
        try {
            // 预留API接口
            // const response = await fetch(`${this.config.baseUrl}/api/user/balance`, {
            //     headers: {
            //         'Authorization': 'Bearer ' + localStorage.getItem('token')
            //     }
            // });
            
            // 模拟返回
            await new Promise(resolve => setTimeout(resolve, 300));
            
            return {
                success: true,
                data: {
                    balance: parseFloat(localStorage.getItem('userBalance') || '500'),
                    frozenBalance: 0,
                    totalBalance: parseFloat(localStorage.getItem('userBalance') || '500')
                }
            };
        } catch (error) {
            console.error('获取用户余额失败:', error);
            return {
                success: false,
                data: {
                    balance: 500,
                    frozenBalance: 0,
                    totalBalance: 500
                }
            };
        }
    },

    /**
     * 充值余额
     * @param {Object} params - 充值参数
     * @param {number} params.amount - 充值金额
     * @param {string} params.paymentMethod - 支付方式
     * @returns {Promise<Object>} - 返回充值结果
     */
    async rechargeBalance(params) {
        try {
            // 预留API接口
            // const response = await fetch(`${this.config.baseUrl}/api/user/recharge`, {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //         'Authorization': 'Bearer ' + localStorage.getItem('token')
            //     },
            //     body: JSON.stringify(params)
            // });
            
            // 模拟充值
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const currentBalance = parseFloat(localStorage.getItem('userBalance') || '500');
            const newBalance = currentBalance + params.amount;
            localStorage.setItem('userBalance', newBalance.toFixed(2));
            
            return {
                success: true,
                message: '充值成功',
                data: {
                    amount: params.amount,
                    newBalance: newBalance
                }
            };
        } catch (error) {
            console.error('充值失败:', error);
            return {
                success: false,
                message: '充值失败，请重试'
            };
        }
    }
};

// 导出到全局
window.PaymentAPI = PaymentAPI;
