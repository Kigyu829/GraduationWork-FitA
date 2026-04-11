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

/* ── 로고 클릭: 항상 sc101 유지 (맨 위로 스크롤) ── */
const siteLogo = document.getElementById('siteLogo');
if (siteLogo) {
  siteLogo.addEventListener('click', function(e) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ── 이미 로그인된 사용자 → sc301로 자동 이동 ── */
(function checkLogin() {
  const reg  = Storage.getRegistered ? Storage.getRegistered() : {};
  const user = Storage.getUser ? Storage.getUser() : {};
  if (reg.email && user.targetWeight) {
    /* 로그인 + 초기설정 완료 → 대시보드로 */
    location.replace('sc301.html');
  }
})();
