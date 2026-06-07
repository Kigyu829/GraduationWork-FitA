'use strict';

/* ════════════════════════════════
   운동 탭 렌더링
   ════════════════════════════════ */
function renderWorkoutTab(dateStr) {
  const sc311Key  = lsKey('sc311', dateStr);
  const planKey   = lsKey('plan',  dateStr);
  let   state     = {};
  let   planData  = {};
  try { state    = JSON.parse(localStorage.getItem(sc311Key)) || {}; } catch {}
  try { planData = JSON.parse(localStorage.getItem(planKey))  || {}; } catch {}
  const workouts    = state.workouts || {};
  const workoutPlan = planData.workoutPlan; // AI 생성 플랜

  /* 운동 목록 — AI 플랜 우선, 없으면 빈 상태 */
  const workoutSource = workoutPlan
    ? [
        ...(workoutPlan.warmup   || []).map((w, i) => ({ id: `warmup_${i}`,   ...w, detail: w.sets ? `${w.reps}회 × ${w.sets}세트` : (w.duration || '') })),
        ...(workoutPlan.main     || []).map((w, i) => ({ id: `main_${i}`,     ...w, detail: w.sets ? `${w.reps}회 × ${w.sets}세트` : (w.duration || '') })),
        ...(workoutPlan.cooldown || []).map((w, i) => ({ id: `cooldown_${i}`, ...w, detail: w.sets ? `${w.reps}회 × ${w.sets}세트` : (w.duration || '') })),
      ]
    : [];

  const list = document.getElementById('detailWorkoutList');
  if (list) {
    if (!workoutSource.length) {
      list.innerHTML = '<div class="detail-empty-msg">이 날의 플랜 기록이 없어요</div>';
    } else {
      const items = workoutSource.map(w => {
        const done   = workouts[w.id]?.done || false;
        const icon   = getWorkoutIcon(w.name);
        const ytUrl  = `https://www.youtube.com/results?search_query=${encodeURIComponent(w.name + ' 운동 방법')}`;
        return `
          <div class="detail-workout-item${done ? ' done' : ''}">
            <div class="detail-workout-icon">${icon}</div>
            <div class="detail-workout-info">
              <a class="detail-workout-name" href="${ytUrl}" target="_blank" rel="noopener noreferrer">${w.name}</a>
              <div class="detail-workout-detail">${w.detail || ''}</div>
            </div>
            <div class="detail-workout-kcal">${w.calories || w.kcal || 0} kcal</div>
            <div class="detail-workout-status">${done ? '✅' : '○'}</div>
          </div>`;
      }).join('');
      list.innerHTML = items;
    }
  }

  /* 요약 */
  const summary = document.getElementById('detailWorkoutSummary');
  if (summary) {
    const doneList = workoutSource.filter(w => workouts[w.id]?.done);
    const burnKcal = doneList.reduce((s, w) => s + (w.calories || w.kcal || 0), 0);
    if (doneList.length > 0) {
      summary.innerHTML = `
        <div>완료한 운동 <strong>${doneList.length}</strong> / ${workoutSource.length}개</div>
        <div>소모 칼로리 <strong>${burnKcal} kcal</strong></div>`;
    } else {
      summary.innerHTML = '';
    }
  }
}
