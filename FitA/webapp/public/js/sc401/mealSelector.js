'use strict';

/* ════════════════════════════════
   날짜 · 끼니 선택 UI
   ════════════════════════════════ */
function showMealSelector() {
  const selector = document.getElementById('mealSelector');
  if (selector) selector.style.display = 'block';
}

function hideMealSelector() {
  const selector = document.getElementById('mealSelector');
  if (selector) selector.style.display = 'none';
}

function bindMealSelector() {
  const mealBtns = document.querySelectorAll('.meal-select-btn, .meal-type-btn');

  mealBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      mealBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      /* 클릭 즉시 uploadParams 저장 */
      const selectedMeal = btn.dataset.meal;
      const userData     = Storage.getUser();
      const mealPlan     = userData.aiMealPlan;
      const kcal         = mealPlan?.[selectedMeal]?.calories || 0;

      const params = new URLSearchParams({ meal: selectedMeal, kcal });
      sessionStorage.setItem('uploadParams', params.toString());
    });
  });
}
