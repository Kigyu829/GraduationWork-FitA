/**
 * RAG (Retrieval-Augmented Generation) 서비스
 * 사용자 메시지에서 키워드를 추출해 관련 DB 문서를 검색,
 * Ollama 프롬프트에 주입할 컨텍스트 문자열을 반환합니다.
 *
 * 검색 대상:
 *   1. 음식 이름 직접 매칭 → foodDb 칼로리/분류 정보
 *   2. 운동 이름 직접 매칭 → exerciseDb 세트/소모칼로리 정보
 *   3. 영양소/건강 키워드 → 사전 정의된 지식 베이스
 */

const { FOODS }                  = require('../data/foodDb');
const { WARMUP, MAIN, COOLDOWN } = require('../data/exerciseDb');

// 모든 운동 목록 (워밍업 + 메인 + 쿨다운)
const ALL_EXERCISES = [
    ...WARMUP,
    ...MAIN.low, ...MAIN.medium, ...MAIN.high,
    ...COOLDOWN,
];

// ── 영양/건강 지식 베이스 ─────────────────────────────────
const HEALTH_KB = {
    '단백질':   '단백질 권장량은 체중 1kg당 1.2~1.6g. 닭가슴살·계란·두부·생선에 풍부. 근육 유지에 필수.',
    '칼로리':   '체중 감량 시 하루 500kcal 적자 권장. 1kg 지방 ≈ 7,700kcal. BMR × 활동계수 = TDEE.',
    '탄수화물': '다이어트 시 총 칼로리의 40~50% 권장. 잡곡밥·고구마 등 복합 탄수화물이 혈당 안정에 유리.',
    '지방':     '총 칼로리의 20~30% 권장. 생선·올리브유 등 불포화지방산 위주 섭취.',
    'BMI':      'BMI 기준: 저체중<18.5, 정상 18.5~22.9, 과체중 23~24.9, 비만≥25 (한국인 기준).',
    '수분':     '하루 2L 이상 권장. 운동 전후 충분한 수분 보충 필요. 포만감 유지에도 도움.',
    '식이섬유': '채소·과일·잡곡에 풍부. 혈당 급상승 억제, 포만감 증가, 장 건강에 도움.',
    '기초대사량': '성인 남성 BMR ≈ 1,500~1,800kcal, 여성 ≈ 1,200~1,500kcal. 근육량이 많을수록 높아짐.',
    '식단':     '다이어트 식단: 아침 25%, 점심 40%, 저녁 35% 칼로리 배분 권장. 야식은 삼가세요.',
    '운동':     '유산소+근력 복합 운동이 체중 감량 효율 최대. 주 3~5회, 회당 30~60분 권장.',
    '수면':     '수면 부족 시 식욕 호르몬(그렐린) 증가. 하루 7~8시간 수면이 다이어트에 도움.',
    '스트레스': '만성 스트레스는 코르티솔 분비 → 복부 지방 증가. 규칙적 운동·충분한 수면이 스트레스 완화에 도움.',
};

// ── 음식 문서 검색 ─────────────────────────────────────────
function retrieveFoodDocs(message) {
    const matched = FOODS.filter(f => message.includes(f.name));
    if (matched.length === 0) return null;

    const typeLabel = { main: '주식', soup: '국/찌개', side: '반찬', drink: '음료' };
    const lines = matched
        .slice(0, 8) // 최대 8개
        .map(f => `  • ${f.name}: ${f.kcal}kcal (${typeLabel[f.type] || f.type})`);
    return '【관련 음식 정보】\n' + lines.join('\n');
}

// ── 운동 문서 검색 ─────────────────────────────────────────
function retrieveExerciseDocs(message) {
    const matched = ALL_EXERCISES.filter(e => message.includes(e.name));
    if (matched.length === 0) return null;

    const lines = matched
        .slice(0, 6) // 최대 6개
        .map(e =>
            e.sets
                ? `  • ${e.name}: ${e.sets}세트×${e.reps}회, 소모 ${e.calories}kcal`
                : `  • ${e.name}: ${e.duration}분, 소모 ${e.calories}kcal`
        );
    return '【관련 운동 정보】\n' + lines.join('\n');
}

// ── 건강 지식 검색 ─────────────────────────────────────────
function retrieveHealthDocs(message) {
    const lines = Object.entries(HEALTH_KB)
        .filter(([kw]) => message.includes(kw))
        .map(([, info]) => `  • ${info}`);
    if (lines.length === 0) return null;
    return '【건강/영양 정보】\n' + lines.join('\n');
}

// ── 통합 검색 ─────────────────────────────────────────────
/**
 * 메시지에서 관련 컨텍스트를 검색하여 문자열로 반환.
 * 검색 결과가 없으면 null 반환.
 */
function retrieveContext(message) {
    const parts = [
        retrieveFoodDocs(message),
        retrieveExerciseDocs(message),
        retrieveHealthDocs(message),
    ].filter(Boolean);

    if (parts.length === 0) return null;
    return parts.join('\n\n');
}

module.exports = { retrieveContext };
