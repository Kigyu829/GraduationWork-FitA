/* ============================================================
   sc201_1.js — 로그인
   의존: common.js
   ============================================================ */

'use strict';

/* ── 테스트 계정 초기 세팅 (등록 계정 없을 때만 1회) ── */
(function initTestAccount() {
  if (!localStorage.getItem('registeredEmail')) {
    Storage.setRegistered('test1@test.com', 'test1TEST', 'test1');
    localStorage.setItem('registeredPhone', '010-1234-5678');

    /* 테스트용 신체정보 + 목표 데이터 */
    Storage.setUser({
      gender:        '남성',
      birth:         '1998-05-15',
      height:        '175',
      weight:        '78',
      bmi:           calculateBMI('175', '78'),   /* common.js */
      initialWeight: 78,
      targetLoss:    8,
      goalPeriod:    '12주',
      targetWeight:  70,
      activityLevel: '보통',
    });
  }
})();

const loginForm  = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const saveIdBox  = document.getElementById('saveId');
const loginIdEl  = document.getElementById('loginId');

/* ── 저장된 이메일 복원 ── */
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('savedEmail');
  if (saved && loginIdEl) {
    loginIdEl.value = saved;
    if (saveIdBox) saveIdBox.checked = true;
  }
});

/* ── 소셜 로그인 버튼 (추후 연동) ── */
document.querySelectorAll('.social-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const provider = btn.classList.contains('naver')  ? '네이버'  :
                     btn.classList.contains('kakao')  ? '카카오' : '구글';
    alert(`${provider} 로그인은 추후 연동 예정입니다.`);
  });
});

/* ── 로그인 제출 ── */
if (loginForm) {
  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const email    = loginIdEl.value.trim();
    const password = document.getElementById('loginPw').value;

    if (!email || !password) {
      loginError.classList.add('show');
      return;
    }

    /* 아이디 저장 처리 */
    if (saveIdBox && saveIdBox.checked) {
      localStorage.setItem('savedEmail', email);
    } else {
      localStorage.removeItem('savedEmail');
    }

    /* 인증 확인 */
    const reg = Storage.getRegistered();
    if (email !== reg.email || password !== reg.password) {
      loginError.classList.add('show');
      return;
    }

    loginError.classList.remove('show');

    /* ── 분기 ──
       신체정보(targetWeight) 미입력 → sc202
       입력 완료                     → sc301  */
    const userData = Storage.getUser();
    location.href = userData.targetWeight ? 'sc301.html' : 'sc202.html';
  });
}
