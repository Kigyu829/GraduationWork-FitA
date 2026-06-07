'use strict';

/* ── 경고 표시 / 숨김 ── */
function showWarning(msg) {
  if (!warningEl) return;
  warningEl.textContent = '⚠️ ' + msg;
  warningEl.classList.add('show');
}

function hideWarning() {
  if (!warningEl) return;
  warningEl.classList.remove('show');
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
