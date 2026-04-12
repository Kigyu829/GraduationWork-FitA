/* ============================================================
   sc311.js — 오늘의 식단/운동
   의존: common.js

   [기능]
   - AI 서버(port 5000)에서 받아온 플랜을 동적 렌더링
   - 식단/운동 탭 전환
   - 식단 인증 버튼 → sc401로 이동 (끼니 정보 전달)
   - 운동 체크박스 → 달성 칼로리 누적
   - 우측 AI 채팅 사이드패널 (실제 /api/chat 연결)
   ============================================================ */

'use strict';

const AI_SERVER = 'http://localhost:5000';

window.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  renderPageSubtitle();
  initTabs();
  renderAiPlan();        /* ← AI 플랜 렌더링 (applyIcons/initMealVerify/initWorkoutCheck 포함) */
  initAiChat();
  bindMenuBtns();
  bindLogout();
  bindLogoClick();
  restoreTodayState();
  fetchMotivation();     /* ← 동기부여 메시지 */
});

/* ════════════════════════════════
   AI 플랜 렌더링 (localStorage → DOM)
   sc302에서 저장한 aiMealPlan, aiWorkoutPlan을 읽어
   식단/운동 섹션을 동적으로 업데이트
   ════════════════════════════════ */
function renderAiPlan() {
  const userData = Storage.getUser();
  const mealPlan    = userData.aiMealPlan;
  const workoutPlan = userData.aiWorkoutPlan;

  if (mealPlan)    renderMealItems(mealPlan);
  if (workoutPlan) renderWorkoutItems(workoutPlan);

  applyIcons();
  initMealVerify();
  initWorkoutCheck();
}

/* 식단 항목 업데이트 (breakfast / lunch / dinner) */
function renderMealItems(mealPlan) {
  const MEAL_KEYS = ['breakfast', 'lunch', 'dinner'];
  let totalKcal = 0;

  MEAL_KEYS.forEach(key => {
    const meal = mealPlan[key];
    if (!meal) return;

    const item = document.getElementById(`meal-${key}`);
    if (!item) return;

    const menuText = Array.isArray(meal.menu) ? meal.menu.join(' + ') : meal.menu;
    item.querySelector('.meal-name').textContent  = menuText;
    item.querySelector('.meal-detail').textContent = meal.desc || '';
    item.querySelector('.meal-kcal').textContent  = `${meal.calories} kcal`;

    const btn = item.querySelector('.verify-btn');
    if (btn) {
      btn.dataset.kcal = meal.calories;
      if (meal.main_food) btn.dataset.mainFood = meal.main_food;
    }

    /* main_food 힌트 표시 */
    if (meal.main_food) {
      let hintEl = item.querySelector('.meal-main-food');
      if (!hintEl) {
        hintEl = document.createElement('div');
        hintEl.className = 'meal-main-food';
        item.querySelector('.meal-detail')?.insertAdjacentElement('afterend', hintEl);
      }
      hintEl.textContent = `📷 ${meal.main_food}을(를) 인증하세요`;
      hintEl.style.cssText = 'font-size:11px;color:var(--teal,#4ECDC4);margin-top:3px;';
    }

    totalKcal += meal.calories || 0;
  });


  /* 총 칼로리 표시 업데이트 */
  const totalKcalEl = document.getElementById('totalKcal');
  if (totalKcalEl) totalKcalEl.textContent = totalKcal.toLocaleString();
  TOTAL_MEAL_KCAL = totalKcal;

  /* 오늘의 팁 표시 (있으면) */
  if (mealPlan.tip) {
    const tipEl = document.getElementById('mealTip');
    if (tipEl) tipEl.textContent = `💡 ${mealPlan.tip}`;
  }
}

/* 운동 목록 동적 렌더링 (warmup / main / cooldown) */
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
          <div class="workout-kcal">${kcal} kcal</div>
          <div class="workout-check" data-workout="${id}" data-kcal="${kcal}">✓</div>
        </div>`;
    });
    html += '</div>';
  });

  if (workoutPlan.tip) {
    html += `<div class="ai-tip" style="margin-top:16px;padding:12px;background:var(--card);border-radius:10px;font-size:13px;color:var(--text-sec);">💡 ${workoutPlan.tip}</div>`;
  }

  /* 기존 운동 목록 교체 (summary 유지) */
  Array.from(container.children).forEach(child => {
    if (child !== summaryDiv) child.remove();
  });
  summaryDiv.insertAdjacentHTML('afterend', html);
}

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
let TOTAL_MEAL_KCAL = 0; /* renderMealItems에서 AI 플랜 총 칼로리로 업데이트됨 */

function initMealVerify() {
  document.querySelectorAll('.verify-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const meal     = btn.dataset.meal;
      const kcal     = parseInt(btn.dataset.kcal, 10);
      const mainFood = btn.dataset.mainFood || '';

      /* sc401로 이동 — URL 파라미터로 끼니 정보 전달 */
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
  if (verifiedCntEl)  verifiedCntEl.textContent  = `${verifiedCount}/3`;
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

  /* 전체 운동 완료 시 sc301 대시보드 체크 자동 설정 */
  const allDone  = totalItems > 0 && doneItems === totalItems;
  const today    = new Date();
  const dateStr  = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const checkKey = `check_${dateStr}`;
  try {
    const state    = JSON.parse(localStorage.getItem(checkKey)) || { meal: false, workout: false };
    state.workout  = allDone;
    localStorage.setItem(checkKey, JSON.stringify(state));
  } catch(e) {
    localStorage.setItem(checkKey, JSON.stringify({ meal: false, workout: allDone }));
  }
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
   AI 채팅 사이드패널 (AI 서버 /api/chat 연결)
   ════════════════════════════════ */
const chatHistory = []; /* { role: 'user'|'ai', text: string } */

async function callAiChat(message) {
  const userData = Storage.getUser();

  const userInfoStr = [
    userData.gender      ? `성별 ${userData.gender}`          : '',
    userData.height      ? `키 ${userData.height}cm`          : '',
    userData.weight      ? `체중 ${userData.weight}kg`        : '',
    userData.targetWeight? `목표 ${userData.targetWeight}kg`  : '',
    userData.goalWeeks   ? `기간 ${userData.goalWeeks}주`     : '',
  ].filter(Boolean).join(', ');

  const recentHistory = chatHistory.slice(-6)
    .map(h => `${h.role === 'user' ? '사용자' : 'AI'}: ${h.text}`)
    .join('\n');

  const res = await fetch(`${AI_SERVER}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      userInfo:     userInfoStr,
      mealPlan:     userData.aiMealPlan    || null,
      workoutPlan:  userData.aiWorkoutPlan || null,
      recentHistory,
    }),
  });

  if (!res.ok) throw new Error(`AI 서버 오류 (${res.status})`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json;
}

function initAiChat() {
  const toggleBtn = document.getElementById('aiChatToggleBtn');
  const panel     = document.getElementById('aiChatPanel');
  const closeBtn  = document.getElementById('chatCloseBtn');
  const sendBtn   = document.getElementById('chatSendBtn');
  const input     = document.getElementById('chatInput');

  /* 토글 */
  toggleBtn?.addEventListener('click', () => {
    const isOpen = panel.classList.toggle('open');
    toggleBtn.classList.toggle('active', isOpen);
  });

  /* sc302에서 "AI 상담으로 수정하기" 클릭 시 채팅 패널 자동 오픈 */
  if (new URLSearchParams(location.search).get('openChat') === '1') {
    panel?.classList.add('open');
    toggleBtn?.classList.add('active');
  }

  closeBtn?.addEventListener('click', () => {
    panel.classList.remove('open');
    toggleBtn.classList.remove('active');
  });

  /* 전송 */
  function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    appendMessage('user', text);
    chatHistory.push({ role: 'user', text });
    input.value = '';
    autoResizeTextarea(input);

    const typingEl = appendTyping();

    callAiChat(text)
      .then(result => {
        typingEl.remove();
        const reply = result.reply || '죄송해요, 응답을 받지 못했어요.';
        appendMessage('ai', reply);
        chatHistory.push({ role: 'ai', text: reply });

        /* action 감지 → 식단/운동 자동 재조정 */
        if (result.action === 'meal_adjust' && result.reason) {
          handleMealAdjust(result.reason);
        } else if (result.action === 'exercise_adjust' && result.reason) {
          handleExerciseAdjust(result.reason);
        }
      })
      .catch(err => {
        typingEl.remove();
        appendMessage('ai', `오류가 발생했어요: ${err.message}`);
      });
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

/* ════════════════════════════════
   AI 채팅 → 플랜 자동 재조정
   action: "meal_adjust" | "exercise_adjust"
   ════════════════════════════════ */
/* 대시보드/sc302와 동일한 Mifflin-St Jeor 기반 목표 칼로리 계산 */
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

  const actMap = { '낮음': 1.2, '보통': 1.375, '높음': 1.55 };
  const tdee   = Math.round(bmr * (actMap[userData.activityLevel] || 1.375));

  const weightToLose = Math.max(0, weight - targetWeight);
  const dailyDeficit = Math.min(Math.round((weightToLose * 7700) / (goalWeeks * 7)), 1000);
  return Math.max(1200, tdee - dailyDeficit);
}

async function handleMealAdjust(reason) {
  const userData       = Storage.getUser();
  const currentPlan    = userData.aiMealPlan;
  const targetCalories = calcTargetCalories(userData);
  if (!currentPlan) return;

  const typingEl = appendTyping();
  try {
    const res = await fetch(`${AI_SERVER}/api/meal/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPlan, reasons: [reason], targetCalories }),
    });
    if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    /* localStorage 업데이트 */
    Storage.mergeUser({ aiMealPlan: json.data });

    /* 식단 탭 다시 렌더 */
    renderMealItems(json.data);
    applyIcons();
    restoreMealState(loadTodayState());

    typingEl.remove();
    appendMessage('ai', '✅ 식단을 수정했어요! 식단 탭에서 확인해보세요.');
  } catch (err) {
    typingEl.remove();
    appendMessage('ai', `식단 수정 중 오류가 발생했어요: ${err.message}`);
  }
}

/* ════════════════════════════════
   동기부여 메시지 (오늘 하루 1회 캐시)
   최근 7일 미이행 횟수를 계산해서 /api/motivation에 전달
   ════════════════════════════════ */
async function fetchMotivation() {
  const textEl = document.getElementById('motivationText');
  if (!textEl) return;

  /* 오늘 날짜 키 */
  const today   = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const cacheKey = `motivationMsg_${dateStr}`;

  /* 오늘 이미 받은 메시지 있으면 캐시 사용 */
  const cached = localStorage.getItem(cacheKey);
  if (cached) { textEl.textContent = cached; return; }

  /* 최근 7일 미이행 횟수 계산 */
  let missedCount = 0;
  const missedTypes = { meal: 0, workout: 0 };
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `check_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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

  /* 사용자 정보 문자열 */
  const userData = Storage.getUser();
  const userInfoStr = [
    userData.gender       ? `성별 ${userData.gender}`         : '',
    userData.weight       ? `체중 ${userData.weight}kg`       : '',
    userData.targetWeight ? `목표 ${userData.targetWeight}kg` : '',
    userData.goalWeeks    ? `기간 ${userData.goalWeeks}주`    : '',
  ].filter(Boolean).join(', ');

  try {
    const res = await fetch(`${AI_SERVER}/api/motivation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userInfo: userInfoStr, missedCount, missedReasons }),
    });
    if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    const msg = json.message.trim();
    textEl.textContent = msg;
    localStorage.setItem(cacheKey, msg);   /* 오늘 하루 캐시 */
  } catch (err) {
    textEl.textContent = '오늘도 건강한 하루 보내세요! 💪';
    console.warn('동기부여 메시지 로드 실패:', err.message);
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPlan, reasons: [reason], targetWeeks }),
    });
    if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    /* localStorage 업데이트 */
    Storage.mergeUser({ aiWorkoutPlan: json.data });

    /* 운동 탭 다시 렌더 (요소 재생성 → 리스너 재등록 필요) */
    renderWorkoutItems(json.data);
    applyIcons();
    initWorkoutCheck();
    restoreWorkoutState(loadTodayState());

    typingEl.remove();
    appendMessage('ai', '✅ 운동 플랜을 수정했어요! 운동 탭에서 확인해보세요.');
  } catch (err) {
    typingEl.remove();
    appendMessage('ai', `운동 수정 중 오류가 발생했어요: ${err.message}`);
  }
}
