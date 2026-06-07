'use strict';

/* ════════════════════════════════
   sc311/meal.js
   식단 렌더링, 인증, 안먹었어요 처리
   의존: utils.js (TOTAL_MEAL_KCAL, CURRENT_BURN_KCAL, CURRENT_MEAL_ACCOUNTED,
                   loadTodayState, saveTodayState)
        common.js (lsKey, syncDayToFirestore, Storage, getCurrentUid, db)
   ════════════════════════════════ */

/* 식단 항목 렌더링 */
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

    /* 구버전 desc 자동 수정: "📷 ...인증하세요" 패턴이나 빈 값이면 메뉴명으로 대체 */
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
    if (btn) {
      btn.dataset.kcal = meal.calories;
    }

    /* ── 안먹었어요 버튼에 메뉴 정보 주입 ── */
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

  /* 구버전 desc 수정이 있었으면 localStorage/Firestore에 저장 */
  if (planDirty) Storage.mergeUser({ aiMealPlan: mealPlan });

  if (mealPlan.tip) {
    const tipEl = document.getElementById('mealTip');
    if (tipEl) tipEl.textContent = `💡 ${mealPlan.tip}`;
  }
}

/* ════════════════════════════════
   식단 인증 버튼
   ════════════════════════════════ */
function initMealVerify() {
  document.querySelectorAll('.verify-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const meal     = btn.dataset.meal;
      const kcal     = parseInt(btn.dataset.kcal, 10);
      const mainFood = btn.dataset.mainFood || '';

      const params = new URLSearchParams({ meal, kcal });
      if (mainFood) params.set('mainFood', mainFood);
      location.href = `sc401.html?${params.toString()}`;
    });
  });
}

/* ── 인증 완료 상태 복원 ── */
function restoreMealState(state) {
  let verifiedKcal  = 0;
  let verifiedCount = 0;
  let accountedKcal = 0;

  Object.entries(state.meals || {}).forEach(([meal, data]) => {
    if (data.verified) {
      const btn     = document.querySelector(`.verify-btn[data-meal="${meal}"]`);
      const item    = document.getElementById(`meal-${meal}`);
      const skipBtn = document.querySelector(`.skip-btn[data-meal="${meal}"]`);

      if (!data.skipped) {
        /* 일반 인증 */
        if (btn) { btn.textContent = '✅ 완료'; btn.classList.add('done'); }
        if (item) item.classList.add('verified');
        accountedKcal += data.kcal || 0;
      } else {
        /* 안먹었어요 — 계획 칼로리 전체를 처리된 것으로 계산 */
        if (skipBtn)  { skipBtn.textContent = '🚫 건너뜀'; skipBtn.classList.add('done'); }
        if (btn)      { btn.disabled = true; btn.style.opacity = '0.4'; }
        if (item)     item.classList.add('skipped');
        accountedKcal += parseInt(skipBtn?.dataset.kcal, 10) || data.kcal || 0;
      }

      verifiedKcal  += data.kcal || 0;
      verifiedCount += 1;
    }
  });

  updateMealSummary(verifiedKcal, verifiedCount, accountedKcal);
}

function updateMealSummary(verifiedKcal, verifiedCount, accountedKcal = verifiedKcal) {
  CURRENT_MEAL_ACCOUNTED = accountedKcal;
  const verifiedKcalEl = document.getElementById('verifiedKcal');
  const remainKcalEl   = document.getElementById('remainKcal');
  const verifiedCntEl  = document.getElementById('verifiedCount');

  const remaining = Math.max(0, TOTAL_MEAL_KCAL - accountedKcal + CURRENT_BURN_KCAL);

  if (verifiedKcalEl) verifiedKcalEl.textContent = verifiedKcal.toLocaleString();
  if (remainKcalEl)   remainKcalEl.textContent   = remaining.toLocaleString();
  if (verifiedCntEl)  verifiedCntEl.textContent  = `${verifiedCount}/3`;

  /* 칼로리 진행 바 */
  const pct     = TOTAL_MEAL_KCAL > 0 ? Math.min(100, Math.round(verifiedKcal / TOTAL_MEAL_KCAL * 100)) : 0;
  const barFill = document.getElementById('kcalBarFill');
  if (barFill) {
    barFill.style.width      = `${pct}%`;
    barFill.style.background = pct >= 100 ? 'var(--red,#FF3B3B)' : 'var(--teal)';
  }
  const consumedEl = document.getElementById('kcalBarConsumed');
  const targetEl   = document.getElementById('kcalBarTarget');
  if (consumedEl) consumedEl.textContent = `${verifiedKcal.toLocaleString()} kcal 섭취`;
  if (targetEl)   targetEl.textContent   = `목표 ${TOTAL_MEAL_KCAL.toLocaleString()} kcal`;
}

/* ════════════════════════════════
   안먹었어요 버튼
   ════════════════════════════════ */
function initMealSkip() {
  document.querySelectorAll('.skip-btn').forEach(btn => {
    if (btn.classList.contains('done')) return;
    btn.addEventListener('click', () => {
      const mealKey   = btn.dataset.meal;
      const totalKcal = parseInt(btn.dataset.kcal, 10) || 0;
      let   menuItems = [];
      try { menuItems = JSON.parse(btn.dataset.menuJson || '[]'); } catch { menuItems = []; }
      showSkipModal(mealKey, totalKcal, menuItems);
    });
  });
}

function showSkipModal(mealKey, totalKcal, menuItems) {
  document.getElementById('skipModal')?.remove();

  const mealLabel = { breakfast: '아침', lunch: '점심', dinner: '저녁' }[mealKey] || mealKey;
  const hasItems  = menuItems.length > 0;

  const itemsHtml = hasItems
    ? menuItems.map((name, i) => `
        <label class="skip-check-row">
          <input type="checkbox" class="skip-item-check" data-index="${i}" />
          <span class="skip-check-label">${name}</span>
        </label>
      `).join('')
    : `<p style="font-size:13px;color:var(--text-sec);margin:8px 0;">메뉴 정보가 없어요. 전부 안먹은 것으로 처리할게요.</p>`;

  const modal = document.createElement('div');
  modal.id        = 'skipModal';
  modal.className = 'skip-modal-overlay';
  modal.innerHTML = `
    <div class="skip-modal">
      <div class="skip-modal-header">
        <div>
          <div class="skip-modal-title">🚫 ${mealLabel} — 안먹은 항목</div>
          <div class="skip-modal-sub">안먹은 항목을 선택하면 칼로리에서 제외돼요.</div>
        </div>
        <button class="skip-modal-close" id="skipModalClose">✕</button>
      </div>

      <div class="skip-items-list" id="skipItemsList">
        ${hasItems ? `
          <label class="skip-check-row skip-all-row">
            <input type="checkbox" id="skipAllCheck" />
            <span class="skip-check-label" style="font-weight:800;">전부 안먹었어요</span>
          </label>
          <div class="skip-divider"></div>
          ${itemsHtml}
        ` : itemsHtml}
      </div>

      <div class="skip-kcal-preview" id="skipKcalPreview">
        <span>제외 칼로리</span>
        <strong id="skipKcalValue">0 kcal</strong>
      </div>
      <div class="skip-kcal-preview" style="border-color:var(--teal,#66D0BC); background:rgba(102,208,188,0.06);">
        <span>실제 섭취 칼로리</span>
        <strong id="skipKcalRemain" style="color:var(--teal,#66D0BC);">${totalKcal} kcal</strong>
      </div>

      <div class="skip-modal-actions">
        <button class="secondary-btn skip-cancel-btn" id="skipCancelBtn">취소</button>
        <button class="primary-btn skip-confirm-btn" id="skipConfirmBtn">이대로 기록</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('show')));

  const allCheck   = modal.querySelector('#skipAllCheck');
  const itemChecks = modal.querySelectorAll('.skip-item-check');

  function calcSkipKcal() {
    if (!hasItems) return totalKcal;
    const checkedCount = modal.querySelectorAll('.skip-item-check:checked').length;
    if (checkedCount === 0) return 0;
    return Math.round((checkedCount / menuItems.length) * totalKcal);
  }

  function updatePreview() {
    const skipKcal   = calcSkipKcal();
    const remainKcal = totalKcal - skipKcal;
    const skipEl     = modal.querySelector('#skipKcalValue');
    const remainEl   = modal.querySelector('#skipKcalRemain');
    if (skipEl)   skipEl.textContent   = `${skipKcal} kcal`;
    if (remainEl) remainEl.textContent = `${Math.max(0, remainKcal)} kcal`;
  }

  allCheck?.addEventListener('change', () => {
    itemChecks.forEach(c => { c.checked = allCheck.checked; });
    updatePreview();
  });
  itemChecks.forEach(c => {
    c.addEventListener('change', () => {
      if (allCheck) allCheck.checked = [...itemChecks].every(ic => ic.checked);
      updatePreview();
    });
  });

  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 280);
  };
  modal.querySelector('#skipModalClose')?.addEventListener('click', closeModal);
  modal.querySelector('#skipCancelBtn')?.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  modal.querySelector('#skipConfirmBtn')?.addEventListener('click', () => {
    const skipKcal   = calcSkipKcal();
    const remainKcal = Math.max(0, totalKcal - skipKcal);

    let skippedItems = [];
    if (hasItems) {
      skippedItems = menuItems.filter((_, i) =>
        modal.querySelector(`.skip-item-check[data-index="${i}"]`)?.checked
      );
    } else {
      skippedItems = ['전체'];
    }

    doSkipVerify(mealKey, remainKcal, skippedItems);
    closeModal();

    /* UI 업데이트 */
    const skipBtn   = document.querySelector(`.skip-btn[data-meal="${mealKey}"]`);
    const verifyBtn = document.querySelector(`.verify-btn[data-meal="${mealKey}"]`);
    const mealItem  = document.getElementById(`meal-${mealKey}`);

    if (skipBtn)  { skipBtn.textContent = '🚫 건너뜀'; skipBtn.classList.add('done'); }
    if (verifyBtn){ verifyBtn.disabled = true; verifyBtn.style.opacity = '0.4'; }
    if (mealItem) mealItem.classList.add('skipped');

    /* 요약 갱신 */
    const stateNow = loadTodayState();
    let vKcal = 0, vCount = 0, aKcal = 0;
    Object.entries(stateNow.meals || {}).forEach(([mealId, d]) => {
      if (d.verified) {
        vCount++;
        vKcal += d.kcal || 0;
        if (d.skipped) {
          const sb = document.querySelector(`.skip-btn[data-meal="${mealId}"]`);
          aKcal += parseInt(sb?.dataset.kcal, 10) || d.kcal || 0;
        } else {
          aKcal += d.kcal || 0;
        }
      }
    });
    updateMealSummary(vKcal, vCount, aKcal);
  });
}

function doSkipVerify(mealKey, remainKcal, skippedItems) {
  const today   = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const sc311Key = lsKey('sc311', dateStr);

  let sc311State;
  try { sc311State = JSON.parse(localStorage.getItem(sc311Key)) || { meals: {}, workouts: {} }; }
  catch { sc311State = { meals: {}, workouts: {} }; }

  sc311State.meals[mealKey] = {
    verified:     true,
    skipped:      true,
    kcal:         remainKcal,
    skippedItems: skippedItems,
    food:         skippedItems.length > 0 ? `(건너뜀: ${skippedItems.join(', ')})` : '(건너뜀)',
  };
  localStorage.setItem(sc311Key, JSON.stringify(sc311State));

  const checkKey    = lsKey('check', dateStr);
  const allVerified = ['breakfast', 'lunch', 'dinner'].every(k => sc311State.meals[k]?.verified);
  try {
    const chk = JSON.parse(localStorage.getItem(checkKey)) || { meal: false, workout: false };
    chk.meal  = allVerified;
    localStorage.setItem(checkKey, JSON.stringify(chk));
  } catch {
    localStorage.setItem(checkKey, JSON.stringify({ meal: allVerified, workout: false }));
  }
  syncDayToFirestore(dateStr);
}
