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















/* ── 페이지 전환 헬퍼 (sc401, hc402, hc403 공통) ── */
function navigateTo(url) {
  document.body.classList.add('page-exit');
  setTimeout(() => { location.href = url; }, 320);
}


/* ════════════════════════════════
   공통 AI상담 오버레이 + 히스토리 달력
   sc301, sc302, sc311, sc602 공통 사용
   DOMContentLoaded에서 initCommonOverlays() 호출
   ════════════════════════════════ */
function initCommonOverlays() {
  if (document.getElementById('menuAiChat')) initAiOverlay();
  /* 히스토리 메뉴: 모달 여부와 무관하게 항상 sc602 오늘날짜로 이동 */
  const histBtn = document.getElementById('menuHistory');
  if (histBtn) {
    histBtn.addEventListener('click', () => {
      const d = new Date();
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      location.href = `sc602.html?date=${dateStr}`;
    });
  }
  /* sc301 전용: 히스토리 달력 모달 (달력 위에서 날짜 선택) */
  if (document.getElementById('histModalOverlay')) initHistModal();
}

/* ════════════════════════════════
   sc501 — AI 상담 오버레이 (sc301 내)
   ════════════════════════════════ */
function initAiOverlay() {
  const menuBtn   = document.getElementById('menuAiChat');
  const overlay   = document.getElementById('aiOverlay');
  const closeBtn  = document.getElementById('aiOverlayClose');
  const sendBtn   = document.getElementById('aiOverlaySend');
  const input     = document.getElementById('aiOverlayInput');
  const messages  = document.getElementById('aiOverlayMessages');

  const AI_RESPONSES = [
    '좋은 질문이에요! 현재 식단 구성은 균형 잡혀 있어요 💪',
    '운동 강도가 걱정되신다면, 처음엔 세트 수를 줄이고 점진적으로 늘려가세요.',
    '식사 간격을 3~4시간으로 유지하면 혈당 조절에 도움이 돼요.',
    '충분한 수분 섭취도 잊지 마세요. 하루 2L 이상을 목표로 해보세요.',
    '단백질 섭취량을 체중 1kg당 1.2~1.6g 수준으로 맞추는 게 좋아요.',
  ];
  let aiIdx = 0;

  menuBtn?.addEventListener('click', () => {
    overlay?.classList.add('show');
  });

  closeBtn?.addEventListener('click', () => {
    overlay?.classList.remove('show');
  });

  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('show');
  });

  function sendMessage() {
    const text = input?.value.trim();
    if (!text) return;
    appendAiMsg('user', text);
    input.value = '';
    input.style.height = 'auto';

    const typing = appendTypingIndicator();
    setTimeout(() => {
      typing.remove();
      appendAiMsg('ai', AI_RESPONSES[aiIdx % AI_RESPONSES.length]);
      aiIdx++;
    }, 1000 + Math.random() * 600);
  }

  sendBtn?.addEventListener('click', sendMessage);
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  input?.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
  });

  function appendAiMsg(role, text) {
    if (!messages) return;
    const now  = new Date();
    const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const div  = document.createElement('div');
    div.className = `chat-msg ${role}`;
    div.innerHTML = `
      <div class="chat-avatar">${role === 'ai' ? '🤖' : '👤'}</div>
      <div>
        <div class="chat-bubble">${text}</div>
        <div class="chat-time">${role === 'ai' ? 'AI 상담사' : '나'} · ${time}</div>
      </div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function appendTypingIndicator() {
    const div = document.createElement('div');
    div.className = 'chat-msg ai';
    div.innerHTML = `
      <div class="chat-avatar">🤖</div>
      <div class="typing-indicator">
        <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
      </div>`;
    messages?.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }
}

/* ════════════════════════════════
   sc601 — 히스토리 달력 모달 (sc301 내)
   ════════════════════════════════ */
let histYear, histMonth;

function initHistModal() {
  const menuBtn  = document.getElementById('menuHistory');
  const overlay  = document.getElementById('histModalOverlay');
  const closeBtn = document.getElementById('histModalClose');
  const prevBtn  = document.getElementById('histPrevMonth');
  const nextBtn  = document.getElementById('histNextMonth');

  const today = new Date();
  histYear  = today.getFullYear();
  histMonth = today.getMonth();

  /* menuHistory 클릭은 initCommonOverlays에서 처리 */

  /* sc301 달력의 달력 카드 타이틀 클릭 시도 sc601 모달 */
  document.querySelector('.calendar-card .card-title')?.addEventListener('click', openHistModal);

  closeBtn?.addEventListener('click', () => overlay?.classList.remove('show'));
  overlay?.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('show'); });

  prevBtn?.addEventListener('click', () => {
    histMonth--;
    if (histMonth < 0) { histMonth = 11; histYear--; }
    buildHistCal();
  });
  nextBtn?.addEventListener('click', () => {
    histMonth++;
    if (histMonth > 11) { histMonth = 0; histYear++; }
    buildHistCal();
  });
}

function openHistModal() {
  const overlay = document.getElementById('histModalOverlay');
  overlay?.classList.add('show');
  buildHistCal();
}

function buildHistCal() {
  const titleEl = document.getElementById('histCalTitle');
  const daysEl  = document.getElementById('histDays');
  if (!titleEl || !daysEl) return;

  titleEl.textContent = `${histYear}년 ${histMonth + 1}월`;
  daysEl.innerHTML = '';

  const firstDay    = new Date(histYear, histMonth, 1).getDay();
  const daysInMonth = new Date(histYear, histMonth + 1, 0).getDate();
  const offset      = firstDay === 0 ? 6 : firstDay - 1;

  for (let i = 0; i < offset; i++) {
    const el = document.createElement('div');
    el.className = 'hist-day empty';
    daysEl.appendChild(el);
  }

  /* 달성 상태 미리 계산 */
  const statusArr = [null];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr  = `${histYear}-${String(histMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    let checks = {};
    try { checks = JSON.parse(localStorage.getItem(`check_${dateStr}`)) || {}; } catch {}
    if (checks.meal && checks.workout) statusArr.push('both');
    else if (checks.meal)              statusArr.push('meal');
    else if (checks.workout)           statusArr.push('workout');
    else                               statusArr.push(null);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr  = `${histYear}-${String(histMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

    const btn = document.createElement('button');
    btn.className = 'hist-day';
    btn.dataset.date = dateStr;

    /* 오늘 표시 */
    const today = new Date();
    if (histYear === today.getFullYear() && histMonth === today.getMonth() && d === today.getDate()) {
      btn.classList.add('today');
    }

    const status = statusArr[d];
    if (status) {
      btn.classList.add(`done-${status}`);

      /* 연속 streak */
      const col = (offset + d - 1) % 7;
      const prev = statusArr[d - 1];
      const next = statusArr[d + 1];
      const samePrev = prev === status && col !== 0;
      const sameNext = next === status && col !== 6;

      if (samePrev && sameNext)  btn.classList.add('streak-mid');
      else if (samePrev)         btn.classList.add('streak-end');
      else if (sameNext)         btn.classList.add('streak-start');
    }

    const icon = status === 'both' ? '🌟' : status === 'meal' ? '🥗' : status === 'workout' ? '💪' : '';
    btn.innerHTML = `<span class="hist-day-num">${d}</span>${icon ? `<span class="hist-day-icon">${icon}</span>` : ''}`;

    btn.addEventListener('click', () => {
      document.getElementById('histModalOverlay')?.classList.remove('show');
      location.href = `sc602.html?date=${dateStr}`;
    });

    daysEl.appendChild(btn);
  }
}

/* ════════════════════════════════
   사이드바 공통 함수
   sc301, sc302, sc311, sc602, sc701에서 공통 사용
   ════════════════════════════════ */

/* 사이드바 프로필/체중 정보 렌더 */
function renderSidebar() {
  const data = Storage.getUser();
  const reg  = Storage.getRegistered();

  const nameEl = document.getElementById('userName');
  const infoEl = document.getElementById('userBasicInfo');
  const cwEl   = document.getElementById('currentWeightText');
  const twEl   = document.getElementById('targetWeightText');

  if (nameEl) nameEl.textContent = reg.nickname ? `${reg.nickname}님` : '사용자';
  if (infoEl) {
    const parts = [];
    if (data.gender) parts.push(data.gender);
    if (data.height) parts.push(`키 ${data.height}cm`);
    infoEl.textContent = parts.join(' · ') || '기본 정보 없음';
  }
  if (cwEl) cwEl.textContent = data.weight      ? `${data.weight}kg`      : '-';
  if (twEl) twEl.textContent = data.targetWeight ? `${data.targetWeight}kg` : '-';
}

/* 로그아웃 버튼 바인딩 */
function bindLogout() {
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('healthUserData');
    location.href = 'sc101.html';
  });
}

/* 로고 클릭 바인딩
   - sc101: 맨 위로 스크롤 (sc101.js에서 별도 처리)
   - 로그인 후 페이지: sc301로 이동 */
function bindLogoClick() {
  document.getElementById('sidebarLogo')?.addEventListener('click', () => {
    location.href = 'sc301.html';
  });
}
