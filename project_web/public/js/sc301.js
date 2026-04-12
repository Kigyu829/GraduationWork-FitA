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
  bindMenuBtns();
  bindLogout();
  bindLogoClick();
  bindWeightChart();
  bindFooterModals();
});
 
/* ════════════════════════════════
   1. 헤더 날짜
   ════════════════════════════════ */
function renderHeader() {
  const el = document.getElementById('headerDate');
  if (el) el.textContent = formatDate();
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
    if (data.birth)  parts.push(data.birth.slice(0, 4) + '년생');
    if (data.height) parts.push(`키 ${data.height}cm`);
    infoEl.textContent = parts.join(' · ') || '기본 정보 없음';
  }
 
  if (currentWeightEl) currentWeightEl.textContent = data.weight      ? `${data.weight}kg`      : '-';
  if (targetWeightEl)  targetWeightEl.textContent  = data.targetWeight ? `${data.targetWeight}kg` : '-';
}
 
/* ════════════════════════════════
   3. 진행률
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
 
  const checks     = getTodayChecks(getTodayKey());
  const bonus      = (checks.meal && checks.workout) ? 2 : (checks.meal || checks.workout) ? 1 : 0;
  const displayPct = Math.min(100, pct + bonus);
  const remaining  = Math.max(0, currentWeight - targetWeight);
 
  setText('progress',               `${displayPct}%`);
  setText('progressBadge',          `${displayPct}%`);
  setText('currentWeight',          currentWeight ? `${currentWeight}kg` : '-');
  setText('targetWeight',           targetWeight  ? `${targetWeight}kg`  : '-');
  setText('remainingWeight',        targetWeight  ? `${remaining}kg`     : '-');
  setText('goalPeriodText',         data.goalPeriod || '-');
  setText('currentWeightTextMirror', currentWeight ? `${currentWeight}kg` : '-');
 
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
 
  const minBMI = 10, maxBMI = 35;
  const clamped = Math.min(Math.max(bmi, minBMI), maxBMI);
  const angle   = ((clamped - minBMI) / (maxBMI - minBMI)) * 180 - 90;
 
  const needle = document.getElementById('bmiNeedle');
  if (needle) needle.style.transform = `translateX(-50%) rotate(${angle}deg)`;
 
  setText('bmiDisplay', bmi.toFixed(1));
  const status = getBMIStatus(bmi);
  setText('bmiStatusBadge', status.label);
 
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
 
    const targetWeight2 = Number(data.targetWeight || 0);
    const goalWeeks2    = Number(data.goalWeeks || 12);
    const weightToLose2 = Math.max(0, weight - targetWeight2);
    const rawDeficit2   = Math.round((weightToLose2 * 7700) / (goalWeeks2 * 7));
    const dailyDeficit2 = Math.min(rawDeficit2, 1000);
    const targetCal     = Math.max(1200, tdee - dailyDeficit2);
    setText('targetCaloriesValue', `${targetCal.toLocaleString()} kcal`);
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
 
function renderTodayCheck() {
  const todayKey = getTodayKey();
  const checks   = getTodayChecks(todayKey);
 
  const mealChk    = document.getElementById('checkMeal');
  const workoutChk = document.getElementById('checkWorkout');
  const statusEl   = document.getElementById('todayCheckStatus');
 
  if (mealChk) {
    mealChk.checked  = checks.meal;
    mealChk.disabled = true;
  }
  if (workoutChk) {
    workoutChk.checked  = checks.workout;
    workoutChk.disabled = true;
  }
 
  updateCheckStatus(checks, statusEl);
}
 
function updateCheckStatus(checks, statusEl) {
  if (!statusEl) return;
  if (checks.meal && checks.workout) {
    statusEl.textContent = '🎉 오늘 목표 달성!';
    statusEl.className   = 'today-check-status done';
  } else if (checks.meal || checks.workout) {
    statusEl.textContent = '🔥 절반 달성! 조금만 더!';
    statusEl.className   = 'today-check-status half';
  } else {
    statusEl.textContent = '아직 체크하지 않았어요.';
    statusEl.className   = 'today-check-status';
  }
}
 
/* ════════════════════════════════
   6. 달력
   ════════════════════════════════ */
let calYear, calMonth;
let schedules = {};
 
function renderCalendar() {
  const today = new Date();
  calYear  = today.getFullYear();
  calMonth = today.getMonth();
 
  try { schedules = JSON.parse(localStorage.getItem('schedules')) || {}; }
  catch { schedules = {}; }
 
  updateSelectedDateText(today);
  buildCalendar();
  bindCalendarNav();
  bindSchedulePopup();
}
 
function buildCalendar() {
  const titleEl = document.getElementById('calendarTitle');
  const daysEl  = document.getElementById('calendarDays');
  if (!titleEl || !daysEl) return;
 
  titleEl.textContent = `${calYear}년 ${calMonth + 1}월`;
  daysEl.innerHTML    = '';
 
  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today       = new Date();
  const offset      = firstDay === 0 ? 6 : firstDay - 1;
 
  for (let i = 0; i < offset; i++) {
    const e = document.createElement('button');
    e.className = 'calendar-day empty';
    daysEl.appendChild(e);
  }
 
  for (let d = 1; d <= daysInMonth; d++) {
    const key     = dateKey(calYear, calMonth, d);
    const isToday = today.getFullYear() === calYear &&
                    today.getMonth()    === calMonth &&
                    today.getDate()     === d;
 
    const btn       = document.createElement('button');
    btn.className   = 'calendar-day' + (isToday ? ' today' : '');
    btn.textContent = d;
    btn.dataset.key = key;
 
    if (schedules[key]?.length > 0) btn.classList.add('has-schedule');
 
    const chk = getTodayChecks(`check_${key}`);
    if (chk.meal && chk.workout) btn.classList.add('check-done');
 
    btn.addEventListener('click', () => openSchedulePopup(btn, key, d));
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
 
function bindSchedulePopup() {
  document.getElementById('closePopupBtn')?.addEventListener('click', closePopup);
  document.getElementById('saveScheduleBtn')?.addEventListener('click', saveSchedule);
  document.getElementById('scheduleInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); saveSchedule(); }
  });
}
 
function openSchedulePopup(btnEl, key, day) {
  activeKey = key;
  const popup  = document.getElementById('schedulePopup');
  const label  = document.getElementById('popupDateLabel');
  const input  = document.getElementById('scheduleInput');
  const calBox = document.querySelector('.calendar-box');
  if (!popup || !calBox) return;
 
  label.textContent = `${calYear}년 ${calMonth + 1}월 ${day}일`;
  input.value       = '';
  updateSelectedDateText(new Date(calYear, calMonth, day));
 
  const calRect = calBox.getBoundingClientRect();
  const btnRect = btnEl.getBoundingClientRect();
  popup.style.top  = `${btnRect.bottom - calRect.top + 4}px`;
  popup.style.left = `${Math.min(btnRect.left - calRect.left, calRect.width - 220)}px`;
 
  popup.classList.add('show');
  renderScheduleList(key);
  input.focus();
}
 
function closePopup() {
  document.getElementById('schedulePopup')?.classList.remove('show');
  activeKey = null;
}
 
function saveSchedule() {
  if (!activeKey) return;
  const input = document.getElementById('scheduleInput');
  const text  = input?.value.trim();
  if (!text) return;
 
  if (!schedules[activeKey]) schedules[activeKey] = [];
  schedules[activeKey].push(text);
  localStorage.setItem('schedules', JSON.stringify(schedules));
  input.value = '';
  renderScheduleList(activeKey);
  document.querySelector(`.calendar-day[data-key="${activeKey}"]`)
    ?.classList.add('has-schedule');
}
 
function renderScheduleList(key) {
  const list = document.getElementById('scheduleList');
  if (!list) return;
  list.innerHTML = '';
  (schedules[key] || []).forEach((text, idx) => {
    const li  = document.createElement('li');
    li.textContent = text;
    const del = document.createElement('button');
    del.textContent = '×';
    del.style.cssText = 'float:right; background:none; border:none; color:var(--text-mute); cursor:pointer; font-size:14px;';
    del.addEventListener('click', () => {
      schedules[key].splice(idx, 1);
      if (!schedules[key].length) {
        delete schedules[key];
        document.querySelector(`.calendar-day[data-key="${key}"]`)?.classList.remove('has-schedule');
      }
      localStorage.setItem('schedules', JSON.stringify(schedules));
      renderScheduleList(key);
    });
    li.appendChild(del);
    list.appendChild(li);
  });
}
 
function dateKey(y, m, d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
 
/* ════════════════════════════════
   7. 체중 차트
   ════════════════════════════════ */
function bindWeightChart() {
  const saveBtn  = document.getElementById('saveWeightBtn');
  const input    = document.getElementById('todayWeightInput');
  const canvas   = document.getElementById('weightChart');
  const emptyEl  = document.getElementById('chartEmpty');
 
  const WEIGHT_KEY = 'weightHistory';
  let history = [];
  try { history = JSON.parse(localStorage.getItem(WEIGHT_KEY)) || []; } catch { history = []; }
 
  function drawChart() {
    if (!canvas) return;
    if (history.length < 2) {
      if (emptyEl) emptyEl.style.display = 'flex';
      canvas.style.display = 'none';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    canvas.style.display = 'block';
 
    const ctx    = canvas.getContext('2d');
    const W      = canvas.offsetWidth  || 280;
    const H      = canvas.offsetHeight || 200;
    canvas.width  = W;
    canvas.height = H;
 
    const recent = history.slice(-7);
    const vals   = recent.map(r => r.weight);
    const minW   = Math.min(...vals) - 1;
    const maxW   = Math.max(...vals) + 1;
    const padX   = 36, padY = 16;
 
    ctx.clearRect(0, 0, W, H);
 
    const xStep = (W - padX * 2) / Math.max(recent.length - 1, 1);
    const yScale = (H - padY * 2) / (maxW - minW);
 
    const toX = i => padX + i * xStep;
    const toY = v => H - padY - (v - minW) * yScale;
 
    // gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(102,208,188,0.25)');
    grad.addColorStop(1, 'rgba(102,208,188,0)');
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(vals[0]));
    recent.forEach((_, i) => { if (i > 0) ctx.lineTo(toX(i), toY(vals[i])); });
    ctx.lineTo(toX(recent.length - 1), H);
    ctx.lineTo(toX(0), H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
 
    // line
    ctx.beginPath();
    ctx.strokeStyle = 'var(--teal, #66D0BC)';
    ctx.lineWidth = 2;
    ctx.lineJoin  = 'round';
    ctx.moveTo(toX(0), toY(vals[0]));
    recent.forEach((_, i) => { if (i > 0) ctx.lineTo(toX(i), toY(vals[i])); });
    ctx.stroke();
 
    // dots + labels
    recent.forEach((r, i) => {
      ctx.beginPath();
      ctx.arc(toX(i), toY(vals[i]), 4, 0, Math.PI * 2);
      ctx.fillStyle = 'var(--teal, #66D0BC)';
      ctx.fill();
 
      ctx.fillStyle   = 'rgba(255,255,255,0.7)';
      ctx.font        = '10px Nanum Gothic, sans-serif';
      ctx.textAlign   = 'center';
      ctx.fillText(`${vals[i]}`, toX(i), toY(vals[i]) - 8);
 
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillText(r.date.slice(5), toX(i), H - 4);
    });
  }
 
  drawChart();
 
  saveBtn?.addEventListener('click', () => {
    const val = parseFloat(input.value);
    if (!val || val < 20 || val > 300) { alert('체중을 올바르게 입력해주세요.'); return; }
 
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
 
    // 오늘 날짜 중복 제거
    history = history.filter(r => r.date !== dateStr);
    history.push({ date: dateStr, weight: val });
    if (history.length > 30) history = history.slice(-30);
 
    localStorage.setItem(WEIGHT_KEY, JSON.stringify(history));
    Storage.mergeUser({ weight: val, bmi: calculateBMI(Storage.getUser().height, val) });
    input.value = '';
    drawChart();
    renderProgress();
    renderBMIGauge();
  });
}
 
/* ════════════════════════════════
   8. AI 식단/운동 플랜 카드 렌더링
   ════════════════════════════════ */
function renderAiPlan() {
  const userData    = Storage.getUser();
  const mealPlan    = userData.aiMealPlan;
  const workoutPlan = userData.aiWorkoutPlan;
 
  const mealEl    = document.getElementById('mealContent');
  const workoutEl = document.getElementById('workoutContent');
 
  if (mealEl) {
    if (mealPlan) {
      const rows = [
        { icon: '🌅', key: 'breakfast', label: '아침' },
        { icon: '☀️', key: 'lunch',     label: '점심' },
        { icon: '🌙', key: 'dinner',    label: '저녁' },
      ].map(({ icon, key, label }) => {
        const m = mealPlan[key];
        if (!m) return '';
        const menu = Array.isArray(m.menu) ? m.menu.join(', ') : m.menu;
        return `
          <div class="plan-row">
            <span class="plan-row-label">${icon} ${label}</span>
            <span class="plan-row-value">${menu}</span>
            <span class="plan-row-kcal">${m.calories} kcal</span>
          </div>`;
      }).join('');
      mealEl.innerHTML = `
        <div class="plan-list">${rows}</div>
        <div class="plan-total">하루 총 ${(mealPlan.total_calories || 0).toLocaleString()} kcal</div>
        ${mealPlan.tip ? `<div class="plan-tip">💡 ${mealPlan.tip}</div>` : ''}
      `;
    } else {
      mealEl.innerHTML = `<div class="plan-empty">sc302에서 AI 플랜을 먼저 생성해주세요.</div>`;
    }
  }
 
  if (workoutEl) {
    if (workoutPlan) {
      const mainItems = (workoutPlan.main || []).map(item => {
        const detail = item.sets && item.reps
          ? `${item.reps}회 × ${item.sets}세트`
          : (item.duration || '');
        return `
          <div class="plan-row workout-row">
            <span class="plan-row-name">💪 ${item.name}</span>
            <span class="plan-row-detail">${detail}</span>
            <span class="plan-row-kcal">${item.calories || 0} kcal</span>
          </div>`;
      }).join('');
      workoutEl.innerHTML = `
        <div class="plan-list">${mainItems}</div>
        <div class="plan-total">${workoutPlan.total_duration || 0}분 · ${workoutPlan.total_calories || 0} kcal 소모</div>
        ${workoutPlan.tip ? `<div class="plan-tip">💡 ${workoutPlan.tip}</div>` : ''}
      `;
    } else {
      workoutEl.innerHTML = `<div class="plan-empty">sc302에서 AI 플랜을 먼저 생성해주세요.</div>`;
    }
  }
}
 
/* ════════════════════════════════
   9. 로그아웃 / 로고
   ════════════════════════════════ */
function bindLogout() {
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('healthUserData');
    location.href = 'sc101.html';
  });
}
 
function bindLogoClick() {
  document.getElementById('sidebarLogo')?.addEventListener('click', () => {
    location.href = 'sc301.html';
  });
}
 
/* ════════════════════════════════
   10. 푸터 모달
   ════════════════════════════════ */
function bindFooterModals() {
  const overlay   = document.getElementById('footerModalOverlay');
  const modal     = document.getElementById('footerModal');
  const titleEl   = document.getElementById('footerModalTitle');
  const bodyEl    = document.getElementById('footerModalBody');
  const closeBtn  = document.getElementById('footerModalClose');
 
  const CONTENTS = {
    footerTerms: {
      title: '이용약관',
      body: `<h3>제1조 목적</h3><p>본 약관은 HealthDash 서비스 이용에 관한 조건을 규정합니다.</p>
             <h3>제2조 서비스 이용</h3><p>서비스는 개인 건강 관리 목적으로만 사용하여야 합니다.</p>
             <h3>제3조 개인정보</h3><p>수집된 정보는 서비스 제공 목적으로만 활용됩니다.</p>`
    },
    footerPrivacy: {
      title: '개인정보처리방침',
      body: `<h3>수집 항목</h3><p>이메일, 닉네임, 신체 정보(키·체중·BMI), 식단·운동 기록</p>
             <h3>이용 목적</h3><p>맞춤형 AI 식단·운동 추천 서비스 제공</p>
             <h3>보유 기간</h3><p>회원 탈퇴 시 즉시 삭제</p>`
    },
    footerNotice: {
      title: '공지사항',
      body: `<div class="notice-item"><div class="notice-date">2025-01-15</div>
             <div class="notice-title">AI 플랜 추천 기능 업데이트</div></div>
             <div class="notice-item"><div class="notice-date">2025-01-01</div>
             <div class="notice-title">HealthDash 서비스 오픈</div></div>`
    },
    footerContact: {
      title: '문의하기',
      body: `<div class="contact-form">
               <input type="text"  placeholder="이름" />
               <input type="email" placeholder="이메일" />
               <textarea placeholder="문의 내용을 입력해주세요"></textarea>
               <button class="contact-submit">보내기</button>
             </div>`
    },
  };
 
  Object.keys(CONTENTS).forEach(id => {
    document.getElementById(id)?.addEventListener('click', e => {
      e.preventDefault();
      const c = CONTENTS[id];
      if (titleEl) titleEl.textContent = c.title;
      if (bodyEl)  bodyEl.innerHTML    = c.body;
      overlay?.classList.add('show');
    });
  });
 
  closeBtn?.addEventListener('click',  () => overlay?.classList.remove('show'));
  overlay?.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('show'); });
}