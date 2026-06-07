'use strict';

/* ════════════════════════════════
   6. 오늘 목표 체크
   ════════════════════════════════ */
function renderTodayCheck() {
  const todayKey = getTodayKey();
  const checks   = getTodayChecks(todayKey);

  const mealTag    = document.getElementById('mealDoneTag');
  const workoutTag = document.getElementById('workoutDoneTag');
  const statusEl   = document.getElementById('todayCheckStatus');

  if (mealTag)    mealTag.style.display    = checks.meal    ? 'block' : 'none';
  if (workoutTag) workoutTag.style.display = checks.workout ? 'block' : 'none';

  updateCheckStatus(checks, statusEl);
}

function updateCheckStatus(checks, statusEl) {
  if (!statusEl) return;
  if (checks.meal && checks.workout) {
    statusEl.textContent = '🎉 오늘 목표 달성!';
    statusEl.className   = 'today-check-status done';
  } else if (checks.meal || checks.workout) {
    statusEl.textContent = '🔥 절반 달성 중!';
    statusEl.className   = 'today-check-status half';
  } else {
    statusEl.textContent = '아직 체크하지 않았어요.';
    statusEl.className   = 'today-check-status';
  }
}
