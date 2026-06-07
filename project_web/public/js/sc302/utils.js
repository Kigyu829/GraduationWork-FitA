'use strict';

/* ============================================================
   sc302/utils.js — AI 가이드 생성 로딩 상수 및 유틸
   ============================================================ */

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

/* ── 오늘 플랜이 이미 있는지 확인 ── */
function hasTodayPlan() {
  const data = Storage.getUser();
  return data.planDate === todayStr() && !!(data.aiMealPlan && data.aiWorkoutPlan);
}

/* ── 남은 목표 기간(주) 계산 ── */
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
