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

/* ============================================================
   아이콘 매핑 (음식 / 운동)
   AI가 생성한 이름을 받아 키워드 매칭으로 이모지 반환.
   백엔드 연동 후 icon 필드를 직접 내려주면 이 함수 대신 사용.
   ============================================================ */

/* ── 음식 키워드 → 아이콘 ── */
const FOOD_ICON_MAP = [
  /* 단백질류 */
  { keys: ['닭가슴살', '닭', '치킨'],          icon: '🍗' },
  { keys: ['연어'],                             icon: '🐟' },
  { keys: ['참치'],                             icon: '🐠' },
  { keys: ['계란', '달걀'],                     icon: '🥚' },
  { keys: ['두부'],                             icon: '🫘' },
  { keys: ['소고기', '스테이크', '육류'],       icon: '🥩' },
  { keys: ['돼지고기', '삼겹살'],               icon: '🥓' },
  { keys: ['새우'],                             icon: '🍤' },

  /* 탄수화물류 */
  { keys: ['현미밥', '밥', '쌀'],              icon: '🍚' },
  { keys: ['빵', '토스트', '바게트'],           icon: '🍞' },
  { keys: ['고구마'],                           icon: '🍠' },
  { keys: ['파스타', '스파게티'],               icon: '🍝' },
  { keys: ['오트밀', '오트'],                   icon: '🥣' },
  { keys: ['면', '국수', '라면'],               icon: '🍜' },

  /* 채소 / 샐러드류 */
  { keys: ['샐러드'],                           icon: '🥗' },
  { keys: ['브로콜리'],                         icon: '🥦' },
  { keys: ['당근'],                             icon: '🥕' },
  { keys: ['오이'],                             icon: '🥒' },
  { keys: ['토마토'],                           icon: '🍅' },
  { keys: ['아보카도'],                         icon: '🥑' },
  { keys: ['채소', '야채', '나물'],             icon: '🥬' },

  /* 과일류 */
  { keys: ['바나나'],                           icon: '🍌' },
  { keys: ['사과'],                             icon: '🍎' },
  { keys: ['딸기'],                             icon: '🍓' },
  { keys: ['블루베리'],                         icon: '🫐' },
  { keys: ['오렌지', '귤'],                     icon: '🍊' },
  { keys: ['포도'],                             icon: '🍇' },
  { keys: ['수박'],                             icon: '🍉' },
  { keys: ['과일'],                             icon: '🍑' },

  /* 유제품 / 단백질 보충 */
  { keys: ['그릭요거트', '요거트'],             icon: '🫙' },
  { keys: ['우유'],                             icon: '🥛' },
  { keys: ['치즈'],                             icon: '🧀' },
  { keys: ['견과류', '아몬드', '호두', '땅콩'], icon: '🥜' },

  /* 국 / 탕류 */
  { keys: ['된장국', '된장찌개', '찌개'],       icon: '🍲' },
  { keys: ['국', '탕', '스프', '수프'],         icon: '🥣' },

  /* 기타 */
  { keys: ['도시락', '도시락'],                 icon: '🍱' },
  { keys: ['스무디', '주스'],                   icon: '🥤' },
  { keys: ['프로틴', '단백질 쉐이크'],          icon: '💪' },
];

/* ── 운동 키워드 → 아이콘 ── */
const WORKOUT_ICON_MAP = [
  /* 유산소 */
  { keys: ['걷기', '워킹'],                     icon: '🚶' },
  { keys: ['달리기', '런닝', '조깅'],           icon: '🏃' },
  { keys: ['자전거', '사이클'],                 icon: '🚴' },
  { keys: ['수영'],                             icon: '🏊' },
  { keys: ['줄넘기'],                           icon: '🪢' },
  { keys: ['등산', '하이킹'],                   icon: '🏔️' },
  { keys: ['인터벌', 'HIIT'],                   icon: '⚡' },

  /* 근력 */
  { keys: ['스쿼트'],                           icon: '🏋️' },
  { keys: ['푸시업', '팔굽혀펴기'],             icon: '💪' },
  { keys: ['풀업', '턱걸이'],                   icon: '🤸' },
  { keys: ['플랭크'],                           icon: '🧱' },
  { keys: ['런지'],                             icon: '🦵' },
  { keys: ['데드리프트', '벤치프레스'],         icon: '🏋️' },
  { keys: ['윗몸일으키기', '크런치'],           icon: '🤜' },
  { keys: ['덤벨', '바벨', '웨이트'],          icon: '🏋️' },

  /* 유연성 / 회복 */
  { keys: ['스트레칭'],                         icon: '🧘' },
  { keys: ['요가'],                             icon: '🧘' },
  { keys: ['필라테스'],                         icon: '🤸' },
  { keys: ['폼롤러', '마사지'],                 icon: '💆' },
];

/**
 * 음식 이름으로 아이콘 반환
 * @param {string} name - 음식 이름
 * @returns {string} 이모지 (없으면 기본값 🍽️)
 */
function getFoodIcon(name) {
  if (!name) return '🍽️';
  const lower = name.toLowerCase();
  for (const entry of FOOD_ICON_MAP) {
    if (entry.keys.some(k => lower.includes(k.toLowerCase()))) {
      return entry.icon;
    }
  }
  return '🍽️';
}

/**
 * 운동 이름으로 아이콘 반환
 * @param {string} name - 운동 이름
 * @returns {string} 이모지 (없으면 기본값 🏃)
 */
function getWorkoutIcon(name) {
  if (!name) return '🏃';
  const lower = name.toLowerCase();
  for (const entry of WORKOUT_ICON_MAP) {
    if (entry.keys.some(k => lower.includes(k.toLowerCase()))) {
      return entry.icon;
    }
  }
  return '🏃';
}
