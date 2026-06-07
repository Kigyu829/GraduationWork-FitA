'use strict';

/* ============================================================
   sc201_2/validation.js — 이메일·비밀번호 유효성 검사
   의존: utils.js, firebase-config.js
   ============================================================ */

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
