/* ============================================================
   sc201_1.js — 로그인 (Firebase Auth)
   의존: common.js, firebase-config.js
   ============================================================ */

'use strict';

const loginForm  = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');

/* ── 저장된 아이디 복원 ── */
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('savedLoginId');
  if (saved) {
    const el = document.getElementById('loginId');
    if (el) el.value = saved;
    const cb = document.getElementById('saveId');
    if (cb) cb.checked = true;
  }
});

/* ── 이미 로그인된 경우 자동 이동 (Firebase Auth 세션 복원) ── */
auth.onAuthStateChanged(async user => {
  if (!user) return;
  sessionStorage.setItem('_fitUid',   user.uid);
  sessionStorage.setItem('_fitEmail', user.email || '');
  try {
    const doc = await db.collection('users').doc(user.uid).get();
    if (doc.exists) {
      const data = doc.data();
      if (data.nickname) sessionStorage.setItem('_fitNick', data.nickname);
      if (data.userData) localStorage.setItem(`hud_${user.uid}`, JSON.stringify(data.userData));
      if (data.userData?.targetWeight) { location.replace('sc301.html'); return; }
    }
    location.replace('sc202.html');
  } catch { /* 네트워크 오류 시 무시 */ }
});

/* ── 소셜 로그인 버튼 (추후 연동) ── */
document.querySelectorAll('.social-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const provider = btn.classList.contains('naver') ? '네이버' :
                     btn.classList.contains('kakao') ? '카카오' : '구글';
    alert(`${provider} 로그인은 추후 연동 예정입니다.`);
  });
});

/* ── 로그인 제출 ── */
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
