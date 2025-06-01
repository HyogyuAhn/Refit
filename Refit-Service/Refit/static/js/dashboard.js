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
  const mobileToggle = document.getElementById('mobile-toggle');
  const sidebar = document.getElementById('sidebar');
  
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', function() {
      sidebar.classList.toggle('show');
    });
  }

  window.addEventListener('resize', function() {
    if (window.innerWidth > 768 && sidebar.classList.contains('show')) {
      sidebar.classList.remove('show');
    }
  });

  function loadDashboardData() {
    console.log('대시보드 데이터 로드됨');
  }

  loadDashboardData();
});
