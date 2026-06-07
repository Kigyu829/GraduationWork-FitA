'use strict';

/* ============================================================
   sc302/init.js — DOMContentLoaded 진입점
   로드 순서: utils.js → api.js → loading.js → init.js
   ============================================================ */

window.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  initCommonOverlays(); /* AI 상담 오버레이 */
  bindMenuBtns();
  bindLogout();
  bindLogoClick();

  if (hasTodayPlan()) {
    showAlreadyPlanCard();
    return;
  }

  startLoadingSequence();
});
