'use strict';

/* ============================================================
   sc311/utils.js — 상수, 공용 유틸, 전역 공유 변수
   ============================================================ */

/* ── 전역 공유 칼로리 변수 ── */
let TOTAL_MEAL_KCAL        = calcTargetCalories(Storage.getUser()) || 1800;
let CURRENT_BURN_KCAL      = 0;   /* 운동 소모 칼로리 (workout.js 에서 갱신) */
let CURRENT_MEAL_ACCOUNTED = 0;   /* 식사 처리 칼로리 (meal.js 에서 갱신) */

/* ── 운동 체크 상태 (workout.js 와 aiChat.js 가 공유) ── */
let workoutState = {};

/* ── 오늘 상태 localStorage 키 ── */
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

/* ── 탭 문자열 capitalize ── */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ── 현재 시각 HH:MM ── */
function nowTime() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
}

/* ── textarea 자동 높이 조정 ── */
function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}

/* ── 재조정 시 특정 탭 체크 상태 초기화 ── */
function clearAdjustState(type) {
  /* type: 'meals' | 'workouts' */
  const state = loadTodayState();
  state[type] = {};
  saveTodayState(state);
  if (type === 'workouts') workoutState = {};
}

/* ── 토스트 ── */
function showToast(msg) {
  let el = document.getElementById('sc311Toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sc311Toast';
    el.style.cssText = [
      'position:fixed','bottom:80px','left:50%','transform:translateX(-50%)',
      'background:rgba(0,0,0,0.78)','color:#fff','font-size:13px','font-weight:700',
      'padding:10px 20px','border-radius:24px','z-index:9999',
      'pointer-events:none','white-space:nowrap','transition:opacity 0.3s',
    ].join(';');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.opacity = '0'; }, 2200);
}
