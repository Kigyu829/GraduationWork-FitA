'use strict';

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
