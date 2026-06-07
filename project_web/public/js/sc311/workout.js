'use strict';

/* ============================================================
   sc311/workout.js — 운동 체크박스, 요약 업데이트, 자세 인증
   의존: utils.js, render.js
   ============================================================ */

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

/* ════════════════════════════════
   자세 인증 복귀 시 자동 체크
   hc503 → sc311?tab=workout&poseVerified=운동명
   ════════════════════════════════ */
function checkPoseVerified() {
  const params   = new URLSearchParams(location.search);
  const verified = params.get('poseVerified');
  if (!verified) return;

  document.querySelectorAll('.workout-item').forEach(item => {
    const nameEl = item.querySelector('.workout-name');
    if (nameEl && nameEl.textContent.trim() === verified) {
      const checkBtn = item.querySelector('.workout-check');
      if (checkBtn && !checkBtn.classList.contains('done')) {
        checkBtn.click();
      }
    }
  });

  /* URL에서 poseVerified 파라미터 제거 */
  const url = new URL(location.href);
  url.searchParams.delete('poseVerified');
  history.replaceState({}, '', url.toString());
}
