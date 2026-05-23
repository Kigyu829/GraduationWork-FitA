const { Router } = require('express');
const { recommendMeal, adjustMeal }         = require('../services/mealService');
const { recommendExercise, adjustExercise } = require('../services/exerciseService');

const router = Router();

// ──────────────────────────────────────────
// POST /api/plan/replan — 플랜 재스케줄링 (식단 + 운동 병렬 생성)
// Body: { height, weight, bmi, gender, birth, activityLevel, targetWeight, remainingWeeks, missedCount, reason }
// reason이 있으면 Gemini NLU 기반 adjust 함수 사용 (제외/선호 반영)
// reason이 없으면 규칙 기반 recommend 함수 사용 (빠름)
// Response: { success, data: { mealPlan, workoutPlan } }
// ──────────────────────────────────────────
router.post('/replan', async (req, res) => {
    const { height, weight, bmi, gender, birth, activityLevel, targetWeight, remainingWeeks, missedCount = 0, reason = '' } = req.body;

    if (!height || !weight || !targetWeight || !remainingWeeks) {
        return res.status(400).json({ success: false, message: '필수 파라미터가 없습니다. (height, weight, targetWeight, remainingWeeks)' });
    }

    // 남은 기간 기준으로 목표 칼로리 재계산 (Mifflin-St Jeor)
    const age = birth ? new Date().getFullYear() - Number(String(birth).slice(0, 4)) : 25;
    const bmr = (gender === '남성' || gender === 'M')
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : 10 * weight + 6.25 * height - 5 * age - 161;
    const actMap = { '낮음': 1.2, '보통': 1.375, '높음': 1.55, '매우높음': 1.725, '선수': 1.9 };
    const tdee           = Math.round(bmr * (actMap[activityLevel] || 1.375));
    const weightToLose   = Math.max(0, weight - targetWeight);
    const dailyDeficit   = Math.round((weightToLose * 7700) / (remainingWeeks * 7));
    const targetCalories = Math.max(1200, tdee - Math.min(dailyDeficit, 1000));

    try {
        const reasons = reason ? [reason] : [];
        console.log(`  재스케줄링: 미이행 ${missedCount}회 / 남은 ${remainingWeeks}주 / 목표 ${targetCalories}kcal`);
        if (reason) console.log(`  사유: "${reason}" → Gemini NLU 기반 adjust 사용`);

        const [mealPlan, workoutPlan] = await Promise.all([
            reasons.length > 0
                ? adjustMeal({ targetCalories, reasons })
                : Promise.resolve(recommendMeal({ targetCalories })),
            reasons.length > 0
                ? adjustExercise({ bmi: bmi || 22, targetWeeks: remainingWeeks, activityLevel, reasons })
                : Promise.resolve(recommendExercise({ bmi: bmi || 22, targetWeeks: remainingWeeks, activityLevel })),
        ]);

        const mealTotal = mealPlan.breakfast.calories + mealPlan.lunch.calories + mealPlan.dinner.calories;
        console.log(`  식단: ${mealTotal}kcal / 운동: ${workoutPlan.total_calories}kcal 소모`);
        res.json({ success: true, data: { mealPlan, workoutPlan } });
    } catch (err) {
        console.error('  [오류] 재스케줄링 실패:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
