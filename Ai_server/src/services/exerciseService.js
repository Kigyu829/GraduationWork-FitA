/**
 * 운동 추천 서비스 (규칙 기반 + 감성 점수 재조정)
 *
 * 강도 결정: BMI + targetWeeks + activityLevel 기반
 *   1단계) BMI/targetWeeks로 기본 강도 결정:
 *     low:    BMI < 25 이고 targetWeeks > 6
 *     high:   BMI >= 30 이거나 targetWeeks <= 3
 *     medium: 그 외
 *   2단계) activityLevel로 보정:
 *     낮음       → -1 (기본 강도보다 한 단계 낮춤: 초보자 배려)
 *     보통/높음   → ±0 (변화 없음)
 *     매우높음/선수 → +1 (한 단계 높임: 이미 적응된 몸)
 *
 * 재조정 알고리즘 (감성 점수 기반):
 *   긍정 단어(+) / 부정 단어(-) 합산 → 부위/운동 키워드 점수 결정
 *   score > 0 → preferred  (해당 운동 우선 배치)
 *   score < 0 → excluded   (해당 운동 풀에서 제거)
 *   score = 0 → neutral    (기본 랜덤)
 */

const { WARMUP, MAIN, COOLDOWN, EXERCISE_TIPS } = require('../data/exerciseDb');
const { extractExerciseIntent } = require('./geminiExtract');

// 부위 키워드 → 관련 운동 목록
const BODY_PART_MAP = {
    '무릎':  ['스쿼트', '런지', '점프 스쿼트', '파워 런지', '사이드 런지', '스텝업',
              '리버스 런지', '레터럴 런지', '박스 스쿼트', '와이드 스쿼트', '월 싯', '플라이오 런지', '점프 런지'],
    '허리':  ['버피', '마운틴 클라이머', '버피 (변형)', '크로스 크런치', '복부 크런치',
              '슈퍼맨', '인치웜', '버피 점프'],
    '어깨':  ['팔굽혀펴기', '팔굽혀펴기 (무릎)', '트라이셉 딥', '스파이더맨 플랭크',
              '파이크 푸시업', '클랩 푸시업', '익스플로시브 푸시업'],
    '손목':  ['팔굽혀펴기', '팔굽혀펴기 (무릎)', '플랭크', '스파이더맨 플랭크', '트라이셉 딥', '버드독',
              '베어 크롤', '사이드 플랭크'],
    '발목':  ['점프 스쿼트', '파워 런지', '버피', '버피 (변형)', '점핑잭', '하이니', '스텝업',
              '카프 레이즈', '스케이터 점프', '플라이오 런지', '점프 런지'],
    '복근':  ['복부 크런치', '크로스 크런치', '마운틴 클라이머', '스파이더맨 플랭크',
              '사이드 플랭크', '시티드 레그 레이즈', '니 투 체스트', '베어 크롤'],
    '하체':  ['스쿼트', '런지', '점프 스쿼트', '파워 런지', '사이드 런지', '스텝업', '힙 브릿지',
              '리버스 런지', '레터럴 런지', '박스 스쿼트', '와이드 스쿼트', '월 싯',
              '사이드 레그 레이즈', '덩키 킥', '글루트 킥백', '카프 레이즈',
              '플라이오 런지', '스케이터 점프', '점프 런지', '타바타 스쿼트'],
    '상체':  ['팔굽혀펴기', '팔굽혀펴기 (무릎)', '트라이셉 딥', '버드독',
              '파이크 푸시업', '클랩 푸시업', '익스플로시브 푸시업', '킥복싱 콤보'],
    '엉덩이': ['힙 브릿지', '덩키 킥', '글루트 킥백', '사이드 레그 레이즈',
               '파워 런지', '리버스 런지', '플라이오 런지'],
    '전신':  ['버피', '버피 점프', '버피 (변형)', '점핑잭', '마운틴 클라이머',
              '인치웜', '베어 크롤', '킥복싱 콤보', '스프린트 인 플레이스', '타바타 스쿼트'],
};

// 감성 점수 단어 목록 (운동 종류 선호/제외 판단용)
const POSITIVE_WORDS = ['더', '많이', '원해', '하고 싶', '하고싶', '강화', '늘려', '추가', '포함', '집중', '자주', '좋아'];
const NEGATIVE_WORDS = ['못', '안 해', '안해', '부상', '다쳤', '아파', '불편', '못하겠', '힘들어', '무리', '빼줘', '제외'];

// 강도 조정 키워드
const INTENSITY_UP_WORDS   = ['늘리', '강도 높', '강도 올', '더 하고', '운동량', '많이 하', '빡세게', '세게', '열심히'];
const INTENSITY_DOWN_WORDS = ['줄이', '강도 낮', '쉽게', '가볍게', '적게', '조금만', '덜 하', '살살'];

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** activityLevel → 강도 보정치 (-1 / 0 / +1) */
const ACTIVITY_DELTA = {
    '낮음':   -1,
    '보통':    0,
    '높음':    0,
    '매우높음': 1,
    '선수':    1,
};
const INTENSITY_LEVELS = ['low', 'medium', 'high'];

/** BMI + targetWeeks + activityLevel → 강도 */
function getIntensity(bmi, targetWeeks, activityLevel) {
    let base;
    if (bmi >= 30 || targetWeeks <= 3) base = 2; // high
    else if (bmi >= 25 || targetWeeks <= 6) base = 1; // medium
    else base = 0; // low

    const delta = ACTIVITY_DELTA[activityLevel] ?? 0;
    const idx   = Math.min(2, Math.max(0, base + delta));
    return INTENSITY_LEVELS[idx];
}

/**
 * 텍스트의 감성 점수 계산
 * 긍정 단어 +1, 부정 단어 -1 합산
 */
function calcScore(text) {
    let score = 0;
    POSITIVE_WORDS.forEach(w => { if (text.includes(w)) score++; });
    NEGATIVE_WORDS.forEach(w => { if (text.includes(w)) score--; });
    return score;
}

/**
 * reasons 배열 분석 → { excluded: Set, preferred: Set }
 *
 * 각 reason 문장별로 점수 계산.
 * score < 0 → 관련 운동 excluded
 * score > 0 → 관련 운동 preferred
 */
function parseReasons(reasons = []) {
    const excluded  = new Set();
    const preferred = new Set();
    const allExercises = [...MAIN.low, ...MAIN.medium, ...MAIN.high];

    for (const reason of reasons) {
        const score = calcScore(reason);
        if (score === 0) continue;

        // 부위 키워드 → 관련 운동 일괄 처리
        for (const [bodyPart, exercises] of Object.entries(BODY_PART_MAP)) {
            if (reason.includes(bodyPart)) {
                if (score < 0) exercises.forEach(e => excluded.add(e));
                else            exercises.forEach(e => preferred.add(e));
            }
        }

        // 운동 이름 직접 언급 처리
        for (const ex of allExercises) {
            if (reason.includes(ex.name)) {
                if (score < 0) excluded.add(ex.name);
                else            preferred.add(ex.name);
            }
        }
    }

    // preferred이면서 excluded에도 있으면 excluded 우선
    preferred.forEach(e => { if (excluded.has(e)) preferred.delete(e); });

    return { excluded, preferred };
}

/** 분 단위 duration 문자열 변환 */
function fmtDuration(min) { return `${min}분`; }

/** reasons에서 강도 delta 계산 (+1: 강화, -1: 완화, 0: 유지) */
function parseIntensityDelta(reasons = []) {
    let delta = 0;
    for (const reason of reasons) {
        if (INTENSITY_UP_WORDS.some(w => reason.includes(w)))   delta++;
        if (INTENSITY_DOWN_WORDS.some(w => reason.includes(w))) delta--;
    }
    return Math.sign(delta); // -1, 0, 1 로 고정
}

/** intensity + delta → 조정된 intensity */
function shiftIntensity(base, delta) {
    const levels = ['low', 'medium', 'high'];
    const idx    = levels.indexOf(base);
    return levels[Math.max(0, Math.min(2, idx + delta))];
}

/** 운동 플랜 구성 */
function buildPlan(intensity, excludedNames = new Set(), preferredNames = new Set(), mainCount = 4) {
    // 워밍업: 2개
    const warmup = shuffle(WARMUP.filter(e => !excludedNames.has(e.name)))
        .slice(0, 2)
        .map(e => ({ name: e.name, duration: fmtDuration(e.duration), calories: e.calories }));

    // 메인: preferred 우선 배치 후 mainCount개 선택
    let mainPool = MAIN[intensity].filter(e => !excludedNames.has(e.name));
    if (mainPool.length < mainCount) {
        const fallback = intensity === 'high' ? MAIN.medium : MAIN.low;
        mainPool = [...mainPool, ...fallback.filter(e => !excludedNames.has(e.name))];
    }
    const orderedPool = [
        ...shuffle(mainPool.filter(e =>  preferredNames.has(e.name))),
        ...shuffle(mainPool.filter(e => !preferredNames.has(e.name))),
    ];
    const mainExercises = orderedPool.slice(0, mainCount).map(e => ({
        name: e.name, sets: e.sets, reps: e.reps, calories: e.calories,
    }));

    // 쿨다운: 2개
    const cooldown = shuffle(COOLDOWN.filter(e => !excludedNames.has(e.name)))
        .slice(0, 2)
        .map(e => ({ name: e.name, duration: fmtDuration(e.duration), calories: e.calories }));

    const totalCalories = [
        ...warmup, ...mainExercises, ...cooldown
    ].reduce((s, e) => s + e.calories, 0);

    const warmupMin   = warmup.reduce((s, e) => s + parseInt(e.duration), 0);
    const mainMin     = mainExercises.reduce((s, e) => s + e.sets * 2, 0);
    const cooldownMin = cooldown.reduce((s, e) => s + parseInt(e.duration), 0);

    return {
        warmup,
        main:           mainExercises,
        cooldown,
        total_duration: warmupMin + mainMin + cooldownMin,
        total_calories: totalCalories,
        tip:            EXERCISE_TIPS[intensity],
    };
}

/** 운동 추천 (초기 생성) */
function recommendExercise({ bmi, targetWeeks, activityLevel }) {
    const intensity = getIntensity(bmi, targetWeeks, activityLevel);
    console.log(`  운동 강도: ${intensity} (BMI ${bmi}, ${targetWeeks}주, 활동량: ${activityLevel || '미입력'})`);
    return buildPlan(intensity);
}

/** 운동 재조정 (Gemini 의도 추출 기반) */
async function adjustExercise({ bmi, targetWeeks, activityLevel, reasons = [] }) {
    const allExerciseNames = [
        ...WARMUP,
        ...MAIN.low, ...MAIN.medium, ...MAIN.high,
        ...COOLDOWN,
    ].map(e => e.name);
    const uniqueNames = [...new Set(allExerciseNames)];

    const { excluded: excludedArr, preferred: preferredArr, intensityDelta } =
        await extractExerciseIntent(reasons, uniqueNames);

    const baseIntensity = getIntensity(bmi, targetWeeks, activityLevel);
    const intensity     = shiftIntensity(baseIntensity, intensityDelta);
    const mainCount     = 4 + intensityDelta; // 3 / 4 / 5

    const excluded  = new Set(excludedArr);
    const preferred = new Set(preferredArr);

    console.log(`  [강도 조정] ${baseIntensity} → ${intensity} (delta: ${intensityDelta}), 메인 ${mainCount}개`);
    console.log(`  [Gemini 추출] excluded: [${excludedArr.join(', ')}]`);
    console.log(`  [Gemini 추출] preferred: [${preferredArr.join(', ')}]`);

    return buildPlan(intensity, excluded, preferred, mainCount);
}

module.exports = { recommendExercise, adjustExercise };
