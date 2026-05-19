/**
 * Socket.io 채팅 핸들러 (Gemini 스트리밍)
 *
 * 클라이언트 → 서버: 'chat_message'  { message, userInfo, mealPlan, workoutPlan, recentHistory }
 * 서버 → 클라이언트: 'chat_token'    token (string)  — 스트리밍 중
 *                    'chat_done'     { reply, action, reason }  — 완료
 *                    'chat_error'    errorMessage (string)
 *
 * [다중 키 로테이션]
 * .env에 GEMINI_API_KEY=키1,키2,키3 형태로 여러 키를 쉼표로 나열 가능.
 * 429 쿼터 초과 시 자동으로 다음 키로 교체해서 재시도.
 *
 * [API 호출 절감]
 * detectAction 별도 호출 제거 → 시스템 프롬프트에 action 판단 포함,
 * 스트리밍 응답에서 직접 파싱 → 메시지당 호출 1회로 감소.
 */

'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { retrieveContext }    = require('../services/ragService');

// ── 다중 API 키 로테이터 ───────────────────────────────────────
const API_KEYS = (process.env.GEMINI_API_KEY || '')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);

if (API_KEYS.length === 0) {
    console.error('[ChatSocket] GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');
}

let keyIndex = 0;

function getGenAI() {
    return new GoogleGenerativeAI(API_KEYS[keyIndex]);
}

function rotateKey() {
    if (API_KEYS.length <= 1) return false;
    keyIndex = (keyIndex + 1) % API_KEYS.length;
    console.warn(`[ChatSocket] API 키 교체 → 키 ${keyIndex + 1}/${API_KEYS.length}`);
    return true;
}

// ── 시스템 프롬프트 빌더 ───────────────────────────────────────
// action 감지를 메인 응답에 포함시켜 별도 API 호출 제거
function buildSystemInstruction(userInfo, mealPlan, workoutPlan, hasMealPlan, hasWorkoutPlan) {
    let sys = '당신은 한국어 전용 다이어트 코칭 AI입니다.\n';
    sys += '친절하고 전문적으로 3~5문장으로 답변하세요.\n';
    sys += '의학적 진단은 하지 않고, 심각한 건강 문제는 병원 방문을 권유하세요.\n';
    if (userInfo)    sys += `\n사용자 정보: ${userInfo}`;
    if (mealPlan)    sys += `\n현재 식단 플랜: ${JSON.stringify(mealPlan)}`;
    if (workoutPlan) sys += `\n현재 운동 플랜: ${JSON.stringify(workoutPlan)}`;

    if (hasMealPlan || hasWorkoutPlan) {
        const available = [
            hasMealPlan    ? 'meal_adjust'    : '',
            hasWorkoutPlan ? 'exercise_adjust' : '',
        ].filter(Boolean).join(' | ');
        sys += `\n\n[플랜 변경 감지 규칙]\n`;
        sys += `사용자가 식단이나 운동 플랜 변경을 명확히 요청하면 답변 맨 끝에 다음 한 줄을 추가하세요:\n`;
        sys += `ACTION:${available}\n`;
        sys += `단순 질문·격려 요청·일상 대화에는 ACTION 줄을 붙이지 마세요.`;
    }

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
    if (history.length > 0 && history[history.length - 1].role === 'user') {
        history.pop();
    }
    return history;
}

// ── 스트리밍 응답에서 ACTION 추출 ────────────────────────────
function extractAction(fullReply) {
    const match = fullReply.match(/ACTION:(meal_adjust|exercise_adjust)/);
    if (match) return match[1];
    return null;
}

function stripAction(fullReply) {
    return fullReply.replace(/\nACTION:(meal_adjust|exercise_adjust)\s*$/, '').trim();
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

            console.log(`[Socket] 메시지: "${message}" (키 ${keyIndex + 1}/${API_KEYS.length})`);

            const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash';
            const tryChat = async () => {
                const model = getGenAI().getGenerativeModel({
                    model:             CHAT_MODEL,
                    systemInstruction: buildSystemInstruction(
                        userInfo, mealPlan, workoutPlan, hasMealPlan, hasWorkoutPlan
                    ),
                });

                const chat   = model.startChat({ history: parseHistory(recentHistory) });
                const result = await chat.sendMessageStream(userMessage);

                let fullReply = '';
                for await (const chunk of result.stream) {
                    const token = chunk.text();
                    if (token) {
                        fullReply += token;
                        // ACTION 줄은 클라이언트에 스트리밍하지 않음
                        if (!fullReply.trimEnd().endsWith('ACTION:meal_adjust') &&
                            !fullReply.trimEnd().endsWith('ACTION:exercise_adjust')) {
                            socket.emit('chat_token', token);
                        }
                    }
                }

                return fullReply;
            };

            try {
                let fullReply;
                try {
                    fullReply = await tryChat();
                } catch (err) {
                    const is429 = err.message?.includes('429') || err.status === 429;
                    if (is429 && rotateKey()) {
                        console.warn('[Socket] 429 → 다음 키로 재시도');
                        fullReply = await tryChat();
                    } else {
                        throw err;
                    }
                }

                const action     = extractAction(fullReply);
                const cleanReply = stripAction(fullReply);
                const reason     = action ? message : null;

                console.log(`[Socket] 완료 (${cleanReply.length}자). action: ${action}`);
                socket.emit('chat_done', { reply: cleanReply, action, reason });

            } catch (err) {
                console.error('[Socket] Gemini 오류:', err.message);
                if (err.message?.includes('429')) {
                    const fallback = '현재 AI 상담 서버가 잠시 과부하 상태예요. 식단/운동 플랜은 정상 제공 중이니 잠시 후 다시 시도해 주세요! 💪';
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
