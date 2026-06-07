'use strict';

/* ============================================================
   sc311/render.js — AI 플랜 렌더링 (식단/운동 DOM 업데이트)
   의존: utils.js
   ============================================================ */

/* ── AI 플랜 전체 렌더 진입점 ── */
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
  initMealSkip();
  initWorkoutCheck();
  initRoutineButtons();
}

/* ── 식단 항목 업데이트 ── */
function renderMealItems(mealPlan) {
  const MEAL_KEYS = ['breakfast', 'lunch', 'dinner'];
  let totalKcal = 0;
  let planDirty = false;

  MEAL_KEYS.forEach(key => {
    const meal = mealPlan[key];
    if (!meal) return;

    const item = document.getElementById(`meal-${key}`);
    if (!item) return;

    const menuArr  = Array.isArray(meal.menu) ? meal.menu : [meal.menu];
    const menuText = menuArr.join(' + ');

    /* 구버전 desc 자동 수정 */
    let desc = meal.desc || '';
    if (!desc || desc.includes('인증하세요') || desc.includes('📷')) {
      desc = menuArr.join(' · ');
      meal.desc = desc;
      planDirty = true;
    }

    item.querySelector('.meal-name').textContent   = menuText;
    item.querySelector('.meal-detail').textContent = desc;
    item.querySelector('.meal-kcal').textContent   = `${meal.calories} kcal`;

    const macroEl = item.querySelector('.meal-macro');
    if (macroEl && (meal.protein != null || meal.carbs != null || meal.fat != null)) {
      macroEl.textContent = `탄 ${meal.carbs ?? '-'}g · 단 ${meal.protein ?? '-'}g · 지 ${meal.fat ?? '-'}g`;
    }

    /* 인증 버튼 */
    const btn = item.querySelector('.verify-btn');
    if (btn) btn.dataset.kcal = meal.calories;

    /* 안먹었어요 버튼에 메뉴 정보 주입 */
    const skipBtn = item.querySelector('.skip-btn');
    if (skipBtn) {
      skipBtn.dataset.kcal     = meal.calories;
      skipBtn.dataset.menuJson = JSON.stringify(menuArr);
    }

    totalKcal += meal.calories || 0;
  });

  const totalKcalEl = document.getElementById('totalKcal');
  if (totalKcalEl) totalKcalEl.textContent = totalKcal.toLocaleString();
  TOTAL_MEAL_KCAL = totalKcal;

  /* 구버전 desc 수정이 있었으면 저장 */
  if (planDirty) Storage.mergeUser({ aiMealPlan: mealPlan });

  if (mealPlan.tip) {
    const tipEl = document.getElementById('mealTip');
    if (tipEl) tipEl.textContent = `💡 ${mealPlan.tip}`;
  }
}

/* ── 운동 목록 렌더링 ── */
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

/* ── 아이콘 매핑 ── */
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

/* ── 페이지 부제목 날짜 렌더 ── */
function renderPageSubtitle() {
  const el = document.getElementById('pageSubtitle');
  if (el) el.textContent = formatDate();
}
