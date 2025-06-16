function getAccessToken() {
    return localStorage.getItem('access_token');
}

function setAccessToken(token) {
    localStorage.setItem('access_token', token);
}

function removeAccessToken() {
    localStorage.removeItem('access_token');
    document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
}

function isAuthenticated() {
    return !!getAccessToken();
}
function handleSessionExpired(immediate = false) {
    removeAccessToken();
    
    showAuthNotification('세션이 만료되었습니다. 다시 로그인해주세요.', 'warning');
    
    if (immediate) {
        window.location.href = '/login';
    } else {
        setTimeout(() => {
            window.location.href = '/login';
        }, 2000);
    }
}

function refreshTokenIfNeeded() {
    if (!isAuthenticated()) {
        return Promise.reject(new Error('인증 토큰이 없습니다.'));
    }
    
    return Promise.resolve(true);
}

function showAuthNotification(message, type = 'info') {
    if (!message) return;
    
    let notificationContainer = document.getElementById('authNotificationContainer');
    
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'authNotificationContainer';
        notificationContainer.className = 'notification-container';
        document.body.appendChild(notificationContainer);
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-icon">
            <i class="fas ${getAuthNotificationIcon(type)}"></i>
        </div>
        <div class="notification-message">${message}</div>
        <button class="notification-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    notificationContainer.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    });
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);
}

function getAuthNotificationIcon(type) {
    switch (type) {
        case 'success':
            return 'fa-check-circle';
        case 'error':
            return 'fa-exclamation-circle';
        case 'warning':
            return 'fa-exclamation-triangle';
        default:
            return 'fa-info-circle';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    if (!isAuthenticated()) {
        const currentPath = window.location.pathname;
        if (currentPath.startsWith('/dashboard')) {
            window.location.href = '/login?redirect=' + encodeURIComponent(currentPath);
        }
    } else {
        refreshTokenIfNeeded().then(valid => {
            if (!valid) {
                handleSessionExpired();
            }
        });
    }
    
    setInterval(() => {
        if (isAuthenticated()) {
            refreshTokenIfNeeded();
        }
    }, 180000);
});
