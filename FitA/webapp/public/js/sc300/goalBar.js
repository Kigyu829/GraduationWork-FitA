'use strict';

/* ── 목표 진행 바 렌더 ── */
function renderGoalBar(data) {
  const initialWeight = Number(data.initialWeight || data.weight || 0);
  const targetWeight  = Number(data.targetWeight  || 0);
  const barWrap    = document.getElementById('wcGoalBarWrap');
  const goalFill   = document.getElementById('wcGoalFill');
  const startLabel = document.getElementById('wcGoalStartLabel');
  const endLabel   = document.getElementById('wcGoalEndLabel');

  if (initialWeight > targetWeight && barWrap) {
    barWrap.style.display = 'block';
    if (startLabel) startLabel.textContent = `시작 ${initialWeight}kg`;
    if (endLabel)   endLabel.textContent   = `목표 ${targetWeight}kg`;
    const pct = Math.min(100, Math.max(0,
      Math.round(((initialWeight - Number(data.weight)) / (initialWeight - targetWeight)) * 100)
    ));
    if (goalFill) setTimeout(() => { goalFill.style.width = `${pct}%`; }, 80);
  }
}
