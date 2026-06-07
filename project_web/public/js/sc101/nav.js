'use strict';

/* ============================================================
   sc101/nav.js — 네비게이션 인터랙션
   (스크롤 앵커, 로그인 버튼, 로고 클릭)
   ============================================================ */

/* ── 스크롤 부드럽게 (앵커 링크) ── */
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

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
  siteLogo.addEventListener('click', function (e) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
