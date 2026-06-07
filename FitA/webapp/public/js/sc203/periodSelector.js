'use strict';

/* ── 기타 선택 시 직접입력 필드 토글 ── */
goalPeriodInput?.addEventListener('change', () => {
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

/* ── 이벤트 바인딩 ── */
if (targetLossInput)    targetLossInput.addEventListener('input',  updateGoalInfo);
if (activityLevelInput) activityLevelInput.addEventListener('change', updateGoalInfo);
