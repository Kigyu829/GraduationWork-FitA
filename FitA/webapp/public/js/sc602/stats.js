'use strict';

/* ════════════════════════════════
   주간 매크로 리포트
   ════════════════════════════════ */
function initWeeklyMacro() {
  const toggle  = document.getElementById('weeklyMacroToggle');
  const body    = document.getElementById('weeklyMacroBody');
  const chevron = document.getElementById('weeklyMacroChevron');
  if (!toggle || !body) return;

  toggle.addEventListener('click', () => {
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    chevron?.classList.toggle('open', !isOpen);
    if (!isOpen) buildWeeklyMacro();
  });
}

function buildWeeklyMacro() {
  const barsEl = document.getElementById('weeklyMacroBars');
  const rowEl  = document.getElementById('weeklyMacroRow');
  if (!barsEl || !rowEl) return;

  /* 최근 7일 데이터 수집 */
  const days = [];
  let totalP = 0, totalC = 0, totalF = 0, dayCount = 0;

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const planKey = lsKey('plan', dateStr);
    let mp = null;
    try { mp = (JSON.parse(localStorage.getItem(planKey)) || {}).mealPlan; } catch {}

    let p = 0, c = 0, f = 0;
    if (mp) {
      ['breakfast','lunch','dinner'].forEach(k => {
        const m = mp[k];
        if (!m) return;
        p += m.protein || 0;
        c += m.carbs   || 0;
        f += m.fat     || 0;
      });
      totalP += p; totalC += c; totalF += f; dayCount++;
    }
    days.push({ label: `${d.getMonth()+1}/${d.getDate()}`, p, c, f, hasData: !!mp });
  }

  /* 최대값 (바 스케일링용) */
  const maxTotal = Math.max(...days.map(d => d.p + d.c + d.f), 1);

  /* 막대 그래프 */
  barsEl.innerHTML = days.map(d => {
    const total = d.p + d.c + d.f;
    const scale = total > 0 ? 50 / maxTotal : 0;
    return `
      <div class="wmb-group">
        <div class="wmb-bars">
          <div class="wmb-bar carbs"   style="height:${Math.round(d.c * scale)}px" title="탄수화물 ${d.c}g"></div>
          <div class="wmb-bar protein" style="height:${Math.round(d.p * scale)}px" title="단백질 ${d.p}g"></div>
          <div class="wmb-bar fat"     style="height:${Math.round(d.f * scale)}px" title="지방 ${d.f}g"></div>
        </div>
        <div class="wmb-day-label">${d.label}</div>
      </div>`;
  }).join('');

  /* 7일 평균 */
  const avgP = dayCount > 0 ? Math.round(totalP / dayCount) : 0;
  const avgC = dayCount > 0 ? Math.round(totalC / dayCount) : 0;
  const avgF = dayCount > 0 ? Math.round(totalF / dayCount) : 0;

  rowEl.innerHTML = `
    <div class="wm-stat">
      <div class="wm-stat-label">탄수화물 평균</div>
      <div class="wm-stat-val carbs">${avgC}g</div>
    </div>
    <div class="wm-stat">
      <div class="wm-stat-label">단백질 평균</div>
      <div class="wm-stat-val protein">${avgP}g</div>
    </div>
    <div class="wm-stat">
      <div class="wm-stat-label">지방 평균</div>
      <div class="wm-stat-val fat">${avgF}g</div>
    </div>`;
}
