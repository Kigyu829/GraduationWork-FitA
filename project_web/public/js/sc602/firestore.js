'use strict';

/* ── Firestore에서 일별 데이터 복원 (localStorage 캐시 없을 때) ── */
async function loadDayFromFirestore(dateStr) {
  const uid = getCurrentUid();
  if (!uid || typeof db === 'undefined') return;

  try {
    const doc = await db.collection('users').doc(uid).collection('daily').doc(dateStr).get();
    if (!doc.exists) return;
    const data = doc.data();
    if (data.check) localStorage.setItem(lsKey('check', dateStr), JSON.stringify(data.check));
    if (data.sc311) localStorage.setItem(lsKey('sc311', dateStr), JSON.stringify(data.sc311));
    if (data.plan)  localStorage.setItem(lsKey('plan',  dateStr), JSON.stringify(data.plan));
  } catch(err) {
    console.error('Firestore 일별 데이터 로드 실패:', err);
  }
}
