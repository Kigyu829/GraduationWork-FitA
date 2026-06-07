'use strict';

/* ============================================================
   sc201_1/kakaoLogin.js — Kakao 로그인 (authorize 리다이렉트 방식)
   의존: firebase-config.js
   ============================================================ */

/* ── Kakao 로그인 (authorize 리다이렉트 방식) ── */
function loginWithKakao() {
  try {
    const redirectUri = window.location.href.split('?')[0].split('#')[0];
    sessionStorage.setItem('_kakaoRedirectUri', redirectUri);
    Kakao.Auth.authorize({ redirectUri });
  } catch (e) {
    alert('카카오 로그인 오류: ' + e.message);
    console.error('[Kakao]', e);
  }
}

async function handleKakaoCallback(code) {
  const redirectUri = sessionStorage.getItem('_kakaoRedirectUri')
    || window.location.href.split('?')[0].split('#')[0];
  sessionStorage.removeItem('_kakaoRedirectUri');
  /* URL에서 code 파라미터 제거 */
  window.history.replaceState({}, document.title, window.location.pathname);

  try {
    const res  = await fetch('/auth/kakao', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code, redirectUri }),
    });
    const data = await res.json();
    if (data.error) { alert('카카오 로그인 실패: ' + data.error); return; }

    const fakeEmail    = `kakao_${data.kakaoId}@kakao.fita`;
    const fakePassword = `kakao_${data.kakaoId}`;
    sessionStorage.setItem('_pendingNick', data.nickname);
    try {
      await auth.signInWithEmailAndPassword(fakeEmail, fakePassword);
    } catch (e) {
      if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
        await auth.createUserWithEmailAndPassword(fakeEmail, fakePassword);
      } else {
        alert('카카오 Firebase 오류: ' + e.code);
      }
    }
    /* onAuthStateChanged 가 이후 처리 */
  } catch (err) {
    alert('카카오 오류: ' + err.message);
  }
}
