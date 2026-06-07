'use strict';

/* ============================================================
   sc201_1/googleLogin.js — Google 로그인 (팝업 + 네이티브 WebView)
   의존: utils.js (isInWebView), firebase-config.js
   ============================================================ */

/* ── Google 로그인 ── */
async function loginWithGoogle() {
  if (isInWebView) {
    /* Android: 네이티브 Google Sign-In (팝업/리다이렉트 불가) */
    if (window.AndroidBridge) {
      window.AndroidBridge.signInWithGoogle();
    } else {
      alert('구글 로그인을 사용할 수 없습니다.');
    }
    return;
  }
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
    /* onAuthStateChanged 가 이후 처리 */
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
      alert(`구글 로그인 실패: ${err.code}`);
      console.error('[Google]', err.code, err.message);
    }
  }
}

/* ── 네이티브 Google Sign-In 토큰 수신 (Android → WebView) ── */
function handleNativeGoogleToken(idToken) {
  const credential = firebase.auth.GoogleAuthProvider.credential(idToken);
  auth.signInWithCredential(credential).catch(err => {
    alert('구글 로그인 실패: ' + err.code);
    console.error('[Native Google]', err);
  });
  /* onAuthStateChanged 가 이후 처리 */
}
