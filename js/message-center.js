/**
 * 📬 消息中心（客户消息 + 账户通讯）
 * 
 * 与铃铛通知系统分离：
 *  - 铃铛通知 = 系统事件流（订单状态变更、灯条点亮等）
 *  - 消息中心 = 客户消息（C端/微信小程序操作）+ 账户间通讯
 */

const MessageCenter = {
    API_BASE: 'http://localhost:3000',
    allThreads: [],
    currentThreadId: null,
    pollingTimer: null,

    init() {
        this.loadThreads();
        this.startPolling();
        console.log('[消息中心] 已初始化（客户消息 + 账户通讯）');
    },

    getStoreId() {
        const user = JSON.parse(localStorage.getItem('storeUser') || '{}');
        const currentStore = JSON.parse(localStorage.getItem('currentStore') || '{}');
        return user.storeId || currentStore.storeId || 'ALL';
    },

    formatMsgTime(timestamp) {
        if (!timestamp) return '';
        const d = new Date(timestamp);
        const now = new Date();
        const diff = now - d;
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
        if (diff < 86400000) return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
        return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
    },

    getTypeStyle(type) {
        const map = {
            'customer_order':   { icon: 'fa-shopping-cart', color: 'text-orange-500', bg: 'bg-orange-100', label: '客户下单' },
            'customer_payment': { icon: 'fa-credit-card',  color: 'text-green-500',  bg: 'bg-green-100',  label: '客户支付' },
            'customer_inquiry': { icon: 'fa-commenting',   color: 'text-blue-500',   bg: 'bg-blue-100',   label: '客户咨询' },
            'direct_message':   { icon: 'fa-envelope',     color: 'text-purple-500', bg: 'bg-purple-100', label: '账户消息' },
            'system_announcement': { icon: 'fa-bullhorn',  color: 'text-red-500',    bg: 'bg-red-100',    label: '系统公告' },
            'order_event':      { icon: 'fa-bell',         color: 'text-indigo-500', bg: 'bg-indigo-100', label: '订单动态' }
        };
        return map[type] || { icon: 'fa-circle', color: 'text-gray-500', bg: 'bg-gray-100', label: '消息' };
    },

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    },

    // 🔄 加载线程列表
    async loadThreads(silent) {
        try {
            const storeId = this.getStoreId();
            const resp = await fetch(`${this.API_BASE}/api/messages/threads?storeId=${encodeURIComponent(storeId)}`);
            const json = await resp.json();
            if (json.success) {
                this.allThreads = json.data.threads || [];
                this.renderThreadList();
                this.updateSidebarBadge();
            }
        } catch (e) {
            if (!silent) console.error('[消息中心] 加载线程失败:', e.message);
        }
    },

    updateSidebarBadge() {
        const unreadTotal = this.allThreads.reduce((sum, t) => sum + (t.unreadCount || 0), 0);
        const navBadge = document.querySelector('a[href="#messages"] .bg-red-500');
        if (navBadge) {
            if (unreadTotal > 0) {
                navBadge.textContent = unreadTotal > 99 ? '99+' : unreadTotal;
                navBadge.style.display = '';
            } else {
                navBadge.style.display = 'none';
            }
        }
    },

    renderThreadList() {
        const listContainer = document.querySelector('#messages-content .space-y-2.max-h-\\[600px\\]');
        if (!listContainer) return;

        if (this.allThreads.length === 0) {
            listContainer.innerHTML = `
                <div class="p-8 text-center text-gray-400">
                    <i class="fa fa-inbox text-4xl mb-3 block"></i>
                    <p class="text-sm font-medium">暂无消息</p>
                    <p class="text-xs mt-1">当客户通过微信小程序下单或支付时，<br>相关消息将自动出现在这里</p>
                </div>`;
            return;
        }

        listContainer.innerHTML = this.allThreads.map(t => {
            const style = this.getTypeStyle(t.type);
            const isActive = t.threadId === this.currentThreadId;
            return `
                <div class="message-item p-3 rounded-lg cursor-pointer transition-all duration-200 ${isActive ? 'bg-blue-50 border-l-2 border-l-primary' : 'bg-white border border-gray-200'} hover:bg-blue-50"
                     data-thread-id="${t.threadId}">
                    <div class="flex items-center justify-between mb-1">
                        <div class="flex items-center gap-2 min-w-0">
                            <i class="fa ${style.icon} ${style.color} text-sm flex-shrink-0"></i>
                            <span class="font-medium text-gray-800 text-sm truncate">${this.escapeHtml(t.fromName || '系统')}</span>
                            ${t.unreadCount > 0 ? `<span class="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full flex-shrink-0">${t.unreadCount}</span>` : ''}
                        </div>
                        <span class="text-xs text-gray-400 flex-shrink-0 ml-2">${this.formatMsgTime(t.lastTime)}</span>
                    </div>
                    <p class="text-xs text-gray-500 truncate">${this.escapeHtml(t.subject || t.lastContent || '')}</p>
                    ${t.orderNo ? `<p class="text-xs text-gray-400 mt-0.5">订单: ${t.orderNo}</p>` : ''}
                </div>`;
        }).join('');

        const self = this;
        listContainer.querySelectorAll('.message-item').forEach(item => {
            item.addEventListener('click', function() {
                const tid = this.getAttribute('data-thread-id');
                self.openThread(tid);
            });
        });
    },

    // 打开消息线程
    async openThread(threadId) {
        this.currentThreadId = threadId;
        this.renderThreadList();

        try {
            const storeId = this.getStoreId();
            const resp = await fetch(`${this.API_BASE}/api/messages?threadId=${encodeURIComponent(threadId)}&storeId=${encodeURIComponent(storeId)}&limit=100`);
            const json = await resp.json();
            if (json.success) {
                const messages = json.data.messages || [];
                const thread = this.allThreads.find(t => t.threadId === threadId) || {};
                this.renderChatDetail(thread, messages);

                // 自动标记已读
                fetch(`${this.API_BASE}/api/messages/read`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ threadId })
                }).catch(() => {});

                this.loadThreads(true);
            }
        } catch (e) {
            console.error('[消息中心] 打开线程失败:', e.message);
        }
    },

    renderChatDetail(thread, messages) {
        const detailContainer = document.querySelector('#messages-content .lg\\:col-span-2');
        if (!detailContainer) return;

        const threadType = thread.type || 'direct_message';
        const style = this.getTypeStyle(threadType);
        const displayName = thread.fromName || '系统';
        const threadOrderNo = thread.orderNo || '';

        const typeLabelMap = {
            'customer_order': '客户下单通知',
            'customer_payment': '客户支付通知',
            'customer_inquiry': '客户咨询',
            'direct_message': '账户通讯',
            'system_announcement': '系统公告',
            'order_event': '订单动态'
        };
        const typeLabel = typeLabelMap[threadType] || '消息';

        detailContainer.innerHTML = `
            <div class="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-full ${style.bg} flex items-center justify-center flex-shrink-0">
                        <i class="fa ${style.icon} ${style.color}"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h3 class="font-semibold text-gray-800">${this.escapeHtml(displayName)}</h3>
                            <span class="px-2 py-0.5 text-xs rounded-full ${style.bg} ${style.color} font-medium">${typeLabel}</span>
                        </div>
                        <p class="text-sm text-gray-400">${threadOrderNo ? '关联订单: ' + threadOrderNo : '消息详情'}</p>
                    </div>
                </div>
                <button class="p-2 rounded-lg hover:bg-gray-100 transition-all" onclick="MessageCenter.refreshCurrentThread()" title="刷新">
                    <i class="fa fa-refresh text-gray-400 hover:text-gray-600"></i>
                </button>
            </div>
            
            <div class="message-body mb-4 space-y-4 max-h-[360px] overflow-y-auto pr-1" id="msg-detail-body">
                ${messages.length === 0 ? '<div class="text-center text-gray-400 py-10"><i class="fa fa-comments-o text-3xl mb-2 block"></i><p>暂无消息记录</p></div>' : ''}
                ${[...messages].reverse().map(msg => this.renderMessageBubble(msg)).join('')}
            </div>
            
            <!-- 快捷回复 -->
            <div class="mb-3">
                <h4 class="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">快捷回复</h4>
                <div class="flex flex-wrap gap-1.5">
                    <button class="quick-reply-btn px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 rounded-full text-xs hover:bg-gray-100 hover:border-gray-300 transition-all" data-text="收到，我们会尽快处理">✅ 收到，尽快处理</button>
                    <button class="quick-reply-btn px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 rounded-full text-xs hover:bg-gray-100 hover:border-gray-300 transition-all" data-text="请问有什么可以帮您的？">💬 需要帮忙？</button>
                    <button class="quick-reply-btn px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 rounded-full text-xs hover:bg-gray-100 hover:border-gray-300 transition-all" data-text="好的，我已记录您的需求，会尽快处理">📝 好的，已记录</button>
                    <button class="quick-reply-btn px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 rounded-full text-xs hover:bg-gray-100 hover:border-gray-300 transition-all" data-text="请稍等，正在为您查询相关信息">⏳ 请稍等</button>
                </div>
            </div>
            
            <!-- 发送框 -->
            <div class="relative">
                <textarea id="msg-input" placeholder="输入回复消息... (Enter 发送，Shift+Enter 换行)" class="w-full pl-4 pr-12 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none text-sm" rows="3"></textarea>
                <button id="msg-send-btn" class="absolute bottom-3 right-3 bg-primary text-white p-2.5 rounded-full hover:bg-primary/90 transition-all hover:scale-110 shadow-md">
                    <i class="fa fa-paper-plane"></i>
                </button>
            </div>
        `;

        const self = this;
        // 快捷回复
        detailContainer.querySelectorAll('.quick-reply-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const ta = detailContainer.querySelector('#msg-input');
                if (ta) { ta.value = this.getAttribute('data-text'); ta.focus(); }
            });
        });

        // 发送
        const sendBtn = detailContainer.querySelector('#msg-send-btn');
        const msgInput = detailContainer.querySelector('#msg-input');
        if (sendBtn && msgInput) {
            sendBtn.addEventListener('click', () => self.doSendMessage(msgInput, thread));
            msgInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    self.doSendMessage(msgInput, thread);
                }
            });
        }

        // 滚动到底
        setTimeout(() => {
            const body = detailContainer.querySelector('#msg-detail-body');
            if (body) body.scrollTop = body.scrollHeight;
        }, 150);
    },

    renderMessageBubble(msg) {
        const isFromCustomer = msg.fromType === 'customer';
        const isSelf = msg.fromType === 'admin';
        const avatarChar = (msg.fromName || '用').charAt(0);

        if (isSelf) {
            return `
                <div class="flex items-start space-x-3 justify-end animate-fadeIn">
                    <div class="bg-primary text-white rounded-2xl rounded-br-md p-3 max-w-[75%] shadow-sm">
                        <p class="text-sm leading-relaxed">${this.escapeHtml(msg.content)}</p>
                        <p class="text-xs text-white/60 mt-1.5 text-right">${this.formatMsgTime(msg.createdAt)}</p>
                    </div>
                    <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
                        <span class="text-white text-xs font-medium">${avatarChar}</span>
                    </div>
                </div>`;
        } else {
            const bgClass = isFromCustomer ? 'bg-orange-50 border border-orange-100' : 'bg-gray-50 border border-gray-100';
            const avatarBg = isFromCustomer ? 'bg-orange-400' : 'bg-gray-400';
            return `
                <div class="flex items-start space-x-3 animate-fadeIn">
                    <div class="w-8 h-8 rounded-full ${avatarBg} flex items-center justify-center flex-shrink-0 shadow-sm">
                        <span class="text-white text-xs font-medium">${avatarChar}</span>
                    </div>
                    <div class="${bgClass} rounded-2xl rounded-bl-md p-3 max-w-[75%] shadow-sm">
                        <p class="text-sm text-gray-800 leading-relaxed">${this.escapeHtml(msg.content)}</p>
                        <p class="text-xs text-gray-400 mt-1.5">${this.formatMsgTime(msg.createdAt)}</p>
                    </div>
                </div>`;
        }
    },

    async doSendMessage(textarea, thread) {
        const content = textarea.value.trim();
        if (!content || !this.currentThreadId) return;

        textarea.value = '';
        textarea.focus();

        // 乐观更新UI
        const body = document.querySelector('#msg-detail-body');
        if (body) {
            body.insertAdjacentHTML('beforeend', `
                <div class="flex items-start space-x-3 justify-end">
                    <div class="bg-primary/70 text-white rounded-2xl rounded-br-md p-3 max-w-[75%]">
                        <p class="text-sm">${this.escapeHtml(content)}</p>
                        <p class="text-xs text-white/60 mt-1.5 text-right">发送中...</p>
                    </div>
                    <div class="w-8 h-8 rounded-full bg-primary/70 flex items-center justify-center flex-shrink-0">
                        <span class="text-white text-xs">管</span>
                    </div>
                </div>`);
            body.scrollTop = body.scrollHeight;
        }

        try {
            const storeId = this.getStoreId();
            const resp = await fetch(`${this.API_BASE}/api/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    threadId: this.currentThreadId,
                    fromType: 'admin',
                    fromId: 'admin',
                    fromName: '管理员',
                    toType: thread.fromType || 'store',
                    toId: thread.fromId || thread.storeId || '',
                    type: 'direct_message',
                    content,
                    orderNo: thread.orderNo || null,
                    storeId: storeId !== 'ALL' ? storeId : (thread.storeId || null)
                })
            });
            const json = await resp.json();
            if (json.success) {
                this.openThread(this.currentThreadId);
            }
        } catch (e) {
            console.error('[消息中心] 发送失败:', e.message);
            if (typeof showToast === 'function') showToast('消息发送失败: ' + e.message, 'error');
        }
    },

    refreshCurrentThread() {
        if (this.currentThreadId) {
            this.openThread(this.currentThreadId);
        }
    },

    startPolling() {
        if (this.pollingTimer) clearInterval(this.pollingTimer);
        this.pollingTimer = setInterval(() => {
            this.loadThreads(true);
            if (this.currentThreadId) {
                this.refreshCurrentThread();
            }
        }, 15000);
    }
};

// 兼容全局调用
function initMessageCenter() {
    MessageCenter.init();
}
