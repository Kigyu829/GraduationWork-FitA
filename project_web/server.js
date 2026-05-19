const express = require('express');
const http    = require('http');
const path    = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const fs = require('fs');
const app = express();

/* ── .html 확장자 제거 리다이렉트
   /pages/sc301.html → /pages/sc301  (쿼리스트링 유지)
   프록시/정적 파일보다 먼저 실행 ── */
app.use((req, res, next) => {
  if (req.path.endsWith('.html')) {
    const cleanPath = req.path.slice(0, -5);
    const qs = req.url.slice(req.path.length);
    return res.redirect(302, cleanPath + qs);
  }
  next();
});

/* ── 정적 파일 — extensions 옵션으로 확장자 없이도 서빙 ── */
app.use(express.static('public', { extensions: ['html'] }));

/* ── FitA 모바일 웹앱 (포트 3000/fita/) ── */
app.use('/fita', express.static(path.join(__dirname, '..', 'FitA', 'webapp'), { extensions: ['html'] }));

/* 루트 접속 시 시작 페이지로 리다이렉트 */
app.get('/', (req, res) => {
  res.redirect('/pages/sc101');
});

/* ── 간단한 Rate Limiter (분당 IP당 최대 40회) ── */
const _rateMap = new Map();
function apiRateLimit(req, res, next) {
  const ip     = req.ip || req.socket.remoteAddress || 'unknown';
  const minute = Math.floor(Date.now() / 60000);
  const key    = `${ip}-${minute}`;
  const count  = (_rateMap.get(key) || 0) + 1;
  _rateMap.set(key, count);
  for (const k of _rateMap.keys()) {
    if (!k.endsWith(`-${minute}`)) _rateMap.delete(k);
  }
  if (count > 40) {
    return res.status(429).json({ success: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' });
  }
  next();
}

/* ══════════════════════════════════════════════
   프록시 — express.json() 보다 반드시 먼저 등록
   (json() 가 body stream 을 소비하면 proxy 가 빈 body 를 전달)
   ══════════════════════════════════════════════ */

/* ── 프록시 공통 에러 핸들러 팩토리
   error 콜백은 반드시 (err, req, res, next) 를 받아야 응답을 끝낼 수 있음 ── */
function makeErrorHandler(label) {
  return (err, req, res) => {
    console.error(`[proxy→${label}] 오류:`, err.message);
    if (res && !res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
    }
    if (res && !res.writableEnded) {
      res.end(JSON.stringify({ success: false, message: `${label} 서버 연결 오류: ${err.message}` }));
    }
  };
}

/* /api/* → AI 서버 :5000
   Express 가 /api 를 strip 하므로 pathRewrite 로 복원 */
app.use('/api', apiRateLimit, createProxyMiddleware({
  target:        'http://localhost:5000',
  changeOrigin:  true,
  pathRewrite:   (path) => '/api' + path,
  proxyTimeout:  60000,
  timeout:       60000,
  on: {
    proxyReq: (proxyReq, req) => console.log(`[proxy→AI] ${req.method} /api${req.url}`),
    error:    makeErrorHandler('AI'),
  },
}));

/* /socket.io/* → AI 서버 :5000 WebSocket */
const socketProxy = createProxyMiddleware({
  target:       'http://localhost:5000',
  changeOrigin: true,
  ws:           true,
  pathRewrite:  (path) => '/socket.io' + path,
  on: { error: makeErrorHandler('Socket') },
});
app.use('/socket.io', socketProxy);

/* /cnn/* → CNN 서버 :4000  (/cnn strip 후 /api/analyze 로 전달) */
app.use('/cnn', apiRateLimit, createProxyMiddleware({
  target:        'http://localhost:4000',
  changeOrigin:  true,
  proxyTimeout:  120000,
  timeout:       120000,
  on: {
    proxyReq: (proxyReq, req) => console.log(`[proxy→CNN] ${req.method} ${req.url}`),
    error:    makeErrorHandler('CNN'),
  },
}));

/* ── 여기서부터 express.json() 적용 (프록시 이후 라우트에서만 사용) ── */
app.use(express.json());

/* ────────────────────────────────────────────
   기존 라우트 (Firebase 전환 후 미사용이지만 유지)
   ──────────────────────────────────────────── */
const FILE = './data/users.json';
const read  = () => JSON.parse(fs.readFileSync(FILE));
const write = (data) => fs.writeFileSync(FILE, JSON.stringify(data, null, 2));

app.post('/register', (req, res) => {
  const users = read();
  const user = {
    id: Date.now(),
    email:    req.body.email,
    password: req.body.password,
    nickname: req.body.nickname,
    phone:    req.body.phone,
  };
  users.push(user);
  write(users);
  res.json({ userId: user.id, nickname: user.nickname });
});

app.post('/login', (req, res) => {
  const users = read();
  const user = users.find(u => u.email === req.body.email && u.password === req.body.password);
  if (!user) return res.json({ success: false });
  res.json({ success: true, userId: user.id });
});

app.post('/info1', (req, res) => {
  const users = read();
  const user  = users.find(u => u.id == req.body.userId);
  user.birth  = req.body.birth;
  user.gender = req.body.gender;
  user.height = Number(req.body.height);
  user.weight = Number(req.body.weight);
  const h = user.height / 100;
  user.bmi = (user.weight / (h * h)).toFixed(1);
  write(users);
  res.json({ bmi: user.bmi });
});

app.post('/goal', (req, res) => {
  const users = read();
  const user  = users.find(u => u.id == req.body.userId);
  user.targetWeight = req.body.targetWeight;
  user.startDate    = req.body.startDate;
  user.endDate      = req.body.endDate;
  write(users);
  res.json({ success: true });
});

app.get('/user/:id', (req, res) => {
  const users = read();
  const user  = users.find(u => u.id == req.params.id);
  res.json(user);
});

/* ── http.Server 로 감싸서 WebSocket 업그레이드 지원 ── */
const server = http.createServer(app);
server.on('upgrade', socketProxy.upgrade);

server.listen(3000, () => {
  console.log('==============================');
  console.log('  FitAiNess Web Server');
  console.log('  http://localhost:3000');
  console.log('  /api/*      → AI  서버 :5000');
  console.log('  /cnn/*      → CNN 서버 :4000');
  console.log('  /socket.io  → AI  서버 :5000 (WS)');
  console.log('==============================');
});
