/* ============================================================
   common.js — 전체 공통 유틸리티
   모든 페이지에서 가장 먼저 로드
   ============================================================ */

'use strict';

/* ── localStorage 헬퍼 ── */
const Storage = {
  getUser() {
    try { return JSON.parse(localStorage.getItem('healthUserData')) || {}; }
    catch { return {}; }
  },
  setUser(data) {
    localStorage.setItem('healthUserData', JSON.stringify(data));
  },
  mergeUser(partial) {
    this.setUser({ ...this.getUser(), ...partial });
  },
  getRegistered() {
    return {
      email:    localStorage.getItem('registeredEmail')    || '',
      password: localStorage.getItem('registeredPw')       || '',
      nickname: localStorage.getItem('registeredNickname') || '',
    };
  },
  setRegistered(email, password, nickname) {
    localStorage.setItem('registeredEmail',    email);
    localStorage.setItem('registeredPw',       password);
    localStorage.setItem('registeredNickname', nickname);
  },
  clearAll() {
    localStorage.removeItem('healthUserData');
    localStorage.removeItem('registeredEmail');
    localStorage.removeItem('registeredPw');
    localStorage.removeItem('registeredNickname');
    localStorage.removeItem('savedEmail');
  },
};

/* ── BMI 계산 ── */
function calculateBMI(heightCm, weightKg) {
  const h = Number(heightCm) / 100;
  const w = Number(weightKg);
  if (!h || !w || h <= 0) return null;
  return parseFloat((w / (h * h)).toFixed(1));
}

/* ── BMI 상태 판정 ── */
function getBMIStatus(bmi) {
  const v = Number(bmi);
  if (v < 18.5) return { label: '저체중', color: 'var(--teal)' };
  if (v < 23)   return { label: '정상',   color: 'var(--teal)' };
  if (v < 25)   return { label: '과체중', color: 'var(--red)'  };
  return               { label: '비만',   color: 'var(--red)'  };
}

/* ── 날짜 포맷 ── */
function formatDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${y}년 ${m}월 ${d}일 (${days[date.getDay()]})`;
}

/* ── 로그아웃 공통 처리 ── */
function handleLogout() {
  localStorage.removeItem('healthUserData');
  location.href = '../html/sc201_1.html';
}

/* ── 메뉴 버튼 네비게이션 공통 바인딩 ── */
function bindMenuBtns() {
  document.querySelectorAll('.menu-btn[data-href]').forEach(btn => {
    btn.addEventListener('click', function () {
      location.href = this.dataset.href;
    });
  });
}

/* ── 로그인 여부 확인 → 미로그인 시 로그인 페이지로 ── */
function requireLogin() {
  const reg = Storage.getRegistered();
  if (!reg.email) {
    location.href = '../html/sc201_1.html';
    return false;
  }
  return true;
}
