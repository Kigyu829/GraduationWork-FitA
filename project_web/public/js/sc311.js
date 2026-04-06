/* ============================================================
   sc311.js — 오늘의 식단/운동
   의존: common.js

   [기능]
   - 식단/운동 탭 전환
   - 식단 인증 버튼 → sc401로 이동 (끼니 정보 전달)
   - 운동 체크박스 → 달성 칼로리 누적
   - 우측 AI 채팅 사이드패널 토글
   ============================================================ */

'use strict';

window.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  renderPageSubtitle();
  initTabs();
  applyIcons();          /* ← 아이콘 매핑 적용 */
  initMealVerify();
  initWorkoutCheck();
  initAiChat();
  bindMenuBtns();
  bindLogout();
  bindLogoClick();
  restoreTodayState();
});

/* ════════════════════════════════
   아이콘 매핑 적용
   HTML의 .meal-emoji, .workout-icon 안을
   common.js의 getFoodIcon / getWorkoutIcon으로 채움
   ════════════════════════════════ */
function applyIcons() {
  /* 식단 아이콘: .meal-item 안의 .meal-emoji에 .meal-name 텍스트로 결정 */
  document.querySelectorAll('.meal-item').forEach(item => {
    const name    = item.querySelector('.meal-name')?.textContent || '';
    const iconEl  = item.querySelector('.meal-emoji');
    if (iconEl) iconEl.textContent = getFoodIcon(name);   /* common.js */
  });

  /* 운동 아이콘: .workout-item 안의 .workout-icon에 .workout-name으로 결정 */
  document.querySelectorAll('.workout-item').forEach(item => {
    const name   = item.querySelector('.workout-name')?.textContent || '';
    const iconEl = item.querySelector('.workout-icon');
    if (iconEl) iconEl.textContent = getWorkoutIcon(name); /* common.js */
  });
}

/* ════════════════════════════════
   사이드바
   ════════════════════════════════ */
function renderSidebar() {
  const data = Storage.getUser();
  const reg  = Storage.getRegistered();

  const nameEl = document.getElementById('userName');
  const infoEl = document.getElementById('userBasicInfo');
  const cwEl   = document.getElementById('currentWeightText');
  const twEl   = document.getElementById('targetWeightText');

  if (nameEl) nameEl.textContent = reg.nickname ? `${reg.nickname}님` : '사용자';
  if (infoEl) {
    const parts = [];
    if (data.gender) parts.push(data.gender);
    if (data.height) parts.push(`키 ${data.height}cm`);
    infoEl.textContent = parts.join(' · ') || '기본 정보 없음';
  }
  if (cwEl) cwEl.textContent = data.weight      ? `${data.weight}kg`      : '-';
  if (twEl) twEl.textContent = data.targetWeight ? `${data.targetWeight}kg` : '-';
}

function renderPageSubtitle() {
  const el = document.getElementById('pageSubtitle');
  if (el) el.textContent = formatDate();  /* common.js */
}

function bindLogout() {
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('healthUserData');
    location.href = 'sc101.html';
  });
}

function bindLogoClick() {
  document.getElementById('sidebarLogo')?.addEventListener('click', () => {
    /* 로그인 후 페이지이므로 로고 클릭 시 대시보드로 이동 */
    location.href = 'sc301.html';
  });
}

/* ════════════════════════════════
   탭 전환
   ════════════════════════════════ */
function initTabs() {
  const tabBtns    = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(`tabContent${capitalize(target)}`)?.classList.add('active');
    });
  });

  /* sc301에서 카드 클릭 시 ?tab=meal 또는 ?tab=workout 파라미터로 탭 자동 선택 */
  const params   = new URLSearchParams(location.search);
  const initTab  = params.get('tab');
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
  return `sc311_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
const TOTAL_MEAL_KCAL = 1820;

function initMealVerify() {
  document.querySelectorAll('.verify-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const meal = btn.dataset.meal;
      const kcal = parseInt(btn.dataset.kcal, 10);

      /* sc401로 이동 — URL 파라미터로 끼니 정보 전달 */
      const params = new URLSearchParams({ meal, kcal });
      location.href = `sc401.html?${params.toString()}`;
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
      if (btn) {
        btn.textContent = '✅ 완료';
        btn.classList.add('done');
      }
      if (item) item.classList.add('verified');
      verifiedKcal  += data.kcal || 0;
      verifiedCount += 1;
    }
  });

  updateMealSummary(verifiedKcal, verifiedCount);
}

function updateMealSummary(verifiedKcal, verifiedCount) {
  const totalKcalEl    = document.getElementById('totalKcal');
  const verifiedKcalEl = document.getElementById('verifiedKcal');
  const remainKcalEl   = document.getElementById('remainKcal');
  const verifiedCntEl  = document.getElementById('verifiedCount');

  if (verifiedKcalEl) verifiedKcalEl.textContent = verifiedKcal.toLocaleString();
  if (remainKcalEl)   remainKcalEl.textContent   = (TOTAL_MEAL_KCAL - verifiedKcal).toLocaleString();
  if (verifiedCntEl)  verifiedCntEl.textContent  = `${verifiedCount}/4`;
}

/* ════════════════════════════════
   운동 체크박스
   ════════════════════════════════ */
let workoutState = {}; /* { workoutId: { done, kcal } } */

function initWorkoutCheck() {
  document.querySelectorAll('.workout-check').forEach(btn => {
    btn.addEventListener('click', () => {
      const id   = btn.dataset.workout;
      const kcal = parseInt(btn.dataset.kcal, 10);

      const isDone = btn.classList.toggle('done');
      workoutState[id] = { done: isDone, kcal };

      /* 상태 저장 */
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
  const totalItems  = document.querySelectorAll('.workout-check').length;
  const doneItems   = document.querySelectorAll('.workout-check.done').length;
  const burnKcal    = Object.values(workoutState)
    .filter(d => d.done).reduce((s, d) => s + (d.kcal || 0), 0);

  const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  const pctEl  = document.getElementById('workoutPct');
  const fillEl = document.getElementById('workoutProgressFill');
  const kcalEl = document.getElementById('workoutBurnKcal');

  if (pctEl)  pctEl.textContent  = `${pct}%`;
  if (fillEl) fillEl.style.width = `${pct}%`;
  if (kcalEl) kcalEl.textContent = `${burnKcal} kcal`;
}

/* ════════════════════════════════
   오늘 상태 복원 (페이지 로드 시)
   ════════════════════════════════ */
function restoreTodayState() {
  const state = loadTodayState();
  restoreMealState(state);
  restoreWorkoutState(state);
}

/* ════════════════════════════════
   AI 채팅 사이드패널
   ════════════════════════════════ */
const AI_RESPONSES = [
  '좋은 질문이에요! 오늘 식단은 균형 잡힌 구성이에요. 단백질 섭취량이 특히 좋아요 💪',
  '운동 강도가 걱정되신다면, 처음엔 세트 수를 줄이고 점진적으로 늘려가는 게 좋아요.',
  '식사 사이 간격을 3~4시간으로 유지하면 혈당 조절에 도움이 돼요.',
  '오늘 음식 중 단백질이 풍부한 닭가슴살 샐러드는 근육 유지에 특히 좋아요!',
  '충분한 수분 섭취도 잊지 마세요. 하루 2L 이상을 목표로 해보세요.',
];
let aiResponseIdx = 0;

function initAiChat() {
  const toggleBtn  = document.getElementById('aiChatToggleBtn');
  const panel      = document.getElementById('aiChatPanel');
  const closeBtn   = document.getElementById('chatCloseBtn');
  const sendBtn    = document.getElementById('chatSendBtn');
  const input      = document.getElementById('chatInput');
  const messages   = document.getElementById('chatMessages');

  /* 토글 */
  toggleBtn?.addEventListener('click', () => {
    const isOpen = panel.classList.toggle('open');
    toggleBtn.classList.toggle('active', isOpen);
  });

  closeBtn?.addEventListener('click', () => {
    panel.classList.remove('open');
    toggleBtn.classList.remove('active');
  });

  /* 전송 */
  function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    appendMessage('user', text);
    input.value = '';
    autoResizeTextarea(input);

    /* 타이핑 인디케이터 */
    const typingEl = appendTyping();

    setTimeout(() => {
      typingEl.remove();
      const reply = AI_RESPONSES[aiResponseIdx % AI_RESPONSES.length];
      aiResponseIdx++;
      appendMessage('ai', reply);
    }, 1200 + Math.random() * 600);
  }

  sendBtn?.addEventListener('click', sendMessage);

  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  input?.addEventListener('input', () => autoResizeTextarea(input));
}

function appendMessage(role, text) {
  const messages = document.getElementById('chatMessages');
  if (!messages) return;

  const now = new Date();
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
