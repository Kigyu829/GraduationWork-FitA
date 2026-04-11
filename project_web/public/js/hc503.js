/* ============================================================
   hc503.js — AI 플랜 확인 페이지
   의존: common.js

   [흐름]
   sc302 완료 → hc503 (플랜 표시 + 확인)
   ① 괜찮아요  → sc301 이동
   ② 별로예요  → 우측 피드백 패널에 채팅 + 빠른버튼 표시
                → 피드백 전송 → AI 재생성 (백엔드 /api/meal/adjust, /api/exercise/adjust)
                → 기존 vs 새 플랜 비교 뷰 (중앙에 나란히 표시)
                → "이 플랜으로 시작" → 새 플랜 저장 후 sc301
                → "이전 플랜 유지"  → 기존 플랜 유지 후 sc301
   ============================================================ */

'use strict';

const AI_SERVER = 'http://localhost:5000';

const MEAL_ICONS  = { breakfast: '🌅', lunch: '☀️', dinner: '🌙' };
const MEAL_LABELS = { breakfast: '아침', lunch: '점심', dinner: '저녁' };

window.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  renderDateChip();
  renderCurrentPlan();
  bindButtons();
  bindLogoClick();
  bindLogout();
  bindMenuBtns();   /* common.js */
});

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

/* ── 날짜 칩 ── */
function renderDateChip() {
  const el = document.getElementById('hc503DateChip');
  if (!el) return;
  const d    = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  el.textContent = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} (${days[d.getDay()]})`;
}

/* ════════════════════════════════
   현재 플랜 렌더링
   ════════════════════════════════ */
function renderCurrentPlan() {
  const userData = Storage.getUser();
  renderMealPlan('current', userData.aiMealPlan);
  renderWorkoutPlan('current', userData.aiWorkoutPlan);
}

/* ── 식단 렌더 (prefix: 'current' | 'new') ── */
function renderMealPlan(prefix, mealPlan, oldPlan) {
  const listEl  = document.getElementById(`${prefix}MealList`);
  const totalEl = document.getElementById(`${prefix}MealTotal`);
  const tipEl   = document.getElementById(`${prefix}MealTip`);
  if (!listEl) return;

  if (!mealPlan) {
    listEl.innerHTML = '<div style="font-size:13px;color:var(--text-mute);padding:8px 0;">플랜 정보가 없어요.</div>';
    return;
  }

  listEl.innerHTML = ['breakfast', 'lunch', 'dinner'].map(key => {
    const meal = mealPlan[key];
    if (!meal) return '';

    const menu = Array.isArray(meal.menu) ? meal.menu.join(', ') : (meal.menu || '—');
    const kcal = meal.calories || 0;

    /* 변경 여부 감지 (새 플랜 렌더 시) */
    let changed = false;
    if (oldPlan && prefix === 'new') {
      const oldMeal = oldPlan[key];
      const oldMenu = Array.isArray(oldMeal?.menu) ? oldMeal.menu.join(', ') : (oldMeal?.menu || '');
      changed = oldMenu !== menu || oldMeal?.calories !== kcal;
    }

    return `
      <div class="plan-meal-row${changed ? ' changed' : ''}">
        <span class="plan-meal-icon">${MEAL_ICONS[key]}</span>
        <span class="plan-meal-label">${MEAL_LABELS[key]}</span>
        <span class="plan-meal-menu" title="${menu}">${menu}</span>
        <span class="plan-meal-kcal">${kcal.toLocaleString()} kcal</span>
      </div>
    `;
  }).join('');

  if (totalEl) {
    const total = mealPlan.total_calories || 0;
    totalEl.textContent = `하루 총 ${total.toLocaleString()} kcal`;
  }
  if (tipEl && mealPlan.tip) tipEl.textContent = `💡 ${mealPlan.tip}`;
}

/* ── 운동 렌더 ── */
function renderWorkoutPlan(prefix, workoutPlan, oldPlan) {
  const listEl  = document.getElementById(`${prefix}WorkoutList`);
  const totalEl = document.getElementById(`${prefix}WorkoutTotal`);
  if (!listEl) return;

  if (!workoutPlan) {
    listEl.innerHTML = '<div style="font-size:13px;color:var(--text-mute);padding:8px 0;">플랜 정보가 없어요.</div>';
    return;
  }

  const allItems = [
    ...(workoutPlan.warmup   || []),
    ...(workoutPlan.main     || []),
    ...(workoutPlan.cooldown || []),
  ];

  listEl.innerHTML = allItems.map(item => {
    const detail = item.sets && item.reps
      ? `${item.reps}회 × ${item.sets}세트`
      : (item.duration || '');
    const kcal = item.calories || 0;

    /* 변경 감지 */
    let changed = false;
    if (oldPlan && prefix === 'new') {
      const oldAll = [
        ...(oldPlan.warmup   || []),
        ...(oldPlan.main     || []),
        ...(oldPlan.cooldown || []),
      ];
      changed = !oldAll.some(o => o.name === item.name);
    }

    const icon = (typeof getWorkoutIcon === 'function') ? getWorkoutIcon(item.name) : '💪';

    return `
      <div class="plan-workout-row${changed ? ' changed' : ''}">
        <span class="plan-workout-icon">${icon}</span>
        <span class="plan-workout-name" title="${item.name}">${item.name}</span>
        <span class="plan-workout-detail">${detail}</span>
        <span class="plan-workout-kcal">${kcal} kcal</span>
      </div>
    `;
  }).join('');

  if (totalEl) {
    const dur  = workoutPlan.total_duration || 0;
    const kcal = workoutPlan.total_calories || 0;
    totalEl.textContent = `${dur}분 · 총 ${kcal} kcal 소모`;
  }
}

/* ════════════════════════════════
   버튼 바인딩
   ════════════════════════════════ */
function bindButtons() {
  /* 괜찮아요 → sc301 이동 */
  document.getElementById('btnLike')?.addEventListener('click', () => {
    const btn = document.getElementById('btnLike');
    btn?.classList.add('selected');
    document.getElementById('btnDislike')?.setAttribute('disabled', '');

    /* 짧은 딜레이 후 이동 (선택 피드백 보여줌) */
    setTimeout(() => { location.href = 'sc301.html'; }, 350);
  });

  /* 별로예요 → 채팅 영역 오픈 */
  document.getElementById('btnDislike')?.addEventListener('click', () => {
    openFeedbackChat();
  });

  /* 채팅 전송 */
  const sendBtn   = document.getElementById('chatSendBtn');
  const chatInput = document.getElementById('chatInput');

  sendBtn?.addEventListener('click', sendChatMessage);

  chatInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  chatInput?.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 80) + 'px';
  });

  /* 빠른 선택 버튼 */
  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const msg = btn.dataset.msg;
      const input = document.getElementById('chatInput');
      if (input) {
        input.value = msg;
        input.dispatchEvent(new Event('input'));
      }
      sendChatMessage();
    });
  });

  /* 새 플랜 확정 */
  document.getElementById('btnApplyNew')?.addEventListener('click', () => {
    const userData = Storage.getUser();
    if (userData.aiMealPlanNew)    Storage.mergeUser({ aiMealPlan:    userData.aiMealPlanNew,    aiMealPlanNew:    null });
    if (userData.aiWorkoutPlanNew) Storage.mergeUser({ aiWorkoutPlan: userData.aiWorkoutPlanNew, aiWorkoutPlanNew: null });
    Storage.mergeUser({ aiPlanDate: getPlanDateStr() });
    location.href = 'sc301.html';
  });

  /* 이전 플랜 유지 */
  document.getElementById('btnKeepOld')?.addEventListener('click', () => {
    Storage.mergeUser({ aiMealPlanNew: null, aiWorkoutPlanNew: null });
    location.href = 'sc301.html';
  });
}

/* ════════════════════════════════
   피드백 채팅 패널 열기
   ════════════════════════════════ */
function openFeedbackChat() {
  /* 별로예요 버튼 선택 상태로 */
  document.getElementById('btnDislike')?.classList.add('selected');
  /* 괜찮아요 버튼 비활성 */
  document.getElementById('btnLike')?.setAttribute('disabled', '');

  /* 구분선, 빠른 버튼, 채팅 영역 표시 */
  const divider  = document.getElementById('feedbackDivider');
  const quickBtns = document.getElementById('quickBtns');
  const chatWrap = document.getElementById('feedbackChatWrap');

  if (divider)  divider.style.display  = 'block';
  if (quickBtns) quickBtns.style.display = 'flex';
  if (chatWrap) chatWrap.style.display  = 'flex';

  /* 입력창 포커스 */
  setTimeout(() => {
    document.getElementById('chatInput')?.focus();
  }, 100);
}

/* ════════════════════════════════
   채팅 메시지 전송 → AI 재생성
   ════════════════════════════════ */
async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const text  = input?.value.trim();
  if (!text) return;

  appendMessage('user', text);
  if (input) { input.value = ''; input.style.height = 'auto'; }

  /* 빠른 버튼 숨기기 */
  const quickBtns = document.getElementById('quickBtns');
  if (quickBtns) quickBtns.style.display = 'none';

  const typingEl = appendTyping();

  try {
    await regenPlan(text);
    typingEl.remove();
    appendMessage('ai', '✅ 플랜을 다시 만들었어요! 가운데 화면에서 새 플랜과 비교해보세요.');
  } catch (err) {
    typingEl.remove();
    appendMessage('ai', `⚠️ 재생성 중 오류가 발생했어요: ${err.message}`);
  }
}

/* ── 플랜 재생성 API 호출 ── */
async function regenPlan(reason) {
  const userData    = Storage.getUser();
  const currentMeal = userData.aiMealPlan;
  const currentWork = userData.aiWorkoutPlan;

  const [mealRes, workRes] = await Promise.all([
    /* 식단 재생성 */
    fetch(`${AI_SERVER}/api/meal/adjust`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPlan:    currentMeal,
        reasons:        [reason],
        targetCalories: calcTargetCalories(userData),
      }),
    }),
    /* 운동 재생성 */
    fetch(`${AI_SERVER}/api/exercise/adjust`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPlan: currentWork,
        reasons:     [reason],
        targetWeeks: userData.goalWeeks,
      }),
    }),
  ]);

  if (!mealRes.ok) throw new Error(`식단 재생성 실패 (${mealRes.status})`);
  if (!workRes.ok) throw new Error(`운동 재생성 실패 (${workRes.status})`);

  const mealJson = await mealRes.json();
  const workJson = await workRes.json();

  if (!mealJson.success) throw new Error(mealJson.message);
  if (!workJson.success) throw new Error(workJson.message);

  /* 임시 저장 */
  Storage.mergeUser({
    aiMealPlanNew:    mealJson.data,
    aiWorkoutPlanNew: workJson.data,
  });

  /* 비교 뷰 표시 */
  showCompareView(currentMeal, currentWork, mealJson.data, workJson.data);
}

/* ── 비교 뷰 표시 ── */
function showCompareView(oldMeal, oldWork, newMeal, newWork) {
  /* 화살표 + 새 플랜 패널 표시 */
  const arrowEl  = document.getElementById('compareArrow');
  const newPanel = document.getElementById('newPlanPanel');

  if (arrowEl)  arrowEl.style.display  = 'flex';
  if (newPanel) newPanel.style.display = 'flex';

  /* 새 플랜 렌더 (변경 항목 강조 포함) */
  renderMealPlan('new', newMeal, oldMeal);
  renderWorkoutPlan('new', newWork, oldWork);

  /* 스크롤을 새 플랜 패널로 */
  setTimeout(() => {
    newPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 150);
}

/* ════════════════════════════════
   채팅 UI 헬퍼
   ════════════════════════════════ */
function appendMessage(role, text) {
  const messagesEl = document.getElementById('chatMessages');
  if (!messagesEl) return;

  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  div.innerHTML = `
    <div class="chat-avatar">${role === 'ai' ? '🤖' : '👤'}</div>
    <div><div class="chat-bubble">${text}</div></div>
  `;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendTyping() {
  const messagesEl = document.getElementById('chatMessages');
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
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return wrap;
}

/* ════════════════════════════════
   목표 칼로리 계산 (sc311과 동일)
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

  const actMap = { '낮음': 1.2, '보통': 1.375, '높음': 1.55 };
  const tdee   = Math.round(bmr * (actMap[userData.activityLevel] || 1.375));

  const weightToLose = Math.max(0, weight - targetWeight);
  const dailyDeficit = Math.min(Math.round((weightToLose * 7700) / (goalWeeks * 7)), 1000);
  return Math.max(1200, tdee - dailyDeficit);
}

/* ── 오늘 날짜 문자열 ── */
function getPlanDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/* ════════════════════════════════
   로고 / 로그아웃
   ════════════════════════════════ */
function bindLogoClick() {
  document.getElementById('sidebarLogo')?.addEventListener('click', () => {
    const reg = Storage.getRegistered();
    location.href = reg.email ? 'sc301.html' : 'sc101.html';
  });
}

function bindLogout() {
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('healthUserData');
    location.href = 'sc101.html';
  });
}