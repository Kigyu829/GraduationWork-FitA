require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const http     = require('http');
const { Server } = require('socket.io');

const mealRouter       = require('./src/routes/meal');
const exerciseRouter   = require('./src/routes/exercise');
const chatRouter       = require('./src/routes/chat');
const goalRouter       = require('./src/routes/goal');
const motivationRouter = require('./src/routes/motivation');
const planRouter       = require('./src/routes/plan');
const registerChatSocket = require('./src/socket/chatSocket');

const app    = express();
const server = http.createServer(app);

// localhost(프록시)에서만 접근 허용
const ALLOWED_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];
const io     = new Server(server, {
    cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] },
});
const PORT   = process.env.PORT || 5000;

// ── 간단한 Rate Limiter (분당 IP당 최대 60회) ──
const _rateMap = new Map();
function aiRateLimit(req, res, next) {
    const ip     = req.ip || req.socket.remoteAddress || 'unknown';
    const minute = Math.floor(Date.now() / 60000);
    const key    = `${ip}-${minute}`;
    const count  = (_rateMap.get(key) || 0) + 1;
    _rateMap.set(key, count);
    for (const k of _rateMap.keys()) {
        if (!k.endsWith(`-${minute}`)) _rateMap.delete(k);
    }
    if (count > 60) {
        return res.status(429).json({ success: false, message: '요청이 너무 많습니다.' });
    }
    next();
}

// ── 미들웨어 ──
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());
app.use(aiRateLimit);

// 모든 요청 로깅
app.use((req, res, next) => {
    const time = new Date().toLocaleTimeString('ko-KR');
    console.log(`\n[${time}] ${req.method} ${req.path}`);
    if (req.body && Object.keys(req.body).length > 0) {
        const preview = { ...req.body };
        if (preview.currentPlan) preview.currentPlan = '{...}';
        console.log('  요청:', JSON.stringify(preview, null, 2).split('\n').map(l => '  ' + l).join('\n').trim());
    }
    next();
});

// ── 라우트 연결 ──
app.use('/api/meal',       mealRouter);
app.use('/api/exercise',   exerciseRouter);
app.use('/api/chat',       chatRouter);
app.use('/api/goal',       goalRouter);
app.use('/api/motivation', motivationRouter);
app.use('/api/plan',       planRouter);

// ── 헬스체크 ──
app.get('/api/health', (req, res) => {
    res.json({
        status:      'ok',
        server:      'ai_server',
        port:        PORT,
        chat_model:  'ollama/qwen2.5:14b',
        algorithm:   'rule-based (meal/exercise) + sentiment scoring',
        websocket:   'socket.io',
        rag:         'keyword-based (foodDb + exerciseDb)',
        cache:       'in-memory TTL (5min)',
        endpoints: [
            'POST   /api/meal/recommend',
            'POST   /api/meal/adjust',
            'POST   /api/exercise/recommend',
            'POST   /api/exercise/adjust',
            'POST   /api/chat',
            'POST   /api/goal/calories',
            'POST   /api/motivation',
            'POST   /api/plan/replan',
            'WS     /socket.io  (chat_message → chat_token, chat_done)',
        ],
        timestamp: new Date().toISOString(),
    });
});

// ── Socket.io 채팅 핸들러 ──
registerChatSocket(io);

// ── 전역 에러 핸들러 ──
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
});

// ── 서버 시작 (http.Server로 listen) ──
server.listen(PORT, () => {
    console.log('==============================');
    console.log('  FitAiNess AI Server');
    console.log(`  http://localhost:${PORT}`);
    console.log('  ws://localhost:' + PORT + '  (socket.io)');
    console.log('==============================');
    console.log(`  식단/운동:  규칙 기반 + 감성 점수 알고리즘`);
    console.log(`  채팅(HTTP): Ollama (qwen2.5:14b) + RAG`);
    console.log(`  채팅(WS):   Ollama 스트리밍 + RAG`);
    console.log(`  캐시:       인메모리 TTL 5분`);
    console.log('');
    console.log('  POST /api/meal/recommend     - 식단 추천');
    console.log('  POST /api/meal/adjust        - 식단 재조정');
    console.log('  POST /api/exercise/recommend - 운동 추천');
    console.log('  POST /api/exercise/adjust    - 운동 재조정');
    console.log('  POST /api/chat               - AI 채팅 (HTTP)');
    console.log('  WS   chat_message            - AI 채팅 (스트리밍)');
    console.log('  POST /api/goal/calories      - 일일 목표 칼로리 계산');
    console.log('  POST /api/motivation         - 동기부여 메시지');
    console.log('  POST /api/plan/replan        - AI 플랜 재스케줄링');
    console.log('  GET  /api/health             - 서버 상태');
    console.log('==============================');
});
