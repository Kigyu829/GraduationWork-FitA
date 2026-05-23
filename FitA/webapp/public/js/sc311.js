/* ============================================================
   sc311.js — 오늘의 식단/운동
   의존: common.js

   [기능]
   - AI 서버(port 5000)에서 받아온 플랜을 동적 렌더링
   - 식단/운동 탭 전환
   - 식단 인증 버튼 → sc401로 이동 (끼니 정보 전달)
   - 안먹었어요 버튼 → 팝업으로 항목 선택 후 칼로리 차감 기록
   - 운동 체크박스 → 달성 칼로리 누적
   - 우측 AI 채팅 사이드패널 (실제 /api/chat 연결)
   ============================================================ */

'use strict';

const AI_SERVER = '';

window.addEventListener('DOMContentLoaded', async () => {
  renderSidebar();
  renderPageSubtitle();
  initTabs();
  initAiChat();
  initCommonOverlays();  /* common.js — AI상담/히스토리 오버레이 */
  bindMenuBtns();
  bindLogout();
  bindLogoClick();
  await refreshUserDataFromFirestore(); /* 타 기기 플랜 변경 반영 */
  await loadTodayFromFirestore();       /* 새 기기 로그인 시 오늘 데이터 복원 */
  await restoreRoutinesFromFirestore(); /* 새 기기 로그인 시 저장된 루틴 복원 */
  renderAiPlan();
  restoreTodayState();
  fetchMotivation();
  checkPoseVerified();   /* 자세 인증 복귀 시 자동 체크 */
});

/* ════════════════════════════════
   AI 플랜 렌더링
   ════════════════════════════════ */
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

/* 식단 항목 업데이트 */
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

  Array.from(container.children).forEach(child => {
    if (child !== summaryDiv) child.remove();
  });
  summaryDiv.insertAdjacentHTML('afterend', html);
}

/* 아이콘 매핑 */
function applyIcons() {
  document.querySelectorAll('.meal-item').forEach(item => {
    const name   = item.querySelector('.meal-name')?.textContent || '';
    const iconEl = item.querySelector('.meal-emoji');
    if (iconEl) iconEl.textContent = '🍴';
  });
  document.querySelectorAll('.workout-item').forEach(item => {
    const name   = item.querySelector('.workout-name')?.textContent || '';
    const iconEl = item.querySelector('.workout-icon');
    if (iconEl) iconEl.textContent = getWorkoutIcon(name);
  });
}



function renderPageSubtitle() {
  const el = document.getElementById('pageSubtitle');
  if (el) el.textContent = formatDate();
}

/* ════════════════════════════════
   탭 전환
   ════════════════════════════════ */
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

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ════════════════════════════════
   오늘 상태 키
   ════════════════════════════════ */
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

/* ════════════════════════════════
   식단 인증 버튼
   ════════════════════════════════ */
/* calcTargetCalories는 common.js에서 제공. 플랜 미로드 시 사용자 실제 목표값 사용 */
let TOTAL_MEAL_KCAL           = calcTargetCalories(Storage.getUser()) || 1800;
let CURRENT_BURN_KCAL         = 0;   /* 운동 소모 칼로리 (updateWorkoutSummary 에서 갱신) */
let CURRENT_MEAL_ACCOUNTED    = 0;   /* 식사 처리 칼로리 (먹은 + 스킵한 식사 플랜 칼로리 합계) */

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

/* ════════════════════════════════
   운동 체크박스
   ════════════════════════════════ */
let workoutState = {};

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
   오늘 상태 복원
   ════════════════════════════════ */
/* ── Firestore에서 최신 userData 갱신 (타 기기 플랜 변경 반영) ── */
async function refreshUserDataFromFirestore() {
  const uid = getCurrentUid();
  if (!uid || typeof db === 'undefined') return;
  try {
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists && doc.data().userData) {
      localStorage.setItem(`hud_${uid}`, JSON.stringify(doc.data().userData));
    }
  } catch { /* 네트워크 오류 — 캐시 사용 */ }
}

/* ── Firestore에서 오늘 데이터 복원 (localStorage 캐시 없을 때) ── */
async function loadTodayFromFirestore() {
  const uid = getCurrentUid();
  if (!uid || typeof db === 'undefined') return;

  const _d    = new Date();
  const today = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;

  /* sc311 캐시가 이미 있으면 스킵 */
  if (localStorage.getItem(lsKey('sc311', today))) return;

  try {
    const doc = await db.collection('users').doc(uid).collection('daily').doc(today).get();
    if (!doc.exists) return;
    const data = doc.data();
    if (data.check) localStorage.setItem(lsKey('check', today), JSON.stringify(data.check));
    if (data.sc311) localStorage.setItem(lsKey('sc311', today), JSON.stringify(data.sc311));
    if (data.plan)  localStorage.setItem(lsKey('plan',  today), JSON.stringify(data.plan));
  } catch(err) {
    console.error('Firestore 오늘 데이터 로드 실패:', err);
  }
}

function restoreTodayState() {
  const state = loadTodayState();
  restoreMealState(state);
  restoreWorkoutState(state);
}

/* ════════════════════════════════
   AI 채팅 사이드패널 (socket.io 스트리밍)
   ════════════════════════════════ */
/* ── 채팅 히스토리 localStorage 저장/로드 ── */
const _sc311ChatKey = () => `sc311Chat_${getCurrentUid() || 'guest'}`;
let chatHistory = (() => {
  try { return JSON.parse(localStorage.getItem(_sc311ChatKey())) || []; } catch { return []; }
})();
function saveChatHistory() {
  if (chatHistory.length > 30) chatHistory.splice(0, chatHistory.length - 30);
  try { localStorage.setItem(_sc311ChatKey(), JSON.stringify(chatHistory)); } catch {}
}
function nowTime() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
}

/* ── Socket.io 연결 ── */
let _aiSocket = null;
function getAiSocket() {
  if (!_aiSocket) {
    _aiSocket = io({ transports: ['websocket', 'polling'] });
    _aiSocket.on('connect',       () => console.log('[Socket] AI 서버 연결됨'));
    _aiSocket.on('connect_error', () => console.warn('[Socket] AI 서버 연결 실패'));
  }
  return _aiSocket;
}

/* 스트리밍 버블 생성 — 토큰이 도착하면 내용을 채움 */
function createStreamBubble() {
  const messages = document.getElementById('chatMessages');
  const now  = new Date();
  const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const div  = document.createElement('div');
  div.className = 'chat-msg ai';
  div.innerHTML = `
    <div class="chat-avatar">🤖</div>
    <div>
      <div class="chat-bubble"></div>
      <div class="chat-time">AI 상담사 · ${time}</div>
    </div>
  `;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

function initAiChat() {
  const toggleBtn = document.getElementById('aiChatToggleBtn');
  const panel     = document.getElementById('aiChatPanel');
  const closeBtn  = document.getElementById('chatCloseBtn');
  const sendBtn   = document.getElementById('chatSendBtn');
  const input     = document.getElementById('chatInput');

  /* 사이드메뉴 AI상담 버튼도 우측 패널 열기 (오버레이 대신) */
  const sideMenuAiBtn = document.getElementById('menuAiChat');
  if (sideMenuAiBtn) {
    sideMenuAiBtn.addEventListener('click', (e) => {
      e.stopImmediatePropagation(); /* common.js 오버레이 핸들러 차단 */
      const isOpen = panel?.classList.toggle('open');
      toggleBtn?.classList.toggle('active', isOpen);
    });
  }

  toggleBtn?.addEventListener('click', () => {
    const isOpen = panel.classList.toggle('open');
    toggleBtn.classList.toggle('active', isOpen);
  });

  if (new URLSearchParams(location.search).get('openChat') === '1') {
    panel?.classList.add('open');
    toggleBtn?.classList.add('active');
  }

  closeBtn?.addEventListener('click', () => {
    panel.classList.remove('open');
    toggleBtn.classList.remove('active');
  });

  function sendMessage() {
    const text = input.value.trim();
    if (!text || sendBtn.disabled) return;

    const userTime = nowTime();
    appendMessage('user', text, userTime);
    chatHistory.push({ role: 'user', text, time: userTime });
    saveChatHistory();
    input.value = '';
    autoResizeTextarea(input);
    sendBtn.disabled = true;

    const userData    = Storage.getUser();
    const userInfoStr = [
      userData.gender       ? `성별 ${userData.gender}`         : '',
      userData.height       ? `키 ${userData.height}cm`         : '',
      userData.weight       ? `체중 ${userData.weight}kg`       : '',
      userData.targetWeight ? `목표 ${userData.targetWeight}kg` : '',
      userData.goalWeeks    ? `기간 ${userData.goalWeeks}주`    : '',
    ].filter(Boolean).join(', ');

    const recentHistory = chatHistory.slice(-6)
      .map(h => `${h.role === 'user' ? '사용자' : 'AI'}: ${h.text}`)
      .join('\n');

    const socket    = getAiSocket();
    const streamDiv = createStreamBubble();
    const bubble    = streamDiv.querySelector('.chat-bubble');

    /* 핸들러를 named function으로 정의 → off() 시 정확히 이 인스턴스만 제거 */
    function onToken(token) {
      bubble.textContent += token;
      document.getElementById('chatMessages').scrollTop = 999999;
    }
    function cleanup() {
      socket.off('chat_token', onToken);
      socket.off('chat_done',  onDone);
      socket.off('chat_error', onError);
    }
    function onDone({ reply, action, reason }) {
      cleanup();
      const finalReply = reply || bubble.textContent || '죄송해요, 응답을 받지 못했어요.';
      bubble.textContent = finalReply;
      chatHistory.push({ role: 'ai', text: finalReply, time: nowTime() });
      saveChatHistory();
      sendBtn.disabled = false;
      if (action === 'meal_adjust' && reason)          handleMealAdjust(reason);
      else if (action === 'exercise_adjust' && reason) handleExerciseAdjust(reason);
    }
    function onError(errMsg) {
      cleanup();
      bubble.textContent = `오류가 발생했어요: ${errMsg}`;
      sendBtn.disabled = false;
    }

    cleanup();  /* 이전 메시지의 핸들러가 남아 있으면 먼저 제거 */
    socket.on('chat_token', onToken);
    socket.on('chat_done',  onDone);
    socket.on('chat_error', onError);

    socket.emit('chat_message', {
      message:       text,
      userInfo:      userInfoStr,
      mealPlan:      userData.aiMealPlan    || null,
      workoutPlan:   userData.aiWorkoutPlan || null,
      recentHistory,
    });
  }

  sendBtn?.addEventListener('click', sendMessage);
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  input?.addEventListener('input', () => autoResizeTextarea(input));

  /* ── 저장된 채팅 기록 복원 ── */
  if (chatHistory.length > 0) {
    chatHistory.forEach(msg => appendMessage(msg.role, msg.text, msg.time));
    const chatMsgs = document.getElementById('chatMessages');
    if (chatMsgs) chatMsgs.scrollTop = chatMsgs.scrollHeight;
  }
}

function appendMessage(role, text, savedTime) {
  const messages = document.getElementById('chatMessages');
  if (!messages) return;

  const time = savedTime || nowTime();

  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'chat-avatar';
  avatar.textContent = role === 'ai' ? '🤖' : '👤';

  const inner = document.createElement('div');

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.textContent = text;   /* XSS 방지: textContent 사용 */

  const timeEl = document.createElement('div');
  timeEl.className = 'chat-time';
  timeEl.textContent = `${role === 'ai' ? 'AI 상담사' : '나'} · ${time}`;

  inner.appendChild(bubble);
  inner.appendChild(timeEl);
  div.appendChild(avatar);
  div.appendChild(inner);
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function appendTyping() {
  const messages = document.getElementById('chatMessages');
  const wrap = document.createElement('div');
  wrap.className = 'chat-msg ai';
  wrap.innerHTML = `
    <div class="chat-avatar">🤖</div>
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  messages.appendChild(wrap);
  messages.scrollTop = messages.scrollHeight;
  return wrap;
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}

/* ════════════════════════════════
   AI 채팅 → 플랜 자동 재조정
   ════════════════════════════════ */
/* 재조정 시 특정 탭의 체크 상태 초기화 */
function clearAdjustState(type) {
  /* type: 'meals' | 'workouts' */
  const state = loadTodayState();
  state[type] = {};
  saveTodayState(state);
  if (type === 'workouts') workoutState = {};
}

async function handleMealAdjust(reason) {
  const userData       = Storage.getUser();
  const currentPlan    = userData.aiMealPlan;
  const targetCalories = calcTargetCalories(userData);
  if (!currentPlan) return;

  const accumulated = [...(userData.mealAdjustReasons || []), reason];

  const typingEl = appendTyping();
  try {
    const res = await fetch(`${AI_SERVER}/api/meal/adjust`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPlan, reasons: accumulated, targetCalories }),
    });
    if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    clearAdjustState('meals');           /* 기존 식단 체크 초기화 */
    Storage.mergeUser({ aiMealPlan: json.data, mealAdjustReasons: accumulated });
    renderMealItems(json.data);
    applyIcons();
    initMealVerify();
    initMealSkip();
    updateMealSummary(0, 0);             /* 요약 0으로 리셋 */

    /* 오늘 daily 플랜도 Firestore에 반영 → 안드로이드 즉시 동기화 */
    const _uid = getCurrentUid();
    if (_uid && typeof db !== 'undefined') {
      const _d = new Date();
      const _today = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;
      db.collection('users').doc(_uid).collection('daily').doc(_today)
        .set({ plan: { mealPlan: json.data } }, { merge: true }).catch(console.error);
    }

    typingEl.remove();
    appendMessage('ai', `✅ "${reason}" 사유로 식단을 수정했어요! 식단 탭에서 확인해보세요.`);
  } catch (err) {
    typingEl.remove();
    appendMessage('ai', `식단 수정 중 오류가 발생했어요: ${err.message}`);
  }
}

async function handleExerciseAdjust(reason) {
  const userData    = Storage.getUser();
  const currentPlan = userData.aiWorkoutPlan;
  const targetWeeks = userData.goalWeeks;
  if (!currentPlan) return;

  const accumulated = [...(userData.workoutAdjustReasons || []), reason];

  const typingEl = appendTyping();
  try {
    const res = await fetch(`${AI_SERVER}/api/exercise/adjust`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPlan, reasons: accumulated, targetWeeks, bmi: userData.bmi, activityLevel: userData.activityLevel }),
    });
    if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    clearAdjustState('workouts');        /* 기존 운동 체크 초기화 */
    Storage.mergeUser({ aiWorkoutPlan: json.data, workoutAdjustReasons: accumulated });
    renderWorkoutItems(json.data);
    applyIcons();
    initWorkoutCheck();
    updateWorkoutSummary();              /* 달성률 0으로 리셋 */

    /* 오늘 daily 플랜도 Firestore에 반영 → 안드로이드 즉시 동기화 */
    const _uid = getCurrentUid();
    if (_uid && typeof db !== 'undefined') {
      const _d = new Date();
      const _today = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;
      db.collection('users').doc(_uid).collection('daily').doc(_today)
        .set({ plan: { workoutPlan: json.data } }, { merge: true }).catch(console.error);
    }

    typingEl.remove();
    appendMessage('ai', `✅ "${reason}" 사유로 운동 플랜을 수정했어요! 운동 탭에서 확인해보세요.`);
  } catch (err) {
    typingEl.remove();
    appendMessage('ai', `운동 수정 중 오류가 발생했어요: ${err.message}`);
  }
}

/* ════════════════════════════════
   자세 인증 복귀 시 자동 체크
   hc503 → sc311?tab=workout&poseVerified=운동명
   ════════════════════════════════ */
function checkPoseVerified() {
  const params   = new URLSearchParams(location.search);
  const verified = params.get('poseVerified');
  if (!verified) return;

  /* 운동명 일치하는 항목 찾아서 ✓ 자동 클릭 */
  document.querySelectorAll('.workout-item').forEach(item => {
    const nameEl = item.querySelector('.workout-name');
    if (nameEl && nameEl.textContent.trim() === verified) {
      const checkBtn = item.querySelector('.workout-check');
      if (checkBtn && !checkBtn.classList.contains('done')) {
        checkBtn.click();
      }
    }
  });

  /* URL에서 poseVerified 파라미터 제거 (새로고침 시 재실행 방지) */
  const url = new URL(location.href);
  url.searchParams.delete('poseVerified');
  history.replaceState({}, '', url.toString());
}

/* ════════════════════════════════
   동기부여 메시지
   ════════════════════════════════ */
async function fetchMotivation() {
  const textEl = document.getElementById('motivationText');
  if (!textEl) return;

  const today   = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const cacheKey = lsKey('motivationMsg', dateStr);

  const cached = localStorage.getItem(cacheKey);
  if (cached) { textEl.textContent = cached; return; }

  let missedCount = 0;
  const missedTypes = { meal: 0, workout: 0 };
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const key  = lsKey('check', dStr);
    try {
      const chk = JSON.parse(localStorage.getItem(key)) || {};
      if (!chk.meal)    missedTypes.meal++;
      if (!chk.workout) missedTypes.workout++;
      if (!chk.meal || !chk.workout) missedCount++;
    } catch { missedCount++; }
  }

  const reasons = [];
  if (missedTypes.meal > 0)    reasons.push(`식단 미인증 ${missedTypes.meal}일`);
  if (missedTypes.workout > 0) reasons.push(`운동 미이행 ${missedTypes.workout}일`);
  const missedReasons = reasons.join(', ') || '없음';

  const userData    = Storage.getUser();
  const userInfoStr = [
    userData.gender       ? `성별 ${userData.gender}`         : '',
    userData.weight       ? `체중 ${userData.weight}kg`       : '',
    userData.targetWeight ? `목표 ${userData.targetWeight}kg` : '',
    userData.goalWeeks    ? `기간 ${userData.goalWeeks}주`    : '',
  ].filter(Boolean).join(', ');

  try {
    const res = await fetch(`${AI_SERVER}/api/motivation`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userInfo: userInfoStr, missedCount, missedReasons }),
    });
    if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    const msg = json.message.trim();
    textEl.textContent = msg;
    localStorage.setItem(cacheKey, msg);
  } catch (err) {
    textEl.textContent = '오늘도 건강한 하루 보내세요! 💪';
    console.warn('동기부여 메시지 로드 실패:', err.message);
  }
}

/* ════════════════════════════════
   운동 루틴 저장 / 불러오기
   ════════════════════════════════ */
function routineStorageKey() {
  const uid = getCurrentUid() || 'anon';
  return `savedRoutines_${uid}`;
}

function getSavedRoutines() {
  try { return JSON.parse(localStorage.getItem(routineStorageKey())) || []; }
  catch { return []; }
}

/* 새 기기 로그인 시 Firestore에서 루틴 복원 */
async function restoreRoutinesFromFirestore() {
  const uid = getCurrentUid();
  if (!uid || typeof db === 'undefined') return;
  if (localStorage.getItem(routineStorageKey())) return; /* 이미 로컬 데이터 있으면 스킵 */
  try {
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists && Array.isArray(doc.data().savedRoutines)) {
      localStorage.setItem(routineStorageKey(), JSON.stringify(doc.data().savedRoutines));
    }
  } catch (e) {
    console.warn('[sc311] 루틴 Firestore 복원 실패:', e.message);
  }
}

function initRoutineButtons() {
  const bar     = document.getElementById('routineActionBar');
  const saveBtn = document.getElementById('routineSaveBtn');
  const loadBtn = document.getElementById('routineLoadBtn');
  if (!bar) return;

  /* 운동 플랜이 있을 때만 버튼 표시 */
  const data = Storage.getUser();
  if (data.aiWorkoutPlan) bar.style.display = 'flex';

  saveBtn?.addEventListener('click', saveWorkoutRoutine);
  loadBtn?.addEventListener('click', showRoutineModal);
}

function saveWorkoutRoutine() {
  const data = Storage.getUser();
  const plan = data.aiWorkoutPlan;
  if (!plan) { showToast('저장할 운동 플랜이 없어요'); return; }

  const today        = new Date();
  const defaultLabel = `${today.getMonth()+1}/${today.getDate()} 루틴`;
  showRoutineNameModal(defaultLabel, (label) => {
    const saved = getSavedRoutines();
    saved.unshift({ label, plan, savedAt: Date.now() });
    if (saved.length > 5) saved.pop();
    localStorage.setItem(routineStorageKey(), JSON.stringify(saved));

    /* Firestore 동기화 (크로스 디바이스 루틴 유지) */
    const uid = getCurrentUid();
    if (uid && typeof db !== 'undefined') {
      db.collection('users').doc(uid)
        .set({ savedRoutines: saved }, { merge: true })
        .catch(console.error);
    }

    showToast('루틴이 저장됐어요! 📂');
  });
}

function showRoutineNameModal(defaultLabel, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'routine-modal-overlay';
  overlay.innerHTML = `
    <div class="routine-modal" style="padding-bottom:24px;">
      <div class="routine-modal-header">
        <span class="routine-modal-title">💾 루틴 이름 지정</span>
        <button class="routine-modal-close" id="routineNameClose">✕</button>
      </div>
      <input id="routineNameInput" class="routine-name-input"
        type="text" maxlength="20" value="${defaultLabel}" placeholder="루틴 이름 입력" />
      <button class="routine-name-save-btn" id="routineNameSave">저장</button>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('show')));

  const input = overlay.querySelector('#routineNameInput');
  setTimeout(() => { input.focus(); input.select(); }, 280);

  const close = () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 260);
  };

  overlay.querySelector('#routineNameClose').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  const doSave = () => {
    const label = input.value.trim() || defaultLabel;
    close();
    onConfirm(label);
  };
  overlay.querySelector('#routineNameSave').addEventListener('click', doSave);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSave(); });
}

function showRoutineModal() {
  const saved = getSavedRoutines();

  const overlay = document.createElement('div');
  overlay.className = 'routine-modal-overlay';
  overlay.innerHTML = `
    <div class="routine-modal">
      <div class="routine-modal-header">
        <span class="routine-modal-title">📂 저장된 루틴</span>
        <button class="routine-modal-close" id="routineModalClose">✕</button>
      </div>
      ${saved.length === 0
        ? '<div class="routine-empty">저장된 루틴이 없어요.<br>"이 루틴 저장" 버튼으로 저장해보세요.</div>'
        : saved.map((r, i) => `
          <div class="routine-item">
            <div class="routine-item-info">
              <div class="routine-item-name">${r.label}</div>
              <div class="routine-item-date">${new Date(r.savedAt).toLocaleDateString('ko-KR')}</div>
            </div>
            <button class="routine-item-load-btn" data-idx="${i}">불러오기</button>
          </div>`).join('')
      }
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('show')));

  const close = () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 260);
  };
  overlay.querySelector('#routineModalClose')?.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  overlay.querySelectorAll('.routine-item-load-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx     = parseInt(btn.dataset.idx, 10);
      const routine = saved[idx];
      if (!routine) return;
      close();
      /* 저장된 루틴을 현재 AI 플랜으로 적용 */
      clearAdjustState('workouts');
      Storage.mergeUser({ aiWorkoutPlan: routine.plan });
      renderWorkoutItems(routine.plan);
      applyIcons();
      initWorkoutCheck();
      updateWorkoutSummary();
      showToast(`"${routine.label}" 루틴을 불러왔어요!`);
    });
  });
}

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