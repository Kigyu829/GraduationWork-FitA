'use strict';

/* ============================================================
   sc203/goal.js — 목표 설정 UI 로직
   의존: sc203/utils.js, common.js
   ============================================================ */

const bodyInfoForm2      = document.getElementById('bodyInfoForm2');
const bmiValueEl         = document.getElementById('bmiValue');
const bmiStatusEl        = document.getElementById('bmiStatus');
const targetLossInput    = document.getElementById('targetLoss');
const goalPeriodInput    = document.getElementById('goalPeriod');
const goalInfoEl         = document.getElementById('goalInfo');
const activityLevelInput = document.getElementById('activityLevel');
const customPeriodWrap   = document.getElementById('customPeriodWrap');
const customPeriodInput  = document.getElementById('customPeriodWeeks');

/* ── 현재 선택된 주 수 반환 (기타이면 직접입력값 사용) ── */
function getSelectedWeeks() {
  const val = goalPeriodInput.value;
  if (val === '기타') {
    const w = parseInt(customPeriodInput?.value, 10);
    return (!w || w < 1) ? null : w;
  }
  const map = { '4주': 4, '8주': 8, '12주': 12, '16주': 16 };
  return map[val] || null;
}

/* ── 기타 선택 시 직접입력 필드 토글 ── */
goalPeriodInput.addEventListener('change', () => {
  if (goalPeriodInput.value === '기타') {
    customPeriodWrap.style.display = 'block';
    customPeriodInput.focus();
  } else {
    customPeriodWrap.style.display = 'none';
    if (customPeriodInput) customPeriodInput.value = '';
  }
  updateGoalInfo();
});

if (customPeriodInput) {
  customPeriodInput.addEventListener('input', () => {
    const hint = document.getElementById('customPeriodHint');
    const w = parseInt(customPeriodInput.value, 10);
    if (hint) {
      if (!w || w < 1)   hint.textContent = '1주 이상 입력해주세요.';
      else if (w > 52)   hint.textContent = '최대 52주(1년)까지 입력 가능합니다.';
      else               hint.textContent = '';
    }
    updateGoalInfo();
  });
}

/* ── BMI 표시 ── */
function renderBMI() {
  const { bmi } = Storage.getUser();
  if (!bmiValueEl || !bmiStatusEl) return;

  if (!bmi) {
    bmiValueEl.textContent  = '-';
    bmiStatusEl.textContent = '이전 단계 정보를 불러올 수 없습니다.';
    return;
  }

  const status = getBMIStatus(bmi);
  bmiValueEl.textContent  = bmi;
  bmiValueEl.style.color  = status.color;
  bmiStatusEl.textContent = `현재 BMI ${bmi}는 ${status.label} 범위입니다.`;
}

/* ── 목표 프리뷰 + 경고 갱신 ── */
function updateGoalInfo() {
  if (!goalInfoEl) return;

  const { weight: savedWeight } = Storage.getUser();
  const currentWeight = Number(savedWeight);
  const targetLoss    = Number(targetLossInput.value);
  const weeks         = getSelectedWeeks();
  const activity      = activityLevelInput.value;
  const periodLabel   = goalPeriodInput.value === '기타'
    ? (weeks ? `${weeks}주` : '기타')
    : goalPeriodInput.value;

  /* ── 경고는 targetLoss와 weeks만 있으면 activity와 무관하게 먼저 판단 ── */
  if (targetLoss && weeks) {
    if (isExcessive(targetLoss, weeks)) {
      const perWeek = (targetLoss / weeks).toFixed(1);
      showWarning(`주 ${perWeek}kg 감량은 권장 범위(주 1kg)를 초과합니다. 목표를 조정하거나 기간을 늘려주세요.`);
    } else {
      hideWarning();
    }
  } else {
    hideWarning();
  }

  /* ── 프리뷰는 모든 항목이 채워진 경우에만 표시 ── */
  if (!currentWeight || !targetLoss || !weeks || !activity) {
    goalInfoEl.textContent = '목표 감량과 기간을 입력하면 목표가 표시됩니다.';
    goalInfoEl.classList.add('muted');
    return;
  }

  const targetWeight = currentWeight - targetLoss;

  if (targetWeight <= 0) {
    goalInfoEl.textContent = '목표 감량 무게를 다시 확인해주세요.';
    goalInfoEl.classList.add('muted');
    return;
  }

  const perWeek = (targetLoss / weeks).toFixed(1);
  goalInfoEl.textContent = `${currentWeight}kg → ${targetWeight}kg | ${periodLabel} 동안 ${targetLoss}kg 감량 (주 ${perWeek}kg)`;
  goalInfoEl.classList.remove('muted');
}

/* ── 이벤트 바인딩 ── */
if (targetLossInput)    targetLossInput.addEventListener('input',  updateGoalInfo);
if (activityLevelInput) activityLevelInput.addEventListener('change', updateGoalInfo);
