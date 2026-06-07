'use strict';

/* ============================================================
   sc302/api.js — AI 플랜 API 호출 (15초 타임아웃)
   의존: common.js (Storage, calcTargetCalories, getCurrentUid), utils.js
   ============================================================ */

async function fetchAiPlans() {
  const userData       = Storage.getUser();
  const targetCalories = calcTargetCalories(userData);
  const mealReasons    = userData.mealAdjustReasons    || [];
  const workoutReasons = userData.workoutAdjustReasons || [];

  const baseBody = {
    height:        userData.height        || '',
    weight:        userData.weight        || '',
    bmi:           userData.bmi           || '',
    gender:        userData.gender        || '',
    targetWeight:  userData.targetWeight  || '',
    targetWeeks:   calcRemainingWeeks(userData),
    activityLevel: userData.activityLevel || '보통',
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
