'use strict';

/* ════════════════════════════════
   5. AI 플랜 대시보드 카드 렌더링
   ════════════════════════════════ */
function renderAiPlan() {
  const data        = Storage.getUser();
  const mealPlan    = data.aiMealPlan;
  const workoutPlan = data.aiWorkoutPlan;

  /* 오늘 sc311 인증 상태 읽기 */
  let sc311State = { meals: {}, workouts: {} };
  try {
    const raw = localStorage.getItem(lsKey('sc311', todayStr()));
    if (raw) sc311State = JSON.parse(raw) || sc311State;
  } catch {}

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
        const menuArr   = Array.isArray(meal.menu) ? meal.menu : [meal.menu || ''];
        const menuText  = menuArr.join(' · ');
        const border    = i < 2 ? 'border-bottom:1px solid rgba(255,255,255,0.07);' : '';
        const mStatus   = sc311State.meals[key];
        const verified  = mStatus?.verified;
        const skipped   = mStatus?.skipped;
        const rowOp     = verified ? 'opacity:0.45;' : '';
        const textStyle = verified ? 'text-decoration:line-through;' : '';
        const badge     = verified
          ? `<span style="font-size:15px;flex-shrink:0;margin-top:14px;">${skipped ? '🚫' : '✅'}</span>`
          : '';
        return `
          <div style="${border}${rowOp}padding:10px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div style="flex:1;min-width:0;">
              <div style="font-size:11px;color:var(--text-sec);margin-bottom:4px;">${emoji} ${label}</div>
              <div style="font-size:14px;font-weight:500;line-height:1.4;word-break:keep-all;${textStyle}">${menuText}</div>
            </div>
            ${badge || `<span style="font-size:12px;color:var(--teal,#66D0BC);white-space:nowrap;flex-shrink:0;margin-top:18px;">${meal.calories}kcal</span>`}
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
      /* 준비운동 1개 + 메인 전체 + 마무리 1개 (워크아웃 ID 포함) */
      const sections = [];
      (workoutPlan.warmup   || []).slice(0, 1).forEach((w, i) => sections.push({ ...w, tag: '준비',  tagColor: 'var(--text-sec)',     wId: `warmup_${i}` }));
      (workoutPlan.main     || []).forEach((w, i) =>            sections.push({ ...w, tag: '메인',  tagColor: 'var(--teal,#66D0BC)', wId: `main_${i}` }));
      (workoutPlan.cooldown || []).slice(0, 1).forEach((w, i) => sections.push({ ...w, tag: '마무리', tagColor: 'var(--text-sec)',     wId: `cooldown_${i}` }));

      const rows = sections.map((item, i) => {
        const detail  = item.sets ? `${item.reps}회 × ${item.sets}세트` : (item.duration || '');
        const border  = i < sections.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.07);' : '';
        const isDone  = sc311State.workouts[item.wId]?.done;
        const rowOp   = isDone ? 'opacity:0.45;' : '';
        const nameStr = isDone ? `<span style="text-decoration:line-through;">${item.name}</span>` : item.name;
        const tagTxt  = isDone ? '✓완료' : item.tag;
        const tagCol  = isDone ? 'var(--teal,#66D0BC)' : item.tagColor;
        return `
          <div style="${border}${rowOp}display:flex;align-items:center;gap:10px;padding:8px 0;">
            <span style="font-size:18px;flex-shrink:0;">${getWorkoutIcon(item.name)}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${nameStr}</div>
              <div style="font-size:11px;color:var(--text-sec);margin-top:2px;">${detail}</div>
            </div>
            <span style="font-size:10px;color:${tagCol};border:1px solid ${tagCol};border-radius:4px;padding:1px 6px;white-space:nowrap;flex-shrink:0;">${tagTxt}</span>
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
