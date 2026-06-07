'use strict';

window.addEventListener('DOMContentLoaded', () => {
  /* Firebase auth 완료 후 초기화 (sessionStorage fallback 있어서 대부분 즉시 진행됨) */
  if (typeof auth !== 'undefined') {
    auth.onAuthStateChanged(user => {
      if (user) {
        sessionStorage.setItem('_fitUid', user.uid);
        if (user.displayName) sessionStorage.setItem('_fitNick', user.displayName);
      }
      initPage();
    });
  } else {
    initPage();
  }
});

function initPage() {
  const data = Storage.getUser();

  /* 프로필 미완성이면 홈으로 (온보딩 먼저) */
  if (!data.weight || !data.height || !data.targetWeight) {
    location.replace('sc301.html');
    return;
  }

  /* 오늘 체중 이미 입력됐으면 홈으로 */
  const today    = new Date();
  const todayStr = todayDateStr();
  const todayKey = `todayWeight_${lsKey('check', todayStr)}`;
  if (localStorage.getItem(todayKey)) {
    location.replace('sc301.html');
    return;
  }

  /* ── 날짜 ── */
  const weekNames = ['일','월','화','수','목','금','토'];
  const dateEl = document.getElementById('wcDate');
  if (dateEl) {
    dateEl.textContent =
      `${today.getFullYear()}년 ${today.getMonth()+1}월 ${today.getDate()}일 (${weekNames[today.getDay()]})`;
  }

  /* ── 닉네임 인사 ── */
  const reg  = Storage.getRegistered();
  const nick = reg.nickname || '';
  const greetEl = document.getElementById('wcGreeting');
  if (greetEl && nick) greetEl.textContent = `안녕하세요, ${nick}님! 👋`;

  /* ── 목표 진행 바 ── */
  renderGoalBar(data);

  /* ── 체중 입력 초기화 ── */
  initWeightInput(data, todayStr, todayKey);
}
