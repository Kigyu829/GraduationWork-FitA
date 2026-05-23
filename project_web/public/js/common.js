/* ============================================================
   common.js — 전체 공통 유틸리티
   모든 페이지에서 가장 먼저 로드
   ============================================================ */

'use strict';

/* ── Firebase UID 헬퍼 ── */
function getCurrentUid() {
  if (typeof auth !== 'undefined' && auth.currentUser) return auth.currentUser.uid;
  return sessionStorage.getItem('_fitUid') || null;
}

/**
 * UID를 포함한 날짜별 localStorage 키 생성
 * @param {string} prefix - 'check' | 'plan' | 'sc311' | 'water' | 'motivationMsg' | ...
 * @param {string} dateStr - 'YYYY-MM-DD'
 */
function lsKey(prefix, dateStr) {
  const uid = getCurrentUid();
  return uid ? `${prefix}_${uid}_${dateStr}` : `${prefix}_${dateStr}`;
}

/**
 * 날짜별 데이터를 Firestore에 동기화 (비동기, 오류 무시)
 * sc311.js / hc403.js write 이후 호출
 */
function syncDayToFirestore(dateStr) {
  const uid = getCurrentUid();
  if (!uid || typeof db === 'undefined') return;
  const read = key => { try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; } };
  const checkData = read(lsKey('check', dateStr));
  const sc311Data = read(lsKey('sc311', dateStr));
  const planData  = read(lsKey('plan',  dateStr));
  const dayDoc = {};
  if (checkData) dayDoc.check = checkData;
  if (sc311Data) dayDoc.sc311 = sc311Data;
  if (planData)  dayDoc.plan  = planData;
  if (Object.keys(dayDoc).length) {
    db.collection('users').doc(uid).collection('daily').doc(dateStr)
      .set(dayDoc, { merge: true }).catch(console.error);
  }
}

/* ── localStorage / Firestore 헬퍼 ── */
const Storage = {
  _key() {
    const uid = getCurrentUid();
    return uid ? `hud_${uid}` : 'healthUserData';
  },
  getUser() {
    try { return JSON.parse(localStorage.getItem(this._key())) || {}; }
    catch { return {}; }
  },
  setUser(data) {
    localStorage.setItem(this._key(), JSON.stringify(data));
    const uid = getCurrentUid();
    if (uid && typeof db !== 'undefined') {
      db.collection('users').doc(uid).set({ userData: data }, { merge: true }).catch(console.error);
    }
  },
  mergeUser(partial) {
    this.setUser({ ...this.getUser(), ...partial });
  },
  getRegistered() {
    const uid = getCurrentUid();
    if (uid) {
      return {
        email:    sessionStorage.getItem('_fitEmail') || '',
        password: '',
        nickname: sessionStorage.getItem('_fitNick')  || '',
      };
    }
    /* 레거시 fallback (Firebase 미연결 환경) */
    return {
      email:    localStorage.getItem('registeredEmail')    || '',
      password: '',
      nickname: localStorage.getItem('registeredNickname') || '',
    };
  },
  setRegistered(email, _pw, nickname) {
    sessionStorage.setItem('_fitEmail', email);
    sessionStorage.setItem('_fitNick',  nickname);
  },
  clearAll() {
    const uid = getCurrentUid();
    if (uid) localStorage.removeItem(`hud_${uid}`);
    localStorage.removeItem('healthUserData');
    localStorage.removeItem('registeredEmail');
    localStorage.removeItem('registeredNickname');
    localStorage.removeItem('savedEmail');
    sessionStorage.removeItem('_fitUid');
    sessionStorage.removeItem('_fitEmail');
    sessionStorage.removeItem('_fitNick');
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
  if (typeof auth !== 'undefined') auth.signOut().catch(() => {});
  Storage.clearAll();
  location.href = 'sc201_1.html';
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
  if (!getCurrentUid()) {
    location.href = 'sc201_1.html';
    return false;
  }
  return true;
}

/**
 * localStorage가 비어있을 때 Firestore에서 사용자 데이터 복원
 * 로그인 상태인데 캐시 삭제 등으로 localStorage가 날아간 경우 대응
 */
async function restoreUserFromFirestore() {
  const uid = getCurrentUid();
  if (!uid || typeof db === 'undefined') return;
  if (localStorage.getItem(`hud_${uid}`)) return;
  try {
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) return;
    const userData = doc.data().userData;
    if (userData && typeof userData === 'object') {
      localStorage.setItem(`hud_${uid}`, JSON.stringify(userData));
    }
  } catch (err) {
    console.warn('[FitA] Firestore 사용자 데이터 복원 실패:', err.message);
  }
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

  const chatKey = `aiChat_${getCurrentUid() || 'guest'}`;
  let chatHistory = [];
  try { chatHistory = JSON.parse(localStorage.getItem(chatKey)) || []; } catch { chatHistory = []; }

  let isSending = false;

  menuBtn?.addEventListener('click', () => { overlay?.classList.add('show'); });
  closeBtn?.addEventListener('click', () => { overlay?.classList.remove('show'); });
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('show');
  });

  /* ── Socket.io 연결 (lazy) ── */
  let _socket = null;
  function getSocket() {
    if (!_socket && typeof io !== 'undefined') {
      _socket = io({ transports: ['websocket', 'polling'] });
    }
    return _socket;
  }

  /* ── 스트리밍 버블 생성 ── */
  function createStreamBubble() {
    if (!messages) return null;
    const now  = new Date();
    const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const div  = document.createElement('div');
    div.className = 'chat-msg ai';
    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.textContent = '🤖';
    const inner = document.createElement('div');
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    const timeEl = document.createElement('div');
    timeEl.className = 'chat-time';
    timeEl.textContent = `AI 상담사 · ${time}`;
    inner.appendChild(bubble);
    inner.appendChild(timeEl);
    div.appendChild(avatar);
    div.appendChild(inner);
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  async function sendMessage() {
    const text = input?.value.trim();
    if (!text || isSending) return;
    isSending = true;

    appendAiMsg('user', text);
    input.value = '';
    if (input) input.style.height = 'auto';
    if (sendBtn) sendBtn.disabled = true;

    const userData = Storage.getUser();
    const userInfoStr = [
      userData.gender       ? `성별 ${userData.gender}`         : '',
      userData.height       ? `키 ${userData.height}cm`         : '',
      userData.weight       ? `체중 ${userData.weight}kg`       : '',
      userData.targetWeight ? `목표 ${userData.targetWeight}kg` : '',
      userData.goalWeeks    ? `기간 ${userData.goalWeeks}주`    : '',
    ].filter(Boolean).join(', ');

    const recentHistory = chatHistory.slice(-6)
      .map(h => `${h.role === 'user' ? '사용자' : 'AI'}: ${h.text}`)
      .join('\n');

    const socket = getSocket();

    /* ── Socket.io 스트리밍 경로 ── */
    if (socket) {
      const streamDiv = createStreamBubble();
      const bubble    = streamDiv?.querySelector('.chat-bubble');

      function onToken(token) {
        if (bubble) bubble.textContent += token;
        if (messages) messages.scrollTop = messages.scrollHeight;
      }
      function cleanup() {
        socket.off('chat_token', onToken);
        socket.off('chat_done',  onDone);
        socket.off('chat_error', onError);
      }
      function onDone({ reply, action, reason }) {
        cleanup();
        const finalReply = reply || bubble?.textContent || '응답을 받지 못했어요.';
        if (bubble) bubble.textContent = finalReply;
        const now = new Date();
        const t   = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        chatHistory.push({ role: 'ai', text: finalReply, time: t });
        if (chatHistory.length > 30) chatHistory.splice(0, chatHistory.length - 30);
        try { localStorage.setItem(chatKey, JSON.stringify(chatHistory)); } catch {}
        isSending = false;
        if (sendBtn) sendBtn.disabled = false;
        if (action === 'meal_adjust' && reason)          _commonAdjustPlan('meal', reason);
        else if (action === 'exercise_adjust' && reason) _commonAdjustPlan('exercise', reason);
      }
      function onError(errMsg) {
        cleanup();
        if (bubble) bubble.textContent = errMsg || '오류가 발생했어요. 다시 시도해주세요. 😔';
        isSending = false;
        if (sendBtn) sendBtn.disabled = false;
      }

      cleanup();
      socket.on('chat_token', onToken);
      socket.on('chat_done',  onDone);
      socket.on('chat_error', onError);

      socket.emit('chat_message', {
        message:     text,
        userInfo:    userInfoStr,
        mealPlan:    userData.aiMealPlan    || null,
        workoutPlan: userData.aiWorkoutPlan || null,
        recentHistory,
      });
      return;
    }

    /* ── HTTP 폴백 ── */
    const typing = appendTypingIndicator();
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:     text,
          userInfo:    userInfoStr,
          mealPlan:    userData.aiMealPlan    || null,
          workoutPlan: userData.aiWorkoutPlan || null,
          recentHistory,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      typing.remove();
      const data = await res.json();
      appendAiMsg('ai', data.reply || '응답을 받지 못했어요.');
      if (data.action === 'meal_adjust' && data.reason)          _commonAdjustPlan('meal', data.reason);
      else if (data.action === 'exercise_adjust' && data.reason) _commonAdjustPlan('exercise', data.reason);
    } catch (err) {
      clearTimeout(timeoutId);
      typing.remove();
      appendAiMsg('ai', err.name === 'AbortError'
        ? '응답 시간이 초과됐어요. 잠시 후 다시 시도해주세요. ⏱️'
        : '일시적인 오류가 발생했어요. AI 서버가 실행 중인지 확인해주세요. 😔');
    } finally {
      isSending = false;
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  sendBtn?.addEventListener('click', sendMessage);
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  input?.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
  });

  function renderMsg(role, text, time) {
    if (!messages) return;
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.textContent = role === 'ai' ? '🤖' : '👤';
    const inner = document.createElement('div');
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = text;
    const timeEl = document.createElement('div');
    timeEl.className = 'chat-time';
    timeEl.textContent = `${role === 'ai' ? 'AI 상담사' : '나'} · ${time}`;
    inner.appendChild(bubble);
    inner.appendChild(timeEl);
    div.appendChild(avatar);
    div.appendChild(inner);
    messages.appendChild(div);
  }

  function appendAiMsg(role, text) {
    const now  = new Date();
    const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    renderMsg(role, text, time);
    if (messages) messages.scrollTop = messages.scrollHeight;
    chatHistory.push({ role, text, time });
    if (chatHistory.length > 30) chatHistory.splice(0, chatHistory.length - 30);
    try { localStorage.setItem(chatKey, JSON.stringify(chatHistory)); } catch {}
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
    if (messages) messages.scrollTop = messages.scrollHeight;
    return div;
  }

  /* 저장된 히스토리 복원 */
  if (chatHistory.length > 0) {
    chatHistory.forEach(msg => renderMsg(msg.role, msg.text, msg.time));
    if (messages) messages.scrollTop = messages.scrollHeight;
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

/* Firestore에서 해당 월의 check 데이터를 가져와 localStorage에 캐시 */
async function loadMonthChecksFromFirestore(year, month) {
  const uid = getCurrentUid();
  if (!uid || typeof db === 'undefined') return;

  const mm        = String(month + 1).padStart(2, '0');
  const startDate = `${year}-${mm}-01`;
  const endDate   = `${year}-${mm}-31`;

  try {
    const snap = await db.collection('users').doc(uid).collection('daily')
      .where(firebase.firestore.FieldPath.documentId(), '>=', startDate)
      .where(firebase.firestore.FieldPath.documentId(), '<=', endDate)
      .get();

    snap.forEach(doc => {
      const data  = doc.data();
      const dateStr = doc.id;
      if (data.check) {
        localStorage.setItem(lsKey('check', dateStr), JSON.stringify(data.check));
      }
    });
  } catch (e) {
    console.warn('[buildHistCal] Firestore 로드 실패:', e.message);
  }
}

async function buildHistCal() {
  const titleEl = document.getElementById('histCalTitle');
  const daysEl  = document.getElementById('histDays');
  if (!titleEl || !daysEl) return;

  titleEl.textContent = `${histYear}년 ${histMonth + 1}월`;
  daysEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;opacity:.4;font-size:12px">불러오는 중...</div>';

  /* Firestore에서 해당 월 check 데이터 로드 → localStorage 캐시 */
  await loadMonthChecksFromFirestore(histYear, histMonth);

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
    try { checks = JSON.parse(localStorage.getItem(lsKey('check', dateStr))) || {}; } catch {}
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

  initMobileSidebar();

  /* 프로필 사진 반영 (localStorage 캐시 → Firestore URL 순) */
  const _uid = getCurrentUid();
  const savedAvatar = localStorage.getItem(_uid ? `profileAvatar_${_uid}` : 'profileAvatar') || Storage.getUser().avatarUrl || null;
  const avatarHtml = savedAvatar
    ? `<img src="${savedAvatar}" alt="프로필" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />`
    : '👤';
  const avatarEl2 = document.getElementById('profileAvatar');
  if (avatarEl2) avatarEl2.innerHTML = avatarHtml;
  const sidebarAvatarEl2 = document.getElementById('sidebarAvatar');
  if (sidebarAvatarEl2) sidebarAvatarEl2.innerHTML = avatarHtml;
}

/* ── 모바일 사이드바 햄버거 메뉴 초기화 ── */
function initMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar || document.getElementById('sidebarToggleBtn')) return;

  /* 햄버거 버튼 생성 */
  const btn = document.createElement('button');
  btn.id = 'sidebarToggleBtn';
  btn.className = 'sidebar-toggle-btn';
  btn.setAttribute('aria-label', '메뉴 열기');
  btn.textContent = '☰';
  document.body.appendChild(btn);

  /* 어두운 배경 막 생성 */
  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  backdrop.id = 'sidebarBackdrop';
  document.body.appendChild(backdrop);

  const open  = () => { sidebar.classList.add('sidebar-open');    backdrop.classList.add('show'); };
  const close = () => { sidebar.classList.remove('sidebar-open'); backdrop.classList.remove('show'); };

  btn.addEventListener('click', () => {
    sidebar.classList.contains('sidebar-open') ? close() : open();
  });

  /* 막 클릭 시 닫기 */
  backdrop.addEventListener('click', close);

  /* 메뉴 항목 클릭 시 닫기 (페이지 이동 전 자연스럽게) */
  sidebar.addEventListener('click', e => {
    if (e.target.closest('.menu-btn') || e.target.closest('#logoutBtn') || e.target.closest('#sidebarLogo')) {
      setTimeout(close, 120);
    }
  });
}

/* 로그아웃 버튼 바인딩 */
function bindLogout() {
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (typeof auth !== 'undefined') auth.signOut().catch(() => {});
    Storage.clearAll();
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

/* ════════════════════════════════
   Mifflin-St Jeor 기반 목표 칼로리 계산
   sc302, sc311 공통 사용
   ════════════════════════════════ */
function calcTargetCalories(userData) {
  const weight       = Number(userData.weight);
  const height       = Number(userData.height);
  const targetWeight = Number(userData.targetWeight);
  const goalWeeks    = Number(userData.goalWeeks) || 8;
  const gender       = userData.gender;
  const birth        = userData.birth || '';
  const age          = birth ? new Date().getFullYear() - Number(birth.slice(0, 4)) : 25;

  const bmr = gender === '남성'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  const actMap = { '낮음': 1.2, '보통': 1.375, '높음': 1.55, '매우높음': 1.725, '선수': 1.9 };
  const tdee   = Math.round(bmr * (actMap[userData.activityLevel] || 1.375));

  const weightToLose = Math.max(0, weight - targetWeight);
  const dailyDeficit = Math.min(Math.round((weightToLose * 7700) / (goalWeeks * 7)), 1000);
  return Math.max(1200, tdee - dailyDeficit);
}

/* ════════════════════════════════
   공통 커스텀 Confirm 모달
   사용법:
     showCustomConfirm({
       icon: '⚠️',
       title: '제목',
       desc: 'HTML 문자열',
       okText: '확인',       // 기본 '확인'
       cancelText: '취소',   // 기본 '취소'
       danger: false,        // true면 확인버튼 빨간색
       onOk: () => {},
       onCancel: () => {}
     });
   ════════════════════════════════ */
function showCustomConfirm({ icon='⚠️', title='', desc='', okText='확인', cancelText='취소', danger=false, onOk=null, onCancel=null } = {}) {
  document.getElementById('_customConfirmOverlay')?.remove();

  const C = {
    bg:      '#172530',
    border:  '#243840',
    teal:    '#66D0BC',
    red:     '#FF0B55',
    textSec: '#8faebb',
    text:    '#ffffff',
  };

  const overlay = document.createElement('div');
  overlay.id = '_customConfirmOverlay';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:10500',
    'display:flex', 'align-items:center', 'justify-content:center', 'padding:24px',
    'background:rgba(0,0,0,0.65)', 'backdrop-filter:blur(6px)',
    'opacity:0', 'pointer-events:none', 'transition:opacity 0.22s ease',
  ].join(';');

  const box = document.createElement('div');
  box.style.cssText = [
    `background:${C.bg}`, `border:1px solid ${C.border}`, 'border-radius:24px',
    'padding:36px 32px 28px', 'width:100%', 'max-width:360px',
    'display:flex', 'flex-direction:column', 'align-items:center',
    'gap:14px', 'text-align:center',
    'box-shadow:0 32px 80px rgba(0,0,0,0.6)',
    'transform:scale(0.88) translateY(16px)',
    'transition:transform 0.28s cubic-bezier(0.22,1,0.36,1)',
    'font-family:Nanum Gothic,sans-serif',
  ].join(';');

  const iconEl = document.createElement('div');
  iconEl.style.cssText = 'font-size:52px;line-height:1;';
  iconEl.textContent = icon;

  const titleEl = document.createElement('div');
  titleEl.style.cssText = `font-size:18px;font-weight:800;color:${C.text};letter-spacing:-0.02em;`;
  titleEl.textContent = title;

  const descEl = document.createElement('div');
  descEl.style.cssText = `font-size:13px;color:${C.textSec};line-height:1.7;word-break:keep-all;`;
  descEl.innerHTML = desc || '';

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:10px;width:100%;margin-top:6px;';

  let cancelBtn = null;
  if (cancelText) {
    cancelBtn = document.createElement('button');
    cancelBtn.id = '_ccCancel';
    cancelBtn.textContent = cancelText;
    cancelBtn.style.cssText = [
      'flex:1', 'padding:12px', `border:1px solid ${C.border}`, 'border-radius:12px',
      'background:transparent', `color:${C.textSec}`,
      'font-size:13px', 'font-family:inherit', 'font-weight:700',
      'cursor:pointer', 'transition:background 0.15s',
    ].join(';');
    cancelBtn.addEventListener('mouseenter', () => { cancelBtn.style.background = 'rgba(255,255,255,0.05)'; });
    cancelBtn.addEventListener('mouseleave', () => { cancelBtn.style.background = 'transparent'; });
    actions.appendChild(cancelBtn);
  }

  const okBtn = document.createElement('button');
  okBtn.id = '_ccOk';
  okBtn.textContent = okText;
  okBtn.style.cssText = [
    'flex:1', 'padding:12px', 'border:none', 'border-radius:12px',
    `background:${danger ? C.red : C.teal}`,
    `color:${danger ? '#fff' : '#09131a'}`,
    'font-size:13px', 'font-family:inherit', 'font-weight:800',
    'cursor:pointer', 'transition:opacity 0.15s',
  ].join(';');
  okBtn.addEventListener('mouseenter', () => { okBtn.style.opacity = '0.88'; });
  okBtn.addEventListener('mouseleave', () => { okBtn.style.opacity = '1'; });
  actions.appendChild(okBtn);

  box.appendChild(iconEl);
  box.appendChild(titleEl);
  if (desc) box.appendChild(descEl);
  box.appendChild(actions);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'auto';
    box.style.transform = 'scale(1) translateY(0)';
  }));

  function close() {
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    box.style.transform = 'scale(0.88) translateY(16px)';
    setTimeout(() => overlay.remove(), 260);
  }

  okBtn.addEventListener('click', () => { close(); if (onOk) onOk(); });
  if (cancelBtn) cancelBtn.addEventListener('click', () => { close(); if (onCancel) onCancel(); });
  overlay.addEventListener('click', e => { if (e.target === overlay) { close(); if (onCancel) onCancel(); } });
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') { close(); if (onCancel) onCancel(); document.removeEventListener('keydown', escHandler); }
    if (e.key === 'Enter')  { close(); if (onOk) onOk();     document.removeEventListener('keydown', escHandler); }
  });
}
