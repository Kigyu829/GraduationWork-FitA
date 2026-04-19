const { Router }         = require('express');
const { callOllama }     = require('../config');
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
// POST /api/chat — AI 채팅 상담 (Ollama + RAG)
// Body: { message, userInfo, mealPlan, workoutPlan, recentHistory }
// Response: { success, reply, action, reason }
// ──────────────────────────────────────────
// 중국어 포함 여부 확인
function hasChinese(text) {
    return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
}

function buildChatPrompt(message, userInfo, mealPlan, workoutPlan, recentHistory, ragContext) {
    let p = '';
    p += '당신은 한국어 전용 다이어트 코칭 AI입니다.\n';
    p += '【언어 규칙】 반드시 한국어로만 답변하세요. 중국어(汉字/漢字), 영어, 일본어는 절대 사용 금지입니다.\n\n';
    if (userInfo)      p += '사용자 정보: ' + userInfo + '\n\n';
    if (mealPlan)      p += '【현재 식단 플랜】\n' + JSON.stringify(mealPlan) + '\n\n';
    if (workoutPlan)   p += '【현재 운동 플랜】\n' + JSON.stringify(workoutPlan) + '\n\n';
    if (recentHistory) p += '【최근 대화 기록】\n' + recentHistory + '\n\n';
    if (ragContext)    p += ragContext + '\n\n';
    p += '사용자 질문: ' + message + '\n\n';
    p += '위의 정보를 참고하여 친절하고 전문적으로 답변하세요.\n';
    p += '의학적 진단은 하지 않고, 심각한 건강 문제는 병원 방문을 권유하세요.\n';
    p += '답변은 3~5문장으로 간결하게 작성하세요.\n\n';
    p += '【출력 형식】 백틱이나 설명 없이 순수 JSON 하나만 출력하세요.\n';
    p += '{"reply": "한국어로 3~5문장 답변"}';
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
        console.log('  Ollama 요청 중...');

        let text = await callOllama(prompt);

        // 중국어 감지 시 1회 재시도
        if (hasChinese(text)) {
            console.warn('  [경고] 중국어 감지 → 재시도');
            const retryPrompt = prompt + '\n\n[이전 답변에 중국어가 포함되었습니다. 반드시 한국어로만 다시 작성하세요.]';
            text = await callOllama(retryPrompt);
        }

        let reply;
        try {
            const parsed = extractJson(text);
            reply = parsed.reply || text.trim();
        } catch {
            reply = text.trim();
        }

        const action = detectAction(message, hasMealPlan, hasWorkoutPlan);
        const reason = action ? message : null;

        console.log(`  응답: "${reply?.slice(0, 60)}..."`);
        if (action) console.log(`  액션 감지: ${action}`);
        res.json({ success: true, reply, action, reason });

    } catch (err) {
        console.error('  [오류] 채팅 실패:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
