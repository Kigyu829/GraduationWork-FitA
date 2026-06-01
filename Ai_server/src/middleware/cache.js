/**
 * 인메모리 TTL 캐시 (Map 기반)
 *
 * 사용처: meal/recommend, exercise/recommend 엔드포인트
 * TTL 기본값: 5분 (동일 요청 본문이면 캐시 반환)
 *
 * exports:
 *   cacheMiddleware(prefix, ttl?)  — Express 미들웨어 팩토리
 *   cache.get / cache.set / cache.del — 직접 접근용
 */

const DEFAULT_TTL = 5 * 60 * 1000; // 5분 (ms)

/** key → { data, expiresAt } */
const store = new Map();

// 만료된 항목 주기적 정리 (10분마다)
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
        if (now > entry.expiresAt) store.delete(key);
    }
}, 10 * 60 * 1000);

const cache = {
    get(key) {
        const entry = store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) { store.delete(key); return null; }
        return entry.data;
    },
    set(key, data, ttl = DEFAULT_TTL) {
        store.set(key, { data, expiresAt: Date.now() + ttl });
    },
    del(key) { store.delete(key); },
    size() { return store.size; },
};

/**
 * Express 미들웨어 팩토리
 *
 * @param {string} prefix   캐시 키 접두사 (예: 'meal_recommend')
 * @param {number} [ttl]    TTL (ms). 기본 5분
 *
 * @example
 * router.post('/recommend', cacheMiddleware('meal_recommend'), handler);
 */
function cacheMiddleware(prefix, ttl = DEFAULT_TTL) {
    return (req, res, next) => {
        const key = `${prefix}:${JSON.stringify(req.body)}`;
        const hit  = cache.get(key);

        if (hit) {
            console.log(`  [캐시 HIT] ${prefix}`);
            return res.json({ ...hit, _cached: true });
        }

        // res.json을 후킹해 응답 데이터를 캐시에 저장
        const origJson = res.json.bind(res);
        res.json = (data) => {
            if (data && data.success !== false) {
                cache.set(key, data, ttl);
                console.log(`  [캐시 SET] ${prefix} (${ttl / 1000}s)`);
            }
            return origJson(data);
        };

        next();
    };
}

module.exports = { cacheMiddleware, cache };
