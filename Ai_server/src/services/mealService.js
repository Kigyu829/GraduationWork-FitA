/**
 * 식단 추천 서비스 (규칙 기반 + 감성 점수 재조정)
 *
 * 칼로리 배분: 아침 25% / 점심 40% / 저녁 35%
 * 구성 순서: 주식(main) → 국/찌개(soup) → 반찬(side) 채우기
 *
 * 재조정 알고리즘 (감성 점수 기반):
 *   긍정 단어(+) / 부정 단어(-) 합산 → 재료/음식명 키워드 점수 결정
 *   score > 0 → preferred  (해당 음식 우선 배치)
 *   score < 0 → excluded   (해당 음식 풀에서 제거)
 *   score = 0 → neutral    (기본 랜덤)
 */

const { FOODS } = require('../data/foodDb');

// 재료 키워드 → 관련 음식 목록
const INGREDIENT_MAP = {
    '닭':    ['닭갈비', '닭볶음탕', '찜닭', '닭계장', '삼계탕', '양념치킨', '후라이드치킨'],
    '돼지':  ['삼겹살', '제육볶음', '보쌈', '수육', '편육', '소세지볶음', '감자탕'],
    '소고기':['불고기', '갈비구이', '갈비찜', '갈비탕', '장조림', '육개장', '육회', '곰탕/설렁탕', '떡갈비'],
    '해산물':['매운탕', '해물찜', '꼬막찜', '산낙지', '멍게', '물회', '간장게장', '양념게장', '새우튀김', '오징어튀김'],
    '생선':  ['고등어구이', '갈치구이', '조기구이', '황태구이', '고등어조림', '갈치조림', '꽁치조림', '코다리조림', '생선전'],
    '매운':  ['떡볶이', '라볶이', '닭갈비', '김치찌개', '순두부찌개', '쫄면', '주꾸미볶음'],
    '면':    ['라면', '짜장면', '짬뽕', '물냉면', '비빔냉면', '막국수', '잔치국수', '열무국수', '쫄면', '수제비', '칼국수', '콩국수', '라볶이'],
};

// 감성 점수 단어 목록
const POSITIVE_WORDS = ['더', '많이', '좋아', '좋은데', '먹고 싶', '먹고싶', '원해', '포함', '넣어', '추가', '늘려', '강화', '자주'];
const NEGATIVE_WORDS = ['못', '안 먹', '안먹', '싫어', '알레르기', '기피', '빼줘', '제외', '없애', '바꿔', '줄여', '못 먹', '못먹'];

const MEAL_TIPS = [
    '물을 하루 2L 이상 마시면 포만감 유지에 도움이 됩니다.',
    '천천히 씹어 먹으면 포만감을 느끼는 데 효과적입니다.',
    '식사 30분 전 물 한 잔이 과식 예방에 도움을 줍니다.',
    '채소를 먼저 드시면 혈당 급상승을 막을 수 있습니다.',
    '정해진 시간에 규칙적으로 식사하면 기초대사량 유지에 좋습니다.',
    '단백질(계란, 두부, 생선)을 매 끼니 포함하면 근육 유지에 도움됩니다.',
    '야식은 가능한 피하고, 저녁은 취침 3시간 전에 마치세요.',
];

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
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
 * reasons 배열의 각 항목을 개별 문장으로 점수 계산.
 * score < 0 → 관련 음식 excluded
 * score > 0 → 관련 음식 preferred
 */
function parseReasons(reasons = []) {
    const excluded  = new Set();
    const preferred = new Set();

    for (const reason of reasons) {
        const score = calcScore(reason);
        if (score === 0) continue;  // 중립 → 영향 없음

        // 재료 키워드 → 관련 음식 일괄 처리
        for (const [keyword, foods] of Object.entries(INGREDIENT_MAP)) {
            if (reason.includes(keyword)) {
                if (score < 0) foods.forEach(f => excluded.add(f));
                else            foods.forEach(f => preferred.add(f));
            }
        }

        // 음식 이름 직접 언급 처리
        for (const food of FOODS) {
            if (reason.includes(food.name)) {
                if (score < 0) excluded.add(food.name);
                else            preferred.add(food.name);
            }
        }
    }

    // preferred이면서 excluded에도 있으면 excluded 우선
    preferred.forEach(f => { if (excluded.has(f)) preferred.delete(f); });

    return { excluded, preferred };
}

/**
 * 한 끼 구성: 주식 + 국 + 반찬으로 targetCal 맞추기
 * preferred 음식은 랜덤 풀 앞에 배치해 우선 선택
 */
function buildMeal(slot, targetCal, pool, preferredNames = new Set()) {
    const available = pool.filter(f => f.meals.includes(slot));

    // 주식 선택: preferred 우선, 그 다음 칼로리 여유 있는 것, 나머지 순
    const allMains = shuffle(available.filter(f => f.type === 'main'));
    const mains = [
        ...allMains.filter(f => preferredNames.has(f.name)),
        ...allMains.filter(f => !preferredNames.has(f.name) && f.kcal <= targetCal * 0.65),
        ...allMains.filter(f => !preferredNames.has(f.name) && f.kcal > targetCal * 0.65),
    ];
    if (mains.length === 0) {
        mains.push(FOODS.find(f => f.name === '잡곡밥') ||
            { name: '잡곡밥', kcal: 300, meals: ['breakfast','lunch','dinner'], type: 'main' });
    }
    const main = mains[0];

    const menu = [main.name];
    let   cal  = main.kcal;

    // 국/찌개: preferred 우선, 칼로리 맞는 것 선택
    const soups = [
        ...shuffle(available.filter(f => f.type === 'soup' && preferredNames.has(f.name))),
        ...shuffle(available.filter(f => f.type === 'soup' && !preferredNames.has(f.name))),
    ];
    const soup = soups.find(s => cal + s.kcal <= targetCal * 1.1);
    if (soup) { menu.push(soup.name); cal += soup.kcal; }

    // 배추김치 기본 추가
    const kimchi = pool.find(f => f.name === '배추김치' && f.meals.includes(slot));
    if (kimchi && !menu.includes(kimchi.name) && cal + kimchi.kcal <= targetCal * 1.1) {
        menu.push(kimchi.name);
        cal += kimchi.kcal;
    }

    // 반찬: preferred 우선으로 칼로리 채우기
    const sides = [
        ...shuffle(available.filter(f => f.type === 'side' && !menu.includes(f.name) && preferredNames.has(f.name))),
        ...shuffle(available.filter(f => f.type === 'side' && !menu.includes(f.name) && !preferredNames.has(f.name))),
    ];
    for (const side of sides) {
        if (cal >= targetCal * 0.88) break;
        if (cal + side.kcal <= targetCal * 1.10) { menu.push(side.name); cal += side.kcal; }
    }

    return {
        menu,
        calories:  cal,
        main_food: main.name,
        desc:      `${main.name} 중심의 ${cal}kcal 식단`,
    };
}

/** 식단 추천 (초기 생성) */
function recommendMeal({ targetCalories, excludeFoods = [] }) {
    const pool   = FOODS.filter(f => !excludeFoods.includes(f.name));
    const bfCal  = Math.round(targetCalories * 0.25);
    const lnCal  = Math.round(targetCalories * 0.40);
    const dnCal  = targetCalories - bfCal - lnCal;
    const tip    = MEAL_TIPS[Math.floor(Math.random() * MEAL_TIPS.length)];

    return {
        breakfast:      buildMeal('breakfast', bfCal, pool),
        lunch:          buildMeal('lunch',     lnCal, pool),
        dinner:         buildMeal('dinner',    dnCal, pool),
        total_calories: 0,  // 아래에서 재계산
        tip,
    };
}

/** 식단 재조정 (감성 점수 기반) */
function adjustMeal({ targetCalories, reasons = [] }) {
    const { excluded, preferred } = parseReasons(reasons);

    console.log(`  [감성 점수] excluded: [${[...excluded].join(', ')}]`);
    console.log(`  [감성 점수] preferred: [${[...preferred].join(', ')}]`);

    const pool   = FOODS.filter(f => !excluded.has(f.name));
    const bfCal  = Math.round(targetCalories * 0.25);
    const lnCal  = Math.round(targetCalories * 0.40);
    const dnCal  = targetCalories - bfCal - lnCal;
    const tip    = MEAL_TIPS[Math.floor(Math.random() * MEAL_TIPS.length)];

    const breakfast = buildMeal('breakfast', bfCal, pool, preferred);
    const lunch     = buildMeal('lunch',     lnCal, pool, preferred);
    const dinner    = buildMeal('dinner',    dnCal, pool, preferred);

    return {
        breakfast,
        lunch,
        dinner,
        total_calories: breakfast.calories + lunch.calories + dinner.calories,
        tip,
    };
}

// recommendMeal total_calories 보정
const _orig = recommendMeal;
module.exports = {
    recommendMeal: (args) => {
        const r = _orig(args);
        r.total_calories = r.breakfast.calories + r.lunch.calories + r.dinner.calories;
        return r;
    },
    adjustMeal,
};
