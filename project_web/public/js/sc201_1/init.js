'use strict';

/* ============================================================
   sc201_1/init.js — DOMContentLoaded 초기화
   의존: kakaoLogin.js (handleKakaoCallback)
   ============================================================ */

window.addEventListener('DOMContentLoaded', () => {
  /* 저장된 아이디 복원 */
  const saved = localStorage.getItem('savedLoginId');
  if (saved) {
    const el = document.getElementById('loginId');
    if (el) el.value = saved;
    const cb = document.getElementById('saveId');
    if (cb) cb.checked = true;
  }

  /* Kakao/Google 리다이렉트 결과 처리 */
  const kakaoCode = new URLSearchParams(window.location.search).get('code');
  if (kakaoCode) handleKakaoCallback(kakaoCode);

  /* 소셜 버튼 바인딩 */
  document.querySelector('.social-btn.google')?.addEventListener('click', loginWithGoogle);
  document.querySelector('.social-btn.kakao')?.addEventListener('click', loginWithKakao);
  document.querySelector('.social-btn.naver')?.addEventListener('click', () => {
    alert('네이버 로그인은 준비 중입니다.');
  });
});
