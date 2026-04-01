/* ============================================================
   sc101.js — 랜딩 페이지
   의존: common.js
   ============================================================ */

'use strict';

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
