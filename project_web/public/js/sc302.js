/* ============================================================
   sc302.js — AI 가이드 생성 로딩
   의존: common.js

   [흐름]
   sc203 완료 → sc302(로딩 3~4초) → sc301(대시보드)
   실제 서버 연동 시 AI API 응답 대기로 교체 예정
   ============================================================ */

'use strict';

/* ── 사이드바 공통 초기화 ── */
window.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  initCommonOverlays();  /* common.js — AI상담/히스토리 오버레이 */
  bindMenuBtns();
  bindLogout();
  bindLogoClick();
  startLoadingSequence();
});

function renderSidebar() {
  const data = Storage.getUser();
  const reg  = Storage.getRegistered();

  const nameEl = document.getElementById('userName');
  const infoEl = document.getElementById('userBasicInfo');
  const cwEl   = document.getElementById('currentWeightText');
  const twEl   = document.getElementById('targetWeightText');

  if (nameEl) nameEl.textContent = reg.nickname ? `${reg.nickname}님` : '사용자';
  if (infoEl) {
    const parts = [];
    if (data.gender) parts.push(data.gender);
    if (data.height) parts.push(`키 ${data.height}cm`);
    infoEl.textContent = parts.join(' · ') || '기본 정보 없음';
  }
  if (cwEl) cwEl.textContent = data.weight      ? `${data.weight}kg`      : '-';
  if (twEl) twEl.textContent = data.targetWeight ? `${data.targetWeight}kg` : '-';
}

function bindLogout() {
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('healthUserData');
    location.href = 'sc101.html';
  });
}

function bindLogoClick() {
  document.getElementById('sidebarLogo')?.addEventListener('click', () => {
    /* 로그인 후 페이지이므로 로고 클릭 시 대시보드로 이동 */
    location.href = 'sc301.html';
  });
}

/* ── 로딩 시퀀스 ── */
const MESSAGES = [
  '식단 패턴을 분석하고 있어요...',
  'BMI와 활동량을 계산 중이에요...',
  '최적 칼로리를 계산하고 있어요...',
  '운동 강도를 맞춤 설정 중이에요...',
  '식단 조합을 최적화하고 있어요...',
  '거의 다 됐어요! 마무리 중이에요...',
];

const STEPS = [
  { id: 'step1', label: '신체 분석', duration: 1000 },
  { id: 'step2', label: '플랜 생성', duration: 2200 },
  { id: 'step3', label: '최종 검토', duration: 800  },
];

function startLoadingSequence() {
  const msgEl = document.getElementById('loadingMsg');
  const pctEl = document.getElementById('loadingPct');

  /* 메시지 순환 */
  let msgIdx = 0;
  const msgInterval = setInterval(() => {
    if (!msgEl) return;
    msgEl.classList.add('fade');
    setTimeout(() => {
      msgIdx = (msgIdx + 1) % MESSAGES.length;
      msgEl.textContent = MESSAGES[msgIdx];
      msgEl.classList.remove('fade');
    }, 400);
  }, 1800);

  /* 단계 진행 */
  const totalDuration = STEPS.reduce((s, st) => s + st.duration, 0);
  let elapsed = 0;

  STEPS.forEach((step, i) => {
    setTimeout(() => {
      /* 이전 단계 done, 현재 단계 active */
      if (i > 0) {
        document.getElementById(STEPS[i-1].id)?.classList.replace('active', 'done');
      }
      document.getElementById(step.id)?.classList.add('active');

      /* 퍼센트 업데이트 */
      elapsed += step.duration;
      const pct = Math.round((elapsed / totalDuration) * 100);
      if (pctEl) pctEl.textContent = `${pct}% 완료`;
    }, STEPS.slice(0, i).reduce((s, st) => s + st.duration, 0));
  });

  /* 마지막 단계 done 처리 후 sc301으로 이동 */
  setTimeout(() => {
    clearInterval(msgInterval);
    document.getElementById(STEPS[STEPS.length - 1].id)?.classList.replace('active', 'done');
    if (msgEl) msgEl.textContent = '✅ 플랜이 완성되었어요!';
    if (pctEl) pctEl.textContent = '100% 완료';

    setTimeout(() => {
      location.href = 'sc301.html';
    }, 700);

  }, totalDuration);
}
