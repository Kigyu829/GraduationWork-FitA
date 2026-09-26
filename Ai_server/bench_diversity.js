/**
 * 4.6.5 추천 다양성(카테고리 분포 엔트로피) 측정 스크립트
 *
 * 서버 실행 불필요 — recommendMeal/recommendExercise를 직접 호출한다.
 * 다양한 프로필(체중/키/목표기간/활동강도) 조합으로 N회 추천을 반복하여
 * 매 회 선택된 "주식"(식단) / "메인 운동"(운동) 이름의 분포로 Shannon 엔트로피를 계산한다.
 *
 * 실행: node bench_diversity.js
 */

const { recommendMeal } = require('./src/services/mealService');
const { recommendExercise } = require('./src/services/exerciseService');
const { FOODS } = require('./src/data/foodDb');
const { WARMUP, MAIN, COOLDOWN } = require('./src/data/exerciseDb');

const N = 500; // 프로필 샘플 수

function shannonEntropy(counts) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    let h = 0;
    for (const c of Object.values(counts)) {
        if (c === 0) continue;
        const p = c / total;
        h -= p * Math.log2(p);
    }
    return h;
}

function randRange(min, max) {
    return min + Math.random() * (max - min);
}

function randChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

const ACTIVITY_LEVELS = ['낮음', '보통', '높음', '매우높음', '선수'];

// ── 1) 식단 다양성 ──────────────────────────
const mainFoodCount = {};   // 아침/점심/저녁 주식(첫 번째 menu 항목) 분포
const allFoodCount = {};    // menu에 등장한 모든 음식 분포 (참고용)

for (let i = 0; i < N; i++) {
    const targetCalories = Math.round(randRange(1400, 2600));
    const result = recommendMeal({ targetCalories });
    for (const slot of ['breakfast', 'lunch', 'dinner']) {
        const menu = result[slot].menu;
        const main = menu[0];
        mainFoodCount[main] = (mainFoodCount[main] || 0) + 1;
        for (const item of menu) {
            allFoodCount[item] = (allFoodCount[item] || 0) + 1;
        }
    }
}

const mainFoodPoolSize = FOODS.filter(f => f.type === 'main').length;
const mainFoodH = shannonEntropy(mainFoodCount);
const mainFoodHmax = Math.log2(mainFoodPoolSize);

// ── 2) 운동 다양성 ──────────────────────────
const mainExerciseCount = {};
const mainExercisePoolSize = new Set([
    ...MAIN.low.map(e => e.name),
    ...MAIN.medium.map(e => e.name),
    ...MAIN.high.map(e => e.name),
]).size;

for (let i = 0; i < N; i++) {
    const bmi = randRange(17, 33);
    const targetWeeks = Math.round(randRange(2, 16));
    const activityLevel = randChoice(ACTIVITY_LEVELS);
    const result = recommendExercise({ bmi, targetWeeks, activityLevel });
    for (const ex of result.main) {
        mainExerciseCount[ex.name] = (mainExerciseCount[ex.name] || 0) + 1;
    }
}

const exerciseH = shannonEntropy(mainExerciseCount);
const exerciseHmax = Math.log2(mainExercisePoolSize);

// ── 결과 출력 ──────────────────────────
console.log('='.repeat(60));
console.log(`샘플 수: N=${N} (프로필 무작위 생성)`);
console.log('='.repeat(60));

console.log('\n[식단 추천 다양성]');
console.log(`  주식 후보 풀 크기: ${mainFoodPoolSize}종`);
console.log(`  실제 등장한 주식 종류: ${Object.keys(mainFoodCount).length}종`);
console.log(`  Shannon 엔트로피 H = ${mainFoodH.toFixed(3)} bits`);
console.log(`  최대 엔트로피 Hmax = ${mainFoodHmax.toFixed(3)} bits (균등분포 시)`);
console.log(`  정규화 다양성 H/Hmax = ${(mainFoodH / mainFoodHmax * 100).toFixed(1)}%`);
console.log('  상위 5개 주식 빈도:',
    Object.entries(mainFoodCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([n, c]) => `${n}(${c})`).join(', '));

console.log('\n[운동 추천 다양성]');
console.log(`  메인운동 후보 풀 크기: ${mainExercisePoolSize}종`);
console.log(`  실제 등장한 운동 종류: ${Object.keys(mainExerciseCount).length}종`);
console.log(`  Shannon 엔트로피 H = ${exerciseH.toFixed(3)} bits`);
console.log(`  최대 엔트로피 Hmax = ${exerciseHmax.toFixed(3)} bits (균등분포 시)`);
console.log(`  정규화 다양성 H/Hmax = ${(exerciseH / exerciseHmax * 100).toFixed(1)}%`);
console.log('  상위 5개 운동 빈도:',
    Object.entries(mainExerciseCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([n, c]) => `${n}(${c})`).join(', '));

console.log('\n' + '='.repeat(60));
