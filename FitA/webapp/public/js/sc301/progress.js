'use strict';

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
