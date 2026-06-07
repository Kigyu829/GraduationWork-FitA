'use strict';

/* ════════════════════════════════
   sc701/utils.js
   공용 유틸 함수, 토스트
   의존: common.js (Storage, getCurrentUid)
   ════════════════════════════════ */

/* ── DOM 헬퍼 ── */
function setVal(id, value) {
  const el = document.getElementById(id);
  if (el && value !== undefined && value !== null) el.value = value;
}

function setTextSafe(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/* ── 비밀번호 강도 점수 ── */
function getPwStrength(pw) {
  let score = 0;
  if (pw.length >= 8)                        score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw))                         score++;
  if (/[^A-Za-z0-9]/.test(pw))              score++;
  return Math.max(0, score - 1);
}

/* ── 토스트 알림 ── */
let toastTimer = null;
function showToast(msg, type = '') {
  const toast = document.getElementById('toastMsg') || document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className   = `toast show${type ? ' ' + type : ''}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

/* ── 유저 데이터 로드 (Firestore → localStorage 폴백) ── */
async function fetchUser() {
  const uid = getCurrentUid();
  const reg = Storage.getRegistered();
  if (uid && typeof db !== 'undefined') {
    try {
      const doc = await db.collection('users').doc(uid).get();
      if (doc.exists) {
        const data = doc.data().userData || {};
        return { email: reg.email, nickname: reg.nickname, ...data };
      }
    } catch (err) {
      console.warn('Firestore 로드 실패, localStorage 사용:', err.message);
    }
  }
  return buildLocalData();
}

function buildLocalData() {
  const reg  = Storage.getRegistered();
  const data = Storage.getUser();
  return { email: reg.email, nickname: reg.nickname, ...data };
}
