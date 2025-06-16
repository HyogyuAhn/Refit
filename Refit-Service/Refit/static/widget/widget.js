(function() {
    const REFIT_URL = window.location.origin || 'http://127.0.0.1:8000';
    const DEFAULT_CONFIG = {
        position: 'bottom-right',
        theme: 'light',
        greetingMessage: '안녕하세요! Refit 고객센터입니다. 무엇을 도와드릴까요?'
    };

    class RefitWidgetLoader {
        constructor() {
            this.isLoaded = false;
            this.pendingInit = false;
            this.configData = {};
        }

        init(config) {
            this.configData = { ...DEFAULT_CONFIG, ...config };

            if (!this.configData.apiKey) {
                console.error('Refit Widget: API 키가 필요합니다');
                return;
            }

            if (this.isLoaded) {
                this.initializeChat();
                return;
            }

            this.pendingInit = true;
            this.loadScript();
        }

        loadConfig() {
        }

        loadScript() {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = `${REFIT_URL}/static/widget/chat.css`;
            document.head.appendChild(link);
            
            const script = document.createElement('script');
            script.async = true;
            script.src = `${REFIT_URL}/static/widget/chat.js`;
            script.onload = () => {
                this.isLoaded = true;
                if (this.pendingInit) {
                    this.initializeChat();
                    this.pendingInit = false;
                }
            };
            document.head.appendChild(script);
        }

        initializeChat() {
            if (window.RefitChat) {
                if (window.refitChatInstance) {
                    if (typeof window.refitChatInstance.destroy === 'function') {
                        window.refitChatInstance.destroy();
                    }
                    window.refitChatInstance = null;
                }
                
                const existingWidgets = document.querySelectorAll('.refit-chat-widget, .refit-chat-container, .refit-chat-button, .refit-chat-panel');
                existingWidgets.forEach(widget => widget.remove());
                
                window.refitChatInstance = new RefitChat(this.configData);
            }
        }
    }

    window.RefitWidget = new RefitWidgetLoader();
    
    const existingApiKey = document.currentScript.getAttribute('data-api-key');
    const existingPosition = document.currentScript.getAttribute('data-position');
    const existingTheme = document.currentScript.getAttribute('data-theme');
    
    if (existingApiKey) {
        const config = {
            apiKey: existingApiKey
        };
        
        if (existingPosition) {
            config.position = existingPosition;
        }
        
        if (existingTheme) {
            config.theme = existingTheme;
        }
        
        window.RefitWidget.init(config);
    }
})();
