/* ============================================================
   sc201_2.js — 회원가입 (Firebase Auth + Firestore)
   의존: common.js, firebase-config.js
   ============================================================ */

'use strict';

const signupForm         = document.getElementById('signupForm');
const emailEl            = document.getElementById('signupEmail');
const nicknameEl         = document.getElementById('signupNickname');
const pwEl               = document.getElementById('signupPw');
const pwConfirmEl        = document.getElementById('signupPwConfirm');
const phoneEl            = document.getElementById('signupPhone');
const sendVerifyBtn      = document.getElementById('sendVerifyBtn');
const verifyCodeGroup    = document.getElementById('verifyCodeGroup');
const verifyCodeEl       = document.getElementById('verifyCode');
const successOverlay     = document.getElementById('successOverlay');
const welcomeNameEl      = document.getElementById('welcomeName');
const successContinueBtn = document.getElementById('successContinueBtn');

/* ── 힌트 표시 헬퍼 ── */
function setHint(elId, msg, type = '') {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.className   = 'field-hint ' + type;
}

function setInputState(input, state) {
  input.classList.remove('error', 'valid');
  if (state) input.classList.add(state);
}

/* ── 이메일 유효성 (Firebase 중복 체크) ── */
emailEl.addEventListener('blur', async () => {
  const val = emailEl.value.trim();
  if (!val) { setHint('emailHint', ''); return; }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
    setHint('emailHint', '올바른 이메일 형식이 아닙니다.', 'error');
    setInputState(emailEl, 'error');
    return;
  }

  try {
    const methods = await auth.fetchSignInMethodsForEmail(val);
    if (methods.length > 0) {
      setHint('emailHint', '이미 사용 중인 이메일입니다.', 'error');
      setInputState(emailEl, 'error');
    } else {
      setHint('emailHint', '사용 가능한 이메일입니다.', 'valid');
      setInputState(emailEl, 'valid');
    }
  } catch {
    setHint('emailHint', '사용 가능한 이메일입니다.', 'valid');
    setInputState(emailEl, 'valid');
  }
});

/* ── 비밀번호 유효성 ── */
pwEl.addEventListener('input', () => {
  if (!pwEl.value) { setHint('pwHint', ''); return; }
  if (pwEl.value.length < 8) {
    setHint('pwHint', '비밀번호는 8자 이상이어야 합니다.', 'error');
    setInputState(pwEl, 'error');
  } else {
    setHint('pwHint', '사용 가능한 비밀번호입니다.', 'valid');
    setInputState(pwEl, 'valid');
  }
  if (pwConfirmEl.value) checkPwConfirm();
});

function checkPwConfirm() {
  if (!pwConfirmEl.value) { setHint('pwConfirmHint', ''); return; }
  if (pwEl.value !== pwConfirmEl.value) {
    setHint('pwConfirmHint', '비밀번호가 일치하지 않습니다.', 'error');
    setInputState(pwConfirmEl, 'error');
  } else {
    setHint('pwConfirmHint', '비밀번호가 일치합니다.', 'valid');
    setInputState(pwConfirmEl, 'valid');
  }
}

pwConfirmEl.addEventListener('input', checkPwConfirm);

/* ── 전화번호 자동 하이픈 ── */
phoneEl.addEventListener('input', () => {
  let v = phoneEl.value.replace(/\D/g, '').slice(0, 11);
  if (v.length >= 7)      v = v.slice(0,3) + '-' + v.slice(3,7) + '-' + v.slice(7);
  else if (v.length >= 4) v = v.slice(0,3) + '-' + v.slice(3);
  phoneEl.value = v;
});

/* ── 인증번호 전송 ── */
let mockCode     = '';
let codeVerified = false;

sendVerifyBtn.addEventListener('click', () => {
  const phone = phoneEl.value.replace(/\D/g, '');
  if (phone.length < 10) {
    alert('전화번호를 올바르게 입력해주세요.');
    return;
  }
  mockCode     = String(Math.floor(100000 + Math.random() * 900000));
  codeVerified = false;

  verifyCodeGroup.style.display       = 'flex';
  verifyCodeGroup.style.flexDirection = 'column';
  verifyCodeGroup.style.gap           = '6px';

  setHint('verifyHint', `인증번호가 전송되었습니다. (개발 중 확인: ${mockCode})`, 'valid');
  sendVerifyBtn.textContent = '재전송';
  console.log('[DEV] 인증번호:', mockCode);
});

/* ── 인증번호 실시간 검사 ── */
verifyCodeEl.addEventListener('input', () => {
  if (!mockCode) return;
  if (verifyCodeEl.value === mockCode) {
    setHint('verifyHint', '인증이 완료되었습니다.', 'valid');
    setInputState(verifyCodeEl, 'valid');
    codeVerified = true;
  } else if (verifyCodeEl.value.length === 6) {
    setHint('verifyHint', '인증번호가 올바르지 않습니다.', 'error');
    setInputState(verifyCodeEl, 'error');
    codeVerified = false;
  } else {
    setHint('verifyHint', '');
    codeVerified = false;
  }
});

/* ── 가입하기 제출 ── */
if (signupForm) {
  signupForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const email     = emailEl.value.trim();
    const nickname  = nicknameEl.value.trim();
    const password  = pwEl.value;
    const pwConfirm = pwConfirmEl.value;
    const phone     = phoneEl.value.trim();

    if (!email || !nickname || !password || !pwConfirm || !phone) {
      alert('모든 항목을 입력해주세요.'); return;
    }
    if (password.length < 8) {
      alert('비밀번호는 8자 이상이어야 합니다.'); return;
    }
    if (password !== pwConfirm) {
      alert('비밀번호가 일치하지 않습니다.'); return;
    }
    if (!codeVerified) {
      alert('전화번호 인증을 완료해주세요.'); return;
    }

    const submitBtn = signupForm.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '가입 중...'; }

    try {
      /* Firebase Auth 계정 생성 */
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      const uid  = cred.user.uid;

      sessionStorage.setItem('_fitUid',   uid);
      sessionStorage.setItem('_fitEmail', email);
      sessionStorage.setItem('_fitNick',  nickname);

      /* Firestore 사용자 문서 생성 */
      await db.collection('users').doc(uid).set({
        email,
        nickname,
        phone,
        userData:  {},
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      /* localStorage 초기 캐시 */
      localStorage.setItem(`hud_${uid}`, JSON.stringify({}));
      const _rd = new Date();
      localStorage.setItem(`reg_${uid}`, `${_rd.getFullYear()}-${String(_rd.getMonth()+1).padStart(2,'0')}-${String(_rd.getDate()).padStart(2,'0')}`);

      /* 완료 팝업 */
      if (welcomeNameEl) welcomeNameEl.textContent = nickname;
      if (successOverlay) successOverlay.classList.add('show');

    } catch (err) {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '가입하기'; }
      if (err.code === 'auth/email-already-in-use') {
        alert('이미 사용 중인 이메일입니다.');
        setHint('emailHint', '이미 사용 중인 이메일입니다.', 'error');
        setInputState(emailEl, 'error');
      } else {
        alert(`회원가입 실패: ${err.message}`);
      }
      console.error('회원가입 오류:', err.code);
    }
  });
}

/* ── 완료 팝업 → sc202(신체정보 입력) ── */
if (successContinueBtn) {
  successContinueBtn.addEventListener('click', () => {
    location.href = 'sc202.html';
  });
}
