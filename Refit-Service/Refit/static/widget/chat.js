class RefitChat {
    constructor(config) {
        this.config = {
            apiKey: '',
            baseUrl: 'http://127.0.0.1:8000/api',
            position: 'bottom-right',
            theme: 'light',
            greetingMessage: '안녕하세요! 무엇을 도와드릴까요?',
            ...config
        };
        
        this.state = {
            chatOpen: false,
            sessionId: null,
            visitorId: this.generateVisitorId(),
            messages: [],
            selectedCategory: null,
            categories: [],
            isLoading: false,
            currentStep: 'welcome'
        };
        
        this.elements = {};
        this.headers = {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey
        };
        
        this.init();
    }
    
    init() {
        if (!this.config.apiKey) {
            console.error('Refit Chat: API 키가 필요합니다.');
            return;
        }
        this.loadStyles();
        this.createChatWidget();
        this.registerEventListeners();
        this.loadCategories();
        this.addRippleEffect();
    }
    
    generateVisitorId() {
        let visitorId = localStorage.getItem('refit_visitor_id');
        if (!visitorId) {
            visitorId = 'v_' + Math.random().toString(36).substring(2, 15) + 
                        Math.random().toString(36).substring(2, 15);
            localStorage.setItem('refit_visitor_id', visitorId);
        }
        return visitorId;
    }
    
    loadStyles() {
        if (document.getElementById('refit-chat-styles')) return;
        
        const styleLink = document.createElement('link');
        styleLink.id = 'refit-chat-styles';
        styleLink.rel = 'stylesheet';
        styleLink.type = 'text/css';
        styleLink.href = 'http://127.0.0.1:8000/static/widget/chat.css';
        document.head.appendChild(styleLink);
    }
    
    createChatWidget() {
        const existingWidget = document.querySelector('.refit-chat-widget');
        if (existingWidget) {
            existingWidget.remove();
        }
        
        const container = document.createElement('div');
        container.className = `refit-chat-widget ${this.config.position} ${this.config.theme}`;
        container.style.position = 'fixed';
        container.style.zIndex = '999999';
        
        const chatButton = document.createElement('div');
        chatButton.className = 'refit-chat-button';
        chatButton.style.width = '60px';
        chatButton.style.height = '60px';
        chatButton.style.borderRadius = '50%';
        chatButton.style.backgroundColor = '#4e73df';
        chatButton.style.color = 'white';
        chatButton.style.display = 'flex';
        chatButton.style.alignItems = 'center';
        chatButton.style.justifyContent = 'center';
        chatButton.style.cursor = 'pointer';
        chatButton.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.15)';
        chatButton.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        chatButton.style.position = 'absolute';
        chatButton.style.zIndex = '2';
        chatButton.style.overflow = 'hidden';
        chatButton.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"></path>
                <path d="M6 12h12v2H6zm0-3h12v2H6zm0-3h12v2H6z"></path>
            </svg>
        `;
        
        const chatPanel = document.createElement('div');
        chatPanel.className = 'refit-chat-panel';
        chatPanel.innerHTML = `
            <div class="refit-chat-header">
                <div class="refit-chat-header-title">고객 지원</div>
                <div class="refit-chat-close">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"></path>
                    </svg>
                </div>
            </div>
            <div class="refit-chat-messages"></div>
            <div class="refit-chat-input-container">
                <div class="refit-chat-input-wrapper">
                    <textarea class="refit-chat-input" placeholder="메시지를 입력하세요..." rows="1"></textarea>
                    <button class="refit-chat-send" disabled>
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2 0.01 7z"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        container.appendChild(chatButton);
        container.appendChild(chatPanel);
        document.body.appendChild(container);
        
        this.elements.container = container;
        this.elements.chatButton = chatButton;
        this.elements.chatPanel = chatPanel;
        this.elements.messagesContainer = chatPanel.querySelector('.refit-chat-messages');
        this.elements.inputContainer = chatPanel.querySelector('.refit-chat-input-container');
        this.elements.input = chatPanel.querySelector('.refit-chat-input');
        this.elements.sendButton = chatPanel.querySelector('.refit-chat-send');
        this.elements.closeButton = chatPanel.querySelector('.refit-chat-close');
    }
    
    registerEventListeners() {
        this.elements.chatButton.addEventListener('click', () => this.toggleChat());
        this.elements.closeButton.addEventListener('click', () => this.closeChat());
        
        this.elements.input.addEventListener('input', () => {
            const isEmpty = !this.elements.input.value.trim();
            this.elements.sendButton.disabled = isEmpty;
            
            this.autoResizeTextarea();
        });
        
        this.elements.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!this.elements.sendButton.disabled) {
                    this.sendMessage();
                }
            }
        });
        
        this.elements.sendButton.addEventListener('click', () => this.sendMessage());
    }
    
    autoResizeTextarea() {
        const input = this.elements.input;
        input.style.height = 'auto';
        input.style.height = (input.scrollHeight) + 'px';
    }
    
    loadCategories() {
        this.state.isLoading = true;
        this.showLoading();
        
        fetch(`${this.config.baseUrl}/chat/categories`, {
            method: 'GET',
            headers: this.headers
        })
        .then(response => response.json())
        .then(data => {
            let categories = [];
            if (Array.isArray(data)) {
                categories = data;
            } else if (data && Array.isArray(data.categories)) {
                categories = data.categories.map(c => c.name || c.id || c);
            } else if (data && typeof data === 'object') {
                categories = Object.values(data);
            }
            this.state.categories = categories;
            this.hideLoading();
            this.showWelcomeMessage();
        })
        .catch(error => {
            console.error('Refit Chat: 카테고리 로드 오류', error);
            this.hideLoading();
            this.showWelcomeMessage();
        });
    }
    
    showLoading() {
        this.hideLoading();
        
        this.state.isLoading = true;
        
        const loadingEl = document.createElement('div');
        loadingEl.className = 'refit-chat-loading';
        loadingEl.setAttribute('role', 'status');
        loadingEl.setAttribute('aria-label', '로딩 중');
        loadingEl.innerHTML = '<div class="refit-chat-spinner"></div>';
        
        this.elements.messagesContainer.appendChild(loadingEl);
        
        this.scrollToBottom();
    }
    
    hideLoading() {
        const loadingEl = this.elements.messagesContainer.querySelector('.refit-chat-loading');
        if (loadingEl) {
            loadingEl.remove();
        }
        this.state.isLoading = false;
    }
    
    showWelcomeMessage() {
        this.clearMessages();
        
        const welcomeEl = document.createElement('div');
        welcomeEl.className = 'refit-chat-welcome';
        welcomeEl.innerHTML = `
            <h3>환영합니다!</h3>
            <p>${this.config.greetingMessage}</p>
        `;
        
        this.elements.messagesContainer.appendChild(welcomeEl);
        
        if (this.state.categories.length > 0) {
            this.showCategorySelector();
        }
    }
    
    clearMessages() {
        this.elements.chatPanel.querySelector('.refit-chat-messages').innerHTML = '';
    }
    
    showCategorySelector() {
        const categoriesEl = document.createElement('div');
        categoriesEl.className = 'refit-chat-categories';
        
        this.state.categories.forEach(category => {
            const categoryBtn = document.createElement('div');
            categoryBtn.className = 'refit-chat-category';
            categoryBtn.textContent = category;
            categoryBtn.addEventListener('click', () => this.selectCategory(category));
            categoriesEl.appendChild(categoryBtn);
        });
        
        this.elements.chatPanel.querySelector('.refit-chat-messages').appendChild(categoriesEl);
    }
    
    selectCategory(category) {
        this.state.selectedCategory = category;
        this.state.currentStep = 'chat';
        
        const categoryButtons = this.elements.chatPanel.querySelector('.refit-chat-messages').querySelectorAll('.refit-chat-category');
        categoryButtons.forEach(btn => {
            if (btn.textContent === category) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
        
        this.createChatSession();
    }
    
    createChatSession() {
        this.state.isLoading = true;
        this.showLoading();
        
        fetch(`${this.config.baseUrl}/chat/sessions`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                visitor_id: this.state.visitorId,
                category: this.state.selectedCategory
            })
        })
        .then(response => response.json())
        .then(data => {
            this.state.sessionId = data.session_id;
            this.hideLoading();
            this.addBotMessage("질문을 입력해주세요.");
        })
        .catch(error => {
            console.error('Refit Chat: 세션 생성 오류', error);
            this.hideLoading();
            this.addBotMessage("문제가 발생했습니다. 다시 시도해주세요.");
        });
    }
    
    toggleChat() {
        if (this.state.chatOpen) {
            this.closeChat();
        } else {
            this.openChat();
        }
        
        this.elements.chatButton.classList.add('pulse');
        setTimeout(() => {
            this.elements.chatButton.classList.remove('pulse');
        }, 1000);
    }
    
    openChat() {
        this.state.chatOpen = true;
        this.elements.container.classList.add('open');
        
        if (this.elements.chatButton.classList.contains('unread')) {
            this.elements.chatButton.classList.remove('unread');
        }
        
        if (this.state.messages.length === 0) {
            this.showWelcomeMessage();
        }
        
        this.elements.chatButton.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"></path>
            </svg>
        `;
        
        setTimeout(() => {
            this.elements.input.focus();
            this.scrollToBottom();
        }, 400);
        
        this.addAccessibility();
    }
    
    closeChat() {
        this.state.chatOpen = false;
        this.elements.container.classList.remove('open');
        
        this.elements.chatButton.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"></path>
                <path d="M6 12h12v2H6zm0-3h12v2H6zm0-3h12v2H6z"></path>
            </svg>
        `;
        
        if (this.state.sessionId) {
            const sessionToClose = this.state.sessionId;
            this.state.sessionId = null;
            this.finishChatSession(false, sessionToClose);
        }
    }
    
    finishChatSession(showMessage = true, specificSessionId = null) {
        const sessionId = specificSessionId || this.state.sessionId;
        
        if (!sessionId) return;
        
        fetch(`${this.config.baseUrl}/chat/sessions/${sessionId}/api`, {
            method: 'PUT',
            headers: this.headers,
            body: JSON.stringify({
                status: 'closed',
                ended_at: new Date().toISOString()
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Refit Chat: 세션이 성공적으로 종료되었습니다', data);
            if (showMessage) {
                this.addSystemMessage('대화가 종료되었습니다. 새로운 문의를 하시려면 새 메시지를 입력해주세요.');
            }
        })
        .catch(error => {
            console.error('Refit Chat: 세션 종료 오류', error);
        });
    }
    
    sendMessage() {
        const messageText = this.elements.input.value.trim();
        if (!messageText || this.state.isLoading) return;
        
        if (!this.state.selectedCategory) {
            this.addSystemMessage('문의 카테고리를 선택해주세요.');
            const categoryButtons = this.elements.chatPanel.querySelectorAll('.refit-chat-category');
            if (categoryButtons.length > 0) {
                categoryButtons.forEach(btn => btn.classList.add('error'));
                setTimeout(() => categoryButtons.forEach(btn => btn.classList.remove('error')), 2000);
            }
            return;
        }
        
        this.elements.input.value = '';
        this.elements.input.style.height = 'auto';
        this.elements.sendButton.disabled = true;
        
        this.addUserMessage(messageText);
        
        if (!this.state.sessionId) {
            this.createChatSession().then(() => {
                this.processSendMessage(messageText);
            });
        } else {
            this.processSendMessage(messageText);
        }
    }
    
    processSendMessage(messageText) {
        this.state.isLoading = true;
        this.showLoading();
        
        fetch(`${this.config.baseUrl}/chat/sessions/${this.state.sessionId}/messages`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                content: messageText,
                sender_type: 'visitor'
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            this.state.messages.push(data);
            this.hideLoading();
            
            setTimeout(() => {
                this.fetchBotResponse();
            }, 500);
        })
        .catch(error => {
            console.error('Refit Chat: 메시지 전송 오류', error);
            this.hideLoading();
            this.addBotMessage('메시지 전송 중 오류가 발생했습니다.');
        });
    }
    
    fetchBotResponse() {
        this.state.isLoading = true;
        this.showLoading();
        
        fetch(`${this.config.baseUrl}/chat/sessions/${this.state.sessionId}/respond`, {
            method: 'POST',
            headers: this.headers
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            this.state.messages.push(data);
            this.hideLoading();
            this.addBotMessage(data.content, data.id);
            
            if (this.isResponseComplete(data.content)) {
                this.finishChatSession();
            }
        })
        .catch(error => {
            console.error('Refit Chat: 봇 응답 오류', error);
            this.hideLoading();
            this.addBotMessage('응답을 생성하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        });
    }
    
    addUserMessage(text) {
        const messageEl = document.createElement('div');
        messageEl.className = 'refit-chat-message user';
        messageEl.innerHTML = `<div class="refit-chat-message-content">${this.escapeHtml(text)}</div>`;
        
        this.elements.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
        
        this.state.messages.push({
            sender_type: 'visitor',
            content: text,
            timestamp: new Date().toISOString()
        });
    }
    
    addBotMessage(text, messageId) {
        const messageEl = document.createElement('div');
        messageEl.className = 'refit-chat-message bot';
        
        let messageContent = `<div class="refit-chat-message-content">${this.escapeHtml(text)}</div>`;
        
        if (messageId) {
            messageContent += `
                <div class="refit-chat-message-feedback">
                    <span>도움이 되었나요?</span>
                    <div class="refit-chat-feedback-buttons">
                        <button class="refit-chat-feedback-btn" data-value="helpful" data-message-id="${messageId}" title="도움이 됨">
                            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"></path>
                            </svg>
                            <span>네</span>
                        </button>
                        <button class="refit-chat-feedback-btn" data-value="unhelpful" data-message-id="${messageId}" title="도움이 안됨">
                            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"></path>
                            </svg>
                            <span>아니요</span>
                        </button>
                    </div>
                </div>
            `;
        }
        
        messageEl.innerHTML = messageContent;
        
        this.elements.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
        
        if (messageId) {
            const feedbackButtons = messageEl.querySelectorAll('.refit-chat-feedback-btn');
            feedbackButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const value = btn.getAttribute('data-value');
                    const msgId = btn.getAttribute('data-message-id');
                    this.sendFeedback(msgId, value);
                    
                    feedbackButtons.forEach(b => b.disabled = true);
                    btn.classList.add('selected');
                    messageEl.querySelector('.refit-chat-message-feedback span').textContent = '피드백 감사합니다!';
                });
            });
        }
    }
    
    sendFeedback(messageId, feedback) {
        fetch(`${this.config.baseUrl}/chat/messages/${messageId}/feedback`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                feedback
            })
        })
        .catch(error => {
            console.error('Refit Chat: 피드백 전송 오류', error);
        });
    }
    
    scrollToBottom() {
        setTimeout(() => {
            this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
        }, 10);
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    addRippleEffect() {
        const buttons = this.elements.container.querySelectorAll('.refit-chat-button, .refit-chat-send');
        
        buttons.forEach(button => {
            button.addEventListener('click', function(e) {
                const rect = button.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const ripple = document.createElement('span');
                ripple.className = 'refit-ripple';
                ripple.style.left = x + 'px';
                ripple.style.top = y + 'px';
                
                button.appendChild(ripple);
                
                setTimeout(() => {
                    ripple.remove();
                }, 600);
            });
        });
    }
    
    isResponseComplete(content) {
        const completionPhrases = [
            "더 필요하신 것이 있으신가요",
            "더 궁금한 점이 있으신가요",
            "추가로 도움이 필요하신가요",
            "더 도울 것이 있을까요",
            "도움이 되셨나요",
            "감사합니다",
            "좋은 하루 되세요"
        ];
        
        return completionPhrases.some(phrase => content.includes(phrase));
    }
    
    finishChatSession() {
        setTimeout(() => {
            if (!this.state.sessionId) return;
            
            fetch(`${this.config.baseUrl}/chat/sessions/${this.state.sessionId}`, {
                method: 'PUT',
                headers: this.headers,
                body: JSON.stringify({
                    status: 'closed',
                    ended_at: new Date().toISOString()
                })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Refit Chat: 세션이 성공적으로 종료되었습니다', data);
                this.addSystemMessage('대화가 종료되었습니다. 새로운 문의를 하시려면 새 메시지를 입력해주세요.');
                this.state.sessionId = null;
            })
            .catch(error => {
                console.error('Refit Chat: 세션 종료 오류', error);
            });
        }, 5000);
    }
    
    addSystemMessage(text) {
        const messageEl = document.createElement('div');
        messageEl.className = 'refit-chat-message system';
        messageEl.innerHTML = `<div class="refit-chat-message-content system">${this.escapeHtml(text)}</div>`;
        
        this.elements.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
    }
    
    addAccessibility() {
        this.elements.chatPanel.setAttribute('role', 'dialog');
        this.elements.chatPanel.setAttribute('aria-labelledby', 'refit-chat-header-title');
        this.elements.chatButton.setAttribute('aria-label', this.state.chatOpen ? '채팅창 닫기' : '채팅창 열기');
        this.elements.closeButton.setAttribute('aria-label', '채팅창 닫기');
        this.elements.sendButton.setAttribute('aria-label', '메시지 전송');
    }
}