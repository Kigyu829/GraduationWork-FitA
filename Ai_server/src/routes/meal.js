const { Router } = require('express');
const { recommendMeal, adjustMeal } = require('../services/mealService');
const { cacheMiddleware } = require('../middleware/cache');

const router = Router();

// ──────────────────────────────────────────
// POST /api/meal/recommend — 식단 추천
// Body: { height, weight, bmi, gender, targetWeight, targetWeeks, targetCalories? }
// ──────────────────────────────────────────
router.post('/recommend', cacheMiddleware('meal_recommend'), (req, res) => {
    const { height, weight, bmi, gender, targetWeight, targetWeeks, targetCalories: providedCalories } = req.body;

    if (!height || !weight || !targetWeight || !targetWeeks) {
        return res.status(400).json({ success: false, message: '필수 파라미터가 없습니다. (height, weight, targetWeight, targetWeeks)' });
    }

    let targetCalories;
    if (providedCalories && providedCalories > 0) {
        targetCalories = providedCalories;
    } else {
        const totalDays    = targetWeeks * 7;
        const weightToLose = Math.max(0, weight - targetWeight);
        const tdee         = weight * 28;
        const dailyDeficit = Math.min(Math.round((weightToLose * 7700) / totalDays), 1000);
        targetCalories     = Math.max(1200, tdee - dailyDeficit);
    }

    try {
        console.log(`  목표 칼로리: ${targetCalories}kcal | 식단 추천 중...`);
        const data = recommendMeal({ targetCalories });
        console.log(`  결과: 아침 ${data.breakfast.calories}kcal / 점심 ${data.lunch.calories}kcal / 저녁 ${data.dinner.calories}kcal / 합계 ${data.total_calories}kcal`);
        res.json({ success: true, data, targetCalories });
    } catch (err) {
        console.error('  [오류] 식단 추천 실패:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ──────────────────────────────────────────
// POST /api/meal/adjust — 식단 재조정
// Body: { currentPlan, reasons, targetCalories }
//   reasons: ["이유1", "이유2", ...] (누적 이유 배열)
// ──────────────────────────────────────────
router.post('/adjust', (req, res) => {
    const { currentPlan, reasons, targetCalories } = req.body;

    if (!currentPlan || !reasons || !reasons.length || !targetCalories) {
        return res.status(400).json({ success: false, message: '필수 파라미터가 없습니다. (currentPlan, reasons, targetCalories)' });
    }

    try {
        console.log(`  누적 재조정 이유 ${reasons.length}개:`);
        reasons.forEach((r, i) => console.log(`    ${i + 1}. ${r}`));
        const data = adjustMeal({ targetCalories, reasons });
        console.log(`  결과: 아침 ${data.breakfast.calories}kcal / 점심 ${data.lunch.calories}kcal / 저녁 ${data.dinner.calories}kcal`);
        res.json({ success: true, data });
    } catch (err) {
        console.error('  [오류] 식단 재조정 실패:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
