const { Router }         = require('express');
const { callGemini }     = require('../config');
const { retrieveContext } = require('../services/ragService');

const router = Router();

// 식단 조정이 필요한 키워드
const MEAL_KEYWORDS = [
    '못 먹', '알레르기', '빼줘', '빼 줘', '제외', '싫어', '기피',
    '식단 바꿔', '메뉴 바꿔', '다른 음식', '냄새', '못먹', '안 먹',
    '식단 변경', '메뉴 변경', '음식 바꿔',
];

// 운동 조정이 필요한 키워드
const EXERCISE_KEYWORDS = [
    '부상', '다쳤', '아파', '못 해', '못해', '운동 바꿔', '운동 변경',
    '무릎', '허리', '어깨', '손목', '발목', '힘들어', '못 하겠',
];

/**
 * 메시지에서 action 감지 (키워드 기반)
 */
function detectAction(message, hasMealPlan, hasWorkoutPlan) {
    if (hasMealPlan    && MEAL_KEYWORDS.some(k => message.includes(k))) return 'meal_adjust';
    if (hasWorkoutPlan && EXERCISE_KEYWORDS.some(k => message.includes(k))) return 'exercise_adjust';
    return null;
}

/**
 * 텍스트에서 첫 번째 유효한 JSON 객체 추출
 */
function extractJson(text) {
    let depth = 0, start = -1;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '{') {
            if (depth === 0) start = i;
            depth++;
        } else if (text[i] === '}') {
            depth--;
            if (depth === 0 && start !== -1) {
                try { return JSON.parse(text.slice(start, i + 1)); } catch {}
                start = -1;
            }
        }
    }
    throw new Error('JSON 추출 실패');
}

// ──────────────────────────────────────────
// POST /api/chat — AI 채팅 상담 (gemini-2.5-flash)
// Body: { message, userInfo, mealPlan, workoutPlan, recentHistory }
// Response: { success, reply, action, reason }
// ──────────────────────────────────────────
function buildChatPrompt(message, userInfo, mealPlan, workoutPlan, recentHistory, ragContext) {
    let p = '당신은 한국어 전용 다이어트 코칭 AI입니다. 친절하고 전문적으로 3~5문장으로 답변하세요. 의학적 진단은 하지 않고, 심각한 건강 문제는 병원 방문을 권유하세요.\n\n';
    if (userInfo)      p += '사용자 정보: ' + userInfo + '\n';
    if (mealPlan)      p += '현재 식단 플랜: ' + JSON.stringify(mealPlan) + '\n';
    if (workoutPlan)   p += '현재 운동 플랜: ' + JSON.stringify(workoutPlan) + '\n';
    if (recentHistory) p += '최근 대화: ' + recentHistory + '\n';
    if (ragContext)    p += ragContext + '\n';
    p += '\n사용자: ' + message;
    return p;
}

router.post('/', async (req, res) => {
    const { message, userInfo, mealPlan, workoutPlan, recentHistory } = req.body;

    if (!message) {
        return res.status(400).json({ success: false, message: '메시지가 필요합니다.' });
    }

    const hasMealPlan    = !!mealPlan;
    const hasWorkoutPlan = !!workoutPlan;
    const ragContext     = retrieveContext(message);
    const prompt         = buildChatPrompt(message, userInfo, mealPlan, workoutPlan, recentHistory, ragContext);

    try {
        console.log(`  메시지: "${message}"`);
        if (ragContext) console.log(`  [RAG] ${ragContext.split('\n')[0]}`);
        console.log('  Gemini 요청 중...');

        const reply = await callGemini(prompt);

        const action = detectAction(message, hasMealPlan, hasWorkoutPlan);
        const reason = action ? message : null;

        console.log(`  응답: "${reply?.slice(0, 60)}..."`);
        if (action) console.log(`  액션 감지: ${action}`);
        res.json({ success: true, reply: reply.trim(), action, reason });

    } catch (err) {
        console.error('  [오류] 채팅 실패:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
