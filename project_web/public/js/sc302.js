/* ============================================================
   sc302.js — AI 가이드 생성 로딩
   의존: common.js

   [흐름]
   sc203 완료 → sc302(로딩 + AI API 호출) → sc311(오늘의 식단/운동)

   [당일 중복 방지]
   planDate === 오늘 이면 API 재호출 없이 sc311로 즉시 이동
   ============================================================ */

'use strict';

const AI_SERVER = '';

/* ── 오늘 날짜 문자열 (YYYY-MM-DD) ── */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/* ── 오늘 플랜이 이미 있는지 확인 ── */
function hasTodayPlan() {
  const data = Storage.getUser();
  return data.planDate === todayStr() && !!(data.aiMealPlan && data.aiWorkoutPlan);
}

/* ── 사이드바 공통 초기화 ── */
window.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  initCommonOverlays(); /* AI 상담 오버레이 */
  bindMenuBtns();
  bindLogout();
  bindLogoClick();

  if (hasTodayPlan()) {
    showAlreadyPlanCard();
    return;
  }

  startLoadingSequence();
});

/* ── 당일 플랜 안내 카드 표시 ── */
function showAlreadyPlanCard() {
  document.getElementById('loadingCard')?.style.setProperty('display', 'none');
  const card = document.getElementById('alreadyPlanCard');
  if (card) card.style.display = '';

  document.getElementById('btnBackToDash')?.addEventListener('click', () => {
    location.href = 'sc301.html';
  });

  document.getElementById('btnOpenAiChat')?.addEventListener('click', () => {
    /* AI 상담 오버레이 열기 (sc311에서 더 풍부한 상담 가능하므로 sc311로 이동 후 열기) */
    location.href = 'sc311.html?openChat=1';
  });
}



/* ── 로딩 시퀀스 ── */
const MESSAGES = [
  '식단 패턴을 분석하고 있어요...',
  'BMI와 활동량을 계산 중이에요...',
  '최적 칼로리를 계산하고 있어요...',
  '운동 강도를 맞춤 설정 중이에요...',
  '식단 조합을 최적화하고 있어요...',
  '거의 다 됐어요! 마무리 중이에요...',
];

const STEPS = [
  { id: 'step1', label: '신체 분석', duration: 1000 },
  { id: 'step2', label: '플랜 생성', duration: 2200 },
  { id: 'step3', label: '최종 검토', duration: 800  },
];

/* ── AI 플랜 API 호출 (15초 타임아웃) ── */
async function fetchAiPlans() {
  const userData       = Storage.getUser();
  const targetCalories = calcTargetCalories(userData);
  const mealReasons     = userData.mealAdjustReasons    || [];
  const workoutReasons  = userData.workoutAdjustReasons || [];

  const baseBody = {
    height:          userData.height        || '',
    weight:          userData.weight        || '',
    bmi:             userData.bmi           || '',
    gender:          userData.gender        || '',
    targetWeight:    userData.targetWeight  || '',
    targetWeeks:     userData.goalWeeks     || 8,
    activityLevel:   userData.activityLevel || '보통',
    targetCalories,
  };

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 15000);

  try {
    const [mealRes, exRes] = await Promise.all([
      fetch(`${AI_SERVER}/api/meal/recommend`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...baseBody, ...(mealReasons.length > 0 && { reasons: mealReasons }) }),
        signal:  controller.signal,
      }),
      fetch(`${AI_SERVER}/api/exercise/recommend`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...baseBody, ...(workoutReasons.length > 0 && { reasons: workoutReasons }) }),
        signal:  controller.signal,
      }),
    ]);

    const mealJson = await mealRes.json();
    const exJson   = await exRes.json();

    if (mealJson.success) Storage.mergeUser({ aiMealPlan:    mealJson.data });
    if (exJson.success)   Storage.mergeUser({ aiWorkoutPlan: exJson.data   });

    if (mealJson.success || exJson.success) {
      Storage.mergeUser({ planDate: todayStr() });
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

function startLoadingSequence() {
  const msgEl = document.getElementById('loadingMsg');
  const pctEl = document.getElementById('loadingPct');

  /* API 호출 — 실패 여부 추적 */
  let plansFailed = false;
  const plansPromise = fetchAiPlans().catch(err => {
    console.warn('[sc302] AI 플랜 로드 실패:', err.message);
    plansFailed = true;
  });

  /* 메시지 순환 */
  let msgIdx = 0;
  const msgInterval = setInterval(() => {
    if (!msgEl) return;
    msgEl.classList.add('fade');
    setTimeout(() => {
      msgIdx = (msgIdx + 1) % MESSAGES.length;
      msgEl.textContent = MESSAGES[msgIdx];
      msgEl.classList.remove('fade');
    }, 400);
  }, 1800);

  /* 단계 진행 */
  const totalDuration = STEPS.reduce((s, st) => s + st.duration, 0);
  let elapsed = 0;

  STEPS.forEach((step, i) => {
    setTimeout(() => {
      if (i > 0) {
        document.getElementById(STEPS[i-1].id)?.classList.replace('active', 'done');
      }
      document.getElementById(step.id)?.classList.add('active');

      elapsed += step.duration;
      const pct = Math.round((elapsed / totalDuration) * 100);
      if (pctEl) pctEl.textContent = `${pct}% 완료`;
    }, STEPS.slice(0, i).reduce((s, st) => s + st.duration, 0));
  });

  /* 애니메이션 완료 후 API 응답 대기 → 결과에 따라 분기 */
  setTimeout(async () => {
    clearInterval(msgInterval);
    document.getElementById(STEPS[STEPS.length - 1].id)?.classList.replace('active', 'done');
    if (msgEl) msgEl.textContent = '서버 응답을 기다리는 중...';

    await plansPromise;

    if (plansFailed || !Storage.getUser().aiMealPlan) {
      showPlanError();
      return;
    }

    if (msgEl) msgEl.textContent = '✅ 플랜이 완성되었어요!';
    if (pctEl) pctEl.textContent = '100% 완료';

    setTimeout(() => { location.href = 'sc301.html'; }, 700);

  }, totalDuration);
}

/* ── 서버 연결 실패 UI ── */
function showPlanError() {
  const card = document.getElementById('loadingCard');
  if (!card) return;
  card.innerHTML = `
    <div style="text-align:center;padding:8px 0;">
      <div style="font-size:48px;margin-bottom:16px;">😔</div>
      <div style="font-size:18px;font-weight:700;color:var(--text,#fff);margin-bottom:8px;">AI 서버에 연결할 수 없어요</div>
      <div style="font-size:13px;color:var(--text-sec,rgba(255,255,255,0.6));line-height:1.7;margin-bottom:24px;">
        서버가 실행 중인지 확인하거나<br>잠시 후 다시 시도해주세요.
      </div>
      <button onclick="location.reload()"
        style="display:block;width:100%;padding:14px;background:var(--teal,#66D0BC);color:#09131a;border:none;
               border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:10px;">
        🔄 다시 시도
      </button>
      <button onclick="location.href='sc301.html'"
        style="display:block;width:100%;padding:14px;background:transparent;
               color:var(--text-sec,rgba(255,255,255,0.6));border:1px solid var(--border,rgba(255,255,255,0.12));
               border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">
        건너뛰고 홈으로
      </button>
    </div>
  `;
}
