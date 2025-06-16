document.addEventListener('DOMContentLoaded', function() {
    loadApiKeys();

    document.getElementById('submitCreateApiKey').addEventListener('click', createApiKey);
    document.getElementById('copyApiKeyBtn').addEventListener('click', copyApiKey);
    document.getElementById('confirmDeleteApiKey').addEventListener('click', deleteApiKey);
    document.getElementById('confirmViewApiKey').addEventListener('click', viewApiKey);
    document.getElementById('confirmToggleApiKey').addEventListener('click', toggleApiKeyStatus);
});

async function loadApiKeys() {
    try {
        const response = await fetch('/api/apikeys/', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('API 키 목록을 가져오는데 실패했습니다.');
        }

        const apiKeys = await response.json();
        
        const tableBody = document.getElementById('apiKeysTableBody');
        const noApiKeysMessage = document.getElementById('noApiKeysMessage');
        const apiKeysTable = document.getElementById('apiKeysTable');
        
        tableBody.innerHTML = '';
        
        if (apiKeys.length === 0) {
            noApiKeysMessage.classList.remove('d-none');
            apiKeysTable.classList.add('d-none');
        } else {
            noApiKeysMessage.classList.add('d-none');
            apiKeysTable.classList.remove('d-none');
            
            apiKeys.forEach(key => {
                const row = document.createElement('tr');
                
                const nameCell = document.createElement('td');
                nameCell.textContent = key.name;
                row.appendChild(nameCell);
                
                const createdCell = document.createElement('td');
                createdCell.textContent = formatDate(key.created_at);
                row.appendChild(createdCell);
                
                const lastUsedCell = document.createElement('td');
                lastUsedCell.textContent = key.last_used_at ? formatDate(key.last_used_at) : '사용 기록 없음';
                row.appendChild(lastUsedCell);
                
                const countCell = document.createElement('td');
                countCell.textContent = key.request_count;
                row.appendChild(countCell);
                
                const statusCell = document.createElement('td');
                const statusBadge = document.createElement('span');
                statusBadge.classList.add('badge', key.is_active ? 'badge-success' : 'badge-danger');
                statusBadge.textContent = key.is_active ? '활성' : '비활성';
                statusCell.appendChild(statusBadge);
                row.appendChild(statusCell);
                
                const actionsCell = document.createElement('td');
                actionsCell.className = 'actions-cell';
                
                const viewBtn = document.createElement('button');
                viewBtn.className = 'btn btn-info btn-sm mr-1';
                viewBtn.innerHTML = '<i class="fas fa-eye"></i>';
                viewBtn.title = 'API 키 보기';
                viewBtn.addEventListener('click', () => showViewApiKeyModal(key.id));
                actionsCell.appendChild(viewBtn);
                
                const toggleBtn = document.createElement('button');
                toggleBtn.className = `btn ${key.is_active ? 'btn-warning' : 'btn-success'} btn-sm mr-1`;
                toggleBtn.innerHTML = key.is_active ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
                toggleBtn.title = key.is_active ? 'API 키 비활성화' : 'API 키 활성화';
                toggleBtn.addEventListener('click', () => showToggleApiKeyModal(key.id, key.is_active, key.name));
                actionsCell.appendChild(toggleBtn);
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn btn-danger btn-sm';
                deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
                deleteBtn.title = 'API 키 삭제';
                deleteBtn.addEventListener('click', () => showDeleteApiKeyModal(key.id, key.name));
                actionsCell.appendChild(deleteBtn);
                
                row.appendChild(actionsCell);
                
                tableBody.appendChild(row);
            });
        }
    } catch (error) {
        console.error('API 키 목록 로딩 오류:', error);
        showNotification('오류', 'API 키 목록을 가져오는데 실패했습니다.', 'error');
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

async function createApiKey() {
    const nameInput = document.getElementById('keyName');
    const passwordInput = document.getElementById('userPassword');
    
    if (!nameInput.value.trim()) {
        showNotification('오류', 'API 키 이름을 입력하세요.', 'error');
        return;
    }
    
    if (!passwordInput.value) {
        showNotification('오류', '비밀번호를 입력하세요.', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/apikeys/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: nameInput.value.trim(),
                user_password: passwordInput.value
            }),
            credentials: 'include'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'API 키 생성에 실패했습니다.');
        }
        
        const apiKey = await response.json();
        
        $('#createApiKeyModal').modal('hide');
        
        document.getElementById('createApiKeyForm').reset();
        
        showApiKey(apiKey.token);
        
        loadApiKeys();
        
    } catch (error) {
        console.error('API 키 생성 오류:', error);
        showNotification('오류', error.message, 'error');
    }
}

function showApiKey(token) {
    document.getElementById('apiKeyToken').value = token;
    $('#showApiKeyModal').modal('show');
}

function copyApiKey() {
    const apiKeyInput = document.getElementById('apiKeyToken');
    apiKeyInput.select();
    document.execCommand('copy');
    
    showNotification('성공', 'API 키가 클립보드에 복사되었습니다.', 'success');
}

function showDeleteApiKeyModal(keyId, keyName) {
    document.getElementById('deleteApiKeyId').value = keyId;
    document.getElementById('deleteKeyName').textContent = keyName;
    $('#deleteApiKeyModal').modal('show');
}

async function deleteApiKey() {
    const keyId = document.getElementById('deleteApiKeyId').value;
    const password = document.getElementById('deleteUserPassword').value;
    
    if (!password) {
        showNotification('오류', '비밀번호를 입력하세요.', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/apikeys/${keyId}?user_password=${encodeURIComponent(password)}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'API 키 삭제에 실패했습니다.');
        }
        
        $('#deleteApiKeyModal').modal('hide');
        document.getElementById('deleteApiKeyForm').reset();
        showNotification('성공', 'API 키가 삭제되었습니다.', 'success');
        loadApiKeys();
        
    } catch (error) {
        console.error('API 키 삭제 오류:', error);
        showNotification('오류', error.message, 'error');
    }
}

function showViewApiKeyModal(keyId) {
    document.getElementById('viewApiKeyId').value = keyId;
    $('#viewApiKeyModal').modal('show');
}

async function viewApiKey() {
    const keyId = document.getElementById('viewApiKeyId').value;
    const password = document.getElementById('viewUserPassword').value;
    
    if (!password) {
        showNotification('오류', '비밀번호를 입력하세요.', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/apikeys/${keyId}/token?user_password=${encodeURIComponent(password)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'API 키 조회에 실패했습니다.');
        }
        
        const apiKey = await response.json();
        
        $('#viewApiKeyModal').modal('hide');
        document.getElementById('viewApiKeyForm').reset();
        showApiKey(apiKey.token);
        
    } catch (error) {
        console.error('API 키 조회 오류:', error);
        showNotification('오류', error.message, 'error');
    }
}

function showToggleApiKeyModal(keyId, isActive, keyName) {
    document.getElementById('toggleApiKeyId').value = keyId;
    document.getElementById('toggleApiKeyStatus').value = !isActive;
    
    const message = isActive
        ? `"${keyName}" API 키를 비활성화하시겠습니까? 비활성화하면 이 키로 채팅 위젯을 사용할 수 없게 됩니다.`
        : `"${keyName}" API 키를 활성화하시겠습니까? 활성화하면 이 키로 채팅 위젯을 사용할 수 있게 됩니다.`;
    
    document.getElementById('toggleApiKeyMessage').textContent = message;
    $('#toggleApiKeyModal').modal('show');
}

async function toggleApiKeyStatus() {
    const keyId = document.getElementById('toggleApiKeyId').value;
    const newStatus = document.getElementById('toggleApiKeyStatus').value === 'true';
    
    try {
        const response = await fetch(`/api/apikeys/${keyId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                is_active: newStatus
            }),
            credentials: 'include'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'API 키 상태 변경에 실패했습니다.');
        }
        
        $('#toggleApiKeyModal').modal('hide');
        const statusText = newStatus ? '활성화' : '비활성화';
        showNotification('성공', `API 키가 ${statusText}되었습니다.`, 'success');
        loadApiKeys();
        
    } catch (error) {
        console.error('API 키 상태 변경 오류:', error);
        showNotification('오류', error.message, 'error');
    }
}

function showNotification(title, message, type = 'info') {
    const toast = document.getElementById('notificationToast');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    toast.className = 'toast';
    if (type === 'error') {
        toast.classList.add('bg-danger', 'text-white');
    } else if (type === 'success') {
        toast.classList.add('bg-success', 'text-white');
    } else {
        toast.classList.add('bg-info', 'text-white');
    }
    $('.toast').toast('show');
}
