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
  renderTodayCheck();
  renderCalendar();
  bindMenuBtns();     /* common.js */
  bindLogout();
  bindLogoClick();
  initCommonOverlays();  /* common.js — AI상담 오버레이 + 히스토리 sc602 이동 */
  initTodayWeight();     /* 오늘 체중 입력 초기화 */
  renderStreakBanner();  /* 연속 달성 배너 */
});

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

  /* 프로필 사진 반영 */
  const saved = localStorage.getItem('profileAvatar');
  const imgTag = saved
    ? `<img src="${saved}" alt="프로필" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />`
    : '👤';
  const avatarEl = document.getElementById('profileAvatar');
  if (avatarEl) avatarEl.innerHTML = imgTag;
  const sidebarAvatarEl = document.getElementById('sidebarAvatar');
  if (sidebarAvatarEl) sidebarAvatarEl.innerHTML = imgTag;
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
   5. 오늘 목표 체크
   ════════════════════════════════ */
function getTodayKey() {
  const d = new Date();
  return `check_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
  const key      = `water_${getTodayKey()}`;
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
    const key = `check_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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

function buildCalendar() {
  const titleEl = document.getElementById('calendarTitle');
  const daysEl  = document.getElementById('calendarDays');
  if (!titleEl || !daysEl) return;

  titleEl.textContent = `${calYear}년 ${calMonth + 1}월`;
  daysEl.innerHTML = '';

  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today       = new Date();
  const offset      = firstDay === 0 ? 6 : firstDay - 1;

  /* ── 각 날짜의 달성 상태 미리 계산 ── */
  const statusArr = [null]; // index 1부터 사용
  for (let d = 1; d <= daysInMonth; d++) {
    const chk = getTodayChecks(`check_${dateKey(calYear, calMonth, d)}`);
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
    localStorage.removeItem('healthUserData');
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

/* ════════════════════════════════
   오늘 체중 입력
   ════════════════════════════════ */
function initTodayWeight() {
  const input   = document.getElementById('todayWeightInput');
  const saveBtn = document.getElementById('todayWeightSaveBtn');
  const hint    = document.getElementById('todayWeightHint');

  const todayKey = `todayWeight_${getTodayKey()}`;
  const saved    = localStorage.getItem(todayKey);
  if (saved && input) input.value = saved;

  saveBtn?.addEventListener('click', () => {
    const val = parseFloat(input?.value);
    if (!val || val < 20 || val > 300) {
      if (hint) { hint.textContent = '올바른 체중을 입력해주세요.'; hint.style.color = 'var(--red)'; }
      return;
    }
    localStorage.setItem(todayKey, val);
    Storage.mergeUser({ weight: String(val) });
    if (hint) hint.textContent = '';
    showWeightSavedPopup(val);
    renderProgress();
    renderSidebar();
    renderStreakBanner();
  });

  input?.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn?.click(); });
}

function showWeightSavedPopup(val) {
  document.getElementById('weightSavedPopup')?.remove();
  document.getElementById('weightPopupOverlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'weightPopupOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);z-index:9998;';

  const popup = document.createElement('div');
  popup.id = 'weightSavedPopup';
  popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.9);background:var(--card);border:1px solid var(--border);border-radius:20px;padding:32px 36px;text-align:center;z-index:9999;box-shadow:0 24px 64px rgba(0,0,0,0.5);display:flex;flex-direction:column;align-items:center;gap:12px;opacity:0;transition:opacity 0.2s ease,transform 0.2s ease;min-width:260px;';
  popup.innerHTML = `<div style="font-size:48px;line-height:1;">⚖️</div><div style="font-size:18px;font-weight:800;color:var(--text);letter-spacing:-0.02em;">체중이 저장됐어요!</div><div style="font-size:14px;color:var(--teal);font-weight:800;">오늘 체중: ${val}kg</div><div style="font-size:12px;color:var(--text-sec);line-height:1.6;">대시보드에 반영됐어요.</div><button onclick="document.getElementById('weightSavedPopup')?.remove();document.getElementById('weightPopupOverlay')?.remove();" style="margin-top:4px;padding:10px 28px;border:none;border-radius:10px;background:var(--teal);color:#09131a;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">확인</button>`;

  overlay.addEventListener('click', () => { popup.remove(); overlay.remove(); });
  document.body.appendChild(overlay);
  document.body.appendChild(popup);
  requestAnimationFrame(() => { requestAnimationFrame(() => { popup.style.opacity='1'; popup.style.transform='translate(-50%,-50%) scale(1)'; }); });
  setTimeout(() => { popup.remove(); overlay.remove(); }, 3000);
}

function renderStreakBanner() {
  const banner = document.getElementById('streakBanner');
  const textEl = document.getElementById('streakBannerText');
  if (!banner || !textEl) return;
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const key = `check_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    let checks = {};
    try { checks = JSON.parse(localStorage.getItem(key)) || {}; } catch {}
    if (checks.meal && checks.workout) { streak++; }
    else if (i === 0) { continue; }
    else { break; }
  }
  if (streak >= 1) { banner.style.display='flex'; textEl.textContent=`${streak}일째 연속 성공 중!`; }
  else { banner.style.display='none'; }
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
               font-family:inherit;font-weight:700;cursor:pointer;">
        닫기
      </button>
      <button onclick="location.href='sc701.html';document.getElementById('goalAchievedPopup')?.remove();document.getElementById('goalAchievedOverlay')?.remove();"
        style="flex:1;padding:12px;border:none;border-radius:12px;
               background:var(--teal);color:#09131a;font-size:13px;
               font-family:inherit;font-weight:800;cursor:pointer;">
        목표 재설정 →
      </button>
    </div>
  `;

  /* 떨어지는 색종이 (간단 버전) */
  const style = document.createElement('style');
  style.textContent = `
    @keyframes celebBounce {
      from { transform: translateY(0) rotate(-5deg); }
      to   { transform: translateY(-8px) rotate(5deg); }
    }
    @keyframes confettiFall {
      0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
      100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  overlay.addEventListener('click', () => {
    popup.remove();
    overlay.remove();
  });

  document.body.appendChild(overlay);
  document.body.appendChild(popup);

  /* 색종이 생성 */
  const colors = ['var(--teal)','#F5A623','#C779D0','#5BA4E6','#7FD37A'];
  for (let i = 0; i < 28; i++) {
    const c = document.createElement('div');
    const size = 6 + Math.random() * 8;
    c.style.cssText = `
      position:fixed;
      left:${Math.random() * 100}%;
      top:-20px;
      width:${size}px;height:${size}px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
      z-index:10000;pointer-events:none;
      animation:confettiFall ${2 + Math.random() * 2}s ease ${Math.random() * 1}s forwards;
    `;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 4000);
  }

  /* 팝업 등장 */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      popup.style.opacity = '1';
      popup.style.transform = 'translate(-50%,-50%) scale(1)';
    });
  });
}
