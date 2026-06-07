'use strict';

/* ── 로그인 버튼 ── */
const loginBtn = document.querySelector('.nav-login-btn');
if (loginBtn) {
  loginBtn.addEventListener('click', function (e) {
    e.preventDefault();
    location.href = 'sc201_1.html';
  });
}

/* ── 로고 클릭: 항상 sc101 유지 (맨 위로 스크롤) ── */
const siteLogo = document.getElementById('siteLogo');
if (siteLogo) {
  siteLogo.addEventListener('click', function(e) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
