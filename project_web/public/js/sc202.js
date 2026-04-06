/* ============================================================
   sc202.js — 신체정보 입력 1
   의존: common.js
   ============================================================ */

'use strict';

const bodyInfoForm1 = document.getElementById('bodyInfoForm1');

/* ── 폼 제출 ── */
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

    /* BMI 계산은 common.js의 calculateBMI 사용 */
    const bmi = calculateBMI(height, weight);

    Storage.mergeUser({ birth, gender, height, weight, bmi });

    location.href = 'sc203.html';
  });
}
