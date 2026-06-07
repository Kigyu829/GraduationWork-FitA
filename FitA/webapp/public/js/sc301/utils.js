'use strict';

/* ── 날짜 키 생성 (YYYY-MM-DD) ── */
function dateKey(y, m, d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

/* ── 텍스트 설정 헬퍼 ── */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ── 오늘 체크 키 ── */
function getTodayKey() {
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return lsKey('check', dateStr);
}

/* ── 오늘 체크 읽기 ── */
function getTodayChecks(key) {
  try { return JSON.parse(localStorage.getItem(key)) || { meal: false, workout: false }; }
  catch { return { meal: false, workout: false }; }
}

/* ── 오늘 체크 저장 ── */
function saveTodayChecks(key, checks) {
  localStorage.setItem(key, JSON.stringify(checks));
}
