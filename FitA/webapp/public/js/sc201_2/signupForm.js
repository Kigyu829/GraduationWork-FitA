'use strict';

/* ============================================================
   sc201_2/signupForm.js — 회원가입 폼 제출 및 완료 팝업 처리
   의존: utils.js, firebase-config.js, phoneAuth.js
   ============================================================ */

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
