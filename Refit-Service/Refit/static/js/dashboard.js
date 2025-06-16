function logoutUser() {
  fetch('/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
    credentials: 'same-origin',
    redirect: 'follow'
  })
  .then(response => {
    if (response.ok || response.redirected) {
      localStorage.clear();
      sessionStorage.clear();

      const timestamp = new Date().getTime();

      document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      window.location.href = '/?nocache=' + timestamp;

      window.setTimeout(function() {
        window.location.reload(true);
      }, 100);
    } else {
      console.error('로그아웃 실패');
    }
  })
  .catch(error => {
    console.error('로그아웃 오류:', error);
  });
}

document.addEventListener('DOMContentLoaded', function() {
  checkLoginStatus();
  
  const mobileToggle = document.getElementById('mobile-toggle') || document.getElementById('mobile-menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const toggleIcon = document.getElementById('menu-toggle-icon');
  
  function toggleSidebar() {
    sidebar.classList.toggle('show');
    
    if (toggleIcon) {
      if (sidebar.classList.contains('show')) {
        toggleIcon.classList.replace('fa-bars', 'fa-times');
      } else {
        toggleIcon.classList.replace('fa-times', 'fa-bars');
      }
    }
  }
  
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleSidebar();
    });
  }
  
  document.addEventListener('click', function(e) {
    const isClickInside = sidebar?.contains(e.target) || mobileToggle?.contains(e.target);
    
    if (!isClickInside && sidebar?.classList.contains('show')) {
      toggleSidebar();
    }
  });

  window.addEventListener('resize', function() {
    if (window.innerWidth > 768 && sidebar && sidebar.classList.contains('show')) {
      sidebar.classList.remove('show');
      if (toggleIcon && toggleIcon.classList.contains('fa-times')) {
        toggleIcon.classList.replace('fa-times', 'fa-bars');
      }
    }
  });

  loadDashboardData();
});

function loadDashboardData() {
  checkApiKeyStatus();
  loadChatSessionsCount();
}

function apiRequest(url, method = 'GET', body = null) {
  const token = getAuthToken();
  
  const options = {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache'
    },
    credentials: 'same-origin'
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  return fetch(url, options)
    .then(response => {
      if (response.status === 401) {
        console.warn('인증이 만료되었습니다. 다시 로그인해주세요.');
        showAuthErrorNotification();
        setTimeout(() => {
          window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname) + '&reason=session_expired';
        }, 1500);
        throw new Error('인증 만료');
      }
      return response.json();
    });
}

function getAuthToken() {
  let token = null;
  
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const parts = cookie.trim().split('=');
    if (parts.length >= 2) {
      const name = parts[0];
      const value = parts.slice(1).join('=');
      
      if (name === 'access_token' && value) {
        token = value;
        console.log('쿠키에서 토큰을 찾았습니다:', value.substring(0, 10) + '...');
        break;
      }
    }
  }
  
  if (!token) {
    token = localStorage.getItem('access_token');
    if (token) {
      console.log('localStorage에서 토큰을 찾았습니다:', token.substring(0, 10) + '...');
    }
  }
  
  if (!token) {
    token = sessionStorage.getItem('access_token');
    if (token) {
      console.log('sessionStorage에서 토큰을 찾았습니다:', token.substring(0, 10) + '...');
    }
  }
  
  return token || '';
}

function showAuthErrorNotification() {
  const notification = document.createElement('div');
  notification.className = 'notification notification-error show';
  notification.innerHTML = '<span><i class="far fa-exclamation-circle"></i> 세션이 만료되었습니다. 로그인 페이지로 이동합니다...</span>';
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

function checkApiKeyStatus() {
  const apiKeyStatus = document.getElementById('api-key-status');
  if (!apiKeyStatus) return;
  
  apiRequest('/api/user/api-keys/status')
    .then(data => {
      if (data.has_api_keys) {
        apiKeyStatus.textContent = '활성화됨';
        apiKeyStatus.classList.add('text-success');
      } else {
        apiKeyStatus.textContent = '미사용중';
        apiKeyStatus.classList.add('text-muted');
      }
    })
    .catch(error => {
      if (error.message !== '인증 만료') {
        console.error('API 키 상태 확인 중 오류:', error);
        apiKeyStatus.textContent = '확인불가';
        apiKeyStatus.classList.add('text-danger');
      }
    });
}

function loadChatSessionsCount() {
  const chatSessionsCount = document.getElementById('chat-sessions-count');
  if (!chatSessionsCount) return;
  
  apiRequest('/api/chat/sessions/count')
    .then(data => {
      chatSessionsCount.textContent = data.count || '0';
    })
    .catch(error => {
      if (error.message !== '인증 만료') {
        console.error('채팅 세션 수 확인 중 오류:', error);
        chatSessionsCount.textContent = '0';
      }
    });
}

function checkLoginStatus() {
  const userInfoElement = document.querySelector('.user-name');

  if (!userInfoElement || !userInfoElement.textContent.trim()) {
    console.warn('사용자 정보가 비어 있습니다. 로그인 페이지로 이동합니다.');
    window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
    return;
  }

  const token = getAuthToken();
  console.log('현재 토큰 상태:', token ? '토큰 있음' : '토큰 없음');
}