const { Router } = require('express');

const router = Router();

// ──────────────────────────────────────────
// POST /api/goal/calories — 일일 권장 칼로리 계산 (Mifflin-St Jeor, Gemini 불필요)
// Body: { gender, birth, height, weight, targetWeight, targetWeeks, activityLevel }
//   gender: "남성" | "여성"
//   birth: "2000-01-15" (YYYY-MM-DD, 선택)
//   activityLevel: "low" | "moderate" | "high"
// Response: { success, data: { bmr, tdee, dailyCalories, dailyDeficit, weeklyLoss }, warning }
// ──────────────────────────────────────────
router.post('/calories', (req, res) => {
    const { gender, birth, height, weight, targetWeight, targetWeeks, activityLevel } = req.body;

    if (!gender || !height || !weight || !targetWeight || !targetWeeks) {
        return res.status(400).json({ success: false, message: '필수 파라미터가 없습니다. (gender, height, weight, targetWeight, targetWeeks)' });
    }

    // 나이 계산 (birth 없으면 기본값 25세)
    const age = birth
        ? Math.floor((new Date() - new Date(birth)) / (365.25 * 24 * 60 * 60 * 1000))
        : 25;

    // BMR — Mifflin-St Jeor 공식
    const bmr = gender === '남성' || gender === 'M'
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : 10 * weight + 6.25 * height - 5 * age - 161;

    // 활동계수 → TDEE
    const activityMultiplier = { '낮음': 1.2, '보통': 1.375, '높음': 1.55, '매우높음': 1.725, '선수': 1.9 };
    const tdee = Math.round(bmr * (activityMultiplier[activityLevel] || 1.375));

    // 목표 칼로리 계산
    const weightToLose   = weight - targetWeight;
    const dailyDeficit   = Math.round((weightToLose * 7700) / (targetWeeks * 7));
    const dailyCalories  = Math.max(1200, tdee - dailyDeficit);
    const weeklyLoss     = parseFloat((weightToLose / targetWeeks).toFixed(2));

    console.log(`  BMR: ${Math.round(bmr)} / TDEE: ${tdee} / 목표: ${dailyCalories}kcal / 주간감량: ${weeklyLoss}kg`);

    // 주 1kg 초과 감량 경고
    const warning = weeklyLoss > 1.0
        ? `주당 ${weeklyLoss}kg 감량은 무리할 수 있습니다. 기간을 늘려주세요.`
        : null;

    res.json({
        success: true,
        data: { bmr: Math.round(bmr), tdee, dailyCalories, dailyDeficit, weeklyLoss },
        warning,
    });
});

module.exports = router;
