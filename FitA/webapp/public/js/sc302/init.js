'use strict';

window.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  initCommonOverlays();
  bindMenuBtns();
  bindLogout();
  bindLogoClick();

  if (hasTodayPlan()) {
    showAlreadyPlanCard();
    return;
  }

  startLoadingSequence();
});
