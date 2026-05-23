/* ============================================================
   sc301.js — 메인 대시보드
   의존: common.js

   [처리 항목]
   - 헤더 날짜 / 사이드바 프로필
   - 진행률 도넛 (conic-gradient 방식 - 친구 CSS 맞춤)
   - 오늘 목표 체크 (식단/운동) → 달성도 반영
   - BMI 게이지 바늘 / BMR / TDEE 계산
   - 물 섭취 트래커 (8잔)
   - 연속 기록 스트릭
   - 달력 + 일정 팝업
   - 로고/로그아웃 → sc101
   - 메뉴 버튼 네비게이션
   ============================================================ */

'use strict';

/* ── 오늘 날짜 문자열 (YYYY-MM-DD) ── */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/* ── 오늘 체중 미입력이면 sc300으로 이동 ── */
async function redirectIfNoTodayWeight() {
  const data = Storage.getUser();
  if (!data.weight || !data.height || !data.targetWeight) return false;
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const todayKey = `todayWeight_${lsKey('check', dateStr)}`;
  if (localStorage.getItem(todayKey)) return false;

  /* localStorage에 없으면 Firestore에서 확인 (새 기기 로그인 대응) */
  const uid = getCurrentUid();
  if (uid && typeof db !== 'undefined') {
    try {
      const doc = await db.collection('users').doc(uid).collection('daily').doc(dateStr).get();
      if (doc.exists && doc.data().weight != null) {
        localStorage.setItem(todayKey, String(doc.data().weight));
        Storage.mergeUser({ weight: String(doc.data().weight) });
        return false;
      }
    } catch (e) {
      console.warn('[sc301] 오늘 체중 Firestore 조회 실패:', e.message);
    }
  }

  location.replace('sc300.html');
  return true;
}

/* ── 프로필이 있고 오늘 플랜이 없으면 sc302로 자동 이동 ── */
function autoRedirectIfNoPlan() {
  const data = Storage.getUser();
  const hasPlan    = data.planDate === todayStr() && !!(data.aiMealPlan && data.aiWorkoutPlan);
  const hasProfile = !!(data.weight && data.height && data.targetWeight);
  if (!hasPlan && hasProfile) {
    location.replace('sc302.html');
    return true;
  }
  return false;
}

window.addEventListener('DOMContentLoaded', async () => {
  await restoreUserFromFirestore();  /* localStorage 비어있으면 Firestore에서 복원 */

  if (autoRedirectIfNoPlan()) return;           /* 플랜 없으면 sc302로 이동 */
  if (await redirectIfNoTodayWeight()) return;  /* 오늘 체중 미입력이면 sc300으로 이동 */

  renderHeader();
  renderSidebar();
  renderProgress();
  renderBMIGauge();
  renderAiPlan();
  renderTodayCheck();
  renderCalendar();
  bindMenuBtns();     /* common.js */
  bindLogout();
  bindLogoClick();
  initCommonOverlays();  /* common.js — AI상담 오버레이 + 히스토리 sc602 이동 */
  initMobileSidebar();   /* common.js — 모바일 햄버거 메뉴 */
  initBackExit();        /* 안드로이드 뒤로가기 → 앱 종료 */
  renderStreak();        /* 연속 기록 스트릭 카드 */
  renderStreakBanner();  /* 연속 달성 배너 */
});

/* ════════════════════════════════
   0. 안드로이드 뒤로가기 종료
   ════════════════════════════════ */
function initBackExit() {
  /* PWA standalone 환경에서만 동작 */
  if (!window.matchMedia('(display-mode: standalone)').matches) return;

  /* 현재 히스토리 스택 맨 위에 더미 상태를 추가
     → 뒤로가기 시 이전 페이지(로그인)로 가지 않고 popstate 이벤트만 발생 */
  history.pushState({ backExit: true }, '', location.href);

  let backPressedOnce = false;
  let toastEl = null;

  window.addEventListener('popstate', () => {
    /* 다시 더미 상태를 쌓아서 다음 뒤로가기에도 같은 로직 반복 */
    history.pushState({ backExit: true }, '', location.href);

    if (backPressedOnce) {
      /* 2번째 뒤로가기 → 앱 종료 */
      window.close();
      /* window.close()가 막히는 경우 대비 (일부 브라우저) */
      document.documentElement.style.transition = 'opacity 0.3s';
      document.documentElement.style.opacity = '0';
      setTimeout(() => window.close(), 350);
      return;
    }

    backPressedOnce = true;

    /* 토스트 메시지 표시 */
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.style.cssText = [
        'position:fixed', 'bottom:60px', 'left:50%', 'transform:translateX(-50%)',
        'background:rgba(0,0,0,0.78)', 'color:#fff', 'font-size:13px', 'font-weight:700',
        'padding:10px 20px', 'border-radius:24px', 'z-index:9999',
        'pointer-events:none', 'white-space:nowrap',
        'transition:opacity 0.3s'
      ].join(';');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = '한 번 더 누르면 앱이 종료됩니다';
    toastEl.style.opacity = '1';

    setTimeout(() => {
      backPressedOnce = false;
      if (toastEl) toastEl.style.opacity = '0';
    }, 2000);
  });
}

/* ════════════════════════════════
   1. 헤더 날짜
   ════════════════════════════════ */
function renderHeader() {
  const el = document.getElementById('headerDate');
  if (el) el.textContent = formatDate();   /* common.js */
}

/* ════════════════════════════════
   3. 진행률 (conic-gradient 방식 — 친구 CSS 호환)
   오늘 체크 보너스 반영
   ════════════════════════════════ */
function renderProgress() {
  const data = Storage.getUser();

  const initialWeight = Number(data.initialWeight || data.weight || 0);
  const targetWeight  = Number(data.targetWeight  || 0);
  const currentWeight = Number(data.weight        || 0);

  let pct = 0;
  if (initialWeight > targetWeight && initialWeight > 0) {
    const total    = initialWeight - targetWeight;
    const achieved = initialWeight - currentWeight;
    pct = Math.min(100, Math.max(0, Math.round((achieved / total) * 100)));
  }

  /* 오늘 체크 보너스 */
  const checks     = getTodayChecks(getTodayKey());
  const bonus      = (checks.meal && checks.workout) ? 2 : (checks.meal || checks.workout) ? 1 : 0;
  const displayPct = Math.min(100, pct + bonus);

  const rawRemaining = currentWeight - targetWeight;
  const remaining    = Math.max(0, rawRemaining);

  /* 목표 달성 축하 팝업 (처음 달성 시 1회만) */
  if (currentWeight > 0 && targetWeight > 0 && rawRemaining <= 0) {
    const celebKey = `celebrated_${data.targetWeight}kg`;
    if (!localStorage.getItem(celebKey)) {
      localStorage.setItem(celebKey, '1');
      setTimeout(showGoalAchievedPopup, 600);
    }
  }

  /* DOM 업데이트 */
  setText('progress',               `${displayPct}%`);
  setText('progressBadge',          `${displayPct}%`);
  setText('currentWeight',          currentWeight ? `${currentWeight}kg` : '-');
  setText('targetWeight',           targetWeight  ? `${targetWeight}kg`  : '-');
  setText('remainingWeight',        targetWeight  ? `${remaining.toFixed(1)}kg` : '-');
  setText('goalPeriodText',         data.goalPeriod || '-');
  setText('currentWeightTextMirror', currentWeight ? `${currentWeight}kg` : '-');

  /* conic-gradient 도넛 — 친구 CSS 방식 */
  const ring = document.getElementById('progressRing');
  if (ring) {
    const deg   = Math.round(displayPct * 3.6);
    const color = displayPct >= 50 ? 'var(--teal)' : 'var(--red)';
    ring.style.background =
      `conic-gradient(${color} ${deg}deg, rgba(255,255,255,0.08) ${deg}deg)`;
  }

  /* SVG stroke-dashoffset 방식 — 모바일 웹앱 */
  const svgRing = document.getElementById('goalRingFill');
  if (svgRing) {
    const circumference = 251.2;
    svgRing.style.strokeDashoffset = circumference * (1 - displayPct / 100);
    svgRing.style.stroke = displayPct >= 50 ? 'var(--teal)' : 'var(--red,#FF3B3B)';
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ════════════════════════════════
   4. BMI 게이지 + BMR / TDEE
   ════════════════════════════════ */
function renderBMIGauge() {
  const data = Storage.getUser();
  const bmi  = Number(data.bmi);

  if (!bmi) return;

  /* 바늘 각도: BMI 10~35 범위를 -90°~90°로 매핑 */
  const minBMI = 10, maxBMI = 35;
  const clamped = Math.min(Math.max(bmi, minBMI), maxBMI);
  const angle   = ((clamped - minBMI) / (maxBMI - minBMI)) * 180 - 90;

  const needle = document.getElementById('bmiNeedle');
  if (needle) needle.style.transform = `translateX(-50%) rotate(${angle}deg)`;

  setText('bmiDisplay', bmi.toFixed(1));

  /* 상태 뱃지 */
  const status = getBMIStatus(bmi);   /* common.js */
  setText('bmiStatusBadge', status.label);

  /* BMR (Mifflin-St Jeor) */
  const weight = Number(data.weight);
  const height = Number(data.height);
  const birth  = data.birth;
  const gender = data.gender;

  if (weight && height && birth && gender) {
    const age = new Date().getFullYear() - Number(birth.slice(0, 4));
    let bmr = gender === '남성'
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;

    const actMap = { '낮음': 1.2, '보통': 1.375, '높음': 1.55, '매우높음': 1.725, '선수': 1.9 };
    const factor = actMap[data.activityLevel] || 1.375;
    const tdee   = Math.round(bmr * factor);
    bmr          = Math.round(bmr);

    setText('bmrValue',  `${bmr} kcal`);
    setText('tdeeValue', `${tdee} kcal`);
  }
}

/* ════════════════════════════════
   5. AI 플랜 대시보드 카드 렌더링
   ════════════════════════════════ */
function renderAiPlan() {
  const data        = Storage.getUser();
  const mealPlan    = data.aiMealPlan;
  const workoutPlan = data.aiWorkoutPlan;

  const mealEl    = document.getElementById('mealContent');
  const workoutEl = document.getElementById('workoutContent');

  if (mealEl) {
    if (mealPlan) {
      const MEAL_META = [
        { key: 'breakfast', emoji: '🌅', label: '아침' },
        { key: 'lunch',     emoji: '☀️', label: '점심' },
        { key: 'dinner',    emoji: '🌙', label: '저녁' },
      ];
      const rows = MEAL_META.map(({ key, emoji, label }, i) => {
        const meal = mealPlan[key];
        if (!meal) return '';
        const menuArr  = Array.isArray(meal.menu) ? meal.menu : [meal.menu || ''];
        const menuText = menuArr.join(' · ');
        const border   = i < 2 ? 'border-bottom:1px solid rgba(255,255,255,0.07);' : '';
        return `
          <div style="${border}padding:10px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div style="flex:1;min-width:0;">
              <div style="font-size:11px;color:var(--text-sec);margin-bottom:4px;">${emoji} ${label}</div>
              <div style="font-size:14px;font-weight:500;line-height:1.4;word-break:keep-all;">${menuText}</div>
            </div>
            <span style="font-size:12px;color:var(--teal,#66D0BC);white-space:nowrap;flex-shrink:0;margin-top:18px;">${meal.calories}kcal</span>
          </div>`;
      }).join('');
      const totalKcal    = ['breakfast','lunch','dinner'].reduce((s, k) => s + (mealPlan[k]?.calories || 0), 0);
      const totalProtein = ['breakfast','lunch','dinner'].reduce((s, k) => s + (mealPlan[k]?.protein || 0), 0);
      const totalCarbs   = ['breakfast','lunch','dinner'].reduce((s, k) => s + (mealPlan[k]?.carbs   || 0), 0);
      const totalFat     = ['breakfast','lunch','dinner'].reduce((s, k) => s + (mealPlan[k]?.fat     || 0), 0);

      const macroRow = (totalProtein || totalCarbs || totalFat) ? `
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.07);display:flex;gap:0;justify-content:space-around;text-align:center;">
          <div><div style="font-size:10px;color:var(--text-mute);margin-bottom:2px;">탄수화물</div><div style="font-size:13px;font-weight:700;color:var(--text);">${totalCarbs}g</div></div>
          <div><div style="font-size:10px;color:var(--text-mute);margin-bottom:2px;">단백질</div><div style="font-size:13px;font-weight:700;color:var(--teal,#66D0BC);">${totalProtein}g</div></div>
          <div><div style="font-size:10px;color:var(--text-mute);margin-bottom:2px;">지방</div><div style="font-size:13px;font-weight:700;color:var(--text);">${totalFat}g</div></div>
        </div>` : '';

      mealEl.className = '';
      mealEl.innerHTML = rows + macroRow;

      setText('targetCaloriesValue', `${totalKcal} kcal`);
    } else {
      mealEl.className = '';
      mealEl.innerHTML = '<a href="sc302.html" style="display:block;text-align:center;color:var(--teal,#66D0BC);padding:8px;font-size:13px;">✨ AI 식단 추천 받기 →</a>';
    }
  }

  if (workoutEl) {
    if (workoutPlan) {
      /* 준비운동 1개 + 메인 전체 + 마무리 1개 */
      const sections = [];
      (workoutPlan.warmup   || []).slice(0, 1).forEach(w => sections.push({ ...w, tag: '준비',  tagColor: 'var(--text-sec)' }));
      (workoutPlan.main     || []).forEach(w =>            sections.push({ ...w, tag: '메인',  tagColor: 'var(--teal,#66D0BC)' }));
      (workoutPlan.cooldown || []).slice(0, 1).forEach(w => sections.push({ ...w, tag: '마무리', tagColor: 'var(--text-sec)' }));

      const rows = sections.map((item, i) => {
        const detail = item.sets ? `${item.reps}회 × ${item.sets}세트` : (item.duration || '');
        const border  = i < sections.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.07);' : '';
        return `
          <div style="${border}display:flex;align-items:center;gap:10px;padding:8px 0;">
            <span style="font-size:18px;flex-shrink:0;">${getWorkoutIcon(item.name)}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.name}</div>
              <div style="font-size:11px;color:var(--text-sec);margin-top:2px;">${detail}</div>
            </div>
            <span style="font-size:10px;color:${item.tagColor};border:1px solid ${item.tagColor};border-radius:4px;padding:1px 6px;white-space:nowrap;flex-shrink:0;">${item.tag}</span>
          </div>`;
      }).join('');
      workoutEl.className = '';
      workoutEl.innerHTML = rows || '<div style="color:var(--text-mute)">운동 정보 없음</div>';
    } else {
      workoutEl.className = '';
      workoutEl.innerHTML = '<a href="sc302.html" style="display:block;text-align:center;color:var(--teal,#66D0BC);padding:8px;font-size:13px;">✨ AI 운동 플랜 받기 →</a>';
    }
  }
}

/* ════════════════════════════════
   6. 오늘 목표 체크
   ════════════════════════════════ */
function getTodayKey() {
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return lsKey('check', dateStr);
}

function getTodayChecks(key) {
  try { return JSON.parse(localStorage.getItem(key)) || { meal: false, workout: false }; }
  catch { return { meal: false, workout: false }; }
}

function saveTodayChecks(key, checks) {
  localStorage.setItem(key, JSON.stringify(checks));
}

function renderTodayCheck() {
  const todayKey = getTodayKey();
  const checks   = getTodayChecks(todayKey);

  const mealTag    = document.getElementById('mealDoneTag');
  const workoutTag = document.getElementById('workoutDoneTag');
  const statusEl   = document.getElementById('todayCheckStatus');

  if (mealTag)    mealTag.style.display    = checks.meal    ? 'block' : 'none';
  if (workoutTag) workoutTag.style.display = checks.workout ? 'block' : 'none';

  updateCheckStatus(checks, statusEl);
}

function updateCheckStatus(checks, statusEl) {
  if (!statusEl) return;
  if (checks.meal && checks.workout) {
    statusEl.textContent = '🎉 오늘 목표 달성!';
    statusEl.className   = 'today-check-status done';
  } else if (checks.meal || checks.workout) {
    statusEl.textContent = '🔥 절반 달성 중!';
    statusEl.className   = 'today-check-status half';
  } else {
    statusEl.textContent = '아직 체크하지 않았어요.';
    statusEl.className   = 'today-check-status';
  }
}

/* ════════════════════════════════
   7. 연속 기록 스트릭
   ════════════════════════════════ */
function renderStreak() {
  const today     = new Date();
  const weekDays  = ['일','월','화','수','목','금','토'];
  let   streak    = 0;

  /* 최근 7일 체크 완료 여부 */
  const weekStatus = [];
  for (let i = 6; i >= 0; i--) {
    const d   = new Date(today);
    d.setDate(today.getDate() - i);
    const key = lsKey('check', `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
    const chk = getTodayChecks(key);
    const done = chk.meal && chk.workout;
    weekStatus.push({ day: weekDays[d.getDay()], done, isToday: i === 0 });
  }

  /* 스트릭: 오늘부터 역순으로 연속 완료일 계산 */
  for (let i = weekStatus.length - 1; i >= 0; i--) {
    if (weekStatus[i].done) streak++;
    else break;
  }

  setText('streakCount', streak);

  const weekEl = document.getElementById('streakWeek');
  if (weekEl) {
    weekEl.innerHTML = '';
    weekStatus.forEach(({ day, done, isToday }) => {
      const div = document.createElement('div');
      div.className = 'streak-day' + (done ? ' done' : '') + (isToday ? ' today-day' : '');
      div.textContent = day;
      weekEl.appendChild(div);
    });
  }

  const infoEl = document.getElementById('streakInfo');
  if (infoEl) {
    infoEl.textContent = streak > 0
      ? `${streak}일 연속으로 목표를 달성하고 있어요! 💪`
      : '오늘 식단과 운동을 체크하면 스트릭이 시작돼요!';
  }
}

/* ════════════════════════════════
   8. 달력
   ════════════════════════════════ */
let calYear, calMonth;
let schedules = {};

function renderCalendar() {
  const today = new Date();
  calYear  = today.getFullYear();
  calMonth = today.getMonth();

  updateSelectedDateText(today);
  buildCalendar();
  bindCalendarNav();
}

async function buildCalendar() {
  const titleEl = document.getElementById('calendarTitle');
  const daysEl  = document.getElementById('calendarDays');
  if (!titleEl || !daysEl) return;

  titleEl.textContent = `${calYear}년 ${calMonth + 1}월`;
  daysEl.innerHTML = '';

  /* Firestore에서 이번 달 check 데이터 로드 */
  if (typeof loadMonthChecksFromFirestore === 'function') {
    await loadMonthChecksFromFirestore(calYear, calMonth);
  }

  const regDate     = localStorage.getItem(`reg_${getCurrentUid()}`) || '';
  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today       = new Date();
  const offset      = firstDay === 0 ? 6 : firstDay - 1;

  /* ── 각 날짜의 달성 상태 미리 계산 ── */
  const statusArr = [null]; // index 1부터 사용
  for (let d = 1; d <= daysInMonth; d++) {
    const chk = getTodayChecks(lsKey('check', dateKey(calYear, calMonth, d)));
    if (chk.meal && chk.workout) statusArr.push('both');
    else if (chk.meal)           statusArr.push('meal');
    else if (chk.workout)        statusArr.push('workout');
    else                         statusArr.push(null);
  }

  /* ── 빈 셀 ── */
  for (let i = 0; i < offset; i++) {
    const e = document.createElement('button');
    e.className = 'calendar-day empty';
    daysEl.appendChild(e);
  }

  /* ── 날짜 셀 ── */
  for (let d = 1; d <= daysInMonth; d++) {
    const key     = dateKey(calYear, calMonth, d);
    const isToday = today.getFullYear() === calYear &&
                    today.getMonth()    === calMonth &&
                    today.getDate()     === d;

    const btn = document.createElement('button');
    btn.className = 'calendar-day' + (isToday ? ' today' : '');
    btn.textContent = d;
    btn.dataset.key = key;

    const status = statusArr[d];
    if (status) {
      btn.classList.add(`cal-done-${status}`);

      /* 연속 이어지기: 그리드 7열 기준 줄바꿈 체크 */
      const col = (offset + d - 1) % 7;  // 0~6 (월~일)
      const prev = statusArr[d - 1];
      const next = statusArr[d + 1];
      const samePrev = prev === status && col !== 0;   // 같은 줄의 전날
      const sameNext = next === status && col !== 6;   // 같은 줄의 다음날

      if (samePrev && sameNext)      btn.classList.add('streak-mid');
      else if (samePrev)             btn.classList.add('streak-end');
      else if (sameNext)             btn.classList.add('streak-start');
      // else: 단독 → 기본 둥근 사각형
    }

    if (regDate && key < regDate) {
      btn.disabled = true;
      btn.classList.add('before-reg');
    } else {
      btn.addEventListener('click', () => {
        location.href = `sc602.html?date=${key}`;
      });
    }

    daysEl.appendChild(btn);
  }
}

function bindCalendarNav() {
  document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    buildCalendar();
  });
  document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    buildCalendar();
  });
}

function updateSelectedDateText(date) {
  const el = document.getElementById('selectedDateText');
  if (el) el.textContent = formatDate(date);
}

let activeKey = null;

function dateKey(y, m, d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

/* ════════════════════════════════
   연속 달성 스트릭 배너
   ════════════════════════════════ */
function renderStreakBanner() {
  let streak = 0;
  const today = new Date();
  const weekDays = ['일','월','화','수','목','금','토'];
  const weekStatus = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    let checks = {};
    try { checks = JSON.parse(localStorage.getItem(lsKey('check', dStr))) || {}; } catch {}
    weekStatus.push({ day: weekDays[d.getDay()], done: !!(checks.meal && checks.workout) });
  }

  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    let checks = {};
    try { checks = JSON.parse(localStorage.getItem(lsKey('check', dStr))) || {}; } catch {}
    if (checks.meal && checks.workout) { streak++; }
    else if (i === 0) { continue; }
    else { break; }
  }

  /* 데스크톱 배너 */
  const banner = document.getElementById('streakBanner');
  const textEl = document.getElementById('streakBannerText');
  if (banner && textEl) {
    if (streak >= 1) { banner.style.display='flex'; textEl.textContent=`${streak}일째 연속 성공 중!`; }
    else { banner.style.display='none'; }
  }

  /* 모바일 스트릭 카드 */
  const mobileCount = document.getElementById('streakCount');
  if (mobileCount) mobileCount.textContent = `${streak}일`;
  const mobileDays = document.getElementById('streakDays');
  if (mobileDays) {
    mobileDays.innerHTML = '';
    weekStatus.forEach(({ done }) => {
      const dot = document.createElement('div');
      dot.className = 'streak-day' + (done ? ' done' : '');
      mobileDays.appendChild(dot);
    });
  }

}

/* ════════════════════════════════
   목표 달성 축하 팝업
   ════════════════════════════════ */
function showGoalAchievedPopup() {
  document.getElementById('goalAchievedPopup')?.remove();
  document.getElementById('goalAchievedOverlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'goalAchievedOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);z-index:9998;';

  const data = Storage.getUser();
  const popup = document.createElement('div');
  popup.id = 'goalAchievedPopup';
  popup.style.cssText = `
    position:fixed;top:50%;left:50%;
    transform:translate(-50%,-50%) scale(0.85);
    background:var(--card);border:1px solid var(--border);
    border-radius:24px;padding:40px 36px;
    text-align:center;z-index:9999;
    box-shadow:0 0 0 1px rgba(102,208,188,0.2),0 32px 80px rgba(0,0,0,0.6);
    display:flex;flex-direction:column;align-items:center;gap:14px;
    min-width:300px;max-width:360px;width:90%;
    opacity:0;transition:opacity 0.3s ease,transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
  `;
  popup.innerHTML = `
    <div style="font-size:64px;line-height:1;animation:celebBounce 0.6s ease infinite alternate;">🏆</div>
    <div style="font-size:22px;font-weight:800;color:var(--teal);letter-spacing:-0.03em;">목표 달성!</div>
    <div style="font-size:15px;font-weight:800;color:var(--text);">
      목표 체중 <span style="color:var(--teal);">${data.targetWeight}kg</span>에 도달했어요!
    </div>
    <div style="font-size:13px;color:var(--text-sec);line-height:1.7;">
      꾸준히 노력한 결과예요. 정말 대단해요! 🎉<br>
      새로운 목표 설정 또는 현재 체중을 유지해보세요.
    </div>
    <div style="display:flex;gap:10px;width:100%;margin-top:4px;">
      <button onclick="document.getElementById('goalAchievedPopup')?.remove();document.getElementById('goalAchievedOverlay')?.remove();"
        style="flex:1;padding:12px;border:1px solid var(--border);border-radius:12px;
               background:transparent;color:var(--text-sec);font-size:13px;
               font-family:inherit;font-weight:700;cursor:pointer;">닫기</button>
      <button onclick="location.href='sc701.html';document.getElementById('goalAchievedPopup')?.remove();document.getElementById('goalAchievedOverlay')?.remove();"
        style="flex:1;padding:12px;border:none;border-radius:12px;
               background:var(--teal);color:#09131a;font-size:13px;
               font-family:inherit;font-weight:800;cursor:pointer;">목표 재설정 →</button>
    </div>
  `;

  /* 떨어지는 색종이 */
  const style = document.createElement('style');
  style.textContent = `
    @keyframes celebBounce { from { transform: translateY(0) rotate(-5deg); } to { transform: translateY(-8px) rotate(5deg); } }
    @keyframes confettiFall { 0% { transform: translateY(-20px) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }
  `;
  document.head.appendChild(style);

  overlay.addEventListener('click', () => { popup.remove(); overlay.remove(); });
  document.body.appendChild(overlay);
  document.body.appendChild(popup);

  const colors = ['var(--teal)','#F5A623','#C779D0','#5BA4E6','#7FD37A'];
  for (let i = 0; i < 28; i++) {
    const c = document.createElement('div');
    const size = 6 + Math.random() * 8;
    c.style.cssText = `position:fixed;left:${Math.random()*100}%;top:-20px;width:${size}px;height:${size}px;background:${colors[Math.floor(Math.random()*colors.length)]};border-radius:${Math.random()>0.5?'50%':'2px'};z-index:10000;pointer-events:none;animation:confettiFall ${2+Math.random()*2}s ease ${Math.random()*1}s forwards;`;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 4000);
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      popup.style.opacity = '1';
      popup.style.transform = 'translate(-50%,-50%) scale(1)';
    });
  });
}
