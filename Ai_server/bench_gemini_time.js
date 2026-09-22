/**
 * 4.6.1 Gemini NLU 재조정(/api/meal/recommend + reasons → adjustMeal) 응답 시간 측정
 *
 * v2: 요청 간 딜레이를 추가해 분당 요청 한도(RPM) 소진으로 인한 안전 폴백 오염을 피하고,
 *     비정상적으로 빠른 응답(폴백 의심)을 자동으로 분리 집계한다.
 *
 * 사전 준비:
 *   1) Ai_server/.env 에 실제 GEMINI_API_KEY가 설정되어 있어야 함
 *   2) 별도 터미널에서 서버 실행: cd Ai_server && node server.js
 *
 * 실행: cd Ai_server && node bench_gemini_time.js
 */

const BASE = process.env.AI_SERVER_URL || 'http://localhost:5000';
const N = 12;                 // RPM 한도를 넘지 않도록 줄임
const DELAY_MS = 4000;        // 요청 사이 대기 시간 (RPM 여유 확보)
const FALLBACK_THRESHOLD_MS = 1000; // 이보다 빠르면 폴백 의심으로 분류

function stats(arr) {
    if (arr.length === 0) return null;
    const n = arr.length;
    const mean = arr.reduce((a, b) => a + b, 0) / n;
    const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);
    const sorted = [...arr].sort((a, b) => a - b);
    return {
        n, mean_s: (mean / 1000).toFixed(2), std_ms: Math.round(std),
        min_s: (sorted[0] / 1000).toFixed(2), max_s: (sorted[n - 1] / 1000).toFixed(2),
        p50_s: (sorted[Math.floor(n * 0.5)] / 1000).toFixed(2),
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

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
    console.log(`Gemini NLU 재조정 응답시간 측정 시작 (N=${N}, 요청 간 ${DELAY_MS / 1000}초 대기)`);
    console.log(`대상: ${BASE}/api/meal/recommend (reasons 포함 → adjustMeal 경로)\n`);

    const normalTimes = [];
    const suspectFallback = [];
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
            } else if (elapsed < FALLBACK_THRESHOLD_MS) {
                console.log(`  [${i + 1}/${N}] ${(elapsed / 1000).toFixed(2)}초  ⚠ 폴백 의심 (서버 콘솔에서 [Gemini 추출] excluded/preferred 확인 필요)`);
                suspectFallback.push(elapsed);
            } else {
                console.log(`  [${i + 1}/${N}] ${(elapsed / 1000).toFixed(2)}초`);
                normalTimes.push(elapsed);
            }
        } catch (e) {
            console.log(`  [${i + 1}/${N}] 예외: ${e.message}`);
            errors++;
        }

        if (i < N - 1) await sleep(DELAY_MS);
    }

    console.log('\n' + '='.repeat(55));
    console.log(`정상 응답(≥${FALLBACK_THRESHOLD_MS}ms) ${normalTimes.length}건 / 폴백 의심 ${suspectFallback.length}건 / 실패 ${errors}건`);

    const s = stats(normalTimes);
    if (s) {
        console.log(`\n[정상 Gemini 응답만 집계]`);
        console.log(`평균: ${s.mean_s}초 / p50: ${s.p50_s}초 / 최소~최대: ${s.min_s}초 ~ ${s.max_s}초`);
    } else {
        console.log('\n정상 응답이 없습니다. 전부 폴백되었거나 실패했습니다 — GEMINI_API_KEY/쿼터를 확인하세요.');
    }
    if (suspectFallback.length > 0) {
        console.log(`\n⚠ 폴백 의심 ${suspectFallback.length}건은 통계에서 제외했습니다.`);
        console.log('  서버 콘솔에서 해당 시점에 429/503/[키 교체] 메시지가 있었는지, [Gemini 추출] excluded/preferred가');
        console.log('  계속 빈 배열이었는지 확인해서 폴백이 맞는지 교차검증해줘.');
    }
    console.log('='.repeat(55));
}

main().catch(err => { console.error(err); process.exit(1); });
