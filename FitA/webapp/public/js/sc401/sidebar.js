'use strict';

/* ════════════════════════════════
   사이드바
   ════════════════════════════════ */
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
