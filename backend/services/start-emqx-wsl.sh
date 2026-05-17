#!/bin/bash
# EMQX启动脚本（WSL）

# 检查EMQX是否已运行
if pgrep -x "beam.smp" > /dev/null; then
    echo "[EMQX] Already running"
    exit 0
fi

# 启动EMQX
echo "[EMQX] Starting..."
cd /opt/emqx
/opt/emqx/bin/emqx start

# 等待启动完成
sleep 3

# 验证启动
if /opt/emqx/bin/emqx status | grep -q "pid"; then
    echo "[EMQX] Started successfully"
else
    echo "[EMQX] Failed to start"
    exit 1
fi
