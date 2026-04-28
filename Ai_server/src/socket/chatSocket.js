/**
 * Socket.io 채팅 핸들러 (Gemini 2.0 Flash 스트리밍)
 *
 * 클라이언트 → 서버: 'chat_message'  { message, userInfo, mealPlan, workoutPlan, recentHistory }
 * 서버 → 클라이언트: 'chat_token'    token (string)  — 스트리밍 중
 *                    'chat_done'     { reply, action, reason }  — 완료
 *                    'chat_error'    errorMessage (string)
 */

'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { retrieveContext }    = require('../services/ragService');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── 시스템 프롬프트 빌더 ───────────────────────────────────────
function buildSystemInstruction(userInfo, mealPlan, workoutPlan) {
    let sys = '당신은 한국어 전용 다이어트 코칭 AI입니다.\n';
    sys += '친절하고 전문적으로 3~5문장으로 답변하세요.\n';
    sys += '의학적 진단은 하지 않고, 심각한 건강 문제는 병원 방문을 권유하세요.\n';
    sys += 'JSON이나 마크다운 없이 자연스러운 한국어 문장만 사용하세요.\n';
    if (userInfo)    sys += `\n사용자 정보: ${userInfo}`;
    if (mealPlan)    sys += `\n현재 식단 플랜: ${JSON.stringify(mealPlan)}`;
    if (workoutPlan) sys += `\n현재 운동 플랜: ${JSON.stringify(workoutPlan)}`;
    return sys;
}

// ── 대화 이력 파싱 (sc311.js가 넘기는 "사용자: ...\nAI: ..." 형식) ─
function parseHistory(recentHistory) {
    if (!recentHistory) return [];
    const history = [];
    const lines   = recentHistory.split('\n').filter(Boolean);
    for (const line of lines) {
        if (line.startsWith('사용자: ')) {
            history.push({ role: 'user',  parts: [{ text: line.slice(4) }] });
        } else if (line.startsWith('AI: ')) {
            history.push({ role: 'model', parts: [{ text: line.slice(4) }] });
        }
    }
    // Gemini는 history가 user → model 교차여야 함. 홀수면 마지막 user 제거
    if (history.length > 0 && history[history.length - 1].role === 'user') {
        history.pop();
    }
    return history;
}

// ── action 감지 (빠른 단일 호출) ─────────────────────────────
async function detectAction(message, hasMealPlan, hasWorkoutPlan) {
    if (!hasMealPlan && !hasWorkoutPlan) return null;

    const available = [
        hasMealPlan    ? 'meal_adjust(식단 변경)'    : '',
        hasWorkoutPlan ? 'exercise_adjust(운동 변경)' : '',
    ].filter(Boolean).join(', ');

    const prompt =
        `사용자 메시지: "${message}"\n\n` +
        `사용 가능한 플랜: ${available}\n\n` +
        '사용자가 플랜 변경/조정을 명확히 원하면 해당 값을 반환하세요.\n' +
        '단순 격려 요청·정보 질문·일상 대화는 null을 반환하세요.\n\n' +
        '응답 형식 (JSON만, 다른 텍스트 없이):\n' +
        '{"action": "meal_adjust" | "exercise_adjust" | null}';

    try {
        const model  = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
        const result = await model.generateContent(prompt);
        const text   = result.response.text().trim();
        const match  = text.match(/\{[\s\S]*?\}/);
        if (match) {
            const parsed = JSON.parse(match[0]);
            return parsed.action || null;
        }
    } catch (e) {
        console.warn('[Action 감지 실패]', e.message);
    }
    return null;
}

// ── Socket.io 핸들러 등록 ──────────────────────────────────
module.exports = function registerChatSocket(io) {
    io.on('connection', (socket) => {
        console.log(`[Socket] 연결: ${socket.id}`);

        socket.on('chat_message', async (data) => {
            const { message, userInfo, mealPlan, workoutPlan, recentHistory } = data || {};
            if (!message) return;

            const hasMealPlan    = !!mealPlan;
            const hasWorkoutPlan = !!workoutPlan;

            const ragContext = retrieveContext(message);
            let userMessage  = message;
            if (ragContext) {
                userMessage += `\n\n[참고 정보]\n${ragContext}`;
                console.log(`  [RAG] ${ragContext.split('\n')[0]}`);
            }

            console.log(`[Socket] 메시지: "${message}"`);
            console.log('  Gemini 스트리밍 시작...');

            try {
                const model = genAI.getGenerativeModel({
                    model:             'gemini-2.0-flash-lite',
                    systemInstruction: buildSystemInstruction(userInfo, mealPlan, workoutPlan),
                });

                const chat   = model.startChat({ history: parseHistory(recentHistory) });
                const result = await chat.sendMessageStream(userMessage);

                let fullReply = '';
                for await (const chunk of result.stream) {
                    const token = chunk.text();
                    if (token) {
                        fullReply += token;
                        socket.emit('chat_token', token);
                    }
                }

                // 스트리밍 완료 후 action 감지
                const action = await detectAction(message, hasMealPlan, hasWorkoutPlan);
                const reason = action ? message : null;

                console.log(`[Socket] 완료 (${fullReply.length}자). action: ${action}`);
                socket.emit('chat_done', { reply: fullReply, action, reason });

            } catch (err) {
                console.error('[Socket] Gemini 오류:', err.message);
                // 429 quota 초과 시 시연용 fallback
                if (err.message && err.message.includes('429')) {
                    const fallback = 'AI 서버가 잠시 과부하 상태입니다. 식단과 운동 플랜은 정상적으로 제공되고 있으니, 잠시 후 다시 말씀해 주세요! 💪';
                    socket.emit('chat_token', fallback);
                    socket.emit('chat_done', { reply: fallback, action: null, reason: null });
                } else {
                    socket.emit('chat_error', err.message);
                }
            }
        });

        socket.on('disconnect', () => {
            console.log(`[Socket] 연결 해제: ${socket.id}`);
        });
    });
};
