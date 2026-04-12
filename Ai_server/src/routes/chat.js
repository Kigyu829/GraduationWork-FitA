const { Router } = require('express');
const { callOllama } = require('../config');

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
 * - Ollama가 action을 null로 반환해도 서버에서 보완
 */
function detectAction(message, hasMealPlan, hasWorkoutPlan) {
    if (hasMealPlan && MEAL_KEYWORDS.some(k => message.includes(k))) {
        return 'meal_adjust';
    }
    if (hasWorkoutPlan && EXERCISE_KEYWORDS.some(k => message.includes(k))) {
        return 'exercise_adjust';
    }
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
// POST /api/chat — AI 채팅 상담 (Ollama)
// Body: { message, userInfo, mealPlan, workoutPlan, recentHistory }
// Response: { success, reply, action, reason }
// ──────────────────────────────────────────
router.post('/', async (req, res) => {
    const { message, userInfo, mealPlan, workoutPlan, recentHistory } = req.body;

    if (!message) {
        return res.status(400).json({ success: false, message: '메시지가 필요합니다.' });
    }

    const hasMealPlan    = !!mealPlan;
    const hasWorkoutPlan = !!workoutPlan;

    let prompt = '';
    prompt += '당신은 한국어로만 대화하는 친절한 다이어트 코칭 AI입니다.\n';
    prompt += '★ 반드시 한국어로만 답변하세요. 영어나 중국어는 절대 사용하지 마세요.\n\n';
    if (userInfo)      prompt += '사용자 정보: ' + userInfo + '\n\n';
    if (mealPlan)      prompt += '【현재 식단 플랜】\n' + JSON.stringify(mealPlan) + '\n\n';
    if (workoutPlan)   prompt += '【현재 운동 플랜】\n' + JSON.stringify(workoutPlan) + '\n\n';
    if (recentHistory) prompt += '【최근 대화 기록】\n' + recentHistory + '\n\n';
    prompt += '사용자: ' + message + '\n\n';
    prompt += '위의 사용자 정보와 현재 플랜을 참고하여 친절하고 전문적으로 답변하세요.\n';
    prompt += '의학적 진단은 하지 않고, 심각한 건강 문제는 병원 방문을 권유하세요.\n';
    prompt += '답변은 3~5문장으로 간결하게 작성하세요.\n\n';
    prompt += '★ 아래 JSON 형식으로만 출력하세요. 백틱(```)이나 설명 텍스트 없이 순수 JSON 하나만 출력하세요.\n';
    prompt +=
        '{\n' +
        '  "reply": "한국어로 3~5문장 답변"\n' +
        '}';

    try {
        console.log(`  메시지: "${message}"`);
        if (mealPlan)      console.log('  식단 플랜: 있음');
        if (workoutPlan)   console.log('  운동 플랜: 있음');
        if (recentHistory) console.log(`  대화 기록: ${recentHistory.split('\n').length}줄`);
        console.log('  Ollama 요청 중...');

        const text = await callOllama(prompt);

        // reply 추출: JSON 파싱 → 실패 시 원문 사용
        let reply;
        try {
            const parsed = extractJson(text);
            reply = parsed.reply || text.trim();
        } catch {
            reply = text.trim();
        }

        // action/reason: 키워드 기반 서버 감지 (Ollama에 맡기지 않음)
        const action = detectAction(message, hasMealPlan, hasWorkoutPlan);
        const reason = action ? message : null;

        console.log(`  응답: "${reply?.slice(0, 60)}..."`);
        if (action) console.log(`  액션 감지: ${action} / 이유: "${reason}"`);
        res.json({ success: true, reply, action, reason });

    } catch (err) {
        console.error('  [오류] 채팅 실패:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
