'use strict';

window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(location.search);

  if (urlParams.has('meal')) {
    /* ── A. sc311에서 넘어온 경우 ── */
    sessionStorage.setItem('uploadParams', urlParams.toString());
    hideMealSelector();
  } else {
    /* ── B. 직접 진입 ── */
    sessionStorage.removeItem('uploadParams');
    showMealSelector();
  }

  bindSidebar();
  bindUpload();
  bindMealSelector();
});
