'use strict';

/* ════════════════════════════════
   6. 오늘 목표 체크
   ════════════════════════════════ */
function getTodayKey() {
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return lsKey('check', dateStr);
}

function getTodayChecks(key) {
  try { return JSON.parse(localStorage.getItem(key)) || { meal: false, workout: false }; }
  catch { return { meal: false, workout: false }; }
}

function saveTodayChecks(key, checks) {
  localStorage.setItem(key, JSON.stringify(checks));
}

function renderTodayCheck() {
  const todayKey = getTodayKey();
  const checks   = getTodayChecks(todayKey);

  const mealChk    = document.getElementById('checkMeal');
  const workoutChk = document.getElementById('checkWorkout');
  const statusEl   = document.getElementById('todayCheckStatus');

  /* sc311에서 저장한 check_ 키 기반으로 자동 반영 (읽기전용) */
  if (mealChk) {
    mealChk.checked  = checks.meal;
    mealChk.disabled = true;
    mealChk.style.opacity = '0.7';
    mealChk.style.cursor  = 'default';
    mealChk.title = '식단 인증 시 자동으로 체크됩니다';
  }
  if (workoutChk) {
    workoutChk.checked  = checks.workout;
    workoutChk.disabled = true;
    workoutChk.style.opacity = '0.7';
    workoutChk.style.cursor  = 'default';
    workoutChk.title = '운동 완료 시 자동으로 체크됩니다';
  }

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
