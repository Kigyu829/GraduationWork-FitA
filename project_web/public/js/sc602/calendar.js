'use strict';

let sc602CalYear, sc602CalMonth;

function initDate() {
  const params = new URLSearchParams(location.search);
  const dateStr = params.get('date') || todayStr();
  currentDate = dateStr;
  renderPage(currentDate);

  document.getElementById('prevDayBtn')?.addEventListener('click', () => {
    const prev    = offsetDate(currentDate, -1);
    const regDate = localStorage.getItem(`reg_${getCurrentUid()}`) || '';
    if (regDate && prev < regDate) return;
    currentDate = prev;
    updateURL(currentDate);
    renderPage(currentDate);
  });

  document.getElementById('nextDayBtn')?.addEventListener('click', () => {
    const next = offsetDate(currentDate, 1);
    if (next > todayStr()) return;
    currentDate = next;
    updateURL(currentDate);
    renderPage(currentDate);
  });

  document.getElementById('detailDate')?.addEventListener('click', openSc602Cal);
  document.getElementById('sc602CalOpen')?.addEventListener('click', openSc602Cal);

  initSc602Cal();
}

function initTabs() {
  document.querySelectorAll('.detail-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.detail-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.detail-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.tab;
      document.getElementById(`detailContent${target.charAt(0).toUpperCase() + target.slice(1)}`)?.classList.add('active');
    });
  });
}

function initSc602Cal() {
  const d = new Date(currentDate);
  sc602CalYear  = d.getFullYear();
  sc602CalMonth = d.getMonth();

  document.getElementById('sc602HistClose')?.addEventListener('click', () => {
    document.getElementById('sc602HistOverlay')?.classList.remove('show');
  });
  document.getElementById('sc602HistOverlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('sc602HistOverlay')) {
      document.getElementById('sc602HistOverlay').classList.remove('show');
    }
  });
  document.getElementById('sc602PrevMonth')?.addEventListener('click', async () => {
    sc602CalMonth--;
    if (sc602CalMonth < 0) { sc602CalMonth = 11; sc602CalYear--; }
    await loadMonthChecksFromFirestore(sc602CalYear, sc602CalMonth);
    buildSc602Cal();
  });
  document.getElementById('sc602NextMonth')?.addEventListener('click', async () => {
    sc602CalMonth++;
    if (sc602CalMonth > 11) { sc602CalMonth = 0; sc602CalYear++; }
    await loadMonthChecksFromFirestore(sc602CalYear, sc602CalMonth);
    buildSc602Cal();
  });
}

async function openSc602Cal() {
  const d = new Date(currentDate);
  sc602CalYear  = d.getFullYear();
  sc602CalMonth = d.getMonth();
  document.getElementById('sc602HistOverlay')?.classList.add('show');
  await loadMonthChecksFromFirestore(sc602CalYear, sc602CalMonth);
  buildSc602Cal();
}

function buildSc602Cal() {
  const titleEl = document.getElementById('sc602CalTitle');
  const daysEl  = document.getElementById('sc602CalDays');
  if (!titleEl || !daysEl) return;

  titleEl.textContent = `${sc602CalYear}년 ${sc602CalMonth + 1}월`;
  daysEl.innerHTML = '';

  const regDate     = localStorage.getItem(`reg_${getCurrentUid()}`) || '';
  const firstDay    = new Date(sc602CalYear, sc602CalMonth, 1).getDay();
  const daysInMonth = new Date(sc602CalYear, sc602CalMonth + 1, 0).getDate();
  const offset      = firstDay === 0 ? 6 : firstDay - 1;

  for (let i = 0; i < offset; i++) {
    const el = document.createElement('div');
    el.className = 'hist-day empty';
    daysEl.appendChild(el);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr  = `${sc602CalYear}-${String(sc602CalMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const checkKey = lsKey('check', dateStr);
    let   checks   = {};
    try { checks = JSON.parse(localStorage.getItem(checkKey)) || {}; } catch {}

    const hasMeal    = checks.meal    === true;
    const hasWorkout = checks.workout === true;

    const btn = document.createElement('button');
    btn.className = 'hist-day';

    if (dateStr === currentDate) btn.classList.add('today');

    if (hasMeal && hasWorkout) btn.classList.add('done-both');
    else if (hasMeal)          btn.classList.add('done-meal');
    else if (hasWorkout)       btn.classList.add('done-workout');

    const icon = hasMeal && hasWorkout ? '🌟' : hasMeal ? '🥗' : hasWorkout ? '💪' : '';
    btn.innerHTML = `<span class="hist-day-num">${d}</span>${icon ? `<span class="hist-day-icon">${icon}</span>` : ''}`;

    if ((regDate && dateStr < regDate) || dateStr > todayStr()) {
      btn.disabled = true;
      btn.classList.add('before-reg');
    } else {
      btn.addEventListener('click', () => {
        currentDate = dateStr;
        updateURL(dateStr);
        renderPage(dateStr);
        document.getElementById('sc602HistOverlay')?.classList.remove('show');
      });
    }

    daysEl.appendChild(btn);
  }

  const totalCells = offset + daysInMonth;
  const remainder  = 42 - totalCells;
  for (let i = 0; i < remainder; i++) {
    const el = document.createElement('div');
    el.className = 'hist-day empty';
    daysEl.appendChild(el);
  }
}
