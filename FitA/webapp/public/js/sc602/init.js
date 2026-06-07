'use strict';

window.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  initDate();
  initTabs();
  initWeeklyMacro();
  initCommonOverlays();  /* common.js — AI상담/히스토리 오버레이 */
  bindMenuBtns();
  bindLogout();
  bindLogoClick();
});
