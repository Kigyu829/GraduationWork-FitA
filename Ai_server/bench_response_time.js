/**
 * 4.6.1 추천 응답 속도 + 4.6.2 TTL 캐시 적중률 측정 스크립트
 *
 * 전제: Ai_server가 로컬에서 실행 중이어야 함 (node server.js, 기본 포트 5000)
 * 실행: node bench_response_time.js
 *
 * 측정 항목:
 *   (1) 규칙 기반 추천(/api/meal/recommend, /api/exercise/recommend, reasons 없음) 응답 시간 N회
 *   (2) Gemini NLU 재조정(/api/meal/recommend, reasons 포함) 응답 시간 N회 — Gemini API 키 필요
 *   (3) TTL 캐시 적중률 — 동일 요청 반복 시 _cached 플래그로 실제 HIT/MISS 카운트
 */

const BASE = process.env.AI_SERVER_URL || 'http://localhost:5000';

function stats(arr) {
    const n = arr.length;
    const mean = arr.reduce((a, b) => a + b, 0) / n;
    const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);
    const sorted = [...arr].sort((a, b) => a - b);
    return {
        n, mean: mean.toFixed(1), std: std.toFixed(1),
        min: sorted[0].toFixed(1), max: sorted[n - 1].toFixed(1),
        p50: sorted[Math.floor(n * 0.5)].toFixed(1),
        p95: sorted[Math.floor(n * 0.95)].toFixed(1),
    };
}

async function timedPost(path, body) {
    const t0 = performance.now();
    const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    const elapsed = performance.now() - t0;
    return { elapsed, data };
}

function randomProfile() {
    return {
        height: Math.round(150 + Math.random() * 40),
        weight: Math.round(45 + Math.random() * 50),
        bmi: 22,
        gender: Math.random() < 0.5 ? '남성' : '여성',
        targetWeight: Math.round(45 + Math.random() * 50),
        targetWeeks: Math.round(4 + Math.random() * 12),
        activityLevel: '보통',
    };
}

async function main() {
    const N = 30;

    // ── (1) 규칙 기반 추천 응답 시간 ──────────────────────────
    console.log(`\n[1] 규칙 기반 추천 응답 시간 (N=${N}, 매번 다른 프로필로 캐시 미스 유도)`);
    const mealTimes = [];
    const exerciseTimes = [];
    for (let i = 0; i < N; i++) {
        const profile = randomProfile();
        const { elapsed: e1 } = await timedPost('/api/meal/recommend', profile);
        mealTimes.push(e1);
        const { elapsed: e2 } = await timedPost('/api/exercise/recommend', profile);
        exerciseTimes.push(e2);
    }
    console.log('  /api/meal/recommend     (ms):', stats(mealTimes));
    console.log('  /api/exercise/recommend (ms):', stats(exerciseTimes));

    // ── (2) Gemini NLU 재조정 응답 시간 (API 키 필요) ──────────
    console.log(`\n[2] Gemini NLU 재조정 응답 시간 (N=${N}, reasons 포함 → adjustMeal 호출)`);
    const geminiTimes = [];
    const reasonsPool = [
        '닭고기를 못 먹어요', '오늘 아침에 라면을 먹었어요', '스쿼트가 무릎에 무리가 가요',
        '단백질을 더 챙기고 싶어요', '어제 야식을 먹어서 죄책감이 들어요', '유산소를 더 하고 싶어요',
    ];
    let geminiErrors = 0;
    for (let i = 0; i < N; i++) {
        const profile = randomProfile();
        profile.reasons = [reasonsPool[Math.floor(Math.random() * reasonsPool.length)]];
        try {
            const { elapsed, data } = await timedPost('/api/meal/recommend', profile);
            if (data.success === false) { geminiErrors++; continue; }
            geminiTimes.push(elapsed);
        } catch (e) { geminiErrors++; }
    }
    if (geminiTimes.length > 0) {
        console.log('  /api/meal/recommend(+reasons) (ms):', stats(geminiTimes));
    } else {
        console.log('  ⚠ Gemini 호출 전부 실패 — GEMINI_API_KEY가 유효한지 확인 필요');
    }
    if (geminiErrors > 0) console.log(`  (실패/오류 ${geminiErrors}건 제외)`);

    console.log('\n※ TTL 캐시 적중률은 별도 스크립트(bench_cache_hitrate.js)로 측정합니다.');
    console.log('  (이 스크립트만으로 aiRateLimit의 분당 60건 한도를 이미 소모하기 때문)');
}

main().catch(err => { console.error(err); process.exit(1); });
