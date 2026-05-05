/**
 * 智能灯条 MQTT 服务
 */

const mqtt = require('mqtt');

// 动态读取配置（确保 dotenv 已加载）
const getMqttConfig = () => ({
  broker: process.env.MQTT_BROKER || 'mqtt://localhost:1883', // 修复：默认改为 1883
  wsPort: process.env.MQTT_WS_PORT || 8083,
  keepalive: parseInt(process.env.MQTT_KEEPALIVE) || 60,
  reconnectPeriod: parseInt(process.env.MQTT_RECONNECT_PERIOD) || 5000,
  clientPrefix: process.env.MQTT_CLIENT_PREFIX || 'backend_server_',
  connectTimeout: 10000
});

const TOPIC_PREFIX = 'dryclean';
let mqttClient = null;

// 终端状态存储
const terminalRegistry = new Map(); // storeId -> { lights: [], lastUpdate }
const HEARTBEAT_TIMEOUT = 30000; // 30秒无心跳视为离线

class LightService {
  constructor() {
    this.subscribers = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        const MQTT_CONFIG = getMqttConfig();
        
        console.log('[MQTT] 尝试连接到:', MQTT_CONFIG.broker);
        console.log('[MQTT] 客户端ID:', MQTT_CONFIG.clientPrefix + 'backend_' + Date.now());
        console.log('[MQTT] WebSocket端口:', MQTT_CONFIG.wsPort);
        
        mqttClient = mqtt.connect(MQTT_CONFIG.broker, {
          clientId: MQTT_CONFIG.clientPrefix + 'backend_' + Date.now(),
          keepalive: MQTT_CONFIG.keepalive,
          reconnectPeriod: MQTT_CONFIG.reconnectPeriod,
          connectTimeout: MQTT_CONFIG.connectTimeout
        });

        mqttClient.on('connect', () => {
          console.log('[MQTT] ✅ 成功连接到 Broker');
          this.setupSubscriptions();
          resolve(true);
        });

        mqttClient.on('error', (error) => {
          console.error('[MQTT] ❌ 连接错误:', error.message);
          console.error('[MQTT] 错误代码:', error.code);
          reject(error);
        });

        mqttClient.on('message', (topic, message) => {
          this.handleMessage(topic, message);
        });

        mqttClient.on('offline', () => {
          console.log('[MQTT] 连接离线');
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  setupSubscriptions() {
    const statusTopic = `${TOPIC_PREFIX}/+/+/light/status`;
    const heartbeatTopic = `${TOPIC_PREFIX}/+/+/light/heartbeat`;
    const mainTopic = `${TOPIC_PREFIX}/+/+/light`;  // 终端主消息主题

    mqttClient.subscribe([statusTopic, heartbeatTopic, mainTopic], { qos: 1 }, (err) => {
      if (err) {
        console.error('[MQTT] 订阅失败:', err);
      } else {
        console.log('[MQTT] 订阅成功');
      }
    });
  }

  handleMessage(topic, message) {
    // 只打印心跳消息的简要日志，避免刷屏
    try {
      const msg = JSON.parse(message.toString());
      
      // 处理终端心跳（只在首次注册或状态变化时打印）
      if (msg.action === 'terminal_heartbeat' || msg.action === 'terminal_register') {
        this.handleTerminalHeartbeat(topic, msg);
      }
    } catch (e) {
      // 非JSON消息，静默忽略
    }
    const callbacks = this.subscribers.get(topic);
    if (callbacks) {
      callbacks.forEach(cb => cb(topic, message.toString()));
    }
  }

  // 处理终端心跳
  handleTerminalHeartbeat(topic, msg) {
    // 从topic提取storeId: dryclean/prod/ST001/light
    const parts = topic.split('/');
    const storeId = parts[2] || msg.storeId;
    const lightId = msg.lightId || 'L001';
    
    if (!storeId) return;
    
    // 初始化门店注册
    if (!terminalRegistry.has(storeId)) {
      terminalRegistry.set(storeId, {
        lights: new Map(),
        lastUpdate: Date.now()
      });
      console.log(`[终端] 新门店注册: ${storeId}`);
    }
    
    const store = terminalRegistry.get(storeId);
    store.lastUpdate = Date.now();
    
    // 更新或添加灯条
    store.lights.set(lightId, {
      lightId,
      status: msg.status || 'online',
      lastHeartbeat: Date.now(),
      storeId
    });
    
    console.log(`[终端] 灯条心跳: ${storeId}/${lightId} - ${msg.status}`);
  }

  // 获取所有终端状态
  getTerminals() {
    const now = Date.now();
    const terminals = [];
    
    terminalRegistry.forEach((store, storeId) => {
      // 清理超时灯条
      const activeLights = [];
      store.lights.forEach((light, lightId) => {
        if (now - light.lastHeartbeat < HEARTBEAT_TIMEOUT) {
          activeLights.push(light);
        } else {
          store.lights.delete(lightId);
        }
      });
      
      if (activeLights.length > 0) {
        terminals.push({
          storeId,
          lights: activeLights,
          lastUpdate: store.lastUpdate,
          online: true
        });
      }
    });
    
    return terminals;
  }

  // 获取指定门店的灯条
  getStoreLights(storeId) {
    const store = terminalRegistry.get(storeId);
    if (!store) return [];
    
    const now = Date.now();
    const activeLights = [];
    store.lights.forEach((light, lightId) => {
      if (now - light.lastHeartbeat < HEARTBEAT_TIMEOUT) {
        activeLights.push(light);
      } else {
        store.lights.delete(lightId);
      }
    });
    
    return activeLights;
  }

  subscribe(topic, callback) {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, []);
      mqttClient.subscribe(topic);
    }
    this.subscribers.get(topic).push(callback);
  }

  publish(topic, message) {
    if (mqttClient && mqttClient.connected) {
      mqttClient.publish(topic, JSON.stringify(message), { qos: 1 });
    }
  }

  isConnected() {
    return mqttClient && mqttClient.connected;
  }
}

module.exports = new LightService();
