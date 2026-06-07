'use strict';

/* ============================================================
   sc300/init.js — DOMContentLoaded 진입점 및 Firebase auth 처리
   의존: sc300/utils.js, sc300/weightCheck.js, common.js
   ============================================================ */

window.addEventListener('DOMContentLoaded', () => {
  /* Firebase auth 완료 후 초기화 (sessionStorage fallback 있어서 대부분 즉시 진행됨) */
  if (typeof auth !== 'undefined') {
    auth.onAuthStateChanged(user => {
      if (user) {
        sessionStorage.setItem('_fitUid', user.uid);
        if (user.displayName) sessionStorage.setItem('_fitNick', user.displayName);
      }
      initPage();
    });
  } else {
    initPage();
  }
});
