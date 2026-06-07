'use strict';

/* ════════════════════════════════
   sc311/utils.js
   상수, 공용 유틸, 상태 저장/로드
   ════════════════════════════════ */

/* ── 오늘 날짜 상태 키 ── */
function todayStateKey() {
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return lsKey('sc311', dateStr);
}

function loadTodayState() {
  try { return JSON.parse(localStorage.getItem(todayStateKey())) || { meals: {}, workouts: {} }; }
  catch { return { meals: {}, workouts: {} }; }
}

function saveTodayState(state) {
  localStorage.setItem(todayStateKey(), JSON.stringify(state));
}

/* ── 전역 공유 칼로리 변수 ── */
/* calcTargetCalories는 common.js에서 제공. 플랜 미로드 시 사용자 실제 목표값 사용 */
let TOTAL_MEAL_KCAL        = calcTargetCalories(Storage.getUser()) || 1800;
let CURRENT_BURN_KCAL      = 0;   /* 운동 소모 칼로리 (updateWorkoutSummary 에서 갱신) */
let CURRENT_MEAL_ACCOUNTED = 0;   /* 식사 처리 칼로리 (먹은 + 스킵한 식사 플랜 칼로리 합계) */
