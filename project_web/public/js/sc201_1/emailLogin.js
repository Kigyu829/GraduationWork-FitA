'use strict';

/* ============================================================
   sc201_1/emailLogin.js — 이메일/비밀번호 로그인 폼 제출 처리
   의존: firebase-config.js, common.js (lsKey)
   ============================================================ */

const loginForm  = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');

if (loginForm) {
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const inputId  = document.getElementById('loginId').value.trim();
    const password = document.getElementById('loginPw').value;
    const saveIdCb = document.getElementById('saveId');

    if (!inputId || !password) {
      loginError?.classList.add('show');
      return;
    }

    /* 아이디 저장 */
    if (saveIdCb?.checked) {
      localStorage.setItem('savedLoginId', inputId);
    } else {
      localStorage.removeItem('savedLoginId');
    }

    const submitBtn = loginForm.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '로그인 중...'; }

    try {
      const cred = await auth.signInWithEmailAndPassword(inputId, password);
      const uid  = cred.user.uid;

      sessionStorage.setItem('_fitUid',   uid);
      sessionStorage.setItem('_fitEmail', cred.user.email || '');

      /* Firestore에서 사용자 데이터 로드 후 localStorage 캐시 */
      const doc = await db.collection('users').doc(uid).get();
      if (doc.exists) {
        const data = doc.data();
        if (data.nickname) sessionStorage.setItem('_fitNick', data.nickname);
        if (data.userData) localStorage.setItem(`hud_${uid}`, JSON.stringify(data.userData));

        /* 오늘 일별 데이터도 캐시 */
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        const dayDoc = await db.collection('users').doc(uid).collection('daily').doc(todayStr).get();
        if (dayDoc.exists) {
          const dd = dayDoc.data();
          if (dd.check) localStorage.setItem(lsKey('check', todayStr), JSON.stringify(dd.check));
          if (dd.sc311) localStorage.setItem(lsKey('sc311', todayStr), JSON.stringify(dd.sc311));
          if (dd.plan)  localStorage.setItem(lsKey('plan',  todayStr), JSON.stringify(dd.plan));
        }

        const ud = data.userData || {};
        location.href = ud.targetWeight ? 'sc301.html' : 'sc202.html';
      } else {
        location.href = 'sc202.html';
      }
    } catch (err) {
      loginError?.classList.add('show');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '로그인'; }
      console.error('로그인 실패:', err.code);
    }
  });
}
