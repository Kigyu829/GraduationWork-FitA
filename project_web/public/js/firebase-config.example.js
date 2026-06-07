/* ============================================================
   firebase-config.js — Firebase 초기화

   사용법:
   1. Firebase Console(console.firebase.google.com) → 프로젝트 설정 →
      내 앱 → SDK 설정 및 구성에서 아래 값 복사
   2. 이 파일을 firebase-config.js 로 복사 후 값 입력
   ============================================================ */

const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID",
  measurementId:     "YOUR_MEASUREMENT_ID",
};

firebase.initializeApp(firebaseConfig);
const db      = firebase.firestore();
const auth    = firebase.auth();
const storage = firebase.storage();

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
