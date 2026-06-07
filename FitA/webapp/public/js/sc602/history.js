'use strict';

/* ── Firestore에서 일별 데이터 복원 (localStorage 캐시 없을 때) ── */
async function loadDayFromFirestore(dateStr) {
  const uid = getCurrentUid();
  if (!uid || typeof db === 'undefined') return;

  try {
    const doc = await db.collection('users').doc(uid).collection('daily').doc(dateStr).get();
    if (!doc.exists) return;
    const data = doc.data();
    if (data.check) localStorage.setItem(lsKey('check', dateStr), JSON.stringify(data.check));
    if (data.sc311) localStorage.setItem(lsKey('sc311', dateStr), JSON.stringify(data.sc311));
    if (data.plan)  localStorage.setItem(lsKey('plan',  dateStr), JSON.stringify(data.plan));
  } catch(err) {
    console.error('Firestore 일별 데이터 로드 실패:', err);
  }
}

/* ── 날짜 헤더 렌더 ── */
function renderDateHeader(dateStr) {
  const el = document.getElementById('detailDate');
  if (!el) return;
  const d    = new Date(dateStr);
  const days = ['일','월','화','수','목','금','토'];
  el.textContent = `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

/* ── 달성 뱃지 렌더 ── */
function renderBadge(dateStr) {
  const el       = document.getElementById('detailBadgeRow');
  if (!el) return;
  const checkKey = lsKey('check', dateStr);
  let   checks   = {};
  try { checks = JSON.parse(localStorage.getItem(checkKey)) || {}; } catch {}

  const hasMeal    = checks.meal    === true;
  const hasWorkout = checks.workout === true;

  if (hasMeal && hasWorkout) {
    el.innerHTML = '<span class="detail-badge badge-both">🌟 식단 + 운동 달성!</span>';
  } else if (hasMeal) {
    el.innerHTML = '<span class="detail-badge badge-meal">🥗 식단 달성</span>';
  } else if (hasWorkout) {
    el.innerHTML = '<span class="detail-badge badge-workout">💪 운동 달성</span>';
  } else {
    el.innerHTML = '<span class="detail-badge badge-none">기록 없음</span>';
  }
}

/* ── 페이지 전체 렌더 ── */
async function renderPage(dateStr) {
  renderDateHeader(dateStr);
  showPageLoading();
  await loadDayFromFirestore(dateStr);
  renderBadge(dateStr);
  renderMealTab(dateStr);
  renderWorkoutTab(dateStr);
  hidePageLoading();
}

/* ── 날짜 초기화 및 이전/다음 날 버튼 ── */
function initDate() {
  const params = new URLSearchParams(location.search);
  const dateStr = params.get('date') || todayStr();
  currentDate = dateStr;
  renderPage(currentDate);

  document.getElementById('prevDayBtn')?.addEventListener('click', () => {
    const prev    = offsetDate(currentDate, -1);
    const regDate = localStorage.getItem(`reg_${getCurrentUid()}`) || '';
    if (regDate && prev < regDate) return;
    currentDate = prev;
    updateURL(currentDate);
    renderPage(currentDate);
  });

  document.getElementById('nextDayBtn')?.addEventListener('click', () => {
    const next = offsetDate(currentDate, 1);
    if (next > todayStr()) return;
    currentDate = next;
    updateURL(currentDate);
    renderPage(currentDate);
  });

  /* 날짜 텍스트 or 달력 버튼 클릭 → 달력 모달 오픈 */
  document.getElementById('detailDate')?.addEventListener('click', openSc602Cal);
  document.getElementById('sc602CalOpen')?.addEventListener('click', openSc602Cal);

  initSc602Cal();
}
