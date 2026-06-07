'use strict';

/* ============================================================
   sc401/utils.js — 공용 유틸 함수
   의존: common.js (navigateTo, Storage 등)
   ============================================================ */

/* ── 사이드바 / 네비게이션 버튼 바인딩 ── */
function bindSidebar() {
  document.getElementById('sidebarLogo')?.addEventListener('click', () => {
    location.href = 'sc301.html';
  });
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (typeof auth !== 'undefined') auth.signOut().catch(() => {});
    Storage.clearAll();
    location.href = 'sc101.html';
  });
  document.getElementById('backBtn')?.addEventListener('click', () => {
    navigateTo('sc301.html');
  });
  document.getElementById('backToMain')?.addEventListener('click', () => {
    navigateTo('sc311.html');
  });
  if (typeof bindMenuBtns === 'function') bindMenuBtns();
}
