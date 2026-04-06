/* hc402.js — 스캔 애니메이션 → 파란 로딩 → hc403
   의존: common.js
*/
'use strict';

window.addEventListener('DOMContentLoaded', () => {
  const photo = sessionStorage.getItem('uploadedPhoto');
  if (!photo) {
    location.href = 'sc401.html';
    return;
  }

  const photoEl      = document.getElementById('scanPhoto');
  const progressFill = document.getElementById('progressFill');
  const progressLabel= document.getElementById('progressLabel');
  const statusEl     = document.getElementById('scanStatus');
  const hintEl       = document.getElementById('scanHint');

  photoEl.src = photo;

  /* ── 1단계: 초록 스캔 진행 메시지 ── */
  const messages = [
    { pct: 20,  status: '사진을 스캔하는 중...',      hint: 'AI가 음식의 종류와 양을 파악하고 있어요' },
    { pct: 45,  status: '식품 데이터베이스 조회 중...', hint: '영양 정보를 비교하고 있어요' },
    { pct: 70,  status: '칼로리 분석 중...',           hint: '맞춤 식단 정보를 계산하고 있어요' },
    { pct: 90,  status: '결과 정리 중...',             hint: '거의 다 됐어요!' },
    { pct: 100, status: '스캔 완료!',                  hint: 'AI가 판독을 시작합니다' },
  ];

  let step = 0;

  function nextStep() {
    if (step >= messages.length) {
      /* ── 2단계: 파란 로딩 오버레이 표시 후 이동 ── */
      setTimeout(showAnalyzingOverlay, 300);
      return;
    }
    const m = messages[step];
    progressFill.style.width  = m.pct + '%';
    progressLabel.textContent = m.pct + '%';
    if (statusEl) statusEl.textContent = m.status;
    if (hintEl)   hintEl.textContent   = m.hint;
    step++;
    const delay = step === messages.length ? 600 : 700;
    setTimeout(nextStep, delay);
  }

  /* 사진 로드 후 스캔 시작 */
  photoEl.onload = () => { setTimeout(nextStep, 400); };
  if (photoEl.complete) setTimeout(nextStep, 400);

  /* ── 파란 로딩 오버레이 ── */
  function showAnalyzingOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'analyzing-overlay';
    overlay.innerHTML = `
      <div class="analyzing-box">
        <div class="analyzing-spinner"></div>
        <div class="analyzing-title">분석 중입니다</div>
        <div class="analyzing-sub">AI가 사진을 판독하고 있어요</div>
        <div class="analyzing-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    /* 페이드인 */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlay.classList.add('show'));
    });

    /* 1.6초 후 hc403으로 이동 */
    setTimeout(() => { navigateTo('hc403.html'); }, 1600);
  }
});

/* ── 페이지 전환 헬퍼 ── */
function navigateTo(url) {
  document.body.classList.add('page-exit');
  setTimeout(() => { location.href = url; }, 320);
}

/* drawer.js — 슬라이드 사이드바 공통
   의존: common.js
*/
'use strict';

window.addEventListener('DOMContentLoaded', () => {
  const toggle  = document.getElementById('drawerToggle');
  const drawer  = document.getElementById('drawer');
  const overlay = document.getElementById('drawerOverlay');
  const close   = document.getElementById('drawerClose');
  const logout  = document.getElementById('drawerLogout');

  function openDrawer() {
    drawer?.classList.add('open');
    overlay?.classList.add('show');
  }

  function closeDrawer() {
    drawer?.classList.remove('open');
    overlay?.classList.remove('show');
  }

  toggle?.addEventListener('click', openDrawer);
  close?.addEventListener('click', closeDrawer);
  overlay?.addEventListener('click', closeDrawer);

  /* ESC 키로 닫기 */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDrawer();
  });

  /* 메뉴 버튼 네비게이션 */
  drawer?.querySelectorAll('.drawer-menu-btn[data-href]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigateTo(btn.dataset.href);
    });
  });

  /* 로그아웃 */
  logout?.addEventListener('click', () => {
    localStorage.removeItem('healthUserData');
    navigateTo('sc101.html');
  });
});