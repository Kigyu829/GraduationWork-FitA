'use strict';

/* ============================================================
   sc401/init.js — DOMContentLoaded 진입점
   [진입 경로 분기]
   A. sc311 인증 버튼 → ?meal=breakfast&kcal=340&mainFood=... 파라미터 있음
      → 날짜·끼니 선택 없이 바로 업로드 화면
   B. 메뉴(드로어)에서 직접 진입 → 파라미터 없음
      → 업로드 카드 위에 날짜·끼니 선택 UI 표시
      → 선택 완료 후 uploadParams에 저장하고 업로드 진행
   의존: sc401/utils.js, sc401/mealSelector.js, sc401/upload.js, common.js
   ============================================================ */

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
