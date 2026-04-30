/* ============================================================
   drawer.js — 슬라이드 드로어 사이드바 공통
   sc401, hc402, hc403에서 공통 사용
   의존: common.js (navigateTo 포함)
   ============================================================ */

'use strict';

window.addEventListener('DOMContentLoaded', () => {
  const toggle  = document.getElementById('drawerToggle');
  const drawer  = document.getElementById('drawer');
  const overlay = document.getElementById('drawerOverlay');
  const close   = document.getElementById('drawerClose');
  const logout  = document.getElementById('drawerLogout');

  function openDrawer() {
    drawer?.classList.add('open');
    overlay?.classList.add('show');
  }

  function closeDrawer() {
    drawer?.classList.remove('open');
    overlay?.classList.remove('show');
  }

  toggle?.addEventListener('click', openDrawer);
  close?.addEventListener('click', closeDrawer);
  overlay?.addEventListener('click', closeDrawer);

  /* ESC 키로 닫기 */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDrawer();
  });

  /* 메뉴 버튼 네비게이션 */
  drawer?.querySelectorAll('.drawer-menu-btn[data-href]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigateTo(btn.dataset.href);
    });
  });

  /* 드로어 안 로고 클릭 → sc301 */
  document.getElementById('drawerLogo')?.addEventListener('click', () => {
    navigateTo('sc301.html');
  });

  /* 로그아웃 */
  logout?.addEventListener('click', () => {
    localStorage.removeItem('healthUserData');
    navigateTo('sc101.html');
  });
});
