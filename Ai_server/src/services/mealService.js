/**
 * 식단 추천 서비스 (규칙 기반 + Gemini 의도 추출 재조정)
 *
 * 칼로리 배분: 아침 25% / 점심 40% / 저녁 35%
 * 구성 순서: 주식(main) → 국/찌개(soup) → 반찬(side) 채우기
 */

const { FOODS } = require('../data/foodDb');
const { extractMealIntent } = require('./geminiExtract');

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
            { name: '잡곡밥', kcal: 300, gram: 210, protein: 6, carbs: 65, fat: 1, meals: ['breakfast','lunch','dinner'], type: 'main' });
    }
    const main = mains[0];

    const menu      = [main.name];
    const menuFoods = [main];          // gram 추적용
    let   cal       = main.kcal;

    // 국/찌개: preferred 우선, 칼로리 맞는 것 선택
    const soups = [
        ...shuffle(available.filter(f => f.type === 'soup' && preferredNames.has(f.name))),
        ...shuffle(available.filter(f => f.type === 'soup' && !preferredNames.has(f.name))),
    ];
    const soup = soups.find(s => cal + s.kcal <= targetCal * 1.05);
    if (soup) { menu.push(soup.name); menuFoods.push(soup); cal += soup.kcal; }

    // 배추김치 기본 추가
    const kimchi = pool.find(f => f.name === '배추김치' && f.meals.includes(slot));
    if (kimchi && !menu.includes(kimchi.name) && cal + kimchi.kcal <= targetCal * 1.05) {
        menu.push(kimchi.name);
        menuFoods.push(kimchi);
        cal += kimchi.kcal;
    }

    // 반찬: preferred 우선으로 칼로리 채우기
    const sides = [
        ...shuffle(available.filter(f => f.type === 'side' && !menu.includes(f.name) && preferredNames.has(f.name))),
        ...shuffle(available.filter(f => f.type === 'side' && !menu.includes(f.name) && !preferredNames.has(f.name))),
    ];
    for (const side of sides) {
        if (cal >= targetCal * 0.88) break;
        if (cal + side.kcal <= targetCal * 1.05) {
            menu.push(side.name);
            menuFoods.push(side);
            cal += side.kcal;
        }
    }

    // desc: 각 음식별 섭취량(g) 표시
    const desc = menuFoods
        .map(f => `${f.name} ${f.gram ?? ''}g`.trim())
        .join(' · ');

    return {
        menu,
        calories:  cal,
        protein:   Math.round(menuFoods.reduce((s, f) => s + (f.protein || 0), 0)),
        carbs:     Math.round(menuFoods.reduce((s, f) => s + (f.carbs   || 0), 0)),
        fat:       Math.round(menuFoods.reduce((s, f) => s + (f.fat     || 0), 0)),
        desc,
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

/** 식단 재조정 (Gemini 의도 추출 기반) */
async function adjustMeal({ targetCalories, reasons = [] }) {
    const foodNames = FOODS.map(f => f.name);
    const { excluded: excludedArr, preferred: preferredArr } =
        await extractMealIntent(reasons, foodNames);

    const excluded  = new Set(excludedArr);
    const preferred = new Set(preferredArr);

    console.log(`  [Gemini 추출] excluded: [${excludedArr.join(', ')}]`);
    console.log(`  [Gemini 추출] preferred: [${preferredArr.join(', ')}]`);

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
