const { Router } = require('express');
const { callGemini, parseGeminiJson } = require('../config');

const router = Router();

// ──────────────────────────────────────────
// POST /api/chat — AI 채팅 상담
// Body: { message, userInfo, mealPlan, workoutPlan, recentHistory }
//   userInfo: "성별 남성, 키 175cm ..." (문자열)
//   mealPlan: 현재 식단 플랜 객체 (없으면 null)
//   workoutPlan: 현재 운동 플랜 객체 (없으면 null)
//   recentHistory: "사용자: ...\nAI: ..." (문자열, 없으면 "")
// Response: { success, reply, action, reason }
// ──────────────────────────────────────────
router.post('/', async (req, res) => {
    const { message, userInfo, mealPlan, workoutPlan, recentHistory } = req.body;

    if (!message) {
        return res.status(400).json({ success: false, message: '메시지가 필요합니다.' });
    }

    const hasMealPlan    = !!mealPlan;
    const hasWorkoutPlan = !!workoutPlan;

    let prompt = "당신은 친절한 다이어트 코칭 AI입니다.\n";
    if (userInfo)      prompt += "사용자 정보: " + userInfo + "\n\n";
    if (mealPlan)      prompt += "【현재 식단 플랜】\n" + JSON.stringify(mealPlan) + "\n\n";
    if (workoutPlan)   prompt += "【현재 운동 플랜】\n" + JSON.stringify(workoutPlan) + "\n\n";
    if (recentHistory) prompt += "【최근 대화 기록】\n" + recentHistory + "\n\n";
    prompt += "사용자: " + message + "\n\n";
    prompt += "위의 사용자 정보와 현재 플랜을 참고하여 친절하고 전문적으로 답변하세요.\n";
    prompt += "의학적 진단은 하지 않고, 심각한 건강 문제는 병원 방문을 권유하세요.\n";
    prompt += "답변은 3~5문장으로 간결하게 하세요.\n\n";
    prompt += "★ 반드시 아래 JSON 형식으로만 답변하세요. 백틱(```)이나 다른 텍스트 없이 순수 JSON만 출력하세요.\n";
    if (hasMealPlan || hasWorkoutPlan) {
        prompt += "action 판단 기준 (플랜이 등록된 경우에만 적용):\n";
        prompt += '  - 음식 알레르기/기피, 특정 재료 제외, 식단 변경 요청 → "meal_adjust"\n';
        prompt += '  - 부상, 특정 운동 불가, 운동 강도/종류 변경 요청 → "exercise_adjust"\n';
        prompt += '  - 단순 질문, 정보 요청, 격려, 잡담 → null\n';
    }
    prompt +=
        '{\n' +
        '  "reply": "3~5문장 답변",\n' +
        '  "action": null,\n' +
        '  "reason": null\n' +
        '}';

    try {
        console.log(`  메시지: "${message}"`);
        if (mealPlan)      console.log('  식단 플랜: 있음');
        if (workoutPlan)   console.log('  운동 플랜: 있음');
        if (recentHistory) console.log(`  대화 기록: ${recentHistory.split('\n').length}줄`);
        console.log('  Gemini 요청 중...');
        const text = await callGemini(prompt);
        const parsed = parseGeminiJson(text);
        console.log(`  응답: "${parsed.reply?.slice(0, 60)}..."`);
        if (parsed.action) console.log(`  액션 감지: ${parsed.action} / 이유: "${parsed.reason}"`);
        res.json({ success: true, reply: parsed.reply, action: parsed.action || null, reason: parsed.reason || null });
    } catch (err) {
        console.error('  [오류] 채팅 실패:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
