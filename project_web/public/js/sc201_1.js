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

  /* ── registeredPhone 누락 보정
     기존에 페이지를 열어서 email만 세팅됐고 phone이 없는 경우 보완 ── */
  if (localStorage.getItem('registeredEmail') === 'test1@test.com'
      && !localStorage.getItem('registeredPhone')) {
    localStorage.setItem('registeredPhone', '010-1234-5678');
  }
})();

const loginForm  = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const saveIdBox  = document.getElementById('saveId');
const loginIdEl  = document.getElementById('loginId');

/* ── 저장된 아이디 복원 (이메일 또는 전화번호) ── */
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('savedLoginId');
  if (saved && loginIdEl) {
    loginIdEl.value = saved;
    if (saveIdBox) saveIdBox.checked = true;
  }
});

/* ── 입력값이 전화번호인지 판단 ── */
function isPhoneNumber(val) {
  return /^[\d\-]+$/.test(val);
}

/* ── 전화번호 정규화 (하이픈 제거 후 비교) ── */
function normalizePhone(val) {
  return val.replace(/\D/g, '');
}

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

    const inputId  = loginIdEl.value.trim();
    const password = document.getElementById('loginPw').value;

    if (!inputId || !password) {
      loginError.classList.add('show');
      return;
    }

    /* 아이디 저장 처리 */
    if (saveIdBox && saveIdBox.checked) {
      localStorage.setItem('savedLoginId', inputId);
    } else {
      localStorage.removeItem('savedLoginId');
    }

    /* ── 이메일 / 전화번호 분기 인증 ── */
    const reg     = Storage.getRegistered();
    const byPhone = isPhoneNumber(inputId);
    let   idMatch = false;

    if (byPhone) {
      /* 전화번호: 하이픈 제거 후 비교 */
      const storedPhone = localStorage.getItem('registeredPhone') || '';
      idMatch = normalizePhone(inputId) === normalizePhone(storedPhone);
    } else {
      /* 이메일 */
      idMatch = inputId === reg.email;
    }

    if (!idMatch || password !== reg.password) {
      loginError.classList.add('show');
      return;
    }

    loginError.classList.remove('show');

    /* 신체정보 입력 여부에 따라 분기 */
    const userData = Storage.getUser();
    location.href = userData.targetWeight ? 'sc301.html' : 'sc202.html';
  });
}
