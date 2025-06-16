document.addEventListener('DOMContentLoaded', function() {
    showLoadingState();
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    
    loadApiKeys();
    updateWidgetCodeExample();
    
    const createApiKeyModal = document.getElementById('createApiKeyModal');
    const viewApiKeyModal = document.getElementById('viewApiKeyModal');
    const deleteApiKeyModal = document.getElementById('deleteApiKeyModal');
    const createApiKeyBtn = document.getElementById('createApiKeyBtn');
    const modalCloseButtons = document.querySelectorAll('.modal-close');
    
    createApiKeyBtn.addEventListener('click', function() {
        openModal(createApiKeyModal);
    });
    
    modalCloseButtons.forEach(button => {
        button.addEventListener('click', function() {
            closeModal(this.closest('.modal'));
        });
    });
    
    window.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeAllModals();
        }
    });
    
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            closeModal(event.target);
        }
    });
    
    document.getElementById('createApiKeyForm').addEventListener('submit', function(event) {
        event.preventDefault();
        createApiKey();
    });
    
    document.getElementById('viewApiKeyForm').addEventListener('submit', function(event) {
        event.preventDefault();
        viewApiKeyToken();
    });
    
    document.getElementById('deleteApiKeyForm').addEventListener('submit', function(event) {
        event.preventDefault();
        deleteApiKey();
    });
    
    document.getElementById('cancelCreateApiKey').addEventListener('click', function() {
        closeModal(createApiKeyModal);
    });
    
    document.getElementById('cancelViewApiKey').addEventListener('click', function() {
        closeModal(viewApiKeyModal);
    });
    
    document.getElementById('cancelDeleteApiKey').addEventListener('click', function() {
        closeModal(deleteApiKeyModal);
    });
    
    document.getElementById('copyApiKeyToken').addEventListener('click', function() {
        const tokenInput = document.getElementById('apiKeyToken');
        tokenInput.select();
        document.execCommand('copy');
        showNotification('API 키가 클립보드에 복사되었습니다.');
    });
});

function loadApiKeys() {
    showLoadingState();
    
    fetch('api/apikeys/', {
        headers: {
            'Authorization': `Bearer ${getAccessToken()}`
        }
    })
    .then(response => {
        if (response.status === 401) {
            handleSessionExpired();
            return;
        }
        
        if (response.status === 404) {
            displayApiKeys([]);
            hideErrorState();
            hideLoadingState();
            return [];
        }
        
        if (!response.ok) {
            throw new Error(`API 키 목록을 불러오는데 실패했습니다 (상태: ${response.status})`);
        }
        
        return response.json();
    })
    .then(data => {
        if (data) {
            displayApiKeys(data);
            hideErrorState();
            hideLoadingState();
            updateWidgetCodeExample();
        }
    })
    .catch(error => {
        console.error('API 키 로드 오류:', error);
        showErrorState(error.message);
        hideLoadingState();
    });
}

function handleSessionExpired() {
    localStorage.removeItem('access_token');
    document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    
    showNotification('세션이 만료되었습니다. 다시 로그인해주세요.', 'warning');
    
    setTimeout(() => {
        window.location.href = '/login';
    }, 3000);
}

function getAccessToken() {
    return localStorage.getItem('access_token') || '';
}

function displayApiKeys(apiKeys) {
    const noApiKeysMessage = document.getElementById('noApiKeysMessage');
    const apiKeysTable = document.getElementById('apiKeysTable');
    const tableBody = document.getElementById('apiKeysTableBody');
    const apiKeysGrid = document.getElementById('apiKeysGrid');
    
    tableBody.innerHTML = '';
    apiKeysGrid.innerHTML = '';
    updateApiKeyStats(apiKeys);
    
    if (!apiKeys || apiKeys.length === 0) {
        noApiKeysMessage.style.display = 'block';
        apiKeysGrid.style.display = 'none';
        return;
    }
    
    noApiKeysMessage.style.display = 'none';
    apiKeysGrid.style.display = 'grid';
    
    apiKeys.forEach(key => {
        const row = document.createElement('tr');
        row.setAttribute('data-key-id', key.id);
        
        const nameCell = document.createElement('td');
        nameCell.textContent = key.name;
        row.appendChild(nameCell);
        
        const createdCell = document.createElement('td');
        const createdDate = new Date(key.created_at);
        createdCell.textContent = createdDate.toLocaleDateString('ko-KR');
        row.appendChild(createdCell);
        
        const lastUsedCell = document.createElement('td');
        if (key.last_used_at) {
            const lastUsedDate = new Date(key.last_used_at);
            lastUsedCell.textContent = lastUsedDate.toLocaleDateString('ko-KR');
        } else {
            lastUsedCell.textContent = '-';
        }
        row.appendChild(lastUsedCell);
        
        const usageCountCell = document.createElement('td');
        usageCountCell.textContent = key.usage_count;
        row.appendChild(usageCountCell);
        
        const statusCell = document.createElement('td');
        statusCell.className = 'api-key-status';
        statusCell.textContent = key.is_active ? '활성' : '비활성';
        statusCell.className = `api-key-status ${key.is_active ? 'status-active' : 'status-inactive'}`;
        row.appendChild(statusCell);
        
        const actionsCell = document.createElement('td');
        
        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn btn-outline-secondary btn-sm';
        viewBtn.innerHTML = '<i class="far fa-eye"></i>';
        viewBtn.title = 'API 키 보기';
        viewBtn.onclick = function() {
            openViewModal(key.id);
        };
        actionsCell.appendChild(viewBtn);
        
        const toggleBtn = document.createElement('button');
        toggleBtn.className = `btn ${key.is_active ? 'btn-outline-danger' : 'btn-outline-success'} btn-sm ms-2 toggle-status-btn`;
        toggleBtn.innerHTML = key.is_active ? '비활성화' : '활성화';
        toggleBtn.title = key.is_active ? 'API 키 비활성화' : 'API 키 활성화';
        toggleBtn.onclick = function() {
            toggleApiKeyStatus(key.id, key.is_active);
        };
        actionsCell.appendChild(toggleBtn);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-outline-danger btn-sm ms-2 delete-api-key-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i> 삭제';
        deleteBtn.title = 'API 키 삭제';
        deleteBtn.onclick = function() {
            openDeleteModal(key.id);
        };
        actionsCell.appendChild(deleteBtn);
        
        row.appendChild(actionsCell);
        tableBody.appendChild(row);
        
        createApiKeyCard(key, apiKeysGrid);
    });
}

function createApiKeyCard(key, container) {
    const card = document.createElement('div');
    card.className = 'api-key-card';
    card.setAttribute('data-key-id', key.id);
    
    const cardHeader = document.createElement('div');
    cardHeader.className = 'api-key-header';
    
    const cardTitle = document.createElement('h3');
    cardTitle.className = 'api-key-name';
    cardTitle.textContent = key.name || '이름 없는 API 키';
    cardHeader.appendChild(cardTitle);
    
    card.appendChild(cardHeader);
    
    const cardMeta = document.createElement('div');
    cardMeta.className = 'api-key-meta';
    
    const createdItem = document.createElement('div');
    createdItem.className = 'api-key-meta-item';
    createdItem.innerHTML = `
        <span class="api-key-meta-label">생성일</span>
        <span class="api-key-meta-value">${formatDate(key.created_at)}</span>
    `;
    cardMeta.appendChild(createdItem);
    
    const lastUsedItem = document.createElement('div');
    lastUsedItem.className = 'api-key-meta-item';
    const lastUsedText = key.last_used_at ? formatDate(key.last_used_at) : '사용 기록 없음';
    lastUsedItem.innerHTML = `
        <span class="api-key-meta-label">마지막 사용</span>
        <span class="api-key-meta-value">${lastUsedText}</span>
    `;
    cardMeta.appendChild(lastUsedItem);
    
    const usageItem = document.createElement('div');
    usageItem.className = 'api-key-meta-item';
    usageItem.innerHTML = `
        <span class="api-key-meta-label">사용 횟수</span>
        <span class="api-key-meta-value">${key.usage_count || 0}</span>
    `;
    cardMeta.appendChild(usageItem);
    
    const statusItem = document.createElement('div');
    statusItem.className = 'api-key-meta-item';
    statusItem.innerHTML = `
        <span class="api-key-meta-label">상태</span>
        <span class="status-badge ${key.is_active ? 'status-active' : 'status-inactive'}">
            <i class="far ${key.is_active ? 'fa-check-circle' : 'fa-times-circle'}"></i>
            ${key.is_active ? '활성' : '비활성'}
        </span>
    `;
    cardMeta.appendChild(statusItem);
    
    card.appendChild(cardMeta);
    
    const cardActions = document.createElement('div');
    cardActions.className = 'api-key-actions';
    
    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn btn-sm btn-outline-primary';
    viewBtn.innerHTML = '<i class="far fa-eye"></i> 보기';
    viewBtn.onclick = function() {
        openViewModal(key.id);
    };
    cardActions.appendChild(viewBtn);
    
    const toggleBtn = document.createElement('button');
    toggleBtn.className = `btn btn-sm ${key.is_active ? 'btn-outline-secondary' : 'btn-outline-success'}`;
    toggleBtn.innerHTML = key.is_active ? 
        '<i class="far fa-ban"></i> 비활성화' : 
        '<i class="far fa-check"></i> 활성화';
    toggleBtn.onclick = function() {
        toggleApiKeyStatus(key.id, key.is_active);
    };
    cardActions.appendChild(toggleBtn);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-sm btn-outline-danger';
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i> 삭제';
    deleteBtn.onclick = function() {
        openDeleteModal(key.id);
    };
    cardActions.appendChild(deleteBtn);
    
    card.appendChild(cardActions);
    container.appendChild(card);
}

function updateApiKeyStats(apiKeys) {
    const totalKeysCount = document.getElementById('totalKeysCount');
    const activeKeysCount = document.getElementById('activeKeysCount');
    const totalUsageCount = document.getElementById('totalUsageCount');
    
    if (!totalKeysCount || !activeKeysCount || !totalUsageCount) return;
    
    if (!apiKeys || apiKeys.length === 0) {
        totalKeysCount.innerHTML = '0 <span class="stat-icon"><i class="far fa-key"></i></span>';
        activeKeysCount.innerHTML = '0 <span class="stat-icon"><i class="far fa-check-circle"></i></span>';
        totalUsageCount.innerHTML = '0 <span class="stat-icon"><i class="far fa-chart-line"></i></span>';
        return;
    }
    
    totalKeysCount.innerHTML = apiKeys.length + ' <span class="stat-icon"><i class="far fa-key"></i></span>';
    
    const activeKeys = apiKeys.filter(key => key.is_active);
    activeKeysCount.innerHTML = activeKeys.length + ' <span class="stat-icon"><i class="far fa-check-circle"></i></span>';
    
    const totalUsage = apiKeys.reduce((sum, key) => sum + (key.usage_count || 0), 0);
    totalUsageCount.innerHTML = totalUsage + ' <span class="stat-icon"><i class="far fa-chart-line"></i></span>';
}

function showErrorInModal(errorContainer, message) {
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
}

function openModal(modal) {
    const errorElements = modal.querySelectorAll('.error-message');
    errorElements.forEach(el => { el.style.display = 'none'; });
    
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }, 10);
}

function closeModal(modal) {
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }, 300);
    
    const form = modal.querySelector('form');
    if (form) form.reset();
    
    const errorElements = modal.querySelectorAll('.error-message');
    errorElements.forEach(el => { el.style.display = 'none'; });
    
    if (modal.id === 'viewApiKeyModal') {
        const viewApiKeyForm = document.getElementById('viewApiKeyForm');
        const apiKeyTokenContainer = document.getElementById('apiKeyTokenContainer');
        if (viewApiKeyForm) viewApiKeyForm.style.display = 'block';
        if (apiKeyTokenContainer) apiKeyTokenContainer.style.display = 'none';
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        closeModal(modal);
    });
}

function createApiKey() {
    const name = document.getElementById('apiKeyName').value;
    const password = document.getElementById('userPassword').value;
    const errorContainer = document.getElementById('createApiKeyError');
    
    errorContainer.style.display = 'none';
    
    if (!name || name.trim() === '') {
        showErrorInModal(errorContainer, 'API 키 이름을 입력해주세요.');
        return;
    }
    
    if (!password || password.trim() === '') {
        showErrorInModal(errorContainer, '보안을 위해 비밀번호를 입력해주세요.');
        return;
    }
    
    const createBtn = document.getElementById('submitCreateApiKey');
    const originalText = createBtn.innerHTML;
    createBtn.disabled = true;
    createBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 처리중...';
    
    const data = {
        name: name,
        user_password: password
    };
    
    fetch('/api/apikeys/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAccessToken()}`
        },
        body: JSON.stringify(data)
    })
    .then(response => {
        createBtn.disabled = false;
        createBtn.innerHTML = originalText;
        
        if (response.status === 401) {
            handleSessionExpired();
            return null;
        }
        
        if (!response.ok) {
            return response.json().then(err => {
                const errorMsg = err.detail || err.message || 'API 키 생성 실패';
                throw new Error(errorMsg);
            }).catch(() => {
                throw new Error('API 키 생성 중 오류가 발생했습니다.');
            });
        }
        return response.json();
    })
    .then(data => {
        if (!data) return;
        
        document.getElementById('apiKeyName').value = '';
        document.getElementById('userPassword').value = '';
        
        closeAllModals();
        
        showNotification('API 키가 성공적으로 생성되었습니다.', 'success');
        
        loadApiKeys();
        
        setTimeout(() => {
            if (data.token) {
                document.getElementById('apiKeyToken').value = data.token;
                document.getElementById('apiKeyTokenContainer').style.display = 'block';
                openModal(document.getElementById('viewApiKeyModal'));
            }
        }, 500);
    })
    .catch(error => {
        createBtn.disabled = false;
        createBtn.innerHTML = originalText;
        showErrorInModal(errorContainer, error.message);
        showNotification('오류: ' + error.message, 'error');
    });
}

function showNotification(message, type = 'info') {
    if (!message) return;
    
    const notificationContainer = document.getElementById('notificationContainer') || createNotificationContainer();
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-icon">
            <i class="far ${getNotificationIcon(type)}"></i>
        </div>
        <div class="notification-message">${message}</div>
        <button class="notification-close">
            <i class="far fa-times"></i>
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

function createNotificationContainer() {
    const container = document.createElement('div');
    container.id = 'notificationContainer';
    container.className = 'notification-container';
    document.body.appendChild(container);
    return container;
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success':
            return 'fa-check-circle';
        case 'error':
            return 'fa-exclamation-circle';
        case 'warning':
            return 'fa-exclamation-triangle';
        case 'info':
        default:
            return 'fa-info-circle';
    }
}

function showLoadingState() {
    const apiKeysTable = document.getElementById('apiKeysTable');
    const noApiKeysMessage = document.getElementById('noApiKeysMessage');
    const apiKeysLoading = document.getElementById('apiKeysLoading');
    const apiKeysError = document.getElementById('apiKeysError');
    const apiKeysGrid = document.getElementById('apiKeysGrid');
    
    if (apiKeysGrid) apiKeysGrid.style.display = 'none';
    if (apiKeysTable) apiKeysTable.style.display = 'none';
    if (noApiKeysMessage) noApiKeysMessage.style.display = 'none';
    if (apiKeysError) apiKeysError.style.display = 'none';
    
    if (apiKeysLoading) {
        apiKeysLoading.style.display = 'flex';
        apiKeysLoading.innerHTML = `
            <i class="fas fa-spinner fa-spin"></i>
            <span>API 키 정보를 불러오는 중...</span>
        `;
    }
    
    const statsLoading = document.querySelectorAll('.stat-value');
    statsLoading.forEach(stat => {
        stat.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    });
    
    const widgetCodeContainer = document.getElementById('widgetCodeExample');
    if (widgetCodeContainer) {
        widgetCodeContainer.innerHTML = '<div class="text-center py-3"><i class="fas fa-spinner fa-spin me-2"></i>로딩중...</div>';
    }
}

function hideLoadingState() {
    const apiKeysLoading = document.getElementById('apiKeysLoading');
    
    if (apiKeysLoading) {
        apiKeysLoading.style.display = 'none';
    }
    
    const widgetCodeContainer = document.getElementById('widgetCodeExample');
    if (widgetCodeContainer && widgetCodeContainer.textContent.includes('로딩중')) {
        updateWidgetCodeExample();
    }
}

function showErrorState(errorMessage) {
    const errorContainer = document.getElementById('errorContainer');
    const apiKeysGrid = document.getElementById('apiKeysGrid');
    const noApiKeysMessage = document.getElementById('noApiKeysMessage');
    const loadingContainer = document.getElementById('loadingContainer');
    
    if (apiKeysGrid) apiKeysGrid.style.display = 'none';
    if (noApiKeysMessage) noApiKeysMessage.style.display = 'none';
    if (loadingContainer) loadingContainer.style.display = 'none';
    
    if (errorContainer) {
        errorContainer.style.display = 'flex';
        errorContainer.innerHTML = `
            <div class="error-container">
                <div class="error-icon">
                    <i class="fas fa-exclamation-circle"></i>
                </div>
                <div class="error-message">${errorMessage}</div>
                <button class="btn btn-outline-primary" onclick="retryLoadApiKeys()">
                    <i class="fas fa-redo"></i> 다시 시도
                </button>
            </div>
        `;
    }
    hideLoadingState();
    
    const apiKeysList = document.getElementById('apiKeysList');
    if (apiKeysList) {
        const existingError = apiKeysList.querySelector('.error-container');
        if (existingError) existingError.remove();
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-container';
        errorDiv.innerHTML = `
            <div class="error-icon"><i class="far fa-exclamation-circle"></i></div>
            <div class="error-message">${errorMessage}</div>
            <button class="btn btn-primary" onclick="loadApiKeys()">다시 시도</button>
        `;
        apiKeysList.appendChild(errorDiv);
    }
}

function hideErrorState() {
    const errorContainer = document.querySelector('.error-container');
    if (errorContainer) {
        errorContainer.remove();
    }
}

function retryLoadApiKeys() {
    loadApiKeys();
}

function openViewModal(keyId) {
    const viewApiKeyModal = document.getElementById('viewApiKeyModal');
    const viewApiKeyForm = document.getElementById('viewApiKeyForm');
    const apiKeyTokenContainer = document.getElementById('apiKeyTokenContainer');
    const apiKeyIdInput = document.getElementById('viewApiKeyId');
    const errorContainer = document.getElementById('viewApiKeyError');
    const passwordInput = document.getElementById('viewUserPassword');
    
    viewApiKeyForm.style.display = 'block';
    apiKeyTokenContainer.style.display = 'none';
    passwordInput.value = '';
    
    apiKeyIdInput.value = keyId;
    errorContainer.style.display = 'none';
    
    openModal(viewApiKeyModal);
    
    if (viewApiKeyForm) {
        const clonedForm = viewApiKeyForm.cloneNode(true);
        if (viewApiKeyForm.parentNode) {
            viewApiKeyForm.parentNode.replaceChild(clonedForm, viewApiKeyForm);
        }
        
        clonedForm.addEventListener('submit', function(e) {
            e.preventDefault();
            viewApiKeyToken(keyId);
        });
    }
    
    const cancelButton = document.getElementById('cancelViewApiKey');
    if (cancelButton) {
        cancelButton.onclick = function() {
            closeModal(viewApiKeyModal);
        };
    }
    
    const closeButton = viewApiKeyModal.querySelector('.modal-close');
    if (closeButton) {
        closeButton.onclick = function() {
            closeModal(viewApiKeyModal);
        };
    }
}

function viewApiKeyToken(keyId) {
    const password = document.getElementById('viewUserPassword').value;
    const submitBtn = document.getElementById('submitViewApiKey');
    const errorContainer = document.getElementById('viewApiKeyError');
    const apiKeyTokenContainer = document.getElementById('apiKeyTokenContainer');
    
    apiKeyTokenContainer.style.display = 'none';
    
    errorContainer.style.display = 'none';
    if (!password || password.trim() === '') {
        showErrorInModal(errorContainer, '보안을 위해 비밀번호를 입력해주세요.');
        return;
    }
    
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 확인 중...';

    fetch(`/api/apikeys/${keyId}/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAccessToken()}`
        },
        body: JSON.stringify({
            user_password: password
        })
    })
    .then(response => {
        if (response.status === 401) {
            handleSessionExpired();
            throw new Error('세션이 만료되었습니다.');
        }
        
        if (response.status === 403) {
            throw new Error('비밀번호가 올바르지 않거나 이 API 키를 볼 권한이 없습니다.');
        }
        
        if (!response.ok) {
            throw new Error(`API 키 정보를 불러오는데 실패했습니다. (${response.status})`);
        }
        
        return response.json();
    })
    .then(data => {
        if (!data) {
            throw new Error('API 키 데이터가 없습니다.');
        }
        
        document.getElementById('viewApiKeyForm').style.display = 'none';
        
        const token = data.token || data.key || data.api_key || data.apiKey || data.value || '';
        
        if (token) {
            document.getElementById('apiKeyToken').value = token;
            apiKeyTokenContainer.style.display = 'block';
            
            const copyBtn = document.getElementById('copyApiKeyToken');
            if (copyBtn) {
                copyBtn.onclick = function() {
                    const tokenInput = document.getElementById('apiKeyToken');
                    tokenInput.select();
                    document.execCommand('copy');
                    showNotification('API 토큰이 클립보드에 복사되었습니다.', 'success');
                };
            }
            
            const closeViewModalBtn = document.getElementById('closeViewApiKeyModal');
            if (closeViewModalBtn) {
                closeViewModalBtn.onclick = function() {
                    closeModal(document.getElementById('viewApiKeyModal'));
                };
            }
        } else {
            showErrorInModal(errorContainer, 'API 키를 찾을 수 없습니다.');
            document.getElementById('viewApiKeyForm').style.display = 'block';
        }
    })
    .catch(error => {
        console.error('API 키 조회 오류:', error);
        showErrorInModal(errorContainer, error.message || 'API 키 조회 중 오류가 발생했습니다.');
        document.getElementById('viewApiKeyForm').style.display = 'block';
    })
    .finally(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    });
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const koreaTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    return koreaTime.toLocaleDateString('ko-KR') + ' ' + 
           koreaTime.toLocaleTimeString('ko-KR', {hour: '2-digit', minute:'2-digit'});
}

function toggleApiKeyStatus(keyId, currentStatus) {
    const newStatus = !currentStatus;
    const action = newStatus ? '활성화' : '비활성화';
    
    updateApiKeyStatusInUI(keyId, newStatus);
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
    };
    
    fetch(`/api/apikeys/${keyId}/toggle-status`, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify({ is_active: newStatus })
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else if (response.status === 401) {
            handleSessionExpired();
            throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
        }
        throw new Error(`서버에서 오류가 발생했습니다: ${response.status}`);
    })
    .then(data => {
        showNotification(`API 키가 ${action}되었습니다.`, 'success');
    })
    .catch(error => {
        console.error('API 키 상태 변경 오류:', error);
        updateApiKeyStatusInUI(keyId, currentStatus);
        showNotification(`API 키 ${action} 실패: ${error.message}`, 'error');
    });
}

function openToggleStatusModal(keyId, newStatus, action) {
    const toggleStatusModal = document.getElementById('toggleStatusApiKeyModal');
    const toggleStatusForm = document.getElementById('toggleStatusApiKeyForm');
    const toggleStatusError = document.getElementById('toggleStatusApiKeyError');
    const toggleStatusModalTitle = document.getElementById('toggleStatusModalTitle');
    const toggleStatusWarningText = document.getElementById('toggleStatusWarningText');
    const toggleStatusApiKeyId = document.getElementById('toggleStatusApiKeyId');
    const toggleStatusNewStatus = document.getElementById('toggleStatusNewStatus');
    
    toggleStatusError.style.display = 'none';
    document.getElementById('toggleStatusUserPassword').value = '';
    
    toggleStatusModalTitle.textContent = `API 키 ${action}`;
    toggleStatusWarningText.textContent = `API 키를 ${action}하면 해당 키를 사용하는 서비스에 ${action} 상태가 적용됩니다.`;
    
    toggleStatusApiKeyId.value = keyId;
    toggleStatusNewStatus.value = newStatus;
    
    openModal(toggleStatusModal);
    
    if (toggleStatusForm) {
        const clonedForm = toggleStatusForm.cloneNode(true);
        if (toggleStatusForm.parentNode) {
            toggleStatusForm.parentNode.replaceChild(clonedForm, toggleStatusForm);
        }
        
        clonedForm.addEventListener('submit', function(e) {
            e.preventDefault();
            confirmToggleApiKeyStatus();
        });
    }
    
    const cancelButton = document.getElementById('cancelToggleStatusApiKey');
    if (cancelButton) {
        cancelButton.onclick = function() {
            closeModal(toggleStatusModal);
        };
    }
    
    const closeButton = toggleStatusModal.querySelector('.modal-close');
    if (closeButton) {
        closeButton.onclick = function() {
            closeModal(toggleStatusModal);
        };
    }
}

function confirmToggleApiKeyStatus() {
    const keyId = document.getElementById('toggleStatusApiKeyId').value;
    const newStatus = document.getElementById('toggleStatusNewStatus').value === 'true';
    const password = document.getElementById('toggleStatusUserPassword').value;
    const errorContainer = document.getElementById('toggleStatusApiKeyError');
    const action = newStatus ? '활성화' : '비활성화';
    
    errorContainer.style.display = 'none';
    if (!password || password.trim() === '') {
        showErrorInModal(errorContainer, '보안을 위해 비밀번호를 입력해주세요.');
        return;
    }
    
    const confirmBtn = document.getElementById('confirmToggleStatusApiKey');
    const originalText = confirmBtn.innerHTML;
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${action}중...`;
    
    const toggleBtn = document.querySelector(`.api-key-card[data-key-id="${keyId}"] button:nth-child(2), [data-key-id="${keyId}"] .toggle-status-btn`);
    const toggleBtnOriginalText = toggleBtn ? toggleBtn.innerHTML : '';
    const toggleCardBtn = document.querySelector(`.api-key-card[data-key-id="${keyId}"] button:nth-child(2)`);
    const toggleCardBtnOriginalText = toggleCardBtn ? toggleCardBtn.innerHTML : '';
    
    if (toggleBtn) {
        toggleBtn.disabled = true;
        toggleBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${action}중...`;
    }
    
    if (toggleCardBtn && toggleCardBtn !== toggleBtn) {
        toggleCardBtn.disabled = true;
        toggleCardBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${action}중...`;
    }
    
    const toggleStatusModal = document.getElementById('toggleStatusApiKeyModal');
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
    };
    
    fetch(`/api/apikeys/${keyId}`, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify({
            is_active: newStatus,
            user_password: password
        })
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else if (response.status === 401) {
            handleSessionExpired();
            throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
        }
        
        return fetch(`/api/apikeys/${keyId}`, {
            method: 'PATCH',
            headers: headers,
            body: JSON.stringify({
                is_active: newStatus,
                user_password: password
            })
        }).then(patchResponse => {
            if (patchResponse.ok) {
                return patchResponse.json();
            }
            
            throw new Error(`서버에서 오류가 발생했습니다: ${patchResponse.status}`);
        });
    })
    .then(data => {
        updateApiKeyStatusInUI(keyId, newStatus);
        closeModal(toggleStatusModal);
        showNotification(`API 키가 ${action}되었습니다.`, 'success');
    })
    .catch(error => {
        console.error('API 키 상태 변경 오류:', error);
        showErrorInModal(errorContainer, `API 키 ${action} 실패: ${error.message}`);
    })
    .finally(() => {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalText;
        
        resetAllToggleButtons(keyId, newStatus);
    });
}

function resetAllToggleButtons(keyId, isActive) {
    const rowToggleBtn = document.querySelector(`tr[data-key-id="${keyId}"] .toggle-status-btn`);
    if (rowToggleBtn) {
        rowToggleBtn.disabled = false;
        rowToggleBtn.innerHTML = isActive ? 
            '<i class="fas fa-toggle-on"></i> 비활성화' : 
            '<i class="fas fa-toggle-off"></i> 활성화';
    }
    
    const cardToggleBtn = document.querySelector(`.api-key-card[data-key-id="${keyId}"] button:nth-child(2)`);
    if (cardToggleBtn) {
        cardToggleBtn.disabled = false;
        cardToggleBtn.innerHTML = isActive ? 
            '<i class="far fa-ban"></i> 비활성화' : 
            '<i class="far fa-check"></i> 활성화';
    }
}

function updateApiKeyStatusInUI(keyId, isActive) {
    const keyRow = document.querySelector(`tr[data-key-id="${keyId}"]`);
    const keyCard = document.querySelector(`.api-key-card[data-key-id="${keyId}"]`);
    
    if (keyRow) {
        const statusCell = keyRow.querySelector('.api-key-status');
        const toggleBtn = keyRow.querySelector('.toggle-status-btn');
        
        if (statusCell) {
            statusCell.textContent = isActive ? '활성 상태입니다' : '현재 비활성화됨';
            statusCell.className = `api-key-status ${isActive ? 'status-active' : 'status-inactive'}`;
        }
        
        if (toggleBtn) {
            toggleBtn.innerHTML = isActive ? 
                '<i class="fas fa-toggle-on"></i> 비활성화' : 
                '<i class="fas fa-toggle-off"></i> 활성화';
            toggleBtn.title = isActive ? 'API 키 비활성화' : 'API 키 활성화';
            toggleBtn.className = `btn ${isActive ? 'btn-outline-danger' : 'btn-outline-success'} btn-sm ms-2 toggle-status-btn`;
            toggleBtn.disabled = false;
            toggleBtn.setAttribute('data-active', isActive.toString());
            toggleBtn.onclick = () => toggleApiKeyStatus(keyId, isActive);
        }
    }
    
    if (keyCard) {
        const statusBadge = keyCard.querySelector('.status-badge');
        const toggleBtn = keyCard.querySelector('.btn-outline-secondary, .btn-outline-success');
        
        if (statusBadge) {
            statusBadge.className = `status-badge ${isActive ? 'status-active' : 'status-inactive'}`;
            statusBadge.innerHTML = `
                <i class="far ${isActive ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                ${isActive ? '활성 상태입니다' : '현재 비활성화됨'}
            `;
        }
        
        if (toggleBtn) {
            toggleBtn.innerHTML = isActive ? 
                '<i class="far fa-ban"></i> 비활성화' : 
                '<i class="far fa-check"></i> 활성화';
            toggleBtn.className = `btn btn-sm ${isActive ? 'btn-outline-secondary' : 'btn-outline-success'}`;
            toggleBtn.disabled = false;
            toggleBtn.onclick = () => toggleApiKeyStatus(keyId, isActive);
        }
    }
    
    const apiKeys = [];
    document.querySelectorAll('[data-key-id]').forEach(element => {
        const id = element.getAttribute('data-key-id');
        const isCurrentId = id === keyId;
        const active = isCurrentId ? isActive : element.querySelector('.status-badge').classList.contains('status-active');
        
        if (!apiKeys.some(k => k.id === id)) {
            apiKeys.push({
                id: id,
                is_active: active
            });
        }
    });
    
    updateApiKeyStats(apiKeys);
}

function openDeleteModal(keyId) {
    const deleteApiKeyModal = document.getElementById('deleteApiKeyModal');
    const deleteApiKeyForm = document.getElementById('deleteApiKeyForm');
    const deleteApiKeyId = document.getElementById('deleteApiKeyId');
    const deleteApiKeyError = document.getElementById('deleteApiKeyError');
    
    deleteApiKeyError.style.display = 'none';
    document.getElementById('deleteUserPassword').value = '';
    
    if (deleteApiKeyId) {
        deleteApiKeyId.value = keyId;
    }
    
    openModal(deleteApiKeyModal);
    
    if (deleteApiKeyForm) {
        const clonedForm = deleteApiKeyForm.cloneNode(true);
        if (deleteApiKeyForm.parentNode) {
            deleteApiKeyForm.parentNode.replaceChild(clonedForm, deleteApiKeyForm);
        }
        
        clonedForm.addEventListener('submit', function(e) {
            e.preventDefault();
            deleteApiKey(keyId);
        });
    }
    
    const cancelButton = document.getElementById('cancelDeleteApiKey');
    if (cancelButton) {
        cancelButton.onclick = function() {
            closeModal(deleteApiKeyModal);
        };
    }
    
    const closeButton = deleteApiKeyModal.querySelector('.modal-close');
    if (closeButton) {
        closeButton.onclick = function() {
            closeModal(deleteApiKeyModal);
        };
    }
}

function deleteApiKey(keyId) {
    const password = document.getElementById('deleteUserPassword').value;
    const errorContainer = document.getElementById('deleteApiKeyError');
    
    errorContainer.style.display = 'none';
    
    if (!password || password.trim() === '') {
        showErrorInModal(errorContainer, '보안을 위해 비밀번호를 입력해주세요.');
        return;
    }
    
    const deleteBtn = document.getElementById('confirmDeleteApiKey');
    const originalText = deleteBtn.innerHTML;
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 삭제중...';
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAccessToken()}`
    };

    fetch(`/dashboard/api/apikeys/${keyId}?user_password=${encodeURIComponent(password)}`, {
        method: 'DELETE',
        headers: headers
    })
    .then(async response => {
        if (response.status === 401) {
            handleSessionExpired();
            throw new Error('세션이 만료되었습니다.');
        }
        
        if (response.status === 403) {
            throw new Error('비밀번호가 올바르지 않거나 권한이 없습니다.');
        }
        
        if (!response.ok) {
            if (response.status === 422 || response.status === 405) {
                const altResponse = await fetch(`/api/apikeys/${keyId}/delete`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        user_password: password
                    })
                });
                
                if (altResponse.ok) {
                    return altResponse;
                }
                
                throw new Error(`대체 삭제 요청 실패: ${altResponse.status}`);
            }
            throw new Error(`삭제 요청 실패: ${response.status}`);
        }
        
        return response;
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`서버 오류: ${response.status}`);
        }
        
        const deleteApiKeyModal = document.getElementById('deleteApiKeyModal');
        removeApiKeyFromUI(keyId);
        
        document.getElementById('deleteUserPassword').value = '';
        closeModal(deleteApiKeyModal);
        
        showNotification('API 키가 성공적으로 삭제되었습니다.', 'success');
    })
    .catch(error => {
        console.error('API 키 삭제 오류:', error);
        showErrorInModal(errorContainer, error.message || 'API 키 삭제 중 오류가 발생했습니다.');
    })
    .finally(() => {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = originalText;
    });
}

function updateApiKeyStatusInUI(keyId, isActive) {
    const keyCard = document.querySelector(`[data-key-id="${keyId}"]`);
    if (keyCard) {
        const statusBadge = keyCard.querySelector('.status-badge');
        if (statusBadge) {
            statusBadge.className = `status-badge ${isActive ? 'status-active' : 'status-inactive'}`;
            statusBadge.innerHTML = isActive ? 
                '<i class="fas fa-check-circle"></i> 활성화' : 
                '<i class="fas fa-times-circle"></i> 비활성화';
        }
        
        const toggleBtn = keyCard.querySelector('.toggle-status-btn');
        if (toggleBtn) {
            toggleBtn.innerHTML = isActive ? 
                '<i class="fas fa-toggle-on"></i> 비활성화' : 
                '<i class="fas fa-toggle-off"></i> 활성화';
            toggleBtn.disabled = false;
            toggleBtn.setAttribute('data-active', isActive.toString());
        }
    }
}

function removeApiKeyFromUI(keyId) {
    const tableRow = document.querySelector(`tr[data-key-id="${keyId}"]`);
    if (tableRow) {
        tableRow.remove();
    }
        
    const card = document.querySelector(`.api-key-card[data-key-id="${keyId}"]`);
    if (card) {
        card.remove();
    }
    
    const remainingKeys = document.querySelectorAll('[data-key-id]');
    if (remainingKeys.length === 0) {
        const noApiKeysMessage = document.getElementById('noApiKeysMessage');
        if (noApiKeysMessage) {
            noApiKeysMessage.style.display = 'flex';
        }
        
        const apiKeysGrid = document.getElementById('apiKeysGrid');
        if (apiKeysGrid) {
            apiKeysGrid.style.display = 'none';
        }
    }
    
    fetch('/api/apikeys/', {
        headers: {
            'Authorization': `Bearer ${getAccessToken()}`
        }
    })
    .then(response => {
        if (response.ok) return response.json();
        return [];
    })
    .then(data => {
        updateApiKeyStats(data || []);
    })
    .catch(error => {
        console.error('API 키 통계 업데이트 오류:', error);
        updateApiKeyStats([]);
    });
}

function updateWidgetCodeExample() {
    const widgetCodeContainer = document.getElementById('widgetCodeExample');
    if (!widgetCodeContainer) return;
    
    const exampleCode = `
<script src="http://127.0.0.1:8000/widget.js" defer></script>
<script>
window.refitSettings = {
  apiKey: "YOUR_API_KEY",
  position: "bottom-right",
  welcomeMessage: "안녕하세요! 무엇을 도와드릴까요?",
  backgroundColor: "#0d6efd",
  textColor: "#ffffff"
};
</script>`;
    
    const escapedCode = exampleCode
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    
    widgetCodeContainer.textContent = '';
    widgetCodeContainer.innerHTML = escapedCode;
    
    const codeBlock = document.getElementById('widget-code-container');
    if (!codeBlock) return;
    
    const existingBtn = codeBlock.querySelector('.copy-code-btn');
    if (existingBtn) {
        existingBtn.remove();
    }
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-code-btn';
    copyBtn.innerHTML = '<i class="far fa-copy"></i> 복사';
    
    copyBtn.onclick = function() {
        navigator.clipboard.writeText(exampleCode)
            .then(() => {
                this.innerHTML = '<i class="far fa-check"></i> 복사됨';
                setTimeout(() => {
                    this.innerHTML = '<i class="far fa-copy"></i> 복사';
                }, 2000);
            })
            .catch(err => {
                const tempElement = document.createElement('textarea');
                tempElement.value = exampleCode;
                tempElement.style.position = 'absolute';
                tempElement.style.left = '-9999px';
                document.body.appendChild(tempElement);
                tempElement.select();
                document.execCommand('copy');
                document.body.removeChild(tempElement);
                
                this.innerHTML = '<i class="far fa-check"></i> 복사됨';
                setTimeout(() => {
                    this.innerHTML = '<i class="far fa-copy"></i> 복사';
                }, 2000);
            });
    };
    
    codeBlock.appendChild(copyBtn);
    
    const codeStyle = document.createElement('style');
    codeStyle.textContent = `
        #widget-code-container {
            position: relative;
            margin: 20px 0;
            background-color: #f8f9fa;
            border-radius: 6px;
            border: 1px solid #e9ecef;
        }
        
        #widgetCodeExample {
            padding: 15px;
            margin: 0;
            white-space: pre-wrap;
            word-break: break-word;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
            font-size: 14px;
            line-height: 1.5;
            color: #212529;
        }
        
        .copy-code-btn {
            position: absolute;
            top: 10px;
            right: 10px;
            background-color: #e9ecef;
            border: none;
            border-radius: 4px;
            padding: 6px 10px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .copy-code-btn:hover {
            background-color: #dee2e6;
        }
    `;
    
    document.head.appendChild(codeStyle);
}
