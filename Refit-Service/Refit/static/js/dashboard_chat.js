document.addEventListener('DOMContentLoaded', function() {
    initChatDashboard();
});

function getAuthToken() {
    return localStorage.getItem('access_token') || '';
}

function handleUnauthorized() {
    showErrorNotification('인증 오류', '로그인이 필요하거나 세션이 만료되었습니다.');
    
    if (typeof handleSessionExpired === 'function') {
        handleSessionExpired(false);
    } else {
        setTimeout(() => {
            window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
        }, 2000);
    }
}

function showErrorNotification(title, message) {
    if (typeof createNotification === 'function') {
        createNotification('error', title, message);
    } else {
        alert(`${title}: ${message}`);
    }
}

let currentSessionId = null;
let chatSessions = [];

function initChatDashboard() {
    const sessionStatusFilter = document.getElementById('session-status-filter');
    const sessionCategoryFilter = document.getElementById('session-category-filter');
    const refreshSessionsBtn = document.getElementById('refresh-sessions-btn');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const messageInput = document.getElementById('messageInput');
    const closeSessionBtn = document.getElementById('closeSessionBtn');
    const quickReplyBtns = document.querySelectorAll('.quick-reply-btn');
    
    if (refreshSessionsBtn) {
        refreshSessionsBtn.addEventListener('click', loadChatSessions);
    }
    
    if (sendMessageBtn && messageInput) {
        sendMessageBtn.addEventListener('click', function() {
            if (messageInput.value.trim() !== '') {
                sendMessage(messageInput.value);
                messageInput.value = '';
            }
        });
        
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessageBtn.click();
            }
        });
    }
    
    if (closeSessionBtn) {
        closeSessionBtn.addEventListener('click', closeCurrentSession);
    }
    
    if (quickReplyBtns && quickReplyBtns.length > 0) {
        quickReplyBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                if (messageInput) {
                    messageInput.value = this.textContent;
                    messageInput.focus();
                }
            });
        });
    }
    
    const quickReplyBtn = document.getElementById('quickReplyBtn');
    if (quickReplyBtn) {
        quickReplyBtn.addEventListener('click', function() {
            const quickReplies = document.getElementById('quickReplies');
            if (quickReplies) {
                quickReplies.classList.toggle('show');
            }
        });
    }
    
    if (sessionStatusFilter) {
        sessionStatusFilter.addEventListener('change', loadChatSessions);
    }
    
    if (sessionCategoryFilter) {
        sessionCategoryFilter.addEventListener('change', loadChatSessions);
    }
    
    loadCategories();
    loadChatSessions();
}

function loadCategories() {
    fetch('/api/categories', {
        headers: {
            'Authorization': `Bearer ${getAuthToken()}`
        }
    })
    .then(response => {
        if (response.status === 404) {
            console.warn('카테고리 API를 찾을 수 없습니다. 백엔드 엔드포인트를 확인하세요.');
            return { categories: [] };
        } else if (response.status === 401) {
            handleUnauthorized();
            return { categories: [] };
        }
        return response.json();
    })
    .then(data => {
        const categoryFilter = document.getElementById('session-category-filter');
        if (categoryFilter) {
            const defaultOption = categoryFilter.querySelector('option[value="all"]');
            categoryFilter.innerHTML = '';
            categoryFilter.appendChild(defaultOption);
            
            let categoriesArr = [];
            if (Array.isArray(data)) {
                categoriesArr = data.map(c => ({ id: c, name: c }));
            } else if (data.categories && Array.isArray(data.categories)) {
                categoriesArr = data.categories;
            } else if (data && typeof data === 'object') {
                categoriesArr = Object.entries(data).map(([k, v]) => ({ id: k, name: v }));
            }
            categoriesArr.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                categoryFilter.appendChild(option);
            });
        }
    })
    .catch(error => {
        console.error('카테고리 로딩 중 오류:', error);
        showErrorNotification('카테고리 로딩 실패', '카테고리 정보를 불러오는 중 오류가 발생했습니다.');
    });
}

function loadChatSessions() {
    const statusFilter = document.getElementById('session-status-filter').value;
    const categoryFilter = document.getElementById('session-category-filter').value;
    const sessionsListContent = document.getElementById('sessions-list-content');
    
    if (sessionsListContent) {
        sessionsListContent.innerHTML = `
            <div class="session-loading">
                <i class="fas fa-spinner fa-spin"></i> 
                세션 로딩 중...
            </div>
        `;
    }
    
    fetch(`/api/chat/sessions?status=${statusFilter}&category=${categoryFilter}`, {
        headers: {
            'Authorization': `Bearer ${getAuthToken()}`
        }
    })
    .then(response => {
        if (response.status === 401) {
            handleUnauthorized();
            return { sessions: [] };
        }
        return response.json();
    })
    .then(data => {
        chatSessions = data.sessions || [];
        renderChatSessions();
    })
    .catch(error => {
        console.error('채팅 세션 로딩 중 오류:', error);
        if (sessionsListContent) {
            sessionsListContent.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    세션 로딩 중 오류가 발생했습니다.
                </div>
            `;
        }
        showErrorNotification('세션 로딩 실패', '채팅 세션 정보를 불러오는 중 오류가 발생했습니다.');
    });
}

function renderChatSessions() {
    const sessionsListContent = document.getElementById('sessionsList');
    const noSessionSelected = document.getElementById('noSessionSelected');
    const chatSessionContent = document.getElementById('chatSessionContent');
    const sessionsCount = document.getElementById('sessionsCount');
    const noSessionsMessage = document.getElementById('noSessionsMessage');
    
    if (!sessionsListContent) return;
    
    const sessionItems = sessionsListContent.querySelectorAll('.session-item');
    sessionItems.forEach(item => item.remove());
    
    if (sessionsCount) {
        sessionsCount.textContent = chatSessions.length;
    }
    
    if (chatSessions.length === 0) {
        if (noSessionsMessage) {
            noSessionsMessage.style.display = 'flex';
        }
        return;
    } else if (noSessionsMessage) {
        noSessionsMessage.style.display = 'none';
    }
    
    chatSessions.forEach(session => {
        const sessionItem = document.createElement('div');
        sessionItem.className = `session-item ${session.id === currentSessionId ? 'active' : ''} ${
            session.has_unread ? 'has-unread' : ''
        }`;
        sessionItem.dataset.sessionId = session.id;
        
        const statusClass = {
            'active': 'status-active',
            'pending': 'status-pending',
            'closed': 'status-closed'
        }[session.status] || 'status-active';
        
        sessionItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <span class="session-status-badge ${statusClass}"></span>
                    <strong>방문자 ${session.visitor_id}</strong>
                </div>
                <span class="session-time">${formatDate(session.created_at)}</span>
            </div>
            <div>
                <span class="session-category">${session.category_name || '분류없음'}</span>
            </div>
            <div class="mt-1 text-truncate">
                ${session.last_message || '새 세션'}
            </div>
        `;
        
        sessionItem.addEventListener('click', () => selectSession(session.id));
        sessionsListContent.appendChild(sessionItem);
    });
    
    if (!currentSessionId && chatSessions.length > 0) {
        if (noSessionSelected && chatSessionContent) {
            noSessionSelected.style.display = 'flex';
            chatSessionContent.style.display = 'none';
        }
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function selectSession(sessionId) {
    currentSessionId = sessionId;
    const session = chatSessions.find(s => s.id === sessionId);
    
    if (!session) return;
    
    const noSessionSelected = document.getElementById('noSessionSelected');
    const chatSessionContent = document.getElementById('chatSessionContent');
    
    if (noSessionSelected && chatSessionContent) {
        noSessionSelected.style.display = 'none';
        chatSessionContent.style.display = 'flex';
    }
    
    document.querySelectorAll('.session-item').forEach(item => {
        item.classList.toggle('active', item.dataset.sessionId === sessionId);
    });
    
    document.getElementById('sessionVisitorId').textContent = `방문자 ${session.visitor_id}`;
    document.getElementById('sessionCategoryBadge').textContent = session.category_name || '분류없음';
    document.getElementById('sessionCreatedAt').textContent = formatDate(session.created_at);
    
    document.getElementById('sessionApiKey').textContent = session.api_key_name || '-';
    document.getElementById('sessionStartTime').textContent = formatDate(session.created_at);
    document.getElementById('sessionMessageCount').textContent = session.message_count || '0';
    document.getElementById('sessionStatus').textContent = {
        'active': '활성화',
        'pending': '대기중',
        'closed': '종료됨'
    }[session.status] || '활성화';
    
    document.getElementById('sessionInfoDetails').style.display = 'block';
    document.getElementById('noSessionInfo').style.display = 'none';
    document.getElementById('quickRepliesSection').style.display = 'block';
    
    loadSessionMessages(sessionId);
}

function loadSessionMessages(sessionId) {
    fetch(`/api/chat/sessions/${sessionId}/messages`, {
        headers: {
            'Authorization': `Bearer ${getAuthToken()}`
        }
    })
    .then(response => {
        if (response.status === 401) {
            handleUnauthorized();
            return { messages: [] };
        }
        return response.json();
    })
    .then(data => {
        const messages = data.messages || [];
        renderMessages(messages);
    })
    .catch(error => {
        console.error('메시지 로딩 중 오류:', error);
        showErrorNotification('메시지 로딩 실패', '채팅 메시지를 불러오는 중 오류가 발생했습니다.');
    });
}

function renderMessages(messages) {
    const messagesContainer = document.getElementById('chatMessagesContainer');
    if (!messagesContainer) return;
    
    messagesContainer.innerHTML = '';
    
    if (messages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="text-center text-muted my-5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="32" height="32">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p class="mt-3">메시지가 없습니다. 처음 메시지를 보내보세요.</p>
            </div>
        `;
        return;
    }
    
    messages.forEach(message => {
        const messageType = message.sender_type === 'visitor' ? 'visitor' : 'business';
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${messageType}`;
        messageEl.dataset.messageId = message.id;
        
        messageEl.innerHTML = `
            <div class="message-content">${formatMessageContent(message.content)}</div>
            <div class="message-meta">
                ${formatDate(message.created_at)}
                ${message.is_ai ? ' <span class="badge bg-info text-white">AI</span>' : ''}
            </div>
        `;
        
        if (messageType === 'visitor') {
            messageEl.innerHTML += `
                <div class="message-actions">
                    <button class="message-action-btn suggest-reply-btn" data-message-id="${message.id}" title="AI 응답 제안">
                        <i class="fas fa-magic"></i> AI 응답 제안
                    </button>
                </div>
            `;
        }
        
        messagesContainer.appendChild(messageEl);
    });
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    document.querySelectorAll('.suggest-reply-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            generateReplyToMessage(this.dataset.messageId);
        });
    });
}

function formatMessageContent(content) {
    return content.replace(/\n/g, '<br>');
}

function sendMessage(content) {
    if (!currentSessionId || !content || content.trim() === '') return;
    
    const messageInput = document.getElementById('message-input');
    const sendMessageBtn = document.getElementById('send-message-btn');
    
    if (sendMessageBtn) sendMessageBtn.disabled = true;
    
    fetch(`/api/chat/sessions/${currentSessionId}/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
            content: content,
            sender_type: 'business'
        })
    })
    .then(response => {
        if (response.status === 401) {
            handleUnauthorized();
            return {};
        }
        return response.json();
    })
    .then(() => {
        loadSessionMessages(currentSessionId);
        if (messageInput) messageInput.value = '';
    })
    .catch(error => {
        console.error('메시지 전송 중 오류:', error);
        showErrorNotification('메시지 전송 실패', '메시지를 전송하는 중 오류가 발생했습니다.');
    })
    .finally(() => {
        if (sendMessageBtn) sendMessageBtn.disabled = false;
    });
}

function closeCurrentSession() {
    if (!currentSessionId) return;
    
    if (!confirm('정말로 이 채팅 세션을 종료하시겠습니까?')) return;
    
    fetch(`/api/chat/sessions/${currentSessionId}/close`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthToken()}`
        }
    })
    .then(response => {
        if (response.status === 401) {
            handleUnauthorized();
            return {};
        }
        return response.json();
    })
    .then(() => {
        loadChatSessions();
        
        const noSessionSelected = document.getElementById('no-session-selected');
        const chatSessionContent = document.getElementById('chat-session-content');
        
        if (noSessionSelected && chatSessionContent) {
            noSessionSelected.style.display = 'flex';
            chatSessionContent.style.display = 'none';
        }
        
        currentSessionId = null;
    })
    .catch(error => console.error('세션 종료 중 오류:', error));
}

function generateAIResponse() {
    if (!currentSessionId) return;
    
    fetch(`/api/chat/sessions/${currentSessionId}/ai_response`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthToken()}`
        }
    })
    .then(response => {
        if (response.status === 401) {
            handleUnauthorized();
            return {};
        }
        return response.json();
    })
    .then(data => {
        if (data.success && data.message) {
            const messageInput = document.getElementById('message-input');
            if (messageInput) {
                messageInput.value = data.message;
                messageInput.focus();
            }
        }
    })
    .catch(error => console.error('AI 응답 생성 중 오류:', error));
}

function generateReplyToMessage(messageId) {
    if (!currentSessionId || !messageId) return;
    
    fetch(`/api/chat/sessions/${currentSessionId}/messages/${messageId}/ai_reply`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthToken()}`
        }
    })
    .then(response => {
        if (response.status === 401) {
            handleUnauthorized();
            return {};
        }
        return response.json();
    })
    .then(data => {
        if (data.success && data.message) {
            const messageInput = document.getElementById('message-input');
            if (messageInput) {
                messageInput.value = data.message;
                messageInput.focus();
            }
        }
    })
    .catch(error => console.error('메시지에 대한 AI 응답 생성 중 오류:', error));
}
