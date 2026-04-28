const { Router } = require('express');
const { recommendExercise, adjustExercise } = require('../services/exerciseService');
const { cacheMiddleware } = require('../middleware/cache');

const router = Router();

// ──────────────────────────────────────────
// POST /api/exercise/recommend — 운동 추천
// Body: { height, weight, bmi, gender, targetWeight, targetWeeks }
// ──────────────────────────────────────────
router.post('/recommend', cacheMiddleware('exercise_recommend'), (req, res) => {
    const { height, weight, bmi, gender, targetWeight, targetWeeks } = req.body;

    if (!height || !weight || !targetWeight || !targetWeeks) {
        return res.status(400).json({ success: false, message: '필수 파라미터가 없습니다. (height, weight, targetWeight, targetWeeks)' });
    }

    try {
        const data = recommendExercise({ bmi: bmi || 22, targetWeeks });
        console.log(`  결과: 총 ${data.total_duration}분 / 소모 ${data.total_calories}kcal / 메인 운동 ${data.main.length}개`);
        res.json({ success: true, data });
    } catch (err) {
        console.error('  [오류] 운동 추천 실패:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ──────────────────────────────────────────
// POST /api/exercise/adjust — 운동 재조정
// Body: { currentPlan, reasons, targetWeeks, bmi? }
//   reasons: ["이유1", "이유2", ...] (누적 이유 배열)
// ──────────────────────────────────────────
router.post('/adjust', async (req, res) => {
    const { currentPlan, reasons, targetWeeks, bmi } = req.body;

    if (!currentPlan || !reasons || !reasons.length) {
        return res.status(400).json({ success: false, message: '필수 파라미터가 없습니다. (currentPlan, reasons)' });
    }

    try {
        console.log(`  누적 재조정 이유 ${reasons.length}개:`);
        reasons.forEach((r, i) => console.log(`    ${i + 1}. ${r}`));
        const data = await adjustExercise({ bmi: bmi || 22, targetWeeks: targetWeeks || 8, reasons });
        console.log(`  결과: 총 ${data.total_duration}분 / 소모 ${data.total_calories}kcal`);
        res.json({ success: true, data });
    } catch (err) {
        console.error('  [오류] 운동 재조정 실패:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
