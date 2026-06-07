'use strict';

/* ============================================================
   sc201_1/authState.js — 로그인 상태 감지 (세션 복원 + 소셜 신규 유저 처리)
   의존: utils.js (isInWebView), firebase-config.js
   ============================================================ */

auth.onAuthStateChanged(async user => {
  if (!user) return;
  sessionStorage.setItem('_fitUid',   user.uid);
  localStorage.setItem('_fitUid',     user.uid);
  sessionStorage.setItem('_fitEmail', user.email || '');
  try {
    const doc = await db.collection('users').doc(user.uid).get();
    if (doc.exists) {
      const data = doc.data();
      if (data.nickname) sessionStorage.setItem('_fitNick', data.nickname);
      if (data.userData) localStorage.setItem(`hud_${user.uid}`, JSON.stringify(data.userData));
      if (data.userData?.targetWeight) { location.replace('sc301.html'); return; }
    } else {
      /* 신규 소셜 로그인 유저 — Firestore 문서 생성 */
      const nickname = user.displayName || sessionStorage.getItem('_pendingNick') || '';
      sessionStorage.removeItem('_pendingNick');
      await db.collection('users').doc(user.uid).set({
        email:     user.email || '',
        nickname,
        userData:  {},
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      localStorage.setItem(`hud_${user.uid}`, JSON.stringify({}));
      const d = new Date();
      localStorage.setItem(`reg_${user.uid}`,
        `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
      if (nickname) sessionStorage.setItem('_fitNick', nickname);
    }
    location.replace('sc202.html');
  } catch (e) {
    console.error('[auth] Firestore 오류, sc202로 이동:', e);
    location.replace('sc202.html');
  }
});
