'use strict';
/**
 * Gemini 기반 조정 의도 추출
 *
 * parseReasons() 키워드 매칭을 대체.
 * 부정문("무릎은 괜찮아요"), 문맥("알레르기는 없지만 싫어")도 정확히 처리.
 * Gemini 호출 실패 시 빈 배열 반환 → 기존 플랜 유지 (안전한 폴백).
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * 식단 조정 의도 추출
 * @param {string[]} reasons   사용자 피드백 배열
 * @param {string[]} foodNames 현재 DB 음식명 전체 목록
 * @returns {{ excluded: string[], preferred: string[] }}
 */
async function extractMealIntent(reasons, foodNames) {
    const model  = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
    const prompt =
        `사용자 피드백: ${reasons.map(r => `"${r}"`).join(', ')}\n\n` +
        `사용 가능한 음식 목록:\n${foodNames.join(', ')}\n\n` +
        `위 피드백을 분석해 사용자가 원하는 식단 조정을 파악하세요.\n` +
        `- 제외: 알레르기·기피·싫은 음식\n` +
        `- 선호: 더 먹고 싶거나 선호하는 음식\n` +
        `반드시 위 음식 목록에 있는 이름만 사용하세요. 없으면 빈 배열.\n\n` +
        `응답 형식 (JSON만, 다른 텍스트 없이):\n` +
        `{"excluded": ["음식명"], "preferred": ["음식명"]}`;

    try {
        const result = await model.generateContent(prompt);
        const text   = result.response.text().trim();
        const match  = text.match(/\{[\s\S]*?\}/);
        if (!match) throw new Error('JSON 없음');

        const parsed   = JSON.parse(match[0]);
        const validSet = new Set(foodNames);
        return {
            excluded:  (parsed.excluded  || []).filter(n => validSet.has(n)),
            preferred: (parsed.preferred || []).filter(n => validSet.has(n)),
        };
    } catch (e) {
        console.warn('[geminiExtract] 식단 의도 추출 실패 → 빈 배열 폴백:', e.message);
        return { excluded: [], preferred: [] };
    }
}

/**
 * 운동 조정 의도 추출
 * @param {string[]} reasons       사용자 피드백 배열
 * @param {string[]} exerciseNames 현재 DB 운동명 전체 목록
 * @returns {{ excluded: string[], preferred: string[], intensityDelta: -1|0|1 }}
 */
async function extractExerciseIntent(reasons, exerciseNames) {
    const model  = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
    const prompt =
        `사용자 피드백: ${reasons.map(r => `"${r}"`).join(', ')}\n\n` +
        `사용 가능한 운동 목록:\n${exerciseNames.join(', ')}\n\n` +
        `위 피드백을 분석해 파악하세요:\n` +
        `1. excluded: 부상·통증·싫은 운동 (반드시 목록에 있는 이름만)\n` +
        `2. preferred: 더 하고 싶은 운동 (반드시 목록에 있는 이름만)\n` +
        `3. intensityDelta: 강도를 높여야 하면 1, 낮춰야 하면 -1, 유지면 0\n` +
        `없으면 빈 배열 또는 0.\n\n` +
        `응답 형식 (JSON만):\n` +
        `{"excluded": ["운동명"], "preferred": ["운동명"], "intensityDelta": 0}`;

    try {
        const result = await model.generateContent(prompt);
        const text   = result.response.text().trim();
        const match  = text.match(/\{[\s\S]*?\}/);
        if (!match) throw new Error('JSON 없음');

        const parsed   = JSON.parse(match[0]);
        const validSet = new Set(exerciseNames);
        const delta    = Math.sign(Number(parsed.intensityDelta) || 0);
        return {
            excluded:       (parsed.excluded  || []).filter(n => validSet.has(n)),
            preferred:      (parsed.preferred || []).filter(n => validSet.has(n)),
            intensityDelta: delta,
        };
    } catch (e) {
        console.warn('[geminiExtract] 운동 의도 추출 실패 → 기본값 폴백:', e.message);
        return { excluded: [], preferred: [], intensityDelta: 0 };
    }
}

module.exports = { extractMealIntent, extractExerciseIntent };
