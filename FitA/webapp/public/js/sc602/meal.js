'use strict';

/* ════════════════════════════════
   식단 탭 렌더링
   ════════════════════════════════ */
function renderMealTab(dateStr) {
  const sc311Key = lsKey('sc311', dateStr);
  const planKey  = lsKey('plan',  dateStr);
  let   state    = {};
  let   planData = {};
  try { state    = JSON.parse(localStorage.getItem(sc311Key)) || {}; } catch {}
  try { planData = JSON.parse(localStorage.getItem(planKey))  || {}; } catch {}
  const meals    = state.meals || {};
  const mealPlan = planData.mealPlan; // AI 생성 플랜

  /* 인증 사진 */
  const photoGrid = document.getElementById('detailPhotoGrid');
  if (photoGrid) {
    const photos = Object.entries(meals)
      .filter(([, d]) => d.verified && d.photo)
      .map(([type, d]) => ({ type, photo: d.photo, kcal: d.kcal }));

    if (photos.length > 0) {
      photoGrid.innerHTML = photos.map(({ type, photo, kcal }) => `
        <div class="detail-photo-card">
          <img class="detail-photo-img" src="${photo}" alt="${MEAL_LABELS[type] || type}" />
          <div class="detail-photo-label">${MEAL_LABELS[type] || type} · ${kcal} kcal</div>
        </div>
      `).join('');
    } else {
      photoGrid.innerHTML = '<div class="detail-photo-empty">인증된 사진이 없어요</div>';
    }
  }

  /* 식단 목록 — AI 플랜 우선, 없으면 빈 상태 */
  const mealList = document.getElementById('detailMealList');
  if (mealList) {
    const mealSource = mealPlan
      ? Object.entries({ breakfast: mealPlan.breakfast, lunch: mealPlan.lunch, dinner: mealPlan.dinner })
          .filter(([, m]) => m)
          .map(([type, m]) => [type, {
            name: Array.isArray(m.menu) ? m.menu.join(' + ') : (m.menu || ''),
            kcal: m.calories || 0,
          }])
      : [];

    if (!mealSource.length) {
      mealList.innerHTML = '<div class="detail-empty-msg">이 날의 플랜 기록이 없어요</div>';
    } else {
      const items = mealSource.map(([type, info]) => {
        const verifiedMeal = meals[type];
        const verified     = verifiedMeal?.verified || false;
        const displayName  = verified && verifiedMeal.food ? verifiedMeal.food : info.name;
        const displayKcal  = verified && verifiedMeal.kcal != null ? verifiedMeal.kcal : info.kcal;
        const icon         = getFoodIcon(displayName);
        return `
          <div class="detail-meal-item${verified ? ' verified' : ''}">
            <div class="detail-meal-emoji">${icon}</div>
            <div class="detail-meal-info">
              <div class="detail-meal-name">${displayName}</div>
              <div class="detail-meal-tag">${MEAL_LABELS[type] || type}</div>
            </div>
            <div class="detail-meal-kcal">${displayKcal} kcal</div>
            <div class="detail-meal-check">${verified ? '✅' : '○'}</div>
          </div>`;
      }).join('');
      mealList.innerHTML = items;
    }
  }
}
