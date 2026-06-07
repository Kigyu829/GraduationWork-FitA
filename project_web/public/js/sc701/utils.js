'use strict';

/* ============================================================
   sc701/utils.js — 공용 유틸, 전역 공유 변수
   ============================================================ */

/* ── 토스트 ── */
let toastTimer = null;
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className   = `toast show${type ? ' ' + type : ''}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

/* ── DOM 헬퍼 ── */
function setVal(id, value) {
  const el = document.getElementById(id);
  if (el && value !== undefined && value !== null) el.value = value;
}
function setTextSafe(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/* ── 서버 유저 데이터 로드 (폴백: localStorage) ── */
async function fetchUser() {
  try {
    const userId = localStorage.getItem('userId');
    const reg    = Storage.getRegistered();
    const url    = userId
      ? `/user/${userId}`
      : `/user/byEmail?email=${encodeURIComponent(reg.email)}`;

    const res  = await fetch(url);
    if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
    const data = await res.json();
    if (data && data.id) localStorage.setItem('userId', data.id);
    return data;
  } catch (err) {
    console.warn('서버 로드 실패, localStorage 사용:', err.message);
    return buildLocalData();
  }
}

function buildLocalData() {
  const reg  = Storage.getRegistered();
  const data = Storage.getUser();
  return { email: reg.email, nickname: reg.nickname, password: reg.password, ...data };
}

async function apiPost(endpoint, body) {
  const userId = localStorage.getItem('userId');
  const reg    = Storage.getRegistered();
  const res    = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ userId, email: reg.email, ...body }),
  });
  if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
  return res.json();
}

/* ── 비밀번호 강도 ── */
function getPwStrength(pw) {
  let score = 0;
  if (pw.length >= 8)                        score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw))                         score++;
  if (/[^A-Za-z0-9]/.test(pw))              score++;
  return Math.max(0, score - 1);
}
