'use strict';

/* ============================================================
   sc101/init.js — DOMContentLoaded 진입점
   로드 순서: utils.js → nav.js → auth.js → init.js
   ============================================================ */

/* sc101은 DOMContentLoaded 없이 즉시 실행 스크립트(nav.js, auth.js)로
   구성되어 있으므로, 이 파일은 향후 초기화 로직 추가를 위한 진입점입니다. */
document.addEventListener('DOMContentLoaded', () => {
  /* 현재는 nav.js / auth.js에서 처리하므로 추가 초기화 없음 */
});
