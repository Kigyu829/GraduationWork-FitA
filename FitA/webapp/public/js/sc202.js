/* ============================================================
   sc202.js — 신체정보 입력 1
   의존: common.js
   ============================================================ */

'use strict';

const bodyInfoForm1 = document.getElementById('bodyInfoForm1');

/* ── 폼 제출 ── */
/* ── "해당 없음" 체크 시 다른 항목 해제, 다른 항목 체크 시 "해당 없음" 해제 ── */
const condNoneEl = document.getElementById('condNone');
document.querySelectorAll('input[name="condition"]').forEach(cb => {
  cb.addEventListener('change', () => {
    if (cb.value === '없음' && cb.checked) {
      document.querySelectorAll('input[name="condition"]').forEach(other => {
        if (other.value !== '없음') other.checked = false;
      });
    } else if (cb.value !== '없음' && cb.checked && condNoneEl) {
      condNoneEl.checked = false;
    }
  });
});

if (bodyInfoForm1) {
  bodyInfoForm1.addEventListener('submit', function (e) {
    e.preventDefault();

    const year  = document.getElementById('birthYear').value;
    const month = document.getElementById('birthMonth').value;
    const day   = document.getElementById('birthDay').value;

    /* 생년월일 유효성 */
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) {
      alert('생년월일을 올바르게 입력해주세요.');
      return;
    }

    const birth  = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const height = document.getElementById('height').value;
    const weight = document.getElementById('weight').value;
    const gender = document.getElementById('gender').value;

    /* 기저 질환 수집 */
    const checkedConditions = [...document.querySelectorAll('input[name="condition"]:checked')]
      .map(cb => cb.value)
      .filter(v => v !== '없음');

    /* BMI 계산은 common.js의 calculateBMI 사용 */
    const bmi = calculateBMI(height, weight);

    Storage.mergeUser({ birth, gender, height, weight, bmi, healthConditions: checkedConditions });

    location.href = 'sc203.html';
  });
}
