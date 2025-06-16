document.addEventListener('DOMContentLoaded', function() {
  showAuthForm();
  initializeEventListeners();
  initPasswordValidation();
  updateAddCategoryButtonState();
  initFormChangeDetection();
});

function showAuthForm() {
  document.getElementById('auth-container').style.display = 'block';
  document.getElementById('profile-container').style.display = 'none';
  document.getElementById('auth-password').value = '';
}

function showProfileForm() {
  document.getElementById('auth-container').style.display = 'none';
  document.getElementById('profile-container').style.display = 'block';
}

let originalFormData = {
  fullname: '',
  newPassword: '',
  confirmPassword: '',
  categories: ''
};

let formChanged = false;

function initFormChangeDetection() {
  if (document.getElementById('profile-form')) {
    originalFormData.fullname = document.getElementById('fullname').value;
    originalFormData.categories = document.getElementById('categories').value;
    
    document.getElementById('fullname').addEventListener('input', function() {
      checkFormChanged();
      updateSubmitButtonState();
    });
    
    document.getElementById('new-password').addEventListener('input', checkFormChanged);
    document.getElementById('confirm-password').addEventListener('input', checkFormChanged);
    
    updateSubmitButtonState();
  }
}

function checkFormChanged() {
  if (!document.getElementById('profile-form')) return;
  
  const currentFullname = document.getElementById('fullname').value;
  const currentNewPassword = document.getElementById('new-password').value;
  const currentCategories = document.getElementById('categories').value;
  
  formChanged = 
    currentFullname !== originalFormData.fullname ||
    currentNewPassword !== '' ||
    currentCategories !== originalFormData.categories;
  
  updateSubmitButtonState();
}

function updateSubmitButtonState() {
  const submitBtn = document.querySelector('#profile-form button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = !formChanged;
    
    if (!formChanged) {
      submitBtn.classList.add('btn-disabled');
    } else {
      submitBtn.classList.remove('btn-disabled');
    }
  }
}

function initializeEventListeners() {
  const authForm = document.getElementById('auth-form');
  if (authForm) {
    authForm.addEventListener('submit', function(e) {
      e.preventDefault();
      handleAuthSubmit();
    });
  }

  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', function(e) {
      e.preventDefault();
      handleProfileSubmit();
    });
  }

  const addCategoryBtn = document.getElementById('add-category-btn');
  if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', addCategory);
  }

  const categoryInput = document.getElementById('category-input');
  if (categoryInput) {
    categoryInput.addEventListener('input', updateAddCategoryButtonState);
    categoryInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (document.getElementById('add-category-btn').disabled === false) {
          addCategory();
        }
      }
    });
  }
  
  const checkFullnameBtn = document.getElementById('check-fullname-btn');
  if (checkFullnameBtn) {
    checkFullnameBtn.style.display = 'none';
  }
  
  initCategoryRemoveEvents();
}

function initCategoryRemoveEvents() {
  const removeButtons = document.querySelectorAll('.category-remove');
  removeButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      const categoryItem = this.closest('.category-item');
      if (categoryItem) {
        categoryItem.remove();
        updateCategoriesValue();
      }
    });
  });
}

function handleAuthSubmit() {
  const password = document.getElementById('auth-password').value;
  
  if (!password) {
    showMessage('비밀번호를 입력해주세요.', 'error');
    return;
  }

  fetch('/api/verify-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showProfileForm();
    } else {
      showMessage('비밀번호가 일치하지 않습니다.', 'error');
    }
  })
  .catch(error => {
    showMessage('오류가 발생했습니다. 다시 시도해주세요.', 'error');
    console.error('Error:', error);
  });
}

function handleProfileSubmit() {
  const fullname = document.getElementById('fullname').value;
  const businessName = document.getElementById('business-name').value;
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  const categories = document.getElementById('categories').value;
  
  if (!fullname) {
    showMessage('이름을 입력해주세요.', 'error');
    return;
  }

  if (!businessName) {
    showMessage('사업자명을 입력해주세요.', 'error');
    return;
  }

  if (newPassword) {
    if (!validatePassword(newPassword)) {
      showMessage('비밀번호가 조건을 충족하지 않습니다.', 'error');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      showMessage('비밀번호가 일치하지 않습니다.', 'error');
      return;
    }
  }
  
  const formData = {
    fullname: fullname,
    business_name: businessName,
    categories: categories
  };
  
  if (newPassword) {
    formData.new_password = newPassword;
  }
  
  fetch('/api/update-profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(formData)
  })
  .then(response => {
    if (!response.ok) {
      return response.json().then(data => {
        throw new Error(data.detail || '정보 수정에 실패했습니다.');
      });
    }
    return response.json();
  })
  .then(data => {
    showMessage(data.message || '정보가 성공적으로 업데이트되었습니다.', 'success');
    setTimeout(() => {
      window.location.href = '/dashboard/profile';
    }, 1500);
  })
  .catch(error => {
    console.error('Error:', error);
    showMessage(error.message, 'error');
  });
}

function updateAddCategoryButtonState() {
  const categoryInput = document.getElementById('category-input');
  const addCategoryBtn = document.getElementById('add-category-btn');
  
  if (categoryInput && addCategoryBtn) {
    const categoryText = categoryInput.value.trim();
    addCategoryBtn.disabled = !categoryText;
    
    if (!categoryText) {
      addCategoryBtn.classList.add('btn-disabled');
    } else {
      addCategoryBtn.classList.remove('btn-disabled');
      addCategoryBtn.style.backgroundColor = 'var(--primary-color)';
      addCategoryBtn.style.borderColor = 'var(--primary-color)';
      addCategoryBtn.style.color = 'white';
      addCategoryBtn.style.opacity = '1';
    }
  }
}

function addCategory() {
  const categoryInput = document.getElementById('category-input');
  const categoryText = categoryInput.value.trim();
  
  if (!categoryText) return;

  const existingCategories = document.querySelectorAll('.category-text');
  for (const cat of existingCategories) {
    if (cat.textContent.toLowerCase() === categoryText.toLowerCase()) {
      showMessage('이미 존재하는 카테고리입니다.', 'warning');
      categoryInput.value = '';
      updateAddCategoryButtonState();
      return;
    }
  }


  const categoryItem = document.createElement('div');
  categoryItem.className = 'category-item';
  
  const categorySpan = document.createElement('span');
  categorySpan.className = 'category-text';
  categorySpan.textContent = categoryText;
  
  const removeBtn = document.createElement('span');
  removeBtn.className = 'category-remove';
  removeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  
  removeBtn.addEventListener('click', function() {
    categoryItem.remove();
    updateCategoriesValue();
  });
  
  categoryItem.appendChild(categorySpan);
  categoryItem.appendChild(removeBtn);
  
  const categoriesList = document.getElementById('categories-list');
  categoriesList.appendChild(categoryItem);
  
  categoryInput.value = '';
  updateAddCategoryButtonState();
  
  updateCategoriesValue();
}

function updateCategoriesValue() {
  const categoriesInput = document.getElementById('categories');
  const categoriesTexts = document.querySelectorAll('.category-text');
  
  const categoriesArray = Array.from(categoriesTexts).map(item => item.textContent.trim());
  categoriesInput.value = categoriesArray.join(',');
  
  checkFormChanged();
}

function showMessage(message, type = 'info') {
  let messageEl = document.getElementById('alert-message');
  
  if (!messageEl) {
    messageEl = document.createElement('div');
    messageEl.id = 'alert-message';
    document.body.appendChild(messageEl);
  }
  
  const typeClasses = {
    success: 'alert-success',
    error: 'alert-error',
    warning: 'alert-warning',
    info: 'alert-info'
  };
  
  messageEl.className = `alert ${typeClasses[type] || 'alert-info'}`;
  messageEl.textContent = message;
  messageEl.style.display = 'block';
  setTimeout(() => {
    messageEl.style.opacity = '1';
  }, 10);
  
  setTimeout(() => {
    messageEl.style.opacity = '0';
    setTimeout(() => {
      messageEl.style.display = 'none';
    }, 300);
  }, 3000);
}

const style = document.createElement('style');
style.textContent = `
  .alert {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 8px;
    color: white;
    opacity: 0;
    transition: opacity 0.3s ease;
    z-index: 1050;
    max-width: 350px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  }
  
  .alert-success {
    background-color: #10b981;
  }
  
  .alert-error {
    background-color: #ef4444;
  }
  
  .alert-warning {
    background-color: #f59e0b;
  }
  
  .alert-info {
    background-color: #3b82f6;
  }
`;

document.head.appendChild(style);

function initPasswordValidation() {
  const newPasswordInput = document.getElementById('new-password');
  const confirmPasswordInput = document.getElementById('confirm-password');
  const newPasswordHelper = document.createElement('p');
  const confirmPasswordHelper = document.createElement('p');
  
  newPasswordHelper.className = 'input-helper';
  confirmPasswordHelper.className = 'input-helper';
  
  newPasswordInput.parentNode.appendChild(newPasswordHelper);
  confirmPasswordInput.parentNode.appendChild(confirmPasswordHelper);
  
  newPasswordInput.addEventListener('input', function() {
    const password = this.value;
    const confirmPassword = confirmPasswordInput.value;
    
    if (password) {
      if (validatePassword(password)) {
        newPasswordHelper.textContent = '유효한 비밀번호입니다.';
        newPasswordHelper.className = 'input-helper success';
      } else {
        newPasswordHelper.textContent = '소문자, 숫자, 특수문자를 포함한 8~20자로 입력해주세요.';
        newPasswordHelper.className = 'input-helper error';
      }
      
      if (confirmPassword && password !== confirmPassword) {
        confirmPasswordHelper.textContent = '비밀번호가 일치하지 않습니다.';
        confirmPasswordHelper.className = 'input-helper error';
      } else if (confirmPassword) {
        confirmPasswordHelper.textContent = '비밀번호가 일치합니다.';
        confirmPasswordHelper.className = 'input-helper success';
      }
    } else {
      newPasswordHelper.textContent = '';
      if (!confirmPassword) confirmPasswordHelper.textContent = '';
    }
  });
  
  confirmPasswordInput.addEventListener('input', function() {
    const password = newPasswordInput.value;
    const confirmPassword = this.value;
    
    if (confirmPassword && password !== confirmPassword) {
      confirmPasswordHelper.textContent = '비밀번호가 일치하지 않습니다.';
      confirmPasswordHelper.className = 'input-helper error';
    } else if (confirmPassword) {
      confirmPasswordHelper.textContent = '비밀번호가 일치합니다.';
      confirmPasswordHelper.className = 'input-helper success';
    } else {
      confirmPasswordHelper.textContent = '';
    }
  });
}

function validatePassword(password) {
  const passwordRegex = /^(?=.*[a-z])(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,20}$/;
  return passwordRegex.test(password);
}
