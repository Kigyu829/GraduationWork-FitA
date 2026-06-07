'use strict';

/* ── 오늘 체중 미입력이면 sc300으로 이동 ── */
async function redirectIfNoTodayWeight() {
  const data = Storage.getUser();
  if (!data.weight || !data.height || !data.targetWeight) return false;
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const todayKey = `todayWeight_${lsKey('check', dateStr)}`;
  if (localStorage.getItem(todayKey)) return false;

  /* localStorage에 없으면 Firestore에서 확인 (새 기기 로그인 대응) */
  const uid = getCurrentUid();
  if (uid && typeof db !== 'undefined') {
    try {
      const doc = await db.collection('users').doc(uid).collection('daily').doc(dateStr).get();
      if (doc.exists && doc.data().weight != null) {
        localStorage.setItem(todayKey, String(doc.data().weight));
        Storage.mergeUser({ weight: String(doc.data().weight) });
        return false;
      }
    } catch (e) {
      console.warn('[sc301] 오늘 체중 Firestore 조회 실패:', e.message);
    }
  }

  location.replace('sc300.html');
  return true;
}

/* ── 프로필이 있고 오늘 플랜이 없으면 sc302로 자동 이동 ── */
function autoRedirectIfNoPlan() {
  const data = Storage.getUser();
  const hasPlan    = data.planDate === todayStr() && !!(data.aiMealPlan && data.aiWorkoutPlan);
  const hasProfile = !!(data.weight && data.height && data.targetWeight);
  if (!hasPlan && hasProfile) {
    location.replace('sc302.html');
    return true;
  }
  return false;
}
