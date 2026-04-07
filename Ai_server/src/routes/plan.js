const { Router } = require('express');
const { callGemini, FOOD_LABELS, buildReasonsText, parseGeminiJson } = require('../config');

const router = Router();

// ──────────────────────────────────────────
// POST /api/plan/replan — AI 플랜 재스케줄링 (식단 + 운동 병렬 생성)
// Body: { height, weight, bmi, gender, targetWeight, remainingWeeks, missedCount, reason }
//   remainingWeeks: 남은 목표 기간 (주)
//   missedCount: 누적 미이행 횟수 (기본값 0)
//   reason: 재조정 사유 (선택)
// Response: { success, data: { mealPlan, workoutPlan } }
// ──────────────────────────────────────────
router.post('/replan', async (req, res) => {
    const { height, weight, bmi, gender, targetWeight, remainingWeeks, missedCount = 0, reason = '' } = req.body;

    if (!height || !weight || !targetWeight || !remainingWeeks) {
        return res.status(400).json({ success: false, message: '필수 파라미터가 없습니다. (height, weight, targetWeight, remainingWeeks)' });
    }

    // 남은 기간 기준으로 목표 칼로리 재계산
    const weightToLose   = weight - targetWeight;
    const tdee           = weight * 28;
    const dailyDeficit   = Math.round((weightToLose * 7700) / (remainingWeeks * 7));
    const targetCalories = Math.max(1200, tdee - dailyDeficit);

    const contextText =
        "사용자가 " + missedCount + "회 식단/운동을 미이행하여 플랜을 재조정합니다.\n" +
        (reason ? "재조정 사유: " + reason + "\n" : "") +
        "남은 목표 기간: " + remainingWeeks + "주\n";

    const mealPrompt =
        "당신은 전문 영양사입니다. " + contextText + "\n" +
        "사용자 정보:\n" +
        "- 성별: " + gender + "\n" +
        "- 키: " + height + "cm / 체중: " + weight + "kg / BMI: " + bmi + "\n" +
        "- 목표 체중: " + targetWeight + "kg\n" +
        "- 하루 목표 섭취 칼로리: " + targetCalories + "kcal\n\n" +
        "★ 하루 총 칼로리 합계가 반드시 " + targetCalories + "kcal 근처(±30kcal)가 되도록 구성하세요.\n" +
        "★ 반드시 아래 음식 목록 안에서만 추천하세요:\n" + FOOD_LABELS + "\n\n" +
        "★ 순수 JSON만 출력하세요.\n" +
        '{"breakfast":{"menu":["음식명"],"calories":350,"desc":"설명"},' +
        '"lunch":{"menu":["음식명"],"calories":500,"desc":"설명"},' +
        '"dinner":{"menu":["음식명"],"calories":400,"desc":"설명"},' +
        '"total_calories":' + targetCalories + ',"tip":"팁"}';

    const workoutPrompt =
        "당신은 전문 운동 트레이너입니다. " + contextText + "\n" +
        "사용자 정보:\n" +
        "- 성별: " + gender + "\n" +
        "- 키: " + height + "cm / 체중: " + weight + "kg / BMI: " + bmi + "\n" +
        "- 목표 체중: " + targetWeight + "kg / 남은 기간: " + remainingWeeks + "주\n\n" +
        "★ 집에서 할 수 있는 맨몸 운동 위주로 추천하세요.\n" +
        "★ 순수 JSON만 출력하세요.\n" +
        '{"warmup":[{"name":"운동명","duration":"5분","calories":30}],' +
        '"main":[{"name":"운동명","sets":3,"reps":15,"calories":80}],' +
        '"cooldown":[{"name":"운동명","duration":"5분","calories":20}],' +
        '"total_duration":45,"total_calories":300,"tip":"팁"}';

    try {
        console.log(`  재스케줄링: 미이행 ${missedCount}회 / 남은 ${remainingWeeks}주 / 목표 ${targetCalories}kcal`);
        console.log('  식단 + 운동 Gemini 병렬 요청 중...');

        // 식단과 운동을 동시에 요청 (병렬)
        const [mealText, workoutText] = await Promise.all([
            callGemini(mealPrompt),
            callGemini(workoutPrompt),
        ]);

        const mealPlan    = parseGeminiJson(mealText);
        const workoutPlan = parseGeminiJson(workoutText);

        console.log(`  식단: ${mealPlan.total_calories}kcal / 운동: ${workoutPlan.total_calories}kcal 소모`);
        res.json({ success: true, data: { mealPlan, workoutPlan } });
    } catch (err) {
        console.error('  [오류] 재스케줄링 실패:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
