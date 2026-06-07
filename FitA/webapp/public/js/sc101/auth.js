'use strict';

/* ── 이미 로그인된 사용자 → sc301로 자동 이동 (Firebase Auth) ── */
auth.onAuthStateChanged(async user => {
  if (!user) return;
  sessionStorage.setItem('_fitUid', user.uid);
  localStorage.setItem('_fitUid', user.uid);
  const localData = (() => { try { return JSON.parse(localStorage.getItem(`hud_${user.uid}`)) || {}; } catch { return {}; } })();
  if (localData.targetWeight) { location.replace('sc301.html'); return; }
  /* localStorage 캐시 없을 때 Firestore 확인 */
  try {
    const doc = await db.collection('users').doc(user.uid).get();
    if (doc.exists) {
      const data = doc.data();
      if (data.nickname) sessionStorage.setItem('_fitNick', data.nickname);
      sessionStorage.setItem('_fitEmail', data.email || user.email || '');
      if (data.userData) localStorage.setItem(`hud_${user.uid}`, JSON.stringify(data.userData));
      if (data.createdAt) { const _d = data.createdAt.toDate(); localStorage.setItem(`reg_${user.uid}`, `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`); }
      if (data.userData?.targetWeight) location.replace('sc301.html');
    }
  } catch { /* 네트워크 오류 무시 */ }
});
