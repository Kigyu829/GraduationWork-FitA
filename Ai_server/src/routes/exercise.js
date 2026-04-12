const { Router } = require('express');
const { callGemini, buildReasonsText, parseGeminiJson } = require('../config');

const router = Router();

// ──────────────────────────────────────────
// POST /api/exercise/recommend — 운동 추천
// Body: { height, weight, bmi, gender, targetWeight, targetWeeks }
// ──────────────────────────────────────────
router.post('/recommend', async (req, res) => {
    const { height, weight, bmi, gender, targetWeight, targetWeeks } = req.body;

    if (!height || !weight || !targetWeight || !targetWeeks) {
        return res.status(400).json({ success: false, message: '필수 파라미터가 없습니다. (height, weight, targetWeight, targetWeeks)' });
    }

    const prompt =
        "당신은 전문 운동 트레이너입니다. 다음 사용자 정보를 바탕으로 오늘의 운동 플랜을 추천해주세요.\n\n" +
        "사용자 정보:\n" +
        "- 성별: " + gender + "\n" +
        "- 키: " + height + "cm\n" +
        "- 현재 체중: " + weight + "kg\n" +
        "- BMI: " + bmi + "\n" +
        "- 목표 체중: " + targetWeight + "kg\n" +
        "- 목표 기간: " + targetWeeks + "주\n\n" +
        "★ 목표 기간에 맞는 운동 강도로 조절하세요. 기간이 짧을수록 강도를 높이세요.\n" +
        "★ 집에서 할 수 있는 맨몸 운동 위주로 추천하세요.\n" +
        "★ 반드시 아래 JSON 형식으로만 답변하세요. 백틱(```)이나 다른 텍스트 없이 순수 JSON만 출력하세요.\n\n" +
        '{\n' +
        '  "warmup":   [{"name": "운동명", "duration": "5분", "calories": 30}],\n' +
        '  "main":     [{"name": "운동명", "sets": 3, "reps": 15, "calories": 80}],\n' +
        '  "cooldown": [{"name": "운동명", "duration": "5분", "calories": 20}],\n' +
        '  "total_duration": 45,\n' +
        '  "total_calories": 300,\n' +
        '  "tip": "오늘의 운동 팁"\n' +
        '}';

    try {
        console.log('  Gemini 요청 중...');
        const text = await callGemini(prompt);
        const data = parseGeminiJson(text);
        console.log(`  결과: 총 ${data.total_duration}분 / 소모 ${data.total_calories}kcal / 메인 운동 ${data.main?.length}개`);
        res.json({ success: true, data });
    } catch (err) {
        console.error('  [오류] 운동 추천 실패:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ──────────────────────────────────────────
// POST /api/exercise/adjust — 운동 재조정
// Body: { currentPlan, reasons, targetWeeks }
//   reasons: ["이유1", "이유2", ...] (누적 이유 배열)
// ──────────────────────────────────────────
router.post('/adjust', async (req, res) => {
    const { currentPlan, reasons, targetWeeks } = req.body;

    if (!currentPlan || !reasons || !reasons.length) {
        return res.status(400).json({ success: false, message: '필수 파라미터가 없습니다. (currentPlan, reasons)' });
    }

    const reasonsText = buildReasonsText(reasons);

    const prompt =
        "당신은 전문 운동 트레이너입니다. 아래는 현재 사용자의 운동 플랜입니다.\n\n" +
        "【현재 운동 플랜】\n" + JSON.stringify(currentPlan) + "\n\n" +
        "- 목표 기간: " + targetWeeks + "주\n\n" +
        reasonsText + "\n\n" +
        "★ 위의 모든 재조정 이유를 반영하여 운동 플랜을 수정해주세요.\n" +
        "★ 집에서 할 수 있는 맨몸 운동 위주로 추천하세요.\n" +
        "★ 반드시 아래 JSON 형식으로만 답변하세요. 백틱(```)이나 다른 텍스트 없이 순수 JSON만 출력하세요.\n\n" +
        '{\n' +
        '  "warmup":   [{"name": "운동명", "duration": "5분", "calories": 30}],\n' +
        '  "main":     [{"name": "운동명", "sets": 3, "reps": 15, "calories": 80}],\n' +
        '  "cooldown": [{"name": "운동명", "duration": "5분", "calories": 20}],\n' +
        '  "total_duration": 45,\n' +
        '  "total_calories": 300,\n' +
        '  "tip": "재조정 관련 팁"\n' +
        '}';

    try {
        console.log(`  누적 재조정 이유 ${reasons.length}개:`);
        reasons.forEach((r, i) => console.log(`    ${i + 1}. ${r}`));
        console.log('  Gemini 요청 중...');
        const text = await callGemini(prompt);
        const data = parseGeminiJson(text);
        console.log(`  결과: 총 ${data.total_duration}분 / 소모 ${data.total_calories}kcal`);
        res.json({ success: true, data });
    } catch (err) {
        console.error('  [오류] 운동 재조정 실패:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
