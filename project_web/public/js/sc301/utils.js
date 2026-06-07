'use strict';

/* ── 날짜키 생성 ── */
function dateKey(y, m, d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

/* ── 텍스트 설정 헬퍼 ── */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
