/* ============================================================
   sc201_1.js — 로그인 (Firebase Auth)
   의존: common.js, firebase-config.js
   ============================================================ */

'use strict';

const loginForm  = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');

/* Android WebView 감지 (MainActivity의 UA 문자열 기반) */
const isInWebView = /FitAiness\/1\.0/.test(navigator.userAgent);

/* ── 저장된 아이디 복원 + Kakao/Google 리다이렉트 결과 처리 ── */
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('savedLoginId');
  if (saved) {
    const el = document.getElementById('loginId');
    if (el) el.value = saved;
    const cb = document.getElementById('saveId');
    if (cb) cb.checked = true;
  }
  const kakaoCode = new URLSearchParams(window.location.search).get('code');
  if (kakaoCode) handleKakaoCallback(kakaoCode);

});

/* ── 로그인 상태 감지 (세션 복원 + 소셜 신규 유저 처리) ── */
auth.onAuthStateChanged(async user => {
  if (!user) return;
  sessionStorage.setItem('_fitUid',   user.uid);
  localStorage.setItem('_fitUid',     user.uid);
  sessionStorage.setItem('_fitEmail', user.email || '');
  try {
    const doc = await db.collection('users').doc(user.uid).get();
    if (doc.exists) {
      const data = doc.data();
      if (data.nickname) sessionStorage.setItem('_fitNick', data.nickname);
      if (data.userData) localStorage.setItem(`hud_${user.uid}`, JSON.stringify(data.userData));
      if (data.userData?.targetWeight) { location.replace('sc301.html'); return; }
    } else {
      /* 신규 소셜 로그인 유저 — Firestore 문서 생성 */
      const nickname = user.displayName || sessionStorage.getItem('_pendingNick') || '';
      sessionStorage.removeItem('_pendingNick');
      await db.collection('users').doc(user.uid).set({
        email:     user.email || '',
        nickname,
        userData:  {},
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      localStorage.setItem(`hud_${user.uid}`, JSON.stringify({}));
      const d = new Date();
      localStorage.setItem(`reg_${user.uid}`,
        `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
      if (nickname) sessionStorage.setItem('_fitNick', nickname);
    }
    location.replace('sc202.html');
  } catch (e) {
    console.error('[auth] Firestore 오류, sc202로 이동:', e);
    location.replace('sc202.html');
  }
});

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

/* ── 소셜 버튼 바인딩 ── */
document.querySelector('.social-btn.google')?.addEventListener('click', loginWithGoogle);
document.querySelector('.social-btn.kakao')?.addEventListener('click', loginWithKakao);
document.querySelector('.social-btn.naver')?.addEventListener('click', () => {
  alert('네이버 로그인은 준비 중입니다.');
});

/* ── 로그인 제출 ── */
if (loginForm) {
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const inputId  = document.getElementById('loginId').value.trim();
    const password = document.getElementById('loginPw').value;
    const saveIdCb = document.getElementById('saveId');

    if (!inputId || !password) {
      loginError?.classList.add('show');
      return;
    }

    /* 아이디 저장 */
    if (saveIdCb?.checked) {
      localStorage.setItem('savedLoginId', inputId);
    } else {
      localStorage.removeItem('savedLoginId');
    }

    const submitBtn = loginForm.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '로그인 중...'; }

    try {
      const cred = await auth.signInWithEmailAndPassword(inputId, password);
      const uid  = cred.user.uid;

      sessionStorage.setItem('_fitUid',   uid);
      sessionStorage.setItem('_fitEmail', cred.user.email || '');

      /* Firestore에서 사용자 데이터 로드 후 localStorage 캐시 */
      const doc = await db.collection('users').doc(uid).get();
      if (doc.exists) {
        const data = doc.data();
        if (data.nickname) sessionStorage.setItem('_fitNick', data.nickname);
        if (data.userData) localStorage.setItem(`hud_${uid}`, JSON.stringify(data.userData));

        /* 오늘 일별 데이터도 캐시 */
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        const dayDoc = await db.collection('users').doc(uid).collection('daily').doc(todayStr).get();
        if (dayDoc.exists) {
          const dd = dayDoc.data();
          if (dd.check) localStorage.setItem(lsKey('check', todayStr), JSON.stringify(dd.check));
          if (dd.sc311) localStorage.setItem(lsKey('sc311', todayStr), JSON.stringify(dd.sc311));
          if (dd.plan)  localStorage.setItem(lsKey('plan',  todayStr), JSON.stringify(dd.plan));
        }

        const ud = data.userData || {};
        location.href = ud.targetWeight ? 'sc301.html' : 'sc202.html';
      } else {
        location.href = 'sc202.html';
      }
    } catch (err) {
      loginError?.classList.add('show');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '로그인'; }
      console.error('로그인 실패:', err.code);
    }
  });
}
