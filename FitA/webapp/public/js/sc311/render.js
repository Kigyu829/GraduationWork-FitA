'use strict';

/* ════════════════════════════════
   sc311/render.js
   AI 플랜 최상위 렌더링 조율, 아이콘 매핑, 날짜 표시
   의존: meal.js    (renderMealItems, initMealVerify, initMealSkip)
        workout.js (renderWorkoutItems, initWorkoutCheck, initRoutineButtons)
        utils.js   (lsKey)
        common.js  (Storage, syncDayToFirestore, getWorkoutIcon, formatDate)
   ════════════════════════════════ */

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* AI 플랜 렌더링 진입점 */
function renderAiPlan() {
  const userData    = Storage.getUser();
  const mealPlan    = userData.aiMealPlan;
  const workoutPlan = userData.aiWorkoutPlan;

  /* 오늘 날짜별 키에 플랜 저장 → sc602 히스토리에서 읽기 위해 */
  if (mealPlan || workoutPlan) {
    const _d = new Date();
    const today   = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;
    const planKey = lsKey('plan', today);
    let existing  = {};
    try { existing = JSON.parse(localStorage.getItem(planKey) || '{}'); } catch {}
    if (!existing.mealPlan    && mealPlan)    existing.mealPlan    = mealPlan;
    if (!existing.workoutPlan && workoutPlan) existing.workoutPlan = workoutPlan;
    localStorage.setItem(planKey, JSON.stringify(existing));
    syncDayToFirestore(today);
  }

  if (mealPlan)    renderMealItems(mealPlan);
  if (workoutPlan) renderWorkoutItems(workoutPlan);

  applyIcons();
  initMealVerify();
  initMealSkip();    /* ← 안먹었어요 버튼 */
  initWorkoutCheck();
  initRoutineButtons();
}

/* 아이콘 매핑 */
function applyIcons() {
  document.querySelectorAll('.meal-item').forEach(item => {
    const iconEl = item.querySelector('.meal-emoji');
    if (iconEl) iconEl.textContent = '🍴';
  });
  document.querySelectorAll('.workout-item').forEach(item => {
    const name   = item.querySelector('.workout-name')?.textContent || '';
    const iconEl = item.querySelector('.workout-icon');
    if (iconEl) iconEl.textContent = getWorkoutIcon(name);
  });
}

/* 페이지 날짜 부제목 */
function renderPageSubtitle() {
  const el = document.getElementById('pageSubtitle');
  if (el) el.textContent = formatDate();
}

/* 탭 전환 */
function initTabs() {
  const tabBtns     = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      tabBtns.forEach(b     => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tabContent${capitalize(target)}`)?.classList.add('active');
    });
  });

  const params  = new URLSearchParams(location.search);
  const initTab = params.get('tab');
  if (initTab) {
    const targetBtn = document.querySelector(`.tab-btn[data-tab="${initTab}"]`);
    if (targetBtn) targetBtn.click();
  }
}
