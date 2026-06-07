'use strict';

window.addEventListener('DOMContentLoaded', async () => {
  await restoreUserFromFirestore();  /* localStorage 비어있으면 Firestore에서 복원 */

  if (autoRedirectIfNoPlan()) return;           /* 플랜 없으면 sc302로 이동 */
  if (await redirectIfNoTodayWeight()) return;  /* 오늘 체중 미입력이면 sc300으로 이동 */

  renderHeader();
  renderSidebar();
  renderProgress();
  renderBMIGauge();
  renderAiPlan();
  renderTodayCheck();
  renderCalendar();
  bindMenuBtns();     /* common.js */
  bindLogout();
  bindLogoClick();
  initCommonOverlays();  /* common.js — AI상담 오버레이 + 히스토리 sc602 이동 */
  initMobileSidebar();   /* common.js — 모바일 햄버거 메뉴 */
  initBackExit();        /* 안드로이드 뒤로가기 → 앱 종료 */
  renderStreak();        /* 연속 기록 스트릭 카드 */
  renderStreakBanner();  /* 연속 달성 배너 */
});
