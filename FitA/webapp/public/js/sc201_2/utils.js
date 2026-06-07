'use strict';

/* ============================================================
   sc201_2/utils.js — DOM 참조 상수 및 공용 힌트 헬퍼
   ============================================================ */

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
