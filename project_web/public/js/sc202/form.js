'use strict';

/* ============================================================
   sc202/form.js — 신체정보 폼 제출 처리
   의존: common.js (calculateBMI, Storage), utils.js
   ============================================================ */

/**
 * bodyInfoForm1 제출 이벤트 바인딩
 */
function bindBodyInfoForm() {
  const bodyInfoForm1 = document.getElementById('bodyInfoForm1');
  if (!bodyInfoForm1) return;

  bodyInfoForm1.addEventListener('submit', function (e) {
    e.preventDefault();

    const year  = document.getElementById('birthYear').value;
    const month = document.getElementById('birthMonth').value;
    const day   = document.getElementById('birthDay').value;

    /* 생년월일 유효성 */
    if (!isValidBirth(year, month, day)) {
      alert('생년월일을 올바르게 입력해주세요.');
      return;
    }

    const birth  = formatBirth(year, month, day);
    const height = document.getElementById('height').value;
    const weight = document.getElementById('weight').value;
    const gender = document.getElementById('gender').value;

    /* BMI 계산은 common.js의 calculateBMI 사용 */
    const bmi = calculateBMI(height, weight);

    Storage.mergeUser({ birth, gender, height, weight, bmi });

    location.href = 'sc203.html';
  });
}
