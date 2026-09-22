/**
 * 4.6.2 TTL 캐시 적중률 측정 (독립 실행용)
 *
 * bench_response_time.js와 분리한 이유: aiRateLimit 미들웨어가 IP당 분당 60건으로
 * 제한하는데, 응답시간 측정(파트1+2)만으로 이미 60건 이상을 소모해 이 테스트가
 * 429로 막히는 문제가 있었음. 별도 프로세스/시간대에 실행해야 정확한 값이 나온다.
 *
 * 실행: node bench_cache_hitrate.js
 */

const BASE = process.env.AI_SERVER_URL || 'http://localhost:5000';

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
    const fixedProfile = { height: 170, weight: 65, bmi: 22.5, gender: '남성', targetWeight: 60, targetWeeks: 8, activityLevel: '보통' };
    const M = 30; // aiRateLimit(60/분) 여유 있게 하회
    let hits = 0, misses = 0, errors = 0;

    for (let i = 0; i < M; i++) {
        const body = Math.random() < 0.8 ? fixedProfile : randomProfile();
        const res = await fetch(`${BASE}/api/meal/recommend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.success === false) { errors++; continue; }
        if (data._cached) hits++; else misses++;
    }

    console.log(`요청 ${M}회 (에러 ${errors}건 제외 유효 ${hits + misses}회) 중 캐시 HIT ${hits}회 / MISS ${misses}회`);
    console.log(`적중률: ${(hits / (hits + misses) * 100).toFixed(1)}%`);
    console.log('(시나리오: 동일 프로필 반복 조회 80% + 신규 프로필 20% 혼합 트래픽 가정)');
}

main().catch(err => { console.error(err); process.exit(1); });
