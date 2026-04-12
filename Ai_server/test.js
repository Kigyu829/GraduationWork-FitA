/**
 * FitAiNess AI Server 테스트 스크립트
 * 사용법: node test.js
 *
 * 서버가 실행 중이어야 합니다: npm start
 */

const http = require('http');

const BASE = 'http://localhost:5000';

// 테스트용 공통 사용자 정보
const USER = {
    height:       175,
    weight:        78,
    bmi:         25.5,
    gender:      '남성',
    targetWeight:  70,
    targetWeeks:    8,
};

// ── 헬퍼 ──────────────────────────────────────────────────

function post(path, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const opts = {
            hostname: 'localhost',
            port:     5000,
            path,
            method:   'POST',
            headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        };
        const req = http.request(opts, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve(JSON.parse(d)));
        });
        req.on('error', reject);
        req.setTimeout(120000, () => { req.destroy(); reject(new Error('타임아웃')); });
        req.write(data);
        req.end();
    });
}

function get(path) {
    return new Promise((resolve, reject) => {
        http.get(BASE + path, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve(JSON.parse(d)));
        }).on('error', reject);
    });
}

function pass(msg) { console.log('  ✅', msg); }
function fail(msg) { console.log('  ❌', msg); }
function section(title) { console.log('\n' + '─'.repeat(50)); console.log(' ' + title); console.log('─'.repeat(50)); }

// ── 테스트 케이스 ─────────────────────────────────────────

async function testHealth() {
    section('1. 헬스체크');
    const r = await get('/api/health');
    if (r.status === 'ok') pass('서버 정상 (port ' + r.port + ')');
    else                   fail('서버 응답 이상: ' + JSON.stringify(r));
}

async function testMealRecommend() {
    section('2. 식단 추천');
    const r = await post('/api/meal/recommend', USER);
    if (!r.success) { fail('실패: ' + r.message); return null; }

    const { breakfast, lunch, dinner, total_calories } = r.data;
    console.log('  목표 칼로리:', r.targetCalories, 'kcal');
    console.log('  아침 (' + breakfast.calories + 'kcal):', breakfast.menu.join(', '));
    console.log('  점심 (' + lunch.calories + 'kcal):', lunch.menu.join(', '));
    console.log('  저녁 (' + dinner.calories + 'kcal):', dinner.menu.join(', '));
    console.log('  합계:', total_calories, 'kcal');
    console.log('  팁:', r.data.tip);

    const diff = Math.abs(total_calories - r.targetCalories);
    if (breakfast.main_food && lunch.main_food && dinner.main_food)
        pass('main_food 포함 확인: ' + [breakfast.main_food, lunch.main_food, dinner.main_food].join(' / '));
    if (diff <= r.targetCalories * 0.15)
        pass(`칼로리 오차 ${diff}kcal (15% 이내)`);
    else
        fail(`칼로리 오차 ${diff}kcal (목표 ${r.targetCalories}kcal)`);

    return r.data;
}

async function testMealAdjust(currentPlan) {
    section('3. 식단 재조정 (돼지고기 제외)');
    if (!currentPlan) { console.log('  (식단 추천 실패로 건너뜀)'); return; }

    const r = await post('/api/meal/adjust', {
        currentPlan,
        reasons:        ['돼지고기를 못 먹어요'],
        targetCalories: 1800,
    });
    if (!r.success) { fail('실패: ' + r.message); return; }

    const pigFoods = ['삼겹살', '제육볶음', '보쌈', '수육', '편육', '소세지볶음', '감자탕'];
    const allMenus = [
        ...r.data.breakfast.menu,
        ...r.data.lunch.menu,
        ...r.data.dinner.menu,
    ];
    const found = allMenus.filter(f => pigFoods.includes(f));
    if (found.length === 0) pass('돼지고기 음식 제외 확인');
    else                    fail('돼지고기 음식이 포함됨: ' + found.join(', '));

    console.log('  재조정 점심:', r.data.lunch.menu.join(', '));
}

async function testExerciseRecommend() {
    section('4. 운동 추천');
    const r = await post('/api/exercise/recommend', USER);
    if (!r.success) { fail('실패: ' + r.message); return null; }

    const { warmup, main, cooldown, total_duration, total_calories } = r.data;
    console.log('  워밍업:', warmup.map(e => e.name).join(', '));
    console.log('  메인 운동:', main.map(e => `${e.name}(${e.sets}세트×${e.reps}회)`).join(', '));
    console.log('  쿨다운:', cooldown.map(e => e.name).join(', '));
    console.log('  총 시간:', total_duration, '분 / 소모:', total_calories, 'kcal');
    console.log('  팁:', r.data.tip);

    if (main.length >= 3)       pass('메인 운동 ' + main.length + '개');
    if (total_calories > 0)     pass('칼로리 소모 계산 정상');

    return r.data;
}

async function testExerciseAdjust(currentPlan) {
    section('5. 운동 재조정 (무릎 부상)');
    if (!currentPlan) { console.log('  (운동 추천 실패로 건너뜀)'); return; }

    const r = await post('/api/exercise/adjust', {
        currentPlan,
        reasons:     ['무릎이 아파서 점프 동작을 못 해요'],
        targetWeeks: USER.targetWeeks,
        bmi:         USER.bmi,
    });
    if (!r.success) { fail('실패: ' + r.message); return; }

    const kneeExercises = ['스쿼트', '런지', '점프 스쿼트', '파워 런지'];
    const allNames = r.data.main.map(e => e.name);
    const found = allNames.filter(e => kneeExercises.includes(e));
    if (found.length === 0) pass('무릎 운동 제외 확인');
    else                    fail('무릎 운동이 포함됨: ' + found.join(', '));

    console.log('  재조정 메인:', allNames.join(', '));
}

async function testMotivation() {
    section('6. 동기부여 메시지');
    for (const count of [0, 2, 5]) {
        const r = await post('/api/motivation', { missedCount: count });
        if (!r.success) { fail('실패 (missedCount=' + count + ')'); continue; }
        pass(`missedCount=${count}: "${r.message.slice(0, 40)}..."`);
    }
}

async function testChat() {
    section('7. AI 채팅 (Ollama)');
    console.log('  ⏳ Ollama 응답 대기 중 (최대 2분)...');

    const r = await post('/api/chat', {
        message:     '다이어트 중에 출출할 때 뭘 먹으면 좋을까요?',
        userInfo:    `성별 ${USER.gender}, 키 ${USER.height}cm, 체중 ${USER.weight}kg`,
        mealPlan:    null,
        workoutPlan: null,
    });

    if (!r.success) { fail('실패: ' + r.message); return; }
    pass('응답 수신 완료');
    console.log('  응답:', r.reply);
    console.log('  action:', r.action, '/ reason:', r.reason);
}

async function testPlanReplan() {
    section('8. 플랜 재스케줄링');
    const r = await post('/api/plan/replan', {
        ...USER,
        remainingWeeks: 6,
        missedCount:    3,
        reason:        '최근 식단을 잘 못 지켰어요',
    });
    if (!r.success) { fail('실패: ' + r.message); return; }

    const { mealPlan, workoutPlan } = r.data;
    pass('식단 플랜: ' + mealPlan.total_calories + 'kcal');
    pass('운동 플랜: ' + workoutPlan.total_duration + '분 / ' + workoutPlan.total_calories + 'kcal 소모');
}

// ── 메인 실행 ─────────────────────────────────────────────

(async () => {
    console.log('\n============================');
    console.log('  FitAiNess AI Server 테스트');
    console.log('============================');

    try {
        await testHealth();
        const mealPlan    = await testMealRecommend();
        await testMealAdjust(mealPlan);
        const workoutPlan = await testExerciseRecommend();
        await testExerciseAdjust(workoutPlan);
        await testMotivation();
        await testPlanReplan();
        await testChat();      // Ollama 응답이 가장 오래 걸려서 마지막에

        console.log('\n============================');
        console.log('  테스트 완료');
        console.log('============================\n');
    } catch (e) {
        console.error('\n[오류] 서버에 연결할 수 없습니다:', e.message);
        console.error('서버가 실행 중인지 확인하세요: npm start\n');
        process.exit(1);
    }

    process.exit(0);
})();
