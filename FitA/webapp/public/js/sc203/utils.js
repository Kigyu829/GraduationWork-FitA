'use strict';

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

/* ── 과도한 목표 여부 ── */
function isExcessive(targetLoss, weeks) {
  if (!weeks || !targetLoss) return false;
  return (targetLoss / weeks) > 1.0;
}

