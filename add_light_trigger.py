#!/usr/bin/env python3
import re

# 读取文件
with open('c-order-detail.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 查找并替换代码
old_code = '''        localStorage.setItem('currentOrder', JSON.stringify(currentOrder));
        
        updateOrderUI(currentOrder);
      }
    }
    
    // 提交取件方式并支付配送费'''

new_code = '''        localStorage.setItem('currentOrder', JSON.stringify(currentOrder));
        
        // 触发灯条请求（通知M端点亮灯条）
        triggerLightRequest();
        
        updateOrderUI(currentOrder);
      }
    }
    
    // 触发灯条请求（扫码取件后）
    async function triggerLightRequest() {
      if (!currentOrder) return;
      
      const storeId = currentOrder.storeId || currentOrder.store?.id || 'ST001';
      const items = currentOrder.items || currentOrder.services || [];
      
      try {
        // 调用灯条绑定API
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const response = await fetch('http://localhost:3000/api/store/order-light/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: orderId,
              storeId: storeId,
              itemIndex: i,
              itemName: item.name || item.serviceName || '物品' + (i + 1),
              requestType: 'customer_scan',
              customerPhone: localStorage.getItem('userPhone') || 'C端用户',
              timestamp: Date.now()
            })
          });
          
          const result = await response.json();
          if (result.success) {
            console.log('[C端→M端] 灯条请求已发送:', i, item.name);
          }
        }
        
        // 同时保存到localStorage，让M端能够监听
        const lightRequest = {
          orderId: orderId,
          storeId: storeId,
          itemIndex: 0,
          itemName: items[0]?.name || items[0]?.serviceName || '物品',
          requestType: 'customer_scan',
          customerPhone: localStorage.getItem('userPhone') || 'C端用户',
          timestamp: Date.now()
        };
        localStorage.setItem('light_request_' + orderId, JSON.stringify(lightRequest));
        
        // 触发自定义事件，让M端能够监听
        window.dispatchEvent(new CustomEvent('lightRequestFromC', {
          detail: lightRequest
        }));
        
        alert('✅ 已通知店员，灯条正在点亮...\\n\\n请等待店员确认取件。');
      } catch (error) {
        console.error('触发灯条请求失败:', error);
        alert('⚠️ 灯条触发失败，但订单已更新。\\n\\n请等待店员手动确认取件。');
      }
    }
    
    // 提交取件方式并支付配送费'''

# 替换
if old_code in content:
    content = content.replace(old_code, new_code)
    with open('c-order-detail.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print('✓ C端订单详情页灯条触发功能已添加')
else:
    print('⚠ 未找到匹配的代码')
