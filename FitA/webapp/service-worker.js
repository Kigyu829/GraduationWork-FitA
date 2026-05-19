/* ============================================================
   FitA Service Worker v5
   - App Shell 전체 사전 캐싱 (오프라인 즉시 로딩)
   - 네트워크 우선 → 캐시 폴백 전략
   - 오프라인 시 offline.html 반환
   - 알림 클릭 핸들러
   ============================================================ */

const CACHE_NAME = 'fita-v5';

/* ── 앱 셸: 설치 시 미리 캐시할 파일 전체 ── */
const APP_SHELL = [
  /* 루트 */
  './manifest.json',
  './index.html',

  /* 페이지 */
  './public/pages/offline.html',
  './public/pages/hc503.html',
  './public/pages/sc101.html',
  './public/pages/sc201_1.html',
  './public/pages/sc201_2.html',
  './public/pages/sc202.html',
  './public/pages/sc203.html',
  './public/pages/sc300.html',
  './public/pages/sc301.html',
  './public/pages/sc302.html',
  './public/pages/sc311.html',
  './public/pages/sc401.html',
  './public/pages/sc602.html',
  './public/pages/sc701.html',
  './public/pages/hc402.html',
  './public/pages/hc403.html',

  /* CSS */
  './public/css/common.css',
  './public/css/sc101.css',
  './public/css/sc201.css',
  './public/css/sc202.css',
  './public/css/sc203.css',
  './public/css/sc300.css',
  './public/css/sc301.css',
  './public/css/sc302.css',
  './public/css/sc311.css',
  './public/css/sc401.css',
  './public/css/sc602.css',
  './public/css/sc701.css',
  './public/css/hc402.css',
  './public/css/hc403.css',

  /* JS */
  './public/js/firebase-config.js',
  './public/js/common.js',
  './public/js/notifications.js',
  './public/js/sc101.js',
  './public/js/sc201_1.js',
  './public/js/sc201_2.js',
  './public/js/sc202.js',
  './public/js/sc203.js',
  './public/js/sc300.js',
  './public/js/sc301.js',
  './public/js/sc302.js',
  './public/js/sc311.js',
  './public/js/sc401.js',
  './public/js/sc602.js',
  './public/js/sc701.js',
  './public/js/hc402.js',
  './public/js/hc403.js',

  /* 이미지 */
  './public/img/FitALogo.png',
];

/* ══════════════════════════════════════════════════
   install — 앱 셸 사전 캐싱
   개별 파일 실패가 전체 설치를 막지 않도록
   Promise.allSettled 사용
══════════════════════════════════════════════════ */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        APP_SHELL.map(url =>
          cache.add(url).catch(err => console.warn('[SW] 캐시 실패:', url, err))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

/* ══════════════════════════════════════════════════
   activate — 이전 버전 캐시 삭제
══════════════════════════════════════════════════ */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ══════════════════════════════════════════════════
   fetch — 요청 전략
   · API / CNN 서버 요청 → 캐시 없이 네트워크 직통 (오프라인이면 그냥 실패)
   · Firebase SDK CDN → 네트워크 우선, 실패 시 캐시
   · 앱 자산(HTML/CSS/JS/이미지) → 캐시 우선, 없으면 네트워크 후 캐시에 저장
   · 오프라인 + 캐시 미스 → navigation 요청이면 offline.html 반환
══════════════════════════════════════════════════ */
self.addEventListener('fetch', e => {
  const { request } = e;

  /* GET 아닌 요청은 무시 */
  if (request.method !== 'GET') return;

  const url = request.url;

  /* AI / CNN API 요청 → 서비스워커 개입 없이 그냥 통과 */
  if (url.includes('/api/') || url.includes('/cnn/') || url.includes('localhost:5000') || url.includes('localhost:4000')) {
    return;
  }

  /* Firebase SDK CDN (gstatic, googleapis) → 네트워크 우선 전략 */
  if (url.includes('gstatic.com') || url.includes('googleapis.com') || url.includes('firebaseapp.com')) {
    e.respondWith(networkFirst(request));
    return;
  }

  /* socket.io CDN */
  if (url.includes('cdnjs.cloudflare.com')) {
    e.respondWith(networkFirst(request));
    return;
  }

  /* 앱 자산 → 캐시 우선, 없으면 네트워크 후 캐시 저장 */
  e.respondWith(cacheFirst(request));
});

/* ── 캐시 우선: 캐시에 있으면 즉시 반환, 없으면 네트워크 후 캐시에 저장 ── */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    /* 오프라인 + 캐시 미스 → navigation이면 offline.html */
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('./public/pages/offline.html');
      if (offlinePage) return offlinePage;
    }
    return new Response('오프라인 상태입니다.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    });
  }
}

/* ── 네트워크 우선: 네트워크 성공 시 캐시 갱신, 실패 시 캐시 반환 ── */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('', { status: 503 });
  }
}

/* ══════════════════════════════════════════════════
   notificationclick — 알림 클릭 시 앱 포커스 or 새 탭
══════════════════════════════════════════════════ */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || './public/pages/sc311.html';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes('sc311') || c.url.includes('sc301'));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
