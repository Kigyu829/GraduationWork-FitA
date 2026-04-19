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

window.addEventListener('DOMContentLoaded', () => {
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
   2. 사이드바 프로필
   ════════════════════════════════ */
function renderSidebar() {
  const data = Storage.getUser();
  const reg  = Storage.getRegistered();

  const nameEl          = document.getElementById('userName');
  const infoEl          = document.getElementById('userBasicInfo');
  const currentWeightEl = document.getElementById('currentWeightText');
  const targetWeightEl  = document.getElementById('targetWeightText');

  if (nameEl) nameEl.textContent = reg.nickname ? `${reg.nickname}님` : '사용자';

  if (infoEl) {
    const parts = [];
    if (data.gender) parts.push(data.gender);
    if (data.height) parts.push(`키 ${data.height}cm`);
    infoEl.textContent = parts.join(' · ') || '기본 정보 없음';
  }

  if (currentWeightEl) currentWeightEl.textContent = data.weight      ? `${data.weight}kg`      : '-';
  if (targetWeightEl)  targetWeightEl.textContent  = data.targetWeight ? `${data.targetWeight}kg` : '-';
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

  const remaining = Math.max(0, currentWeight - targetWeight);

  /* DOM 업데이트 */
  setText('progress',               `${displayPct}%`);
  setText('progressBadge',          `${displayPct}%`);
  setText('currentWeight',          currentWeight ? `${currentWeight}kg` : '-');
  setText('targetWeight',           targetWeight  ? `${targetWeight}kg`  : '-');
  setText('remainingWeight',        targetWeight  ? `${remaining}kg`     : '-');
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

    const actMap = { '낮음': 1.2, '보통': 1.375, '높음': 1.55 };
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
      mealEl.className = '';
      mealEl.innerHTML = rows;

      const totalKcal = ['breakfast','lunch','dinner'].reduce((s, k) => s + (mealPlan[k]?.calories || 0), 0);
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

  const mealChk    = document.getElementById('checkMeal');
  const workoutChk = document.getElementById('checkWorkout');
  const statusEl   = document.getElementById('todayCheckStatus');

  /* sc311에서 저장한 check_ 키 기반으로 자동 반영 (읽기전용) */
  if (mealChk) {
    mealChk.checked  = checks.meal;
    mealChk.disabled = true;   /* 사용자가 직접 체크 불가 */
    mealChk.style.opacity = '0.7';
    mealChk.style.cursor  = 'default';
    mealChk.title = '식단 인증 시 자동으로 체크됩니다';
  }
  if (workoutChk) {
    workoutChk.checked  = checks.workout;
    workoutChk.disabled = true;
    workoutChk.style.opacity = '0.7';
    workoutChk.style.cursor  = 'default';
    workoutChk.title = '운동 완료 시 자동으로 체크됩니다';
  }

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
   6. 물 섭취 트래커
   ════════════════════════════════ */
function renderWater() {
  const _wd = new Date();
  const key  = lsKey('water', `${_wd.getFullYear()}-${String(_wd.getMonth()+1).padStart(2,'0')}-${String(_wd.getDate()).padStart(2,'0')}`);
  let   count    = parseInt(localStorage.getItem(key) || '0', 10);
  const total    = 8;
  const cupsEl   = document.getElementById('waterCups');
  const badgeEl  = document.getElementById('waterBadge');
  const tipEl    = document.getElementById('waterTip');

  function drawCups() {
    if (!cupsEl) return;
    cupsEl.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const div = document.createElement('div');
      div.className = 'water-cup' + (i < count ? ' filled' : '');
      div.textContent = i < count ? '💧' : '○';
      cupsEl.appendChild(div);
    }
    if (badgeEl) badgeEl.textContent = `${count} / ${total}잔`;
    if (tipEl) {
      tipEl.textContent = count >= total
        ? '🎉 오늘 수분 목표 달성!'
        : `오늘의 수분 섭취 목표: 2,000ml (${total - count}잔 남음)`;
    }
  }

  drawCups();

  document.getElementById('addWaterBtn')?.addEventListener('click', () => {
    if (count < total) { count++; localStorage.setItem(key, count); drawCups(); }
  });
  document.getElementById('resetWaterBtn')?.addEventListener('click', () => {
    count = 0; localStorage.setItem(key, 0); drawCups();
  });
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

    btn.addEventListener('click', () => {
      location.href = `sc602.html?date=${key}`;
    });

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
   9. 로그아웃 → sc101
   ════════════════════════════════ */
function bindLogout() {
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (typeof auth !== 'undefined') auth.signOut().catch(() => {});
    Storage.clearAll();
    location.href = 'sc101.html';
  });
}

/* ════════════════════════════════
   10. 로고 클릭 → sc101
   ════════════════════════════════ */
function bindLogoClick() {
  document.getElementById('sidebarLogo')?.addEventListener('click', () => {
    /* 로그인 후 페이지이므로 로고 클릭 시 대시보드로 이동 */
    location.href = 'sc301.html';
  });
}
