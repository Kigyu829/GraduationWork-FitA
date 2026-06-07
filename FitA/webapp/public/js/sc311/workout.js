'use strict';

/* ════════════════════════════════
   sc311/workout.js
   운동 목록 렌더링, 체크박스 처리, 달성률 계산
   의존: utils.js (TOTAL_MEAL_KCAL, CURRENT_BURN_KCAL, CURRENT_MEAL_ACCOUNTED,
                   loadTodayState, saveTodayState)
        common.js (lsKey, syncDayToFirestore, getWorkoutIcon)
   ════════════════════════════════ */

let workoutState = {};

/* 운동 목록 렌더링 */
function renderWorkoutItems(workoutPlan) {
  const container = document.getElementById('tabContentWorkout');
  if (!container) return;

  const summaryDiv = container.querySelector('.workout-summary');

  const sections = [
    { key: 'warmup',   title: '🔥 준비 운동' },
    { key: 'main',     title: '💪 메인 운동'  },
    { key: 'cooldown', title: '🧘 마무리'     },
  ];

  let html = '';
  sections.forEach(({ key, title }, sIdx) => {
    const items = workoutPlan[key];
    if (!items || !items.length) return;

    html += `<div class="meal-section-title"${sIdx > 0 ? ' style="margin-top:20px;"' : ''}>${title}</div>`;
    html += '<div class="workout-list">';
    items.forEach((item, i) => {
      const id     = `${key}_${i}`;
      const detail = item.sets && item.reps
        ? `${item.reps}회 × ${item.sets}세트`
        : (item.duration || '');
      const kcal   = item.calories || 0;
      const ytUrl  = `https://www.youtube.com/results?search_query=${encodeURIComponent(item.name + ' 운동 방법')}`;
      html += `
        <div class="workout-item" data-workout="${id}" data-kcal="${kcal}">
          <div class="workout-icon"></div>
          <div class="workout-info">
            <a class="workout-name" href="${ytUrl}" target="_blank" rel="noopener noreferrer">${item.name}</a>
            <div class="workout-detail">${detail}</div>
          </div>
          ${key === 'main' ? `<a href="hc503.html?exercise=${encodeURIComponent(item.name)}" class="pose-btn" onclick="event.stopPropagation()" title="자세 확인하기">자세 확인</a>` : ''}
          <div class="workout-kcal">${kcal} kcal</div>
          <div class="workout-check" data-workout="${id}" data-kcal="${kcal}">✓</div>
        </div>`;
    });
    html += '</div>';
  });

  if (workoutPlan.tip) {
    html += `<div class="ai-tip" style="margin-top:16px;padding:12px;background:var(--card);border-radius:10px;font-size:13px;color:var(--text-sec);">💡 ${workoutPlan.tip}</div>`;
  }

  const routineBar = container.querySelector('#routineActionBar');
  Array.from(container.children).forEach(child => {
    if (child !== summaryDiv && child !== routineBar) child.remove();
  });
  summaryDiv.insertAdjacentHTML('afterend', html);
  /* 루틴 바를 항상 맨 끝으로 이동 */
  if (routineBar) container.appendChild(routineBar);
}

/* ════════════════════════════════
   운동 체크박스
   ════════════════════════════════ */
function initWorkoutCheck() {
  document.querySelectorAll('.workout-check').forEach(btn => {
    btn.addEventListener('click', () => {
      const id   = btn.dataset.workout;
      const kcal = parseInt(btn.dataset.kcal, 10);

      const isDone = btn.classList.toggle('done');
      workoutState[id] = { done: isDone, kcal };

      const state = loadTodayState();
      state.workouts[id] = { done: isDone, kcal };
      saveTodayState(state);

      updateWorkoutSummary();
    });
  });
}

function restoreWorkoutState(state) {
  Object.entries(state.workouts || {}).forEach(([id, data]) => {
    if (data.done) {
      const btn = document.querySelector(`.workout-check[data-workout="${id}"]`);
      if (btn) btn.classList.add('done');
      workoutState[id] = data;
    }
  });
  updateWorkoutSummary();
}

function updateWorkoutSummary() {
  const totalItems = document.querySelectorAll('.workout-check').length;
  const doneItems  = document.querySelectorAll('.workout-check.done').length;
  const burnKcal   = Object.values(workoutState)
    .filter(d => d.done).reduce((s, d) => s + (d.kcal || 0), 0);

  const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  const pctEl  = document.getElementById('workoutPct');
  const fillEl = document.getElementById('workoutProgressFill');
  const kcalEl = document.getElementById('workoutBurnKcal');

  if (pctEl)  pctEl.textContent  = `${pct}%`;
  if (fillEl) fillEl.style.width = `${pct}%`;
  if (kcalEl) kcalEl.textContent = `소모 칼로리 ${burnKcal.toLocaleString()} kcal`;

  /* 운동 소모 칼로리 → 남은 칼로리에 반영 */
  CURRENT_BURN_KCAL = burnKcal;
  const remainEl    = document.getElementById('remainKcal');
  if (remainEl) remainEl.textContent = Math.max(0, TOTAL_MEAL_KCAL - CURRENT_MEAL_ACCOUNTED + CURRENT_BURN_KCAL).toLocaleString();

  const allDone  = totalItems > 0 && doneItems === totalItems;
  const today    = new Date();
  const dateStr  = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const checkKey = lsKey('check', dateStr);
  try {
    const state   = JSON.parse(localStorage.getItem(checkKey)) || { meal: false, workout: false };
    state.workout = allDone;
    localStorage.setItem(checkKey, JSON.stringify(state));
  } catch(e) {
    localStorage.setItem(checkKey, JSON.stringify({ meal: false, workout: allDone }));
  }
  syncDayToFirestore(dateStr);
}
