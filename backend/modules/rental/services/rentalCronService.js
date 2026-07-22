/**
 * 租赁逾期管理定时任务
 * 
 * 功能：
 * 1. 每小时扫描使用中的订单，标记逾期
 * 2. 到期前1天发送提醒通知
 * 3. 逾期后计算逾期费
 */

const { RentalOrder } = require('../models/RentalOrder');
const rentalService = require('./rentalService');

// 定时任务间隔
const CHECK_INTERVAL = 60 * 60 * 1000; // 1小时
let timer = null;

/**
 * 启动逾期检查定时任务
 */
function startOverdueCheck() {
  console.log('[RentalCron] 逾期检查定时任务已启动');
  
  // 立即执行一次
  checkOverdue();
  
  // 定时执行
  timer = setInterval(checkOverdue, CHECK_INTERVAL);
}

/**
 * 停止定时任务
 */
function stopOverdueCheck() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log('[RentalCron] 逾期检查定时任务已停止');
  }
}

/**
 * 执行逾期检查
 */
async function checkOverdue() {
  try {
    console.log('[RentalCron] 开始逾期检查...');
    
    // 1. 标记逾期订单
    const overdueResults = await rentalService.checkOverdueOrders();
    if (overdueResults.length > 0) {
      console.log(`[RentalCron] 标记${overdueResults.length}个逾期订单`);
    }

    // 2. 检查即将到期的订单（提前1天提醒）
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dueSoonOrders = await RentalOrder.find({
      status: 'using',
      dueDate: {
        $gte: new Date(),
        $lte: tomorrow
      }
    });

    for (const order of dueSoonOrders) {
      if (order.status !== 'due') {
        order.status = 'due';
        order.addStatusHistory('due', '租期即将到期，请尽快归还', 'system');
        await order.save();
        
        // TODO: 发送通知给用户
        console.log(`[RentalCron] 到期提醒: 订单${order.orderNo}将于明天到期`);
      }
    }

    // 3. 检查严重逾期（超过7天）
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const severeOverdueOrders = await RentalOrder.find({
      status: 'overdue',
      dueDate: { $lt: weekAgo }
    });

    for (const order of severeOverdueOrders) {
      console.log(`[RentalCron] 严重逾期警告: 订单${order.orderNo}已逾期超过7天`);
      // TODO: 发送严重逾期通知，可能需要风控介入
    }

    console.log('[RentalCron] 逾期检查完成');
  } catch(e) {
    console.error('[RentalCron] 逾期检查异常:', e.message);
  }
}

/**
 * 手动触发逾期检查（API调用）
 */
async function manualCheck() {
  return await checkOverdue();
}

module.exports = {
  startOverdueCheck,
  stopOverdueCheck,
  checkOverdue,
  manualCheck
};
