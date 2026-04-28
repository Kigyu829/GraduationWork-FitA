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

window.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  renderPageSubtitle();
  initTabs();
  renderAiPlan();
  initAiChat();
  initCommonOverlays();  /* common.js — AI상담/히스토리 오버레이 */
  bindMenuBtns();
  bindLogout();
  bindLogoClick();
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
}

/* 식단 항목 업데이트 */
function renderMealItems(mealPlan) {
  const MEAL_KEYS = ['breakfast', 'lunch', 'dinner'];
  let totalKcal = 0;

  MEAL_KEYS.forEach(key => {
    const meal = mealPlan[key];
    if (!meal) return;

    const item = document.getElementById(`meal-${key}`);
    if (!item) return;

    const menuArr  = Array.isArray(meal.menu) ? meal.menu : [meal.menu];
    const menuText = menuArr.join(' + ');

    item.querySelector('.meal-name').textContent   = menuText;
    item.querySelector('.meal-detail').textContent = meal.desc || '';
    item.querySelector('.meal-kcal').textContent   = `${meal.calories} kcal`;

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
      html += `
        <div class="workout-item" data-workout="${id}" data-kcal="${kcal}">
          <div class="workout-icon"></div>
          <div class="workout-info">
            <div class="workout-name">${item.name}</div>
            <div class="workout-detail">${detail}</div>
          </div>
          <a href="hc503.html?exercise=${encodeURIComponent(item.name)}"
             class="pose-btn"
             onclick="event.stopPropagation()"
             title="자세 확인하기">자세 확인</a>
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
    if (iconEl) iconEl.textContent = getFoodIcon(name);
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
let TOTAL_MEAL_KCAL = 1820;

function initMealVerify() {
  document.querySelectorAll('.verify-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const meal = btn.dataset.meal;
      const kcal = parseInt(btn.dataset.kcal, 10);
      location.href = `sc401.html?${new URLSearchParams({ meal, kcal }).toString()}`;
    });
  });
}

/* ── 인증 완료 상태 복원 ── */
function restoreMealState(state) {
  let verifiedKcal  = 0;
  let verifiedCount = 0;

  Object.entries(state.meals || {}).forEach(([meal, data]) => {
    if (data.verified) {
      const btn  = document.querySelector(`.verify-btn[data-meal="${meal}"]`);
      const item = document.getElementById(`meal-${meal}`);

      if (!data.skipped) {
        /* 일반 인증 */
        if (btn) { btn.textContent = '✅ 완료'; btn.classList.add('done'); }
        if (item) item.classList.add('verified');
      } else {
        /* 안먹었어요 */
        const skipBtn   = document.querySelector(`.skip-btn[data-meal="${meal}"]`);
        if (skipBtn)  { skipBtn.textContent = '🚫 건너뜀'; skipBtn.classList.add('done'); }
        if (btn)      { btn.disabled = true; btn.style.opacity = '0.4'; }
        if (item)     item.classList.add('skipped');
      }

      verifiedKcal  += data.kcal || 0;
      verifiedCount += 1;
    }
  });

  updateMealSummary(verifiedKcal, verifiedCount);
}

function updateMealSummary(verifiedKcal, verifiedCount) {
  const totalKcalEl   = document.getElementById('totalKcal');
  const verifiedKcalEl = document.getElementById('verifiedKcal');
  const remainKcalEl  = document.getElementById('remainKcal');
  const verifiedCntEl = document.getElementById('verifiedCount');

  if (verifiedKcalEl) verifiedKcalEl.textContent = verifiedKcal.toLocaleString();
  if (remainKcalEl)   remainKcalEl.textContent   = (TOTAL_MEAL_KCAL - verifiedKcal).toLocaleString();
  if (verifiedCntEl)  verifiedCntEl.textContent  = `${verifiedCount}/3`;
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
    let vKcal = 0, vCount = 0;
    Object.values(stateNow.meals || {}).forEach(d => {
      if (d.verified) { vKcal += d.kcal || 0; vCount++; }
    });
    updateMealSummary(vKcal, vCount);
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
  if (kcalEl) kcalEl.textContent = `${burnKcal} kcal`;

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
function restoreTodayState() {
  const state = loadTodayState();
  restoreMealState(state);
  restoreWorkoutState(state);
}

/* ════════════════════════════════
   AI 채팅 사이드패널 (socket.io 스트리밍)
   ════════════════════════════════ */
const chatHistory = [];

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

    appendMessage('user', text);
    chatHistory.push({ role: 'user', text });
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

    /* 스트리밍: 토큰 도착 시 버블에 추가 */
    socket.off('chat_token').on('chat_token', (token) => {
      bubble.textContent += token;
      document.getElementById('chatMessages').scrollTop = 999999;
    });

    /* 완료: 최종 텍스트 확정 + 액션 처리 */
    socket.off('chat_done').on('chat_done', ({ reply, action, reason }) => {
      const finalReply = reply || bubble.textContent || '죄송해요, 응답을 받지 못했어요.';
      bubble.textContent = finalReply;
      chatHistory.push({ role: 'ai', text: finalReply });
      sendBtn.disabled = false;
      socket.off('chat_token'); socket.off('chat_done'); socket.off('chat_error');

      if (action === 'meal_adjust' && reason)          handleMealAdjust(reason);
      else if (action === 'exercise_adjust' && reason) handleExerciseAdjust(reason);
    });

    /* 오류 처리 */
    socket.off('chat_error').on('chat_error', (errMsg) => {
      bubble.textContent = `오류가 발생했어요: ${errMsg}`;
      sendBtn.disabled = false;
      socket.off('chat_token'); socket.off('chat_done'); socket.off('chat_error');
    });

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
}

function appendMessage(role, text) {
  const messages = document.getElementById('chatMessages');
  if (!messages) return;

  const now  = new Date();
  const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  div.innerHTML = `
    <div class="chat-avatar">${role === 'ai' ? '🤖' : '👤'}</div>
    <div>
      <div class="chat-bubble">${text}</div>
      <div class="chat-time">${role === 'ai' ? 'AI 상담사' : '나'} · ${time}</div>
    </div>
  `;
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
function calcTargetCalories(userData) {
  const weight       = Number(userData.weight);
  const height       = Number(userData.height);
  const targetWeight = Number(userData.targetWeight);
  const goalWeeks    = Number(userData.goalWeeks) || 12;
  const gender       = userData.gender;
  const birth        = userData.birth || '';

  const age = birth ? new Date().getFullYear() - Number(birth.slice(0, 4)) : 25;
  const bmr = gender === '남성'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  const actMap = { '낮음': 1.2, '보통': 1.375, '높음': 1.55, '매우높음': 1.725, '선수': 1.9 };
  const tdee   = Math.round(bmr * (actMap[userData.activityLevel] || 1.375));

  const weightToLose = Math.max(0, weight - targetWeight);
  const dailyDeficit = Math.min(Math.round((weightToLose * 7700) / (goalWeeks * 7)), 1000);
  return Math.max(1200, tdee - dailyDeficit);
}

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

  const typingEl = appendTyping();
  try {
    const res = await fetch(`${AI_SERVER}/api/meal/adjust`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPlan, reasons: [reason], targetCalories }),
    });
    if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    clearAdjustState('meals');           /* 기존 식단 체크 초기화 */
    Storage.mergeUser({ aiMealPlan: json.data });
    renderMealItems(json.data);
    applyIcons();
    initMealVerify();
    initMealSkip();
    updateMealSummary(0, 0);             /* 요약 0으로 리셋 */

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

  const typingEl = appendTyping();
  try {
    const res = await fetch(`${AI_SERVER}/api/exercise/adjust`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPlan, reasons: [reason], targetWeeks, bmi: userData.bmi }),
    });
    if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    clearAdjustState('workouts');        /* 기존 운동 체크 초기화 */
    Storage.mergeUser({ aiWorkoutPlan: json.data });
    renderWorkoutItems(json.data);
    applyIcons();
    initWorkoutCheck();
    updateWorkoutSummary();              /* 달성률 0으로 리셋 */

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