/**
 * 4.6.1 Gemini NLU 재조정(/api/meal/recommend + reasons → adjustMeal) 응답 시간 측정
 *
 * bench_response_time.js에서 분리한 이유:
 *   Gemini 호출은 1건당 2~5초가 걸려 N=30 전체가 aiRateLimit(분당 60건) 버킷을
 *   넘나들 수 있고, 규칙 기반 파트(빠르게 60건 소모)와 같은 스크립트에서 이어
 *   돌리면 레이트리밋과 섞여 순수한 Gemini 응답시간만 보기 어려워진다.
 *   이 스크립트는 Gemini 호출만 단독으로 수행한다.
 *
 * 사전 준비:
 *   1) Ai_server/.env 에 실제 GEMINI_API_KEY가 설정되어 있어야 함
 *   2) 별도 터미널에서 서버 실행: cd Ai_server && node server.js
 *      (콘솔에 "Food Scouter AI 서버" 또는 "AI Server" 관련 시작 로그가 뜨면 준비 완료)
 *
 * 실행: cd Ai_server && node bench_gemini_time.js
 */

const BASE = process.env.AI_SERVER_URL || 'http://localhost:5000';
const N = 20; // Gemini 호출은 느리므로 30보다 줄임 (레이트리밋 여유 확보)

function stats(arr) {
    const n = arr.length;
    const mean = arr.reduce((a, b) => a + b, 0) / n;
    const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);
    const sorted = [...arr].sort((a, b) => a - b);
    return {
        n, mean_ms: Math.round(mean), std_ms: Math.round(std),
        min_ms: Math.round(sorted[0]), max_ms: Math.round(sorted[n - 1]),
        p50_ms: Math.round(sorted[Math.floor(n * 0.5)]),
        p95_ms: Math.round(sorted[Math.floor(n * 0.95)]),
        mean_s: (mean / 1000).toFixed(2), min_s: (sorted[0] / 1000).toFixed(2), max_s: (sorted[n - 1] / 1000).toFixed(2),
    };
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

const REASONS_POOL = [
    '닭고기를 못 먹어요', '오늘 아침에 라면을 먹었어요', '스쿼트가 무릎에 무리가 가요',
    '단백질을 더 챙기고 싶어요', '어제 야식을 먹어서 죄책감이 들어요', '유산소를 더 하고 싶어요',
    '해산물 알레르기가 있어요', '오늘은 운동을 쉬고 싶어요',
];

async function main() {
    console.log(`Gemini NLU 재조정 응답시간 측정 시작 (N=${N})`);
    console.log(`대상: ${BASE}/api/meal/recommend (reasons 포함 → adjustMeal 경로)\n`);

    const times = [];
    let errors = 0;

    for (let i = 0; i < N; i++) {
        const profile = randomProfile();
        profile.reasons = [REASONS_POOL[Math.floor(Math.random() * REASONS_POOL.length)]];

        const t0 = performance.now();
        try {
            const res = await fetch(`${BASE}/api/meal/recommend`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profile),
            });
            const data = await res.json();
            const elapsed = performance.now() - t0;

            if (data.success === false) {
                console.log(`  [${i + 1}/${N}] 실패: ${data.message}`);
                errors++;
                continue;
            }
            times.push(elapsed);
            console.log(`  [${i + 1}/${N}] ${(elapsed / 1000).toFixed(2)}초`);
        } catch (e) {
            console.log(`  [${i + 1}/${N}] 예외: ${e.message}`);
            errors++;
        }
    }

    console.log('\n' + '='.repeat(50));
    if (times.length === 0) {
        console.log('모든 호출이 실패했습니다. GEMINI_API_KEY와 서버 실행 상태를 확인하세요.');
        return;
    }
    const s = stats(times);
    console.log(`유효 응답 ${s.n}건 (실패 ${errors}건 제외)`);
    console.log(`평균: ${s.mean_s}초 (${s.mean_ms}ms)`);
    console.log(`표준편차: ${s.std_ms}ms`);
    console.log(`최소~최대: ${s.min_s}초 ~ ${s.max_s}초`);
    console.log(`p50: ${s.p50_ms}ms, p95: ${s.p95_ms}ms`);
    console.log('='.repeat(50));
}

main().catch(err => { console.error(err); process.exit(1); });
