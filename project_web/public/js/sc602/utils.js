'use strict';

/* ── 상수 ── */
const MEAL_LABELS = {
  breakfast: '🌅 아침',
  lunch:     '☀️ 점심',
  dinner:    '🌙 저녁',
  snack:     '🍎 간식',
};

/* ── 현재 선택된 날짜 (모듈 간 공유) ── */
let currentDate;

/* ── 날짜 이동 ── */
function offsetDate(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/* ── URL에 날짜 반영 ── */
function updateURL(dateStr) {
  const url = new URL(location.href);
  url.searchParams.set('date', dateStr);
  history.replaceState({}, '', url);
}

/* ── 로딩 인디케이터 표시/숨김 ── */
function showPageLoading() {
  document.getElementById('sc602Loading')?.style.setProperty('display', 'flex');
  document.getElementById('detailBadgeRow')?.style.setProperty('visibility', 'hidden');
  document.querySelectorAll('.detail-content').forEach(el => el.style.setProperty('visibility', 'hidden'));
}
function hidePageLoading() {
  document.getElementById('sc602Loading')?.style.setProperty('display', 'none');
  document.getElementById('detailBadgeRow')?.style.setProperty('visibility', '');
  document.querySelectorAll('.detail-content').forEach(el => el.style.setProperty('visibility', ''));
}
