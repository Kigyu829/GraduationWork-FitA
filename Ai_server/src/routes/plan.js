const { Router } = require('express');
const { recommendMeal }     = require('../services/mealService');
const { recommendExercise } = require('../services/exerciseService');

const router = Router();

// ──────────────────────────────────────────
// POST /api/plan/replan — 플랜 재스케줄링 (식단 + 운동 병렬 생성)
// Body: { height, weight, bmi, gender, targetWeight, remainingWeeks, missedCount, reason }
// Response: { success, data: { mealPlan, workoutPlan } }
// ──────────────────────────────────────────
router.post('/replan', (req, res) => {
    const { height, weight, bmi, gender, targetWeight, remainingWeeks, missedCount = 0, reason = '' } = req.body;

    if (!height || !weight || !targetWeight || !remainingWeeks) {
        return res.status(400).json({ success: false, message: '필수 파라미터가 없습니다. (height, weight, targetWeight, remainingWeeks)' });
    }

    // 남은 기간 기준으로 목표 칼로리 재계산
    const weightToLose   = Math.max(0, weight - targetWeight);
    const tdee           = weight * 28;
    const dailyDeficit   = Math.round((weightToLose * 7700) / (remainingWeeks * 7));
    const targetCalories = Math.max(1200, tdee - Math.min(dailyDeficit, 1000));

    try {
        console.log(`  재스케줄링: 미이행 ${missedCount}회 / 남은 ${remainingWeeks}주 / 목표 ${targetCalories}kcal`);

        const reasons  = reason ? [reason] : [];
        const mealPlan    = recommendMeal({ targetCalories, excludeFoods: [] });
        const workoutPlan = recommendExercise({ bmi: bmi || 22, targetWeeks: remainingWeeks });

        console.log(`  식단: ${mealPlan.total_calories}kcal / 운동: ${workoutPlan.total_calories}kcal 소모`);
        res.json({ success: true, data: { mealPlan, workoutPlan } });
    } catch (err) {
        console.error('  [오류] 재스케줄링 실패:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
