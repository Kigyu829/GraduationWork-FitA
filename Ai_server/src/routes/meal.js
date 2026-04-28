const { Router } = require('express');
const { recommendMeal, adjustMeal } = require('../services/mealService');
const { cacheMiddleware } = require('../middleware/cache');

const router = Router();

// ──────────────────────────────────────────
// POST /api/meal/recommend — 식단 추천
// Body: { height, weight, bmi, gender, targetWeight, targetWeeks, targetCalories? }
// ──────────────────────────────────────────
const ACT_MAP = { '낮음': 1.2, '보통': 1.375, '높음': 1.55, '매우높음': 1.725, '선수': 1.9 };

router.post('/recommend', cacheMiddleware('meal_recommend'), (req, res) => {
    const { height, weight, bmi, gender, targetWeight, targetWeeks,
            activityLevel, targetCalories: providedCalories } = req.body;

    if (!height || !weight || !targetWeight || !targetWeeks) {
        return res.status(400).json({ success: false, message: '필수 파라미터가 없습니다. (height, weight, targetWeight, targetWeeks)' });
    }

    let targetCalories;
    if (providedCalories && providedCalories > 0) {
        targetCalories = providedCalories;
    } else {
        /* 프론트에서 targetCalories 미전달 시 Mifflin-St Jeor 폴백 */
        const age          = 25;  // 나이 정보 없을 때 기본값
        const bmr          = gender === '남성'
            ? 10 * weight + 6.25 * height - 5 * age + 5
            : 10 * weight + 6.25 * height - 5 * age - 161;
        const multiplier   = ACT_MAP[activityLevel] || 1.375;
        const tdee         = Math.round(bmr * multiplier);
        const weightToLose = Math.max(0, weight - targetWeight);
        const dailyDeficit = Math.min(Math.round((weightToLose * 7700) / (targetWeeks * 7)), 1000);
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
router.post('/adjust', async (req, res) => {
    const { currentPlan, reasons, targetCalories } = req.body;

    if (!currentPlan || !reasons || !reasons.length || !targetCalories) {
        return res.status(400).json({ success: false, message: '필수 파라미터가 없습니다. (currentPlan, reasons, targetCalories)' });
    }

    try {
        console.log(`  누적 재조정 이유 ${reasons.length}개:`);
        reasons.forEach((r, i) => console.log(`    ${i + 1}. ${r}`));
        const data = await adjustMeal({ targetCalories, reasons });
        console.log(`  결과: 아침 ${data.breakfast.calories}kcal / 점심 ${data.lunch.calories}kcal / 저녁 ${data.dinner.calories}kcal`);
        res.json({ success: true, data });
    } catch (err) {
        console.error('  [오류] 식단 재조정 실패:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
