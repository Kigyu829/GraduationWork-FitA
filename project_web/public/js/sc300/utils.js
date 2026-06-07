'use strict';

/* ============================================================
   sc300/utils.js — 상수 및 공용 유틸 함수
   의존: common.js (lsKey, getCurrentUid 등)
   ============================================================ */

/* ── 오늘 날짜 문자열 (YYYY-MM-DD) ── */
function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
