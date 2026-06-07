'use strict';

/* ============================================================
   sc201_2/phoneAuth.js — 전화번호 인증 (Firebase Phone Auth + reCAPTCHA)
   의존: utils.js (setHint, setInputState), firebase-config.js
   ============================================================ */

const phoneEl         = document.getElementById('signupPhone');
const sendVerifyBtn   = document.getElementById('sendVerifyBtn');
const verifyCodeGroup = document.getElementById('verifyCodeGroup');
const verifyCodeEl    = document.getElementById('verifyCode');

let confirmationResult = null;
let codeVerified       = false;
let recaptchaVerifier  = null;

/* ── 전화번호 자동 하이픈 ── */
phoneEl.addEventListener('input', () => {
  let v = phoneEl.value.replace(/\D/g, '').slice(0, 11);
  if (v.length >= 7)      v = v.slice(0,3) + '-' + v.slice(3,7) + '-' + v.slice(7);
  else if (v.length >= 4) v = v.slice(0,3) + '-' + v.slice(3);
  phoneEl.value = v;
});

/* ── 전화번호 E.164 변환 ── */
function toE164(phone) {
  const digits = phone.replace(/\D/g, '');
  return '+82' + digits.slice(1); // 010xxxxxxxx → +8210xxxxxxxx
}

/* ── reCAPTCHA 초기화 ── */
function initRecaptcha() {
  if (recaptchaVerifier) return;
  recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
    size: 'invisible',
    'expired-callback': () => {
      recaptchaVerifier.clear();
      recaptchaVerifier = null;
    }
  });
}

initRecaptcha();

/* ── 인증번호 전송 ── */
sendVerifyBtn.addEventListener('click', async () => {
  const phone = phoneEl.value.replace(/\D/g, '');
  if (phone.length < 10) {
    alert('전화번호를 올바르게 입력해주세요.');
    return;
  }

  if (!recaptchaVerifier) initRecaptcha();
  sendVerifyBtn.disabled    = true;
  sendVerifyBtn.textContent = '전송 중...';
  codeVerified = false;

  try {
    confirmationResult = await auth.signInWithPhoneNumber(toE164(phone), recaptchaVerifier);

    verifyCodeGroup.style.display       = 'flex';
    verifyCodeGroup.style.flexDirection = 'column';
    verifyCodeGroup.style.gap           = '6px';
    setHint('verifyHint', 'SMS로 인증번호가 전송되었습니다.', 'valid');
    sendVerifyBtn.textContent = '재전송';
    sendVerifyBtn.disabled    = false;
  } catch (err) {
    sendVerifyBtn.disabled    = false;
    sendVerifyBtn.textContent = '인증번호 전송';
    if (recaptchaVerifier) { recaptchaVerifier.clear(); recaptchaVerifier = null; }
    alert('전송 실패: ' + (err.message || err.code));
    console.error('[Phone Auth]', err);
  }
});

/* ── 인증번호 확인 ── */
verifyCodeEl.addEventListener('input', async () => {
  if (!confirmationResult || verifyCodeEl.value.length !== 6) return;

  verifyCodeEl.disabled = true;
  try {
    await confirmationResult.confirm(verifyCodeEl.value);
    await auth.signOut(); // 임시 Phone Auth 사용자 정리 후 이메일 계정 생성
    codeVerified = true;
    setHint('verifyHint', '인증이 완료되었습니다.', 'valid');
    setInputState(verifyCodeEl, 'valid');
  } catch {
    codeVerified = false;
    setHint('verifyHint', '인증번호가 올바르지 않습니다.', 'error');
    setInputState(verifyCodeEl, 'error');
  } finally {
    verifyCodeEl.disabled = false;
  }
});
