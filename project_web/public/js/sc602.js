/* ============================================================
   sc602.js — 기록 상세 페이지
   의존: common.js

   URL 파라미터: ?date=YYYY-MM-DD
   ============================================================ */
'use strict';

const MEAL_LABELS = {
  breakfast: '🌅 아침',
  lunch:     '☀️ 점심',
  dinner:    '🌙 저녁',
  snack:     '🍎 간식',
};


let currentDate;

window.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  initDate();
  initTabs();
  initCommonOverlays();  /* common.js — AI상담/히스토리 오버레이 */
  bindMenuBtns();
  bindLogout();
  bindLogoClick();
});



/* ── 날짜 초기화 ── */
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

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function offsetDate(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function updateURL(dateStr) {
  const url = new URL(location.href);
  url.searchParams.set('date', dateStr);
  history.replaceState({}, '', url);
}

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

/* ── 페이지 렌더 ── */
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

async function renderPage(dateStr) {
  renderDateHeader(dateStr);
  showPageLoading();
  await loadDayFromFirestore(dateStr);
  renderBadge(dateStr);
  renderMealTab(dateStr);
  renderWorkoutTab(dateStr);
  hidePageLoading();
}

function renderDateHeader(dateStr) {
  const el = document.getElementById('detailDate');
  if (!el) return;
  const d    = new Date(dateStr);
  const days = ['일','월','화','수','목','금','토'];
  el.textContent = `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

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

/* ── 식단 탭 ── */
function renderMealTab(dateStr) {
  const sc311Key = lsKey('sc311', dateStr);
  const planKey  = lsKey('plan',  dateStr);
  let   state    = {};
  let   planData = {};
  try { state    = JSON.parse(localStorage.getItem(sc311Key)) || {}; } catch {}
  try { planData = JSON.parse(localStorage.getItem(planKey))  || {}; } catch {}
  const meals    = state.meals || {};
  const mealPlan = planData.mealPlan; // AI 생성 플랜

  /* 인증 사진 */
  const photoGrid = document.getElementById('detailPhotoGrid');
  if (photoGrid) {
    const photos = Object.entries(meals)
      .filter(([, d]) => d.verified && d.photo)
      .map(([type, d]) => ({ type, photo: d.photo, kcal: d.kcal }));

    if (photos.length > 0) {
      photoGrid.innerHTML = photos.map(({ type, photo, kcal }) => `
        <div class="detail-photo-card">
          <img class="detail-photo-img" src="${photo}" alt="${MEAL_LABELS[type] || type}" />
          <div class="detail-photo-label">${MEAL_LABELS[type] || type} · ${kcal} kcal</div>
        </div>
      `).join('');
    } else {
      photoGrid.innerHTML = '<div class="detail-photo-empty">인증된 사진이 없어요</div>';
    }
  }

  /* 식단 목록 — AI 플랜 우선, 없으면 빈 상태 */
  const mealList = document.getElementById('detailMealList');
  if (mealList) {
    const mealSource = mealPlan
      ? Object.entries({ breakfast: mealPlan.breakfast, lunch: mealPlan.lunch, dinner: mealPlan.dinner })
          .filter(([, m]) => m)
          .map(([type, m]) => [type, {
            name: Array.isArray(m.menu) ? m.menu.join(' + ') : (m.menu || ''),
            kcal: m.calories || 0,
          }])
      : [];

    if (!mealSource.length) {
      mealList.innerHTML = '<div class="detail-empty-msg">이 날의 플랜 기록이 없어요</div>';
    } else {
      const items = mealSource.map(([type, info]) => {
        const verifiedMeal = meals[type];
        const verified     = verifiedMeal?.verified || false;
        const displayName  = verified && verifiedMeal.food ? verifiedMeal.food : info.name;
        const displayKcal  = verified && verifiedMeal.kcal != null ? verifiedMeal.kcal : info.kcal;
        const icon         = getFoodIcon(displayName);
        return `
          <div class="detail-meal-item${verified ? ' verified' : ''}">
            <div class="detail-meal-emoji">${icon}</div>
            <div class="detail-meal-info">
              <div class="detail-meal-name">${displayName}</div>
              <div class="detail-meal-tag">${MEAL_LABELS[type] || type}</div>
            </div>
            <div class="detail-meal-kcal">${displayKcal} kcal</div>
            <div class="detail-meal-check">${verified ? '✅' : '○'}</div>
          </div>`;
      }).join('');
      mealList.innerHTML = items;
    }
  }
}

/* ── 운동 탭 ── */
function renderWorkoutTab(dateStr) {
  const sc311Key  = lsKey('sc311', dateStr);
  const planKey   = lsKey('plan',  dateStr);
  let   state     = {};
  let   planData  = {};
  try { state    = JSON.parse(localStorage.getItem(sc311Key)) || {}; } catch {}
  try { planData = JSON.parse(localStorage.getItem(planKey))  || {}; } catch {}
  const workouts    = state.workouts || {};
  const workoutPlan = planData.workoutPlan; // AI 생성 플랜

  /* 운동 목록 — AI 플랜 우선, 없으면 빈 상태 */
  const workoutSource = workoutPlan
    ? [
        ...(workoutPlan.warmup   || []).map((w, i) => ({ id: `warmup_${i}`,   ...w, detail: w.sets ? `${w.reps}회 × ${w.sets}세트` : (w.duration || '') })),
        ...(workoutPlan.main     || []).map((w, i) => ({ id: `main_${i}`,     ...w, detail: w.sets ? `${w.reps}회 × ${w.sets}세트` : (w.duration || '') })),
        ...(workoutPlan.cooldown || []).map((w, i) => ({ id: `cooldown_${i}`, ...w, detail: w.sets ? `${w.reps}회 × ${w.sets}세트` : (w.duration || '') })),
      ]
    : [];

  const list = document.getElementById('detailWorkoutList');
  if (list) {
    if (!workoutSource.length) {
      list.innerHTML = '<div class="detail-empty-msg">이 날의 플랜 기록이 없어요</div>';
    } else {
      const items = workoutSource.map(w => {
        const done   = workouts[w.id]?.done || false;
        const icon   = getWorkoutIcon(w.name);
        const ytUrl  = `https://www.youtube.com/results?search_query=${encodeURIComponent(w.name + ' 운동 방법')}`;
        return `
          <div class="detail-workout-item${done ? ' done' : ''}">
            <div class="detail-workout-icon">${icon}</div>
            <div class="detail-workout-info">
              <a class="detail-workout-name" href="${ytUrl}" target="_blank" rel="noopener noreferrer">${w.name}</a>
              <div class="detail-workout-detail">${w.detail || ''}</div>
            </div>
            <div class="detail-workout-kcal">${w.calories || w.kcal || 0} kcal</div>
            <div class="detail-workout-status">${done ? '✅' : '○'}</div>
          </div>`;
      }).join('');
      list.innerHTML = items;
    }
  }

  /* 요약 */
  const summary = document.getElementById('detailWorkoutSummary');
  if (summary) {
    const doneList = workoutSource.filter(w => workouts[w.id]?.done);
    const burnKcal = doneList.reduce((s, w) => s + (w.calories || w.kcal || 0), 0);
    if (doneList.length > 0) {
      summary.innerHTML = `
        <div>완료한 운동 <strong>${doneList.length}</strong> / ${workoutSource.length}개</div>
        <div>소모 칼로리 <strong>${burnKcal} kcal</strong></div>`;
    } else {
      summary.innerHTML = '';
    }
  }
}

/* ── 탭 전환 ── */
function initTabs() {
  document.querySelectorAll('.detail-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.detail-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.detail-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.tab;
      document.getElementById(`detailContent${target.charAt(0).toUpperCase() + target.slice(1)}`)?.classList.add('active');
    });
  });
}


/* ════════════════════════════════
   sc602 날짜 선택 달력
   ════════════════════════════════ */
let sc602CalYear, sc602CalMonth;

function initSc602Cal() {
  const d = new Date(currentDate);
  sc602CalYear  = d.getFullYear();
  sc602CalMonth = d.getMonth();

  document.getElementById('sc602HistClose')?.addEventListener('click', () => {
    document.getElementById('sc602HistOverlay')?.classList.remove('show');
  });
  document.getElementById('sc602HistOverlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('sc602HistOverlay')) {
      document.getElementById('sc602HistOverlay').classList.remove('show');
    }
  });
  document.getElementById('sc602PrevMonth')?.addEventListener('click', () => {
    sc602CalMonth--;
    if (sc602CalMonth < 0) { sc602CalMonth = 11; sc602CalYear--; }
    buildSc602Cal();
  });
  document.getElementById('sc602NextMonth')?.addEventListener('click', () => {
    sc602CalMonth++;
    if (sc602CalMonth > 11) { sc602CalMonth = 0; sc602CalYear++; }
    buildSc602Cal();
  });
}

function openSc602Cal() {
  const d = new Date(currentDate);
  sc602CalYear  = d.getFullYear();
  sc602CalMonth = d.getMonth();
  document.getElementById('sc602HistOverlay')?.classList.add('show');
  buildSc602Cal();
}

function buildSc602Cal() {
  const titleEl = document.getElementById('sc602CalTitle');
  const daysEl  = document.getElementById('sc602CalDays');
  if (!titleEl || !daysEl) return;

  titleEl.textContent = `${sc602CalYear}년 ${sc602CalMonth + 1}월`;
  daysEl.innerHTML = '';

  const regDate     = localStorage.getItem(`reg_${getCurrentUid()}`) || '';
  const firstDay    = new Date(sc602CalYear, sc602CalMonth, 1).getDay();
  const daysInMonth = new Date(sc602CalYear, sc602CalMonth + 1, 0).getDate();
  const offset      = firstDay === 0 ? 6 : firstDay - 1;
  const today       = new Date();

  for (let i = 0; i < offset; i++) {
    const el = document.createElement('div');
    el.className = 'hist-day empty';
    daysEl.appendChild(el);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr  = `${sc602CalYear}-${String(sc602CalMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const checkKey = lsKey('check', dateStr);
    let   checks   = {};
    try { checks = JSON.parse(localStorage.getItem(checkKey)) || {}; } catch {}

    const hasMeal    = checks.meal    === true;
    const hasWorkout = checks.workout === true;

    const btn = document.createElement('button');
    btn.className = 'hist-day';

    /* 현재 선택된 날짜 강조 */
    if (dateStr === currentDate) btn.classList.add('today');

    if (hasMeal && hasWorkout) btn.classList.add('done-both');
    else if (hasMeal)          btn.classList.add('done-meal');
    else if (hasWorkout)       btn.classList.add('done-workout');

    const icon = hasMeal && hasWorkout ? '🌟' : hasMeal ? '🥗' : hasWorkout ? '💪' : '';
    btn.innerHTML = `<span class="hist-day-num">${d}</span>${icon ? `<span class="hist-day-icon">${icon}</span>` : ''}`;

    if ((regDate && dateStr < regDate) || dateStr > todayStr()) {
      btn.disabled = true;
      btn.classList.add('before-reg');
    } else {
      btn.addEventListener('click', () => {
        currentDate = dateStr;
        updateURL(dateStr);
        renderPage(dateStr);
        document.getElementById('sc602HistOverlay')?.classList.remove('show');
      });
    }

    daysEl.appendChild(btn);
  }

  /* 6행 고정: 남은 칸 빈 셀로 채우기 */
  const totalCells = offset + daysInMonth;
  const remainder  = 42 - totalCells; /* 42 = 6행 × 7열 */
  for (let i = 0; i < remainder; i++) {
    const el = document.createElement('div');
    el.className = 'hist-day empty';
    daysEl.appendChild(el);
  }
}
