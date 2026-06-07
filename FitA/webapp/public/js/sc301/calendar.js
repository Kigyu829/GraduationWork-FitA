'use strict';

/* ════════════════════════════════
   8. 달력
   ════════════════════════════════ */
let calYear, calMonth;
let schedules = {};
let activeKey = null;

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
