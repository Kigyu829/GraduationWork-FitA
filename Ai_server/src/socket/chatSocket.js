/**
 * Socket.io 채팅 핸들러 (Ollama 스트리밍)
 *
 * 클라이언트 → 서버: 'chat_message'  { message, userInfo, mealPlan, workoutPlan, recentHistory }
 * 서버 → 클라이언트: 'chat_token'    token (string)  — 스트리밍 중
 *                    'chat_done'     { reply, action, reason }  — 완료
 *                    'chat_error'    errorMessage (string)
 *
 * 특징:
 *   - Ollama stream:true NDJSON 파싱
 *   - RAG 컨텍스트 프롬프트 주입
 *   - 서버 사이드 action 감지 (키워드 기반)
 */

const http                = require('http');
const { retrieveContext } = require('../services/ragService');

// ── 키워드 ────────────────────────────────────────────────
const MEAL_KEYWORDS = [
    '못 먹', '알레르기', '빼줘', '빼 줘', '제외', '싫어', '기피',
    '식단 바꿔', '메뉴 바꿔', '다른 음식', '냄새', '못먹', '안 먹',
    '식단 변경', '메뉴 변경', '음식 바꿔',
    '칼로리 줄여', '덜 먹', '더 먹', '식단 늘려', '식단 줄여',
    '칼로리 늘려', '식사 바꿔', '다른 메뉴',
];
const EXERCISE_KEYWORDS = [
    '부상', '다쳤', '아파', '못 해', '못해', '운동 바꿔', '운동 변경',
    '무릎', '허리', '어깨', '손목', '발목', '힘들어', '못 하겠',
    '늘리고', '늘려줘', '늘려 줘', '운동량', '강도 높여', '강도 올려',
    '더 하고싶', '더 하고 싶', '운동 추가', '추가해줘', '추가해 줘',
    '줄이고', '줄여줘', '줄여 줘', '강도 낮춰', '쉽게', '가볍게',
    '운동 바꿔', '다른 운동',
];

function detectAction(message, hasMealPlan, hasWorkoutPlan) {
    if (hasMealPlan    && MEAL_KEYWORDS.some(k => message.includes(k))) return 'meal_adjust';
    if (hasWorkoutPlan && EXERCISE_KEYWORDS.some(k => message.includes(k))) return 'exercise_adjust';
    return null;
}

// ── 중국어 포함 여부 확인 ────────────────────────────────────
function hasChinese(text) {
    return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
}

// ── 중국어 문자 제거 ─────────────────────────────────────────
function removeChinese(text) {
    return text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]+/g, '').replace(/\s{2,}/g, ' ').trim();
}

// ── 프롬프트 빌더 ─────────────────────────────────────────
function buildPrompt(message, userInfo, mealPlan, workoutPlan, recentHistory, ragContext) {
    let p = '';
    p += '당신은 한국어 전용 다이어트 코칭 AI입니다.\n';
    p += '【언어 규칙】 반드시 한국어로만 답변하세요. 중국어(汉字/漢字), 영어, 일본어는 절대 사용 금지입니다.\n\n';
    if (userInfo)      p += '사용자 정보: ' + userInfo + '\n\n';
    if (mealPlan)      p += '【현재 식단 플랜】\n' + JSON.stringify(mealPlan)    + '\n\n';
    if (workoutPlan)   p += '【현재 운동 플랜】\n' + JSON.stringify(workoutPlan) + '\n\n';
    if (recentHistory) p += '【최근 대화 기록】\n' + recentHistory + '\n\n';
    if (ragContext)    p += ragContext + '\n\n';
    p += '사용자 질문: ' + message + '\n\n';
    p += '위의 정보를 참고하여 친절하고 전문적으로 답변하세요.\n';
    p += '의학적 진단은 하지 않고, 심각한 건강 문제는 병원 방문을 권유하세요.\n';
    p += '답변은 3~5문장으로 간결하게 작성하세요. JSON 없이 자연스러운 한국어 문장만 사용하세요.\n\n';
    p += '한국어 답변:';
    return p;
}

// ── Ollama 스트리밍 호출 ───────────────────────────────────
function streamOllama(prompt, model, { onToken, onDone, onError }) {
    const body    = JSON.stringify({ model, prompt, stream: true });
    const options = {
        hostname: 'localhost',
        port:     11434,
        path:     '/api/generate',
        method:   'POST',
        headers: {
            'Content-Type':   'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    };

    const req = http.request(options, (res) => {
        let fullReply = '';
        let buffer    = '';

        res.on('data', (chunk) => {
            buffer += chunk.toString();
            // NDJSON: 줄 단위로 파싱
            const lines = buffer.split('\n');
            buffer = lines.pop(); // 마지막 불완전한 줄 보류

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const obj = JSON.parse(line);
                    if (obj.response) {
                        fullReply += obj.response;
                        onToken(obj.response);
                    }
                    if (obj.done) onDone(fullReply);
                } catch { /* 파싱 실패 무시 */ }
            }
        });

        res.on('end', () => {
            // 남은 버퍼 처리
            if (buffer.trim()) {
                try {
                    const obj = JSON.parse(buffer);
                    if (obj.response) { fullReply += obj.response; onToken(obj.response); }
                    if (obj.done || !obj.response) onDone(fullReply);
                } catch { onDone(fullReply); }
            }
        });
    });

    req.on('error', (err) => onError(new Error('Ollama 연결 실패: ' + err.message)));
    req.setTimeout(120000, () => {
        req.destroy();
        onError(new Error('Ollama 스트리밍 타임아웃'));
    });
    req.write(body);
    req.end();
}

// ── Socket.io 핸들러 등록 ──────────────────────────────────
module.exports = function registerChatSocket(io) {
    const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:14b';

    io.on('connection', (socket) => {
        console.log(`[Socket] 연결: ${socket.id}`);

        socket.on('chat_message', (data) => {
            const { message, userInfo, mealPlan, workoutPlan, recentHistory } = data || {};
            if (!message) return;

            const hasMealPlan    = !!mealPlan;
            const hasWorkoutPlan = !!workoutPlan;

            // RAG 컨텍스트 주입
            const ragContext = retrieveContext(message);
            const prompt     = buildPrompt(message, userInfo, mealPlan, workoutPlan, recentHistory, ragContext);

            console.log(`[Socket] 메시지: "${message}"`);
            if (ragContext) console.log(`  [RAG] ${ragContext.split('\n')[0]}`);
            console.log(`  Ollama 스트리밍 시작 (${MODEL})...`);

            let fullReply = '';

            streamOllama(prompt, MODEL, {
                onToken: (token) => {
                    fullReply += token;
                    socket.emit('chat_token', token);
                },
                onDone: (reply) => {
                    const action = detectAction(message, hasMealPlan, hasWorkoutPlan);
                    const reason = action ? message : null;
                    let finalReply = reply || fullReply;
                    if (hasChinese(finalReply)) {
                        console.warn('[Socket] 중국어 감지 → 제거 후 전송');
                        finalReply = removeChinese(finalReply);
                    }
                    console.log(`[Socket] 완료 (${finalReply.length}자). action: ${action}`);
                    socket.emit('chat_done', { reply: finalReply, action, reason });
                },
                onError: (err) => {
                    console.error('[Socket] 오류:', err.message);
                    socket.emit('chat_error', err.message);
                },
            });
        });

        socket.on('disconnect', () => {
            console.log(`[Socket] 연결 해제: ${socket.id}`);
        });
    });
};
