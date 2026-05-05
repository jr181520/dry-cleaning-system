/**
 * 门店端公共API - 无需认证的灯条控制
 */
const express = require('express');
const router = express.Router();
const lightService = require('../../../services/lightService');

// 点亮灯条
router.post('/lights/:storeId/turn-on', (req, res) => {
    const { storeId } = req.params;
    const { color, priority, lightId } = req.body;
    console.log(`[灯条API] 点亮请求 - 门店: ${storeId}, 颜色: ${color || 'green'}`);
    lightService.publish(`dryclean/prod/${storeId}/light`, {
        action: 'on', lightIds: lightId ? [lightId] : [], color: color || 'green', priority: priority || 'normal', timestamp: Date.now()
    });
    res.json({ success: true, data: { storeId, mqttConnected: lightService.isConnected() } });
});

// 关闭灯条
router.post('/lights/:storeId/turn-off', (req, res) => {
    const { storeId } = req.params;
    const { lightId } = req.body;
    console.log(`[灯条API] 关闭请求 - 门店: ${storeId}`);
    lightService.publish(`dryclean/prod/${storeId}/light`, {
        action: 'off', lightIds: lightId ? [lightId] : [], timestamp: Date.now()
    });
    res.json({ success: true, data: { storeId, mqttConnected: lightService.isConnected() } });
});

// 全部点亮
router.post('/lights/:storeId/turn-on-all', (req, res) => {
    const { storeId } = req.params;
    const { color, priority } = req.body;
    console.log(`[灯条API] 全部点亮请求 - 门店: ${storeId}, 颜色: ${color || 'green'}`);
    lightService.publish(`dryclean/prod/${storeId}/light`, {
        action: 'on', lightIds: [], color: color || 'green', priority: priority || 'high', timestamp: Date.now()
    });
    res.json({ success: true, data: { storeId, mqttConnected: lightService.isConnected() } });
});

// 全部关闭
router.post('/lights/:storeId/turn-off-all', (req, res) => {
    const { storeId } = req.params;
    console.log(`[灯条API] 全部关闭请求 - 门店: ${storeId}`);
    lightService.publish(`dryclean/prod/${storeId}/light`, {
        action: 'all_off', timestamp: Date.now()
    });
    res.json({ success: true, data: { storeId, mqttConnected: lightService.isConnected() } });
});

// 检查终端状态
router.get('/terminals', (req, res) => {
    const terminals = lightService.getTerminals();
    res.json({ success: true, data: terminals, mqttConnected: lightService.isConnected() });
});

// 检查门店灯条状态
router.get('/store/:storeId/terminal-lights', (req, res) => {
    const { storeId } = req.params;
    const lights = lightService.getStoreLights(storeId);
    res.json({ success: true, data: { storeId, lights, online: lights.length > 0 } });
});

// 检查MQTT连接状态
router.get('/status', (req, res) => {
    res.json({ success: true, data: { mqttConnected: lightService.isConnected() } });
});

module.exports = router;
