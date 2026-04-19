/* ============================================================
   firebase-config.js — Firebase 초기화
   Firebase 콘솔(console.firebase.google.com) → 프로젝트 설정 →
   내 앱 → SDK 설정 및 구성에서 아래 값을 복사해서 교체하세요.
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyDJ7JT5inoioAPgUNxj9d09QURGkb7JCjQ",
  authDomain: "graduationwork-6c91c.firebaseapp.com",
  projectId: "graduationwork-6c91c",
  storageBucket: "graduationwork-6c91c.firebasestorage.app",
  messagingSenderId: "329977977689",
  appId: "1:329977977689:web:6144eb342563212a280a48",
  measurementId: "G-9JXEG1L1VX"
};

firebase.initializeApp(firebaseConfig);
const db   = firebase.firestore();
const auth = firebase.auth();

/* 인증 상태 복원 시 sessionStorage에 UID·이메일 동기화 */
auth.onAuthStateChanged(user => {
  if (user) {
    sessionStorage.setItem('_fitUid',   user.uid);
    sessionStorage.setItem('_fitEmail', user.email || '');
  } else {
    sessionStorage.removeItem('_fitUid');
    sessionStorage.removeItem('_fitEmail');
    sessionStorage.removeItem('_fitNick');
  }
});
