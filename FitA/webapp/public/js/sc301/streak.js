'use strict';

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
