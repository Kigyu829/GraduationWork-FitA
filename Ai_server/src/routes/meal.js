const { Router } = require('express');
const { callGemini, FOOD_LABELS, buildReasonsText, parseGeminiJson } = require('../config');

const router = Router();

// ──────────────────────────────────────────
// POST /api/meal/recommend — 식단 추천
// Body: { height, weight, bmi, gender, targetWeight, targetWeeks }
// ──────────────────────────────────────────
router.post('/recommend', async (req, res) => {
    const { height, weight, bmi, gender, targetWeight, targetWeeks } = req.body;

    if (!height || !weight || !targetWeight || !targetWeeks) {
        return res.status(400).json({ success: false, message: '필수 파라미터가 없습니다. (height, weight, targetWeight, targetWeeks)' });
    }

    // GeminiTest와 동일한 칼로리 계산 로직
    const totalDays      = targetWeeks * 7;
    const weightToLose   = weight - targetWeight;
    const tdee           = weight * 28;
    const dailyDeficit   = Math.round((weightToLose * 7700) / totalDays);
    const targetCalories = Math.max(1200, tdee - dailyDeficit);

    const prompt =
        "당신은 전문 영양사입니다. 다음 사용자 정보를 바탕으로 오늘의 식단을 추천해주세요.\n\n" +
        "사용자 정보:\n" +
        "- 성별: " + gender + "\n" +
        "- 키: " + height + "cm\n" +
        "- 현재 체중: " + weight + "kg\n" +
        "- BMI: " + bmi + "\n" +
        "- 목표 체중: " + targetWeight + "kg\n" +
        "- 목표 기간: " + targetWeeks + "주\n" +
        "- 하루 목표 섭취 칼로리: " + targetCalories + "kcal\n\n" +
        "★ 하루 총 칼로리 합계가 반드시 " + targetCalories + "kcal 근처(±30kcal 이내)가 되도록 식단을 구성하세요.\n" +
        "★ 중요: 반드시 아래 음식 목록 안에서만 메인 메뉴를 추천하세요. 목록에 없는 음식은 절대 추천하지 마세요.\n" +
        "【허용 음식 목록】\n" + FOOD_LABELS + "\n\n" +
        "★ 반드시 아래 JSON 형식으로만 답변하세요. 백틱(```)이나 다른 텍스트 없이 순수 JSON만 출력하세요.\n\n" +
        '{\n' +
        '  "breakfast": {"menu": ["음식명1", "음식명2"], "calories": 350, "desc": "한 줄 설명"},\n' +
        '  "lunch":     {"menu": ["음식명1", "음식명2"], "calories": 500, "desc": "한 줄 설명"},\n' +
        '  "dinner":    {"menu": ["음식명1", "음식명2"], "calories": 400, "desc": "한 줄 설명"},\n' +
        '  "total_calories": ' + targetCalories + ',\n' +
        '  "tip": "오늘의 식단 팁"\n' +
        '}';

    try {
        console.log(`  목표 칼로리: ${targetCalories}kcal | Gemini 요청 중...`);
        const text = await callGemini(prompt);
        const data = parseGeminiJson(text);
        console.log(`  결과: 아침 ${data.breakfast?.calories}kcal / 점심 ${data.lunch?.calories}kcal / 저녁 ${data.dinner?.calories}kcal / 합계 ${data.total_calories}kcal`);
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

    const reasonsText = buildReasonsText(reasons);

    const prompt =
        "당신은 전문 영양사입니다. 아래는 현재 사용자의 식단 플랜입니다.\n\n" +
        "【현재 식단 플랜】\n" + JSON.stringify(currentPlan) + "\n\n" +
        reasonsText + "\n\n" +
        "★ 위의 모든 재조정 이유를 반영하여 식단을 수정해주세요.\n" +
        "★ 하루 총 칼로리 합계는 반드시 " + targetCalories + "kcal 근처(±30kcal 이내)를 유지하세요.\n" +
        "★ 반드시 아래 음식 목록 안에서만 메뉴를 추천하세요. 목록에 없는 음식은 절대 추천하지 마세요.\n" +
        "【허용 음식 목록】\n" + FOOD_LABELS + "\n\n" +
        "★ 반드시 아래 JSON 형식으로만 답변하세요. 백틱(```)이나 다른 텍스트 없이 순수 JSON만 출력하세요.\n\n" +
        '{\n' +
        '  "breakfast": {"menu": ["음식명1", "음식명2"], "calories": 350, "desc": "한 줄 설명"},\n' +
        '  "lunch":     {"menu": ["음식명1", "음식명2"], "calories": 500, "desc": "한 줄 설명"},\n' +
        '  "dinner":    {"menu": ["음식명1", "음식명2"], "calories": 400, "desc": "한 줄 설명"},\n' +
        '  "total_calories": ' + targetCalories + ',\n' +
        '  "tip": "재조정 관련 팁"\n' +
        '}';

    try {
        console.log(`  누적 재조정 이유 ${reasons.length}개:`);
        reasons.forEach((r, i) => console.log(`    ${i + 1}. ${r}`));
        console.log('  Gemini 요청 중...');
        const text = await callGemini(prompt);
        const data = parseGeminiJson(text);
        console.log(`  결과: 아침 ${data.breakfast?.calories}kcal / 점심 ${data.lunch?.calories}kcal / 저녁 ${data.dinner?.calories}kcal`);
        res.json({ success: true, data });
    } catch (err) {
        console.error('  [오류] 식단 재조정 실패:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
