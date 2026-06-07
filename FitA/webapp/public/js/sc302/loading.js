'use strict';

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

function calcRemainingWeeks(userData) {
  const goalWeeks = Number(userData.goalWeeks) || 8;
  const uid    = getCurrentUid();
  const regStr = uid ? localStorage.getItem(`reg_${uid}`) : null;
  if (!regStr) return goalWeeks;

  const elapsedWeeks = Math.floor(
    (new Date() - new Date(regStr)) / (1000 * 60 * 60 * 24 * 7)
  );
  return Math.max(1, goalWeeks - elapsedWeeks);
}

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
    targetWeeks:     calcRemainingWeeks(userData),
    activityLevel:   userData.activityLevel || '보통',
    targetCalories,
  };

  const mealCtrl    = new AbortController();
  const exCtrl      = new AbortController();
  const mealTimeout = setTimeout(() => mealCtrl.abort(), 15000);
  const exTimeout   = setTimeout(() => exCtrl.abort(),   15000);

  try {
    const [mealResult, exResult] = await Promise.allSettled([
      fetch(`${AI_SERVER}/api/meal/recommend`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...baseBody, ...(mealReasons.length > 0 && { reasons: mealReasons }) }),
        signal:  mealCtrl.signal,
      }),
      fetch(`${AI_SERVER}/api/exercise/recommend`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...baseBody, ...(workoutReasons.length > 0 && { reasons: workoutReasons }) }),
        signal:  exCtrl.signal,
      }),
    ]);

    if (mealResult.status === 'fulfilled') {
      const mealJson = await mealResult.value.json();
      if (mealJson.success) Storage.mergeUser({ aiMealPlan: mealJson.data });
    }
    if (exResult.status === 'fulfilled') {
      const exJson = await exResult.value.json();
      if (exJson.success) Storage.mergeUser({ aiWorkoutPlan: exJson.data });
    }

    const saved = Storage.getUser();
    if (saved.aiMealPlan || saved.aiWorkoutPlan) {
      Storage.mergeUser({ planDate: todayStr() });
    }
  } finally {
    clearTimeout(mealTimeout);
    clearTimeout(exTimeout);
  }
}

function startLoadingSequence() {
  const msgEl = document.getElementById('loadingMsg');
  const pctEl = document.getElementById('loadingPct');

  let plansFailed = false;
  const plansPromise = fetchAiPlans().catch(err => {
    console.warn('[sc302] AI 플랜 로드 실패:', err.message);
    plansFailed = true;
  });

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
