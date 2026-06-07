'use strict';

/* ============================================================
   sc311/init.js — DOMContentLoaded 진입점
   반드시 마지막으로 로드
   의존: utils.js, render.js, meal.js, workout.js,
         aiChat.js, routine.js, motivation.js
   ============================================================ */

/* ── 탭 전환 ── */
function initTabs() {
  const tabBtns     = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      tabBtns.forEach(b     => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tabContent${capitalize(target)}`)?.classList.add('active');
    });
  });

  const params  = new URLSearchParams(location.search);
  const initTab = params.get('tab');
  if (initTab) {
    const targetBtn = document.querySelector(`.tab-btn[data-tab="${initTab}"]`);
    if (targetBtn) targetBtn.click();
  }
}

/* ── Firestore에서 최신 userData 갱신 ── */
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

/* ── Firestore에서 오늘 데이터 복원 ── */
async function loadTodayFromFirestore() {
  const uid = getCurrentUid();
  if (!uid || typeof db === 'undefined') return;

  const _d    = new Date();
  const today = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;

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

/* ── 오늘 상태 복원 ── */
function restoreTodayState() {
  const state = loadTodayState();
  restoreMealState(state);
  restoreWorkoutState(state);
}

/* ── DOMContentLoaded ── */
window.addEventListener('DOMContentLoaded', async () => {
  renderSidebar();
  renderPageSubtitle();
  initTabs();
  initAiChat();
  initCommonOverlays();  /* common.js — AI상담/히스토리 오버레이 */
  bindMenuBtns();
  bindLogout();
  bindLogoClick();
  await refreshUserDataFromFirestore();
  await loadTodayFromFirestore();
  await restoreRoutinesFromFirestore();
  renderAiPlan();
  restoreTodayState();
  fetchMotivation();
  checkPoseVerified();
});
