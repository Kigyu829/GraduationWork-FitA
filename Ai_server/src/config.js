const { GoogleGenerativeAI } = require('@google/generative-ai');

// ── 다중 API 키 로테이터 ─────────────────────────────────────
// .env에서 GEMINI_API_KEY=키1,키2,키3 형태로 여러 키 지원
// 429 쿼터 초과 시 자동으로 다음 키로 교체해서 재시도
const API_KEYS = (process.env.GEMINI_API_KEY || '')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);

let keyIndex = 0;

function getModel(modelName) {
    return new GoogleGenerativeAI(API_KEYS[keyIndex])
        .getGenerativeModel({ model: modelName });
}

function rotateKey() {
    if (API_KEYS.length <= 1) return false;
    keyIndex = (keyIndex + 1) % API_KEYS.length;
    console.warn(`  [키 교체] → 키 ${keyIndex + 1}/${API_KEYS.length}`);
    return true;
}

// Gemini 호출 공통 함수
// - 429 쿼터 초과: 다음 키로 교체 후 재시도 (키가 여러 개인 경우), 1개면 대기 후 재시도
// - 503 과부하:    5초 간격으로 최대 3회 재시도
async function callGemini(prompt, modelName = 'gemini-2.5-flash') {
    const start = Date.now();

    const attempt = async () => {
        const result = await getModel(modelName).generateContent(prompt);
        const text = result.response.text();
        console.log(`  Gemini 응답 완료 (${Date.now() - start}ms, ${text.length}자, 키 ${keyIndex + 1})`);
        return text;
    };

    try {
        return await attempt();
    } catch (err) {
        const is429 = err.message?.includes('429') || err.status === 429;
        const is503 = err.message?.includes('503') || err.status === 503;

        if (is429) {
            if (rotateKey()) {
                console.warn(`  [쿼터 초과] 다음 키로 즉시 재시도...`);
                return await attempt();
            }
            // 키가 1개뿐이면 대기 후 재시도
            const delayMatch = err.message?.match(/retry in (\d+)/i);
            const waitSec = delayMatch ? Math.min(parseInt(delayMatch[1]) + 2, 60) : 35;
            console.warn(`  [쿼터 초과] ${waitSec}초 후 재시도...`);
            await new Promise(r => setTimeout(r, waitSec * 1000));
            return await attempt();
        }

        if (is503) {
            for (let i = 1; i <= 3; i++) {
                console.warn(`  [503 과부하] ${i}/3 재시도 (5초 대기)...`);
                await new Promise(r => setTimeout(r, 5000));
                try {
                    return await attempt();
                } catch (retryErr) {
                    const stillErr = retryErr.message?.includes('503') || retryErr.status === 503;
                    if (!stillErr || i === 3) throw retryErr;
                }
            }
        }

        throw err;
    }
}

// GeminiTest와 동일한 150종 한국 음식 라벨
const FOOD_LABELS =
    "가지볶음, 간장게장, 갈비구이, 갈비찜, 갈비탕, 갈치구이, 갈치조림, 감자전, 감자조림, " +
    "감자채볶음, 감자탕, 갓김치, 건새우볶음, 경단, 계란국, 계란말이, 계란찜, 계란후라이, " +
    "고등어구이, 고등어조림, 고사리나물, 고추장진미채볶음, 고추튀김, 곰탕/설렁탕, 곱창구이, " +
    "곱창전골, 과메기, 김밥, 김치볶음밥, 김치전, 김치찌개, 김치찜, 깍두기, 깻잎장아찌, " +
    "꼬막찜, 꽁치조림, 꽈리고추무침, 꿀떡, 나박김치, 누룽지, 닭갈비, 닭계장, 닭볶음탕, " +
    "더덕구이, 도라지무침, 도토리묵, 동그랑땡, 동태찌개, 된장찌개, 두부김치, 두부조림, " +
    "땅콩조림, 떡갈비, 떡국/만두국, 떡꼬치, 떡볶이, 라면, 라볶이, 막국수, 만두, 매운탕, " +
    "멍게, 메추리알장조림, 멸치볶음, 무국, 무생채, 물냉면, 물회, 미역국, 미역줄기볶음, " +
    "배추김치, 백김치, 보쌈, 부추김치, 북엇국, 불고기, 비빔냉면, 비빔밥, 산낙지, 삼겹살, " +
    "삼계탕, 새우볶음밥, 새우튀김, 생선전, 소세지볶음, 송편, 수육, 수정과, 수제비, 숙주나물, " +
    "순대, 순두부찌개, 시금치나물, 시래기국, 식혜, 알밥, 애호박볶음, 약과, 약식, 양념게장, " +
    "양념치킨, 어묵볶음, 연근조림, 열무국수, 열무김치, 오이소박이, 오징어채볶음, 오징어튀김, " +
    "우엉조림, 유부초밥, 육개장, 육회, 잔치국수, 잡곡밥, 잡채, 장어구이, 장조림, 전복죽, " +
    "젓갈, 제육볶음, 조개구이, 조기구이, 족발, 주꾸미볶음, 주먹밥, 짜장면, 짬뽕, 쫄면, " +
    "찜닭, 총각김치, 추어탕, 칼국수, 코다리조림, 콩국수, 콩나물국, 콩나물무침, 콩자반, " +
    "파김치, 파전, 편육, 피자, 한과, 해물찜, 호박전, 호박죽, 홍어무침, 황태구이, 회무침, " +
    "후라이드치킨, 훈제오리";

// 누적 재조정 이유 텍스트 구성 헬퍼 (meal/adjust, exercise/adjust, plan/replan 공용)
function buildReasonsText(reasons) {
    let text = '';
    if (reasons.length > 1) {
        text += '【지금까지의 재조정 이유 - 아래 조건들을 모두 유지하면서 수정하세요】\n';
        for (let i = 0; i < reasons.length - 1; i++) {
            text += (i + 1) + '. ' + reasons[i] + '\n';
        }
        text += '\n';
    }
    text += '【이번 재조정 이유】\n' + reasons[reasons.length - 1];
    return text;
}

// Gemini 응답 JSON 파싱 헬퍼 (백틱 제거 + 실패 시 원문 로깅)
function parseGeminiJson(text) {
    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
        return JSON.parse(clean);
    } catch (err) {
        console.error('  [JSON 파싱 실패] Gemini 원문:\n', clean);
        throw err;
    }
}

module.exports = { callGemini, FOOD_LABELS, buildReasonsText, parseGeminiJson };
