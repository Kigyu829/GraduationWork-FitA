'use strict';

/* ════════════════════════════════
   sc701/init.js
   DOMContentLoaded 진입점 — 항상 마지막 로드
   의존: utils.js       (fetchUser)
        profile.js     (renderSidebar, renderBanner, bindAvatarUpload,
                         bindNavItems, bindCancelBtns, loadProfileForm, bindProfileSave)
        bodyGoal.js    (loadBodyForm, loadGoalForm, bindBodySave, bindGoalSave, bindActivitySave)
        account.js     (loadAccountForm, bindAccountSave)
        dangerZone.js  (bindDangerZone)
        weightGraph.js (renderWeightGraph)
        common.js      (Storage, getCurrentUid, auth, initCommonOverlays,
                         bindMenuBtns, bindLogout, bindLogoClick)
   ════════════════════════════════ */

window.addEventListener('DOMContentLoaded', async () => {
  const reg = Storage.getRegistered();  /* common.js */
  if (!reg.email) {
    location.href = 'sc201_1.html';
    return;
  }

  const userData = await fetchUser();
  if (!userData) return;

  renderSidebar(userData);
  renderBanner(userData);

  /* Firebase auth가 비동기라 currentUser가 아직 null일 수 있음 → auth 확정 후 그래프 렌더 */
  if (typeof auth !== 'undefined') {
    const unsub = auth.onAuthStateChanged(user => {
      unsub();
      if (user) sessionStorage.setItem('_fitUid', user.uid);
      renderWeightGraph();
    });
  } else {
    renderWeightGraph();
  }

  loadProfileForm(userData);
  loadBodyForm(userData);
  loadGoalForm(userData);
  loadAccountForm(userData);

  bindNavItems();
  bindAvatarUpload();
  bindProfileSave();
  bindBodySave();
  bindGoalSave(userData);
  bindAccountSave();
  bindDangerZone();
  bindCancelBtns();
  bindActivitySave();    /* FitA 활동량 저장 */
  initCommonOverlays();  /* AI상담 오버레이 + 히스토리 sc602 이동 */
  bindMenuBtns();   /* common.js */
  bindLogout();
  bindLogoClick();
});
