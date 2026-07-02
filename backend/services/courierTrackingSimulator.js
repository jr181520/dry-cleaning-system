/**
 * 跑腿配送跟踪引擎 (v2)
 * 
 * 三种运行模式：
 *   1. REAL 模式：已配置服务商密钥 → 轮询真实服务商API获取骑手状态
 *   2. MOCK 模式：未配置密钥 → 模拟8分钟配送全流程（开发测试用）
 *   3. CALLBACK 模式：服务商主动回调 → deliveryRoutes.js/callback 直接推送
 * 
 * 优先级：CALLBACK > REAL > MOCK
 * 
 * MQTT 主题: dryclean/orders/{orderId}/courier
 */

const lightService = require('./lightService');
const deliveryProviders = require('./deliveryProviders');

// 活跃跟踪任务
const activeTasks = new Map();

// 配置
const CONFIG = {
  // 模拟模式总时长（毫秒）
  MOCK_TOTAL_DURATION: 480000,  // 8分钟
  // 模拟模式更新间隔
  MOCK_UPDATE_INTERVAL: 8000,   // 8秒
  // 真实模式轮询间隔（毫秒）
  REAL_POLL_INTERVAL: 15000,    // 15秒
  // 最大跟踪时长（毫秒），超时自动停止
  MAX_DURATION: 7200000,        // 2小时
  // 各阶段占比（模拟模式）
  PHASES: {
    'awaiting_store_outbound': { start: 0, end: 0.15, label: '商家待出库' },
    'picking': { start: 0.15, end: 0.40, label: '骑手待取件' },
    'delivering': { start: 0.40, end: 0.90, label: '配送中' },
    'delivered': { start: 0.90, end: 1.0, label: '已送达' }
  },
  MQTT_TOPIC: 'dryclean/orders'
};

// 模拟骑手名池
const COURIER_NAMES = ['张师傅', '李师傅', '王师傅', '赵师傅', '刘师傅', '陈师傅', '杨师傅', '周师傅'];

/**
 * 服务商状态 → 系统内部 courier 状态映射
 */
const PROVIDER_STATUS_MAP = {
  'pending':      { courierStatus: 'awaiting_store_outbound', progress: 5,  label: '待分配骑手' },
  'accepted':     { courierStatus: 'awaiting_store_outbound', progress: 15, label: '已分配骑手' },
  'arrived_store':{ courierStatus: 'picking',                  progress: 25, label: '骑手已到店' },
  'picking_up':   { courierStatus: 'picking',                  progress: 35, label: '骑手取件中' },
  'picked_up':    { courierStatus: 'delivering',               progress: 50, label: '配送中' },
  'delivering':   { courierStatus: 'delivering',               progress: 70, label: '配送中' },
  'arrived':      { courierStatus: 'delivering',               progress: 90, label: '即将送达' },
  'delivered':    { courierStatus: 'delivered',                progress: 100,label: '已送达' },
  'cancelled':    { courierStatus: 'cancelled',                progress: 0,  label: '已取消' },
  'exception':    { courierStatus: 'exception',                progress: -1, label: '异常' }
};

// ─── 公共入口 ───

/**
 * 启动配送跟踪
 * @param {Object} order - 订单对象
 */
function startSimulation(order) {
  const orderId = order._id?.toString() || order.orderId;
  if (!orderId) return;

  if (activeTasks.has(orderId)) {
    stopSimulation(orderId);
  }

  const courier = order.courier || {};
  const providerName = courier.provider || order.selectedProvider || 'meituan';
  const provider = deliveryProviders.get(providerName);

  // 判断模式：真实API可用则用REAL模式，否则MOCK模式
  if (provider && !provider.isMockMode) {
    startRealTracking(order, provider);
  } else {
    startMockTracking(order);
  }
}

// ─── 真实API追踪模式 ───

/**
 * 真实模式：轮询服务商API获取骑手状态
 */
function startRealTracking(order, provider) {
  const orderId = order._id?.toString() || order.orderId;
  const courier = order.courier || {};
  const platformOrderId = courier.platformOrderId || courier.deliveryId || orderId;
  const startTime = Date.now();

  console.log(`[跟踪-REAL] 启动订单 ${orderId} 的真实配送跟踪 (${provider.displayName}, platformOrderId: ${platformOrderId})`);

  // 初始状态
  const initialData = {
    provider: provider.provider,
    status: 'awaiting_store_outbound',
    progress: 0,
    distance: '—',
    eta: '等待分配骑手',
    courierName: courier.name || '',
    courierPhone: courier.phone || '',
    updatedAt: new Date().toISOString(),
    _mode: 'real'
  };
  publishCourierStatus(orderId, initialData);
  updateCourierInDB(orderId, initialData);

  // 定时轮询
  const timer = setInterval(async () => {
    try {
      const elapsed = Date.now() - startTime;
      if (elapsed > CONFIG.MAX_DURATION) {
        console.log(`[跟踪-REAL] 订单 ${orderId} 超过最大跟踪时长，停止`);
        clearInterval(timer);
        activeTasks.delete(orderId);
        return;
      }

      const result = await provider.queryOrder(platformOrderId);
      if (!result.success) {
        console.warn(`[跟踪-REAL] 查询状态失败 (${orderId}):`, result.error);
        return;
      }

      const mapping = PROVIDER_STATUS_MAP[result.status];
      if (!mapping) {
        console.warn(`[跟踪-REAL] 未知状态: ${result.status} (${orderId})`);
        return;
      }

      const courierData = {
        provider: provider.provider,
        status: mapping.courierStatus,
        progress: mapping.progress,
        distance: result.distance || '—',
        eta: result.eta || result.driver?.name || '—',
        courierName: result.driver?.name || courier.name || '',
        courierPhone: result.driver?.phone || courier.phone || '',
        updatedAt: new Date().toISOString(),
        _mode: 'real'
      };

      publishCourierStatus(orderId, courierData);
      updateCourierInDB(orderId, courierData);

      if (mapping.courierStatus === 'delivered' || mapping.courierStatus === 'cancelled') {
        console.log(`[跟踪-REAL] 订单 ${orderId} 配送结束: ${mapping.label}`);
        clearInterval(timer);
        activeTasks.delete(orderId);

        if (mapping.courierStatus === 'delivered') {
          try {
            const orderEventService = require('./orderEventService');
            orderEventService.publishOrderEvent('courier_delivered', {
              _id: orderId, orderId, orderNo: order.orderNo,
              storeId: order.storeId, status: order.status || 'delivering_back',
              courier: courierData
            }, { source: 'courier-real' });
          } catch (e) {
            console.warn('[跟踪-REAL] 发布配送完成事件失败:', e.message);
          }
        }
      }
    } catch (error) {
      console.error(`[跟踪-REAL] 轮询异常 (${orderId}):`, error.message);
    }
  }, CONFIG.REAL_POLL_INTERVAL);

  activeTasks.set(orderId, {
    timer, startTime, provider: provider.provider,
    courierName: courier.name || '', mode: 'real', platformOrderId
  });
}

// ─── 模拟追踪模式 ───

function startMockTracking(order) {
  const orderId = order._id?.toString() || order.orderId;
  const courier = order.courier || {};
  const provider = courier.provider || order.selectedProvider || 'meituan';
  const startTime = Date.now();

  const initialState = {
    provider,
    status: 'awaiting_store_outbound',
    progress: 0,
    distance: '—',
    eta: '等待商家出库',
    courierName: courier.name || COURIER_NAMES[Math.floor(Math.random() * COURIER_NAMES.length)],
    courierPhone: courier.phone || '138****' + Math.floor(Math.random() * 9000 + 1000),
    assignedAt: courier.assignedAt || new Date().toISOString(),
    _mode: 'mock'
  };

  console.log(`[跟踪-MOCK] 启动订单 ${orderId} 模拟跟踪 (${provider}, 骑手: ${initialState.courierName})`);

  publishCourierStatus(orderId, initialState);
  updateCourierInDB(orderId, initialState);

  const timer = setInterval(async () => {
    const elapsed = Date.now() - startTime;
    const totalProgress = Math.min(elapsed / CONFIG.MOCK_TOTAL_DURATION, 1.0);

    let status, distanceText, etaText, progress;

    if (totalProgress < CONFIG.PHASES.awaiting_store_outbound.end) {
      const phaseProgress = totalProgress / CONFIG.PHASES.awaiting_store_outbound.end;
      status = 'awaiting_store_outbound';
      progress = Math.floor(phaseProgress * 100);
      distanceText = '—';
      etaText = '等待商家出库';
    } else if (totalProgress < CONFIG.PHASES.picking.end) {
      const phaseProgress = (totalProgress - CONFIG.PHASES.picking.start) /
        (CONFIG.PHASES.picking.end - CONFIG.PHASES.picking.start);
      status = 'picking';
      progress = 15 + Math.floor(phaseProgress * 25);
      distanceText = formatDistance(3.2 * (1 - phaseProgress));
      etaText = formatEta((1 - phaseProgress) * 30);
    } else if (totalProgress < CONFIG.PHASES.delivered.start) {
      const phaseProgress = (totalProgress - CONFIG.PHASES.delivering.start) /
        (CONFIG.PHASES.delivering.end - CONFIG.PHASES.delivering.start);
      status = 'delivering';
      progress = 40 + Math.floor(phaseProgress * 50);
      distanceText = formatDistance(1.5 * (1 - phaseProgress) + 0.1);
      etaText = formatEta((1 - phaseProgress) * 15 + 1);
    } else {
      status = 'delivered';
      progress = 100;
      distanceText = '0km';
      etaText = '已到达';
    }

    const courierData = {
      provider,
      status, progress,
      distance: distanceText,
      eta: etaText,
      courierName: initialState.courierName,
      courierPhone: initialState.courierPhone,
      updatedAt: new Date().toISOString(),
      _mode: 'mock'
    };

    publishCourierStatus(orderId, courierData);
    updateCourierInDB(orderId, courierData);

    if (status === 'delivered') {
      console.log(`[跟踪-MOCK] 订单 ${orderId} 模拟配送完成`);
      clearInterval(timer);
      activeTasks.delete(orderId);

      try {
        const orderEventService = require('./orderEventService');
        orderEventService.publishOrderEvent('courier_delivered', {
          _id: orderId, orderId, orderNo: order.orderNo,
          storeId: order.storeId, status: order.status || 'delivering_back',
          courier: courierData
        }, { source: 'courier-mock' });
      } catch (e) {
        console.warn('[跟踪-MOCK] 发布配送完成事件失败:', e.message);
      }
    }
  }, CONFIG.MOCK_UPDATE_INTERVAL);

  activeTasks.set(orderId, {
    timer, startTime, provider,
    courierName: initialState.courierName, mode: 'mock'
  });
}

// ─── 公共方法 ───

function stopSimulation(orderId) {
  const task = activeTasks.get(orderId);
  if (task) {
    clearInterval(task.timer);
    activeTasks.delete(orderId);
    console.log(`[跟踪] 停止订单 ${orderId} 跟踪 (mode: ${task.mode})`);
  }
}

function shouldStartSimulation(order) {
  const courier = order.courier || {};
  const deliveryMethod = order.deliveryMethod || '';
  const selectedProvider = order.selectedProvider || courier.provider;
  const isCourierOrder = deliveryMethod === 'courier' || !!selectedProvider;
  const notFinished = courier.status !== 'delivered';
  const notStarted = !activeTasks.has(order._id?.toString());
  return isCourierOrder && notFinished && notStarted;
}

function getActiveTasks() {
  const result = [];
  for (const [orderId, task] of activeTasks) {
    result.push({
      orderId,
      provider: task.provider,
      courierName: task.courierName,
      mode: task.mode || 'unknown',
      runningSince: new Date(task.startTime).toISOString(),
      durationSec: Math.floor((Date.now() - task.startTime) / 1000)
    });
  }
  return result;
}

function publishCourierStatus(orderId, courierData) {
  try {
    if (lightService && lightService.isConnected && lightService.isConnected()) {
      const topic = `${CONFIG.MQTT_TOPIC}/${orderId}/courier`;
      lightService.publish(topic, courierData);
    }
  } catch (e) {
    // MQTT 不可用时静默忽略
  }
}

async function updateCourierInDB(orderId, courierData) {
  try {
    const mongoose = require('mongoose');
    const Order = mongoose.model('Order');
    if (!Order) return;

    await Order.findByIdAndUpdate(orderId, {
      $set: {
        'courier.status': courierData.status,
        'courier.progress': courierData.progress,
        'courier.distance': courierData.distance,
        'courier.eta': courierData.eta,
        'courier.name': courierData.courierName,
        'courier.phone': courierData.courierPhone,
        'courier.assignedAt': courierData.assignedAt || new Date()
      }
    }, { new: true });
  } catch (e) {
    console.error(`[跟踪] 更新DB失败 (${orderId}):`, e.message);
  }
}

// 工具函数
function formatDistance(km) {
  if (km < 0.1) return '约100m';
  if (km < 1) return (km * 1000).toFixed(0) + 'm';
  return km.toFixed(1) + 'km';
}
function formatEta(minutes) {
  if (minutes <= 0) return '即将到达';
  return Math.ceil(minutes) + '分钟';
}

module.exports = {
  startSimulation,
  stopSimulation,
  shouldStartSimulation,
  getActiveTasks,
  publishCourierStatus,
  CONFIG
};
