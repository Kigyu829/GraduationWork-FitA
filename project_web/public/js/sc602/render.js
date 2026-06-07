'use strict';

/* ── 페이지 렌더 ── */
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
  const mealPlan = planData.mealPlan;

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
  const workoutPlan = planData.workoutPlan;

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
