'use strict';

/* ── 식단 타입 레이블 ── */
const MEAL_LABELS = {
  breakfast: '🌅 아침',
  lunch:     '☀️ 점심',
  dinner:    '🌙 저녁',
  snack:     '🍎 간식',
};

/* ── 현재 날짜 상태 (모듈 공유 변수) ── */
let currentDate;

/* ── 날짜 오프셋 계산 ── */
function offsetDate(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/* ── URL 날짜 파라미터 업데이트 ── */
function updateURL(dateStr) {
  const url = new URL(location.href);
  url.searchParams.set('date', dateStr);
  history.replaceState({}, '', url);
}

/* ── 로딩 인디케이터 표시/숨김 ── */
function showPageLoading() {
  document.getElementById('sc602Loading')?.style.setProperty('display', 'flex');
  document.getElementById('detailBadgeRow')?.style.setProperty('visibility', 'hidden');
  document.querySelectorAll('.tab-content').forEach(el => el.style.setProperty('visibility', 'hidden'));
}
function hidePageLoading() {
  document.getElementById('sc602Loading')?.style.setProperty('display', 'none');
  document.getElementById('detailBadgeRow')?.style.setProperty('visibility', '');
  document.querySelectorAll('.tab-content').forEach(el => el.style.setProperty('visibility', ''));
}
