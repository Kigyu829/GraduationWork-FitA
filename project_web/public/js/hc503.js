/* ============================================================
   hc503.js — AI 플랜 확인 페이지
   의존: common.js

   AI 서버 미연동 시 → 프론트 로컬 처리로 식단/운동 수정
   - 채팅 키워드 파싱 → 해당 메뉴 제거/교체
   - 기존 ↔ 새 플랜 화살표 비교 뷰 표시
   ============================================================ */

'use strict';

const AI_SERVER = 'http://localhost:5000';

/* ── 샘플 플랜 (AI 미연동 시 fallback) ── */
const SAMPLE_MEAL_PLAN = {
  breakfast: { menu: ['그릭요거트', '바나나', '견과류'], calories: 340, desc: '단백질 위주 아침' },
  lunch:     { menu: ['현미밥', '닭가슴살 샐러드', '된장국'], calories: 580, desc: '균형 잡힌 점심' },
  dinner:    { menu: ['연어구이', '구운 채소', '두부'], calories: 520, desc: '저칼로리 저녁' },
  total_calories: 1440,
  tip: '하루 세 끼 규칙적으로 드세요.',
};

const SAMPLE_WORKOUT_PLAN = {
  warmup:   [{ name: '전신 스트레칭', duration: '5분', calories: 20 }],
  main: [
    { name: '스쿼트',       reps: 15, sets: 3, calories: 80 },
    { name: '푸시업',       reps: 10, sets: 3, calories: 60 },
    { name: '플랭크',       duration: '30초 × 3세트', calories: 50 },
    { name: '빠르게 걷기',  duration: '30분', calories: 200 },
  ],
  cooldown: [{ name: '하체 스트레칭', duration: '5분', calories: 15 }],
  total_duration: 60,
  total_calories: 425,
  tip: '운동 후 충분한 수분을 섭취하세요.',
};

/* ── 대체 메뉴 DB (키워드 → 대체 메뉴) ── */
const MEAL_SUBSTITUTES = {
  '연어':      ['닭가슴살구이', '두부조림'],
  '닭가슴살':  ['삶은 달걀', '참치 샐러드'],
  '현미밥':    ['고구마', '오트밀'],
  '된장국':    ['미역국', '콩나물국'],
  '그릭요거트':['삶은 달걀 2개', '두유'],
  '바나나':    ['사과', '블루베리'],
  '견과류':    ['아몬드 10알', '호두'],
  '두부':      ['계란찜', '콩나물'],
  '구운 채소': ['브로콜리 볶음', '시금치 나물'],
};

const WORKOUT_SUBSTITUTES = {
  '스쿼트':       { name: '런지',          reps: 12, sets: 3, calories: 70 },
  '푸시업':       { name: '덤벨 체스트프레스', reps: 10, sets: 3, calories: 55 },
  '플랭크':       { name: '버드독',         duration: '30초 × 3세트', calories: 40 },
  '빠르게 걷기':  { name: '실내 자전거',    duration: '20분', calories: 150 },
  '전신 스트레칭':{ name: '폼롤러 마사지',  duration: '5분', calories: 15 },
  '하체 스트레칭':{ name: '요가 쿨다운',    duration: '5분', calories: 15 },
};

/* ── 현재 플랜 상태 ── */
let currentMealPlan    = null;
let currentWorkoutPlan = null;

window.addEventListener('DOMContentLoaded', () => {
  const data = Storage.getUser();
  currentMealPlan    = data.aiMealPlan    || SAMPLE_MEAL_PLAN;
  currentWorkoutPlan = data.aiWorkoutPlan || SAMPLE_WORKOUT_PLAN;

  renderSidebar();
  renderMealPlan(currentMealPlan);
  renderWorkoutPlan(currentWorkoutPlan);
  bindMenuBtns();
  bindLogout();
  bindLogoClick();
  bindActionButtons();
  bindChat();
  bindChatToggle();
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

function bindLogout() {
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('healthUserData');
    location.href = 'sc101.html';
  });
}

function bindLogoClick() {
  document.getElementById('sidebarLogo')?.addEventListener('click', () => {
    location.href = 'sc301.html';
  });
}

/* ════════════════════════════════
   식단 플랜 렌더링
   ════════════════════════════════ */
function renderMealPlan(plan) {
  const grid    = document.getElementById('mealGrid');
  const totalEl = document.getElementById('mealTotal');
  const tipEl   = document.getElementById('mealTip');
  if (!grid || !plan) return;

  const MEALS = [
    { key: 'breakfast', label: '아침', icon: '🌅' },
    { key: 'lunch',     label: '점심', icon: '☀️' },
    { key: 'dinner',    label: '저녁', icon: '🌙' },
  ];

  grid.innerHTML = MEALS.map(({ key, label, icon }) => {
    const m = plan[key];
    if (!m) return '';
    const menu = Array.isArray(m.menu) ? m.menu.join(' + ') : (m.menu || '-');
    return `
      <div class="hc503-meal-row">
        <div class="hc503-meal-emoji">${icon}</div>
        <div class="hc503-meal-label">${label}</div>
        <div class="hc503-meal-name">${menu}</div>
        <div class="hc503-meal-kcal">${m.calories || 0} kcal</div>
      </div>
    `;
  }).join('');

  if (totalEl) totalEl.textContent = `하루 총 ${(plan.total_calories || 0).toLocaleString()} kcal`;
  if (tipEl) tipEl.textContent = plan.tip ? `💡 ${plan.tip}` : '';
}

/* ════════════════════════════════
   운동 플랜 렌더링
   ════════════════════════════════ */
function renderWorkoutPlan(plan) {
  const listEl  = document.getElementById('workoutList');
  const totalEl = document.getElementById('workoutTotal');
  const tipEl   = document.getElementById('workoutTip');
  if (!listEl || !plan) return;

  const SECTIONS = [
    { key: 'warmup',   icon: '🔥', label: '준비' },
    { key: 'main',     icon: '💪', label: '메인' },
    { key: 'cooldown', icon: '🧘', label: '마무리' },
  ];

  let html = '';
  SECTIONS.forEach(({ key, icon, label }) => {
    const items = plan[key];
    if (!items || !items.length) return;
    items.forEach(item => {
      const detail = item.sets && item.reps
        ? `${item.reps}회 × ${item.sets}세트`
        : (item.duration || '');
      html += `
        <div class="hc503-workout-row">
          <div class="hc503-workout-icon">${icon}</div>
          <div class="hc503-workout-info">
            <div class="hc503-workout-name">${item.name}</div>
            <div class="hc503-workout-detail">${label} · ${detail}</div>
          </div>
          <div class="hc503-workout-kcal">${item.calories || 0} kcal</div>
        </div>
      `;
    });
  });

  listEl.innerHTML = html;
  if (totalEl) totalEl.textContent = `총 ${plan.total_duration || 0}분 · ${plan.total_calories || 0} kcal 소모`;
  if (tipEl) tipEl.textContent = plan.tip ? `💡 ${plan.tip}` : '';
}

/* ════════════════════════════════
   하단 판단 버튼
   ════════════════════════════════ */
function bindActionButtons() {
  const okBtn     = document.getElementById('hc503OkBtn');
  const badBtn    = document.getElementById('hc503BadBtn');
  const toggleBtn = document.getElementById('hc503ChatToggleBtn');

  okBtn?.addEventListener('click', () => {
    /* 수정된 플랜이 있으면 저장 후 이동 */
    Storage.mergeUser({
      aiMealPlan:    currentMealPlan,
      aiWorkoutPlan: currentWorkoutPlan,
    });
    location.href = 'sc301.html';
  });

  badBtn?.addEventListener('click', () => {
    openChatPanel();
    badBtn.style.display = 'none';
    if (okBtn) okBtn.textContent = '✅ 이 플랜으로 진행할게요';
    if (toggleBtn) { toggleBtn.style.display = 'flex'; toggleBtn.classList.add('active'); }
    setTimeout(() => document.getElementById('hc503Input')?.focus(), 350);
  });
}

/* ════════════════════════════════
   채팅 패널 토글
   ════════════════════════════════ */
function bindChatToggle() {
  const toggleBtn = document.getElementById('hc503ChatToggleBtn');
  const closeBtn  = document.getElementById('hc503ChatClose');

  toggleBtn?.addEventListener('click', () => {
    const panel  = document.getElementById('hc503ChatPanel');
    const isOpen = panel.classList.toggle('open');
    toggleBtn.classList.toggle('active', isOpen);
  });

  closeBtn?.addEventListener('click', () => {
    closeChatPanel();
    document.getElementById('hc503ChatToggleBtn')?.classList.remove('active');
  });
}

function openChatPanel() {
  document.getElementById('hc503ChatPanel')?.classList.add('open');
}

function closeChatPanel() {
  document.getElementById('hc503ChatPanel')?.classList.remove('open');
}

/* ════════════════════════════════
   채팅 로직
   ════════════════════════════════ */
function bindChat() {
  const sendBtn = document.getElementById('hc503SendBtn');
  const input   = document.getElementById('hc503Input');

  sendBtn?.addEventListener('click', sendMessage);
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  input?.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 80) + 'px';
  });
}

function sendMessage() {
  const input = document.getElementById('hc503Input');
  const text  = input?.value.trim();
  if (!text) return;

  appendMsg('user', text);
  input.value = '';
  input.style.height = 'auto';

  /* AI 서버 연결 시도 → 실패하면 로컬 처리 */
  const typingEl = appendTyping();

  tryCallAI(text)
    .then(result => {
      typingEl.remove();
      if (result) {
        /* AI 서버 응답 성공 */
        const reply = result.reply || '플랜을 수정할게요!';
        appendMsg('ai', reply);
        if (result.action === 'meal_adjust')     regenerateMealAI(result.reason || text);
        else if (result.action === 'exercise_adjust') regenerateWorkoutAI(result.reason || text);
        else processLocalRequest(text);
      } else {
        /* AI 서버 없음 → 로컬 처리 */
        processLocalRequest(text);
      }
    });
}

/* AI 서버 시도 (실패해도 에러 안 던짐) */
async function tryCallAI(message) {
  try {
    const userData = Storage.getUser();
    const userInfo = [
      userData.gender       ? `성별 ${userData.gender}`         : '',
      userData.weight       ? `체중 ${userData.weight}kg`       : '',
      userData.targetWeight ? `목표 ${userData.targetWeight}kg` : '',
    ].filter(Boolean).join(', ');

    const res = await fetch(`${AI_SERVER}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        userInfo,
        mealPlan:    currentMealPlan,
        workoutPlan: currentWorkoutPlan,
      }),
      signal: AbortSignal.timeout(3000), /* 3초 타임아웃 */
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json : null;
  } catch {
    return null; /* 서버 없으면 null 반환 */
  }
}

/* ════════════════════════════════
   로컬 요청 처리 (AI 미연동 시)
   키워드 파싱 → 플랜 수정 → 비교 뷰
   ════════════════════════════════ */
function processLocalRequest(text) {
  const lc = text.toLowerCase();

  /* 식단 관련 키워드 */
  const mealKeywords  = ['식단', '밥', '음식', '먹', '칼로리', '아침', '점심', '저녁',
                         '빼', '바꿔', '교체', '싫', '없애', '줄여', ...Object.keys(MEAL_SUBSTITUTES)];
  /* 운동 관련 키워드 */
  const workoutKeywords = ['운동', '힘들', '쉽게', '강도', '바꿔', '빼', '교체',
                           ...Object.keys(WORKOUT_SUBSTITUTES)];

  const isMeal    = mealKeywords.some(k => lc.includes(k));
  const isWorkout = workoutKeywords.some(k => lc.includes(k));

  if (isMeal && !isWorkout) {
    modifyMealLocally(text);
  } else if (isWorkout && !isMeal) {
    modifyWorkoutLocally(text);
  } else if (isMeal && isWorkout) {
    modifyMealLocally(text);
    modifyWorkoutLocally(text);
  } else {
    /* 판단 불가 → 둘 다 약간 수정 */
    appendMsg('ai', '어떤 부분을 수정할까요? 예를 들어 "저녁 연어 빼주세요" 또는 "스쿼트 다른 걸로 바꿔주세요"처럼 말씀해주세요!');
  }
}

/* ── 식단 로컬 수정 ── */
function modifyMealLocally(text) {
  const lc     = text.toLowerCase();
  const oldPlan = JSON.parse(JSON.stringify(currentMealPlan)); /* 깊은 복사 */
  const newPlan = JSON.parse(JSON.stringify(currentMealPlan));

  let changed      = false;
  const changes    = [];

  /* 특정 재료 키워드 감지 → 대체 */
  Object.keys(MEAL_SUBSTITUTES).forEach(keyword => {
    if (!lc.includes(keyword.toLowerCase())) return;

    ['breakfast', 'lunch', 'dinner'].forEach(mealKey => {
      const meal = newPlan[mealKey];
      if (!meal) return;

      const menuArr = Array.isArray(meal.menu) ? meal.menu : [meal.menu];
      const idx     = menuArr.findIndex(m => m.toLowerCase().includes(keyword.toLowerCase()));
      if (idx === -1) return;

      const replacements = MEAL_SUBSTITUTES[keyword];
      const newItem      = replacements[Math.floor(Math.random() * replacements.length)];
      const oldItem      = menuArr[idx];
      menuArr[idx]       = newItem;
      meal.menu          = menuArr;

      /* 칼로리 소폭 조정 */
      const calDiff     = Math.round((Math.random() - 0.5) * 60);
      meal.calories     = Math.max(200, (meal.calories || 300) + calDiff);
      changed           = true;
      changes.push(`${mealKey === 'breakfast' ? '아침' : mealKey === 'lunch' ? '점심' : '저녁'}: ${oldItem} → ${newItem}`);
    });
  });

  /* "빼" / "없애" / "제거" 키워드만 있을 때 → 랜덤 한 항목 제거 */
  if (!changed && (lc.includes('빼') || lc.includes('없애') || lc.includes('제거') || lc.includes('줄여'))) {
    const mealKey = lc.includes('아침') ? 'breakfast'
                  : lc.includes('점심') ? 'lunch'
                  : lc.includes('저녁') ? 'dinner'
                  : ['breakfast','lunch','dinner'][Math.floor(Math.random() * 3)];
    const meal    = newPlan[mealKey];
    if (meal) {
      const menuArr = Array.isArray(meal.menu) ? meal.menu : [meal.menu];
      if (menuArr.length > 1) {
        const removed = menuArr.splice(Math.floor(Math.random() * menuArr.length), 1)[0];
        meal.menu     = menuArr;
        meal.calories = Math.max(150, (meal.calories || 300) - Math.round(Math.random() * 80 + 40));
        changed       = true;
        changes.push(`${mealKey === 'breakfast' ? '아침' : mealKey === 'lunch' ? '점심' : '저녁'}에서 ${removed} 제거`);
      }
    }
  }

  if (!changed) {
    appendMsg('ai', '어떤 음식을 바꿀지 좀 더 구체적으로 말씀해주세요! 예) "연어 싫어요", "아침 바나나 빼주세요"');
    return;
  }

  /* 총 칼로리 재계산 */
  newPlan.total_calories = ['breakfast','lunch','dinner']
    .reduce((sum, k) => sum + (newPlan[k]?.calories || 0), 0);

  currentMealPlan = newPlan;

  const replyLines = ['알겠어요! 식단을 수정했어요 🍽️', ...changes.map(c => `• ${c}`)].join('\n');
  appendMsg('ai', replyLines.replace(/\n/g, '<br>'));

  showMealComparison(oldPlan, newPlan);
}

/* ── 운동 로컬 수정 ── */
function modifyWorkoutLocally(text) {
  const lc      = text.toLowerCase();
  const oldPlan = JSON.parse(JSON.stringify(currentWorkoutPlan));
  const newPlan = JSON.parse(JSON.stringify(currentWorkoutPlan));

  let changed   = false;
  const changes = [];

  /* 특정 운동 키워드 감지 → 대체 */
  Object.keys(WORKOUT_SUBSTITUTES).forEach(keyword => {
    if (!lc.includes(keyword.toLowerCase())) return;

    ['warmup', 'main', 'cooldown'].forEach(section => {
      const items = newPlan[section];
      if (!items) return;
      const idx = items.findIndex(i => i.name.toLowerCase().includes(keyword.toLowerCase()));
      if (idx === -1) return;

      const oldItem   = items[idx];
      items[idx]      = { ...WORKOUT_SUBSTITUTES[keyword] };
      changed         = true;
      changes.push(`${oldItem.name} → ${items[idx].name}`);
    });
  });

  /* "빼" / "없애" 키워드만 있을 때 → main에서 랜덤 제거 */
  if (!changed && (lc.includes('빼') || lc.includes('없애') || lc.includes('제거'))) {
    const main = newPlan.main;
    if (main && main.length > 1) {
      const removed = main.splice(Math.floor(Math.random() * main.length), 1)[0];
      changed       = true;
      changes.push(`${removed.name} 제거`);
    }
  }

  /* "쉽게" / "줄여" → 세트/횟수 감소 */
  if (!changed && (lc.includes('쉽게') || lc.includes('줄여') || lc.includes('힘들'))) {
    newPlan.main?.forEach(item => {
      if (item.sets) { item.sets = Math.max(1, item.sets - 1); changed = true; }
      if (item.reps) { item.reps = Math.max(5, item.reps - 3); }
      if (item.calories) item.calories = Math.round(item.calories * 0.8);
    });
    if (changed) changes.push('전체 운동 세트/횟수 감소');
  }

  if (!changed) {
    appendMsg('ai', '어떤 운동을 바꿀지 좀 더 구체적으로 말씀해주세요! 예) "스쿼트 싫어요", "푸시업 다른 걸로 바꿔주세요"');
    return;
  }

  /* 총 칼로리/시간 재계산 */
  const allItems = [...(newPlan.warmup||[]), ...(newPlan.main||[]), ...(newPlan.cooldown||[])];
  newPlan.total_calories = allItems.reduce((s, i) => s + (i.calories || 0), 0);

  currentWorkoutPlan = newPlan;

  const replyLines = ['운동 플랜을 수정했어요 💪', ...changes.map(c => `• ${c}`)].join('\n');
  appendMsg('ai', replyLines.replace(/\n/g, '<br>'));

  showWorkoutComparison(oldPlan, newPlan);
}

/* ════════════════════════════════
   비교 뷰 (화살표 표시)
   ════════════════════════════════ */
function showMealComparison(oldPlan, newPlan) {
  const compareEl = document.getElementById('mealCompare');
  const normalEl  = document.getElementById('mealPlanContent');
  const oldEl     = document.getElementById('mealOldContent');
  const newEl     = document.getElementById('mealNewContent');
  const badgeEl   = document.getElementById('mealPlanBadge');

  if (!compareEl) return;

  const MEALS = [
    { key: 'breakfast', label: '🌅 아침' },
    { key: 'lunch',     label: '☀️ 점심' },
    { key: 'dinner',    label: '🌙 저녁' },
  ];

  function toHtml(plan, comparePlan) {
    return MEALS.map(({ key, label }) => {
      const m  = plan[key];
      const cm = comparePlan?.[key];
      if (!m) return '';

      const menuArr = Array.isArray(m.menu) ? m.menu : [m.menu];
      const cmpArr  = cm ? (Array.isArray(cm.menu) ? cm.menu : [cm.menu]) : menuArr;

      /* 변경된 항목 하이라이트 */
      const menuHtml = menuArr.map(item => {
        const changed = !cmpArr.includes(item);
        return changed
          ? `<span class="hc503-changed-item">${item}</span>`
          : `<span>${item}</span>`;
      }).join(' + ');

      const calChanged = cm && cm.calories !== m.calories;
      const calHtml = calChanged
        ? `<span class="hc503-changed-kcal">${m.calories} kcal</span>`
        : `${m.calories} kcal`;

      return `
        <div class="hc503-compare-item">
          <div class="hc503-compare-item-label">${label}</div>
          <div class="hc503-compare-item-menu">${menuHtml}</div>
          <div class="hc503-compare-item-kcal">${calHtml}</div>
        </div>
      `;
    }).join('') +
    `<div class="hc503-compare-total">합계: ${(plan.total_calories||0).toLocaleString()} kcal</div>`;
  }

  if (oldEl) oldEl.innerHTML = toHtml(oldPlan, null);
  if (newEl) newEl.innerHTML = toHtml(newPlan, oldPlan);

  normalEl.style.display  = 'none';
  compareEl.style.display = 'flex';
  if (badgeEl) { badgeEl.textContent = '수정됨'; badgeEl.classList.add('updated'); }

  /* 카드로 부드럽게 스크롤 */
  compareEl.closest('.hc503-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showWorkoutComparison(oldPlan, newPlan) {
  const compareEl = document.getElementById('workoutCompare');
  const normalEl  = document.getElementById('workoutPlanContent');
  const oldEl     = document.getElementById('workoutOldContent');
  const newEl     = document.getElementById('workoutNewContent');
  const badgeEl   = document.getElementById('workoutPlanBadge');

  if (!compareEl) return;

  function getAllItems(plan) {
    return [...(plan.warmup||[]), ...(plan.main||[]), ...(plan.cooldown||[])];
  }

  function toHtml(plan, comparePlan) {
    const items    = getAllItems(plan);
    const cmpNames = comparePlan ? getAllItems(comparePlan).map(i => i.name) : items.map(i => i.name);

    return items.map(item => {
      const detail  = item.sets && item.reps
        ? `${item.reps}회 × ${item.sets}세트`
        : (item.duration || '');
      const isNew   = !cmpNames.includes(item.name);
      const nameHtml = isNew
        ? `<span class="hc503-changed-item">${item.name}</span>`
        : item.name;

      return `
        <div class="hc503-compare-item">
          <div class="hc503-compare-item-label">${nameHtml}</div>
          <div class="hc503-compare-item-menu" style="font-size:11px;color:var(--text-mute);">${detail}</div>
          <div class="hc503-compare-item-kcal">${item.calories||0} kcal</div>
        </div>
      `;
    }).join('') +
    `<div class="hc503-compare-total">총 ${plan.total_duration||0}분 · ${plan.total_calories||0} kcal</div>`;
  }

  /* 제거된 항목 표시 (oldPlan에 있는데 newPlan에 없는 것) */
  function toHtmlOld(plan, newPlan) {
    const items    = getAllItems(plan);
    const newNames = getAllItems(newPlan).map(i => i.name);

    return items.map(item => {
      const detail  = item.sets && item.reps
        ? `${item.reps}회 × ${item.sets}세트`
        : (item.duration || '');
      const removed = !newNames.includes(item.name);
      const nameHtml = removed
        ? `<span class="hc503-removed-item">${item.name}</span>`
        : item.name;

      return `
        <div class="hc503-compare-item">
          <div class="hc503-compare-item-label">${nameHtml}</div>
          <div class="hc503-compare-item-menu" style="font-size:11px;color:var(--text-mute);">${detail}</div>
          <div class="hc503-compare-item-kcal">${item.calories||0} kcal</div>
        </div>
      `;
    }).join('') +
    `<div class="hc503-compare-total">총 ${plan.total_duration||0}분 · ${plan.total_calories||0} kcal</div>`;
  }

  if (oldEl) oldEl.innerHTML = toHtmlOld(oldPlan, newPlan);
  if (newEl) newEl.innerHTML = toHtml(newPlan, oldPlan);

  normalEl.style.display  = 'none';
  compareEl.style.display = 'flex';
  if (badgeEl) { badgeEl.textContent = '수정됨'; badgeEl.classList.add('updated'); }

  compareEl.closest('.hc503-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ════════════════════════════════
   AI 서버 연동 시 플랜 재생성 함수
   (서버 연결되면 자동으로 사용됨)
   ════════════════════════════════ */
async function regenerateMealAI(reason) {
  const oldPlan    = JSON.parse(JSON.stringify(currentMealPlan));
  const targetCals = calcTargetCalories(Storage.getUser());
  showLoading('식단을 수정하고 있어요...');
  try {
    const res  = await fetch(`${AI_SERVER}/api/meal/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPlan: oldPlan, reasons: [reason], targetCalories: targetCals }),
    });
    if (!res.ok) throw new Error();
    const json = await res.json();
    if (!json.success) throw new Error();
    currentMealPlan = json.data;
    Storage.mergeUser({ aiMealPlan: currentMealPlan });
    hideLoading();
    showMealComparison(oldPlan, currentMealPlan);
    appendMsg('ai', '✅ AI가 식단을 수정했어요! 비교해보세요.');
  } catch {
    hideLoading();
    modifyMealLocally(reason); /* 실패 시 로컬 처리로 fallback */
  }
}

async function regenerateWorkoutAI(reason) {
  const oldPlan = JSON.parse(JSON.stringify(currentWorkoutPlan));
  showLoading('운동 플랜을 수정하고 있어요...');
  try {
    const res  = await fetch(`${AI_SERVER}/api/exercise/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPlan: oldPlan, reasons: [reason], targetWeeks: Storage.getUser().goalWeeks }),
    });
    if (!res.ok) throw new Error();
    const json = await res.json();
    if (!json.success) throw new Error();
    currentWorkoutPlan = json.data;
    Storage.mergeUser({ aiWorkoutPlan: currentWorkoutPlan });
    hideLoading();
    showWorkoutComparison(oldPlan, currentWorkoutPlan);
    appendMsg('ai', '✅ AI가 운동 플랜을 수정했어요! 비교해보세요.');
  } catch {
    hideLoading();
    modifyWorkoutLocally(reason);
  }
}

function calcTargetCalories(userData) {
  const weight   = Number(userData.weight);
  const height   = Number(userData.height);
  const twt      = Number(userData.targetWeight);
  const weeks    = Number(userData.goalWeeks) || 12;
  const age      = userData.birth ? new Date().getFullYear() - Number(userData.birth.slice(0,4)) : 25;
  const bmr      = userData.gender === '남성'
    ? 10*weight + 6.25*height - 5*age + 5
    : 10*weight + 6.25*height - 5*age - 161;
  const tdee     = Math.round(bmr * ({ '낮음':1.2, '보통':1.375, '높음':1.55 }[userData.activityLevel] || 1.375));
  const deficit  = Math.min(Math.round((Math.max(0,weight-twt)*7700)/(weeks*7)), 1000);
  return Math.max(1200, tdee - deficit);
}

/* ════════════════════════════════
   메시지 UI
   ════════════════════════════════ */
function appendMsg(role, text) {
  const messages = document.getElementById('hc503ChatMessages');
  if (!messages) return;
  const div = document.createElement('div');
  div.className = `hc503-msg ${role}`;
  div.innerHTML = `
    <div class="hc503-avatar">${role === 'ai' ? '🤖' : '👤'}</div>
    <div><div class="hc503-bubble">${text}</div></div>
  `;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function appendTyping() {
  const messages = document.getElementById('hc503ChatMessages');
  const wrap = document.createElement('div');
  wrap.className = 'hc503-msg ai';
  wrap.innerHTML = `
    <div class="hc503-avatar">🤖</div>
    <div class="hc503-typing"><span></span><span></span><span></span></div>
  `;
  messages.appendChild(wrap);
  messages.scrollTop = messages.scrollHeight;
  return wrap;
}

/* ── 로딩 오버레이 ── */
function showLoading(msg) {
  const overlay = document.getElementById('hc503LoadingOverlay');
  const titleEl = document.getElementById('hc503LoadingTitle');
  if (titleEl) titleEl.textContent = msg;
  requestAnimationFrame(() => requestAnimationFrame(() => overlay?.classList.add('show')));
}

function hideLoading() {
  document.getElementById('hc503LoadingOverlay')?.classList.remove('show');
}