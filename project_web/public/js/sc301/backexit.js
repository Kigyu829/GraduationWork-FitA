'use strict';

/* ════════════════════════════════
   0. 안드로이드 뒤로가기 종료
   ════════════════════════════════ */
function initBackExit() {
  /* PWA standalone 환경에서만 동작 */
  if (!window.matchMedia('(display-mode: standalone)').matches) return;

  /* 현재 히스토리 스택 맨 위에 더미 상태를 추가
     → 뒤로가기 시 이전 페이지(로그인)로 가지 않고 popstate 이벤트만 발생 */
  history.pushState({ backExit: true }, '', location.href);

  let backPressedOnce = false;
  let toastEl = null;

  window.addEventListener('popstate', () => {
    /* 다시 더미 상태를 쌓아서 다음 뒤로가기에도 같은 로직 반복 */
    history.pushState({ backExit: true }, '', location.href);

    if (backPressedOnce) {
      /* 2번째 뒤로가기 → 앱 종료 */
      window.close();
      /* window.close()가 막히는 경우 대비 (일부 브라우저) */
      document.documentElement.style.transition = 'opacity 0.3s';
      document.documentElement.style.opacity = '0';
      setTimeout(() => window.close(), 350);
      return;
    }

    backPressedOnce = true;

    /* 토스트 메시지 표시 */
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.style.cssText = [
        'position:fixed', 'bottom:60px', 'left:50%', 'transform:translateX(-50%)',
        'background:rgba(0,0,0,0.78)', 'color:#fff', 'font-size:13px', 'font-weight:700',
        'padding:10px 20px', 'border-radius:24px', 'z-index:9999',
        'pointer-events:none', 'white-space:nowrap',
        'transition:opacity 0.3s'
      ].join(';');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = '한 번 더 누르면 앱이 종료됩니다';
    toastEl.style.opacity = '1';

    setTimeout(() => {
      backPressedOnce = false;
      if (toastEl) toastEl.style.opacity = '0';
    }, 2000);
  });
}
