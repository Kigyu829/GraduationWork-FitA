'use strict';

/* ════════════════════════════════
   sc311/init.js
   DOMContentLoaded 진입점 — 항상 마지막 로드
   의존: utils.js   (loadTodayState)
        render.js  (renderAiPlan, renderPageSubtitle, initTabs)
        meal.js    (restoreMealState)
        workout.js (restoreWorkoutState)
        aiChat.js  (initAiChat)
        common.js  (renderSidebar, initCommonOverlays, bindMenuBtns, bindLogout,
                    bindLogoClick, getCurrentUid, lsKey, syncDayToFirestore,
                    Storage, db, AI_SERVER 등)
   ════════════════════════════════ */

/* ── Firestore에서 최신 userData 갱신 (타 기기 플랜 변경 반영) ── */
async function refreshUserDataFromFirestore() {
  const uid = getCurrentUid();
  if (!uid || typeof db === 'undefined') return;
  try {
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists && doc.data().userData) {
      localStorage.setItem(`hud_${uid}`, JSON.stringify(doc.data().userData));
    }
  } catch { /* 네트워크 오류 — 캐시 사용 */ }
}

/* ── Firestore에서 오늘 데이터 복원 (localStorage 캐시 없을 때) ── */
async function loadTodayFromFirestore() {
  const uid = getCurrentUid();
  if (!uid || typeof db === 'undefined') return;

  const _d    = new Date();
  const today = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;

  /* sc311 캐시가 이미 있으면 스킵 */
  if (localStorage.getItem(lsKey('sc311', today))) return;

  try {
    const doc = await db.collection('users').doc(uid).collection('daily').doc(today).get();
    if (!doc.exists) return;
    const data = doc.data();
    if (data.check) localStorage.setItem(lsKey('check', today), JSON.stringify(data.check));
    if (data.sc311) localStorage.setItem(lsKey('sc311', today), JSON.stringify(data.sc311));
    if (data.plan)  localStorage.setItem(lsKey('plan',  today), JSON.stringify(data.plan));
  } catch(err) {
    console.error('Firestore 오늘 데이터 로드 실패:', err);
  }
}

function restoreTodayState() {
  const state = loadTodayState();
  restoreMealState(state);
  restoreWorkoutState(state);
}

/* ════════════════════════════════
   동기부여 메시지
   ════════════════════════════════ */
async function fetchMotivation() {
  const textEl = document.getElementById('motivationText');
  if (!textEl) return;

  const today   = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const cacheKey = lsKey('motivationMsg', dateStr);

  const cached = localStorage.getItem(cacheKey);
  if (cached) { textEl.textContent = cached; return; }

  let missedCount = 0;
  const missedTypes = { meal: 0, workout: 0 };
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const key  = lsKey('check', dStr);
    try {
      const chk = JSON.parse(localStorage.getItem(key)) || {};
      if (!chk.meal)    missedTypes.meal++;
      if (!chk.workout) missedTypes.workout++;
      if (!chk.meal || !chk.workout) missedCount++;
    } catch { missedCount++; }
  }

  const reasons = [];
  if (missedTypes.meal > 0)    reasons.push(`식단 미인증 ${missedTypes.meal}일`);
  if (missedTypes.workout > 0) reasons.push(`운동 미이행 ${missedTypes.workout}일`);
  const missedReasons = reasons.join(', ') || '없음';

  const userData    = Storage.getUser();
  const userInfoStr = [
    userData.gender       ? `성별 ${userData.gender}`         : '',
    userData.weight       ? `체중 ${userData.weight}kg`       : '',
    userData.targetWeight ? `목표 ${userData.targetWeight}kg` : '',
    userData.goalWeeks    ? `기간 ${userData.goalWeeks}주`    : '',
  ].filter(Boolean).join(', ');

  try {
    const res = await fetch(`${AI_SERVER}/api/motivation`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userInfo: userInfoStr, missedCount, missedReasons }),
    });
    if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    const msg = json.message.trim();
    textEl.textContent = msg;
    localStorage.setItem(cacheKey, msg);
  } catch (err) {
    textEl.textContent = '오늘도 건강한 하루 보내세요! 💪';
    console.warn('동기부여 메시지 로드 실패:', err.message);
  }
}

/* ════════════════════════════════
   자세 인증 복귀 시 자동 체크
   hc503 → sc311?tab=workout&poseVerified=운동명
   ════════════════════════════════ */
function checkPoseVerified() {
  const params   = new URLSearchParams(location.search);
  const verified = params.get('poseVerified');
  if (!verified) return;

  /* 운동명 일치하는 항목 찾아서 ✓ 자동 클릭 */
  document.querySelectorAll('.workout-item').forEach(item => {
    const nameEl = item.querySelector('.workout-name');
    if (nameEl && nameEl.textContent.trim() === verified) {
      const checkBtn = item.querySelector('.workout-check');
      if (checkBtn && !checkBtn.classList.contains('done')) {
        checkBtn.click();
      }
    }
  });

  /* URL에서 poseVerified 파라미터 제거 (새로고침 시 재실행 방지) */
  const url = new URL(location.href);
  url.searchParams.delete('poseVerified');
  history.replaceState({}, '', url.toString());
}

/* ════════════════════════════════
   DOMContentLoaded
   ════════════════════════════════ */
window.addEventListener('DOMContentLoaded', async () => {
  renderSidebar();
  renderPageSubtitle();
  initTabs();
  initAiChat();
  initCommonOverlays();  /* common.js — AI상담/히스토리 오버레이 */
  bindMenuBtns();
  bindLogout();
  bindLogoClick();
  await refreshUserDataFromFirestore(); /* 타 기기 플랜 변경 반영 */
  await loadTodayFromFirestore();       /* 새 기기 로그인 시 오늘 데이터 복원 */
  await restoreRoutinesFromFirestore(); /* 새 기기 로그인 시 저장된 루틴 복원 */
  renderAiPlan();
  restoreTodayState();
  fetchMotivation();
  checkPoseVerified();   /* 자세 인증 복귀 시 자동 체크 */
});
