require('dotenv').config();

const express       = require('express');
const cors          = require('cors');
const http          = require('http');
const { Server }    = require('socket.io');
const swaggerUi     = require('swagger-ui-express');
const swaggerSpec   = require('./src/swagger');

const mealRouter       = require('./src/routes/meal');
const exerciseRouter   = require('./src/routes/exercise');
const chatRouter       = require('./src/routes/chat');
const goalRouter       = require('./src/routes/goal');
const motivationRouter = require('./src/routes/motivation');
const planRouter       = require('./src/routes/plan');
const registerChatSocket = require('./src/socket/chatSocket');

const app    = express();
const server = http.createServer(app);

// 로컬 네트워크 접근 허용 (Android WebView는 PC IP로 접속)
const io     = new Server(server, {
    cors: { origin: true, methods: ['GET', 'POST'] },
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
app.use(cors());
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

// ── Swagger UI ──
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'FitAiNess API Docs',
    swaggerOptions: { defaultModelsExpandDepth: -1 },
}));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// ── 라우트 연결 ──
app.use('/api/meal',       mealRouter);
app.use('/api/exercise',   exerciseRouter);
app.use('/api/chat',       chatRouter);
app.use('/api/goal',       goalRouter);
app.use('/api/motivation', motivationRouter);
app.use('/api/plan',       planRouter);

// ── 4.6.3/4.6.4 측정 로그 수신 (원격 PC 실험용 임시 엔드포인트) ──
// hc503.html이 브라우저 콘솔에 찍는 것과 동일한 데이터를 여기로도 보내
// 서버(호스트 PC)의 이 터미널에서 바로 볼 수 있게 한다.
// (위 전역 로깅 미들웨어가 req.body를 이미 예쁘게 찍어주므로 별도 포맷팅 불필요)
app.post('/api/log-measurement', (req, res) => {
    console.log('  ↑ [원격 PC 측정 결과 수신]');
    res.json({ success: true });
});

// ── 헬스체크 ──
app.get('/api/health', (req, res) => {
    res.json({
        status:      'ok',
        server:      'ai_server',
        port:        PORT,
        chat_model:  'gemini-2.5-flash',
        algorithm:   'rule-based (meal/exercise) + Gemini NLU (adjust)',
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
    console.log(`  http://localhost:${PORT}/api-docs  ← Swagger UI`);
    console.log('  ws://localhost:' + PORT + '  (socket.io)');
    console.log('==============================');
    console.log(`  식단/운동:  규칙 기반 + 감성 점수 알고리즘`);
    console.log(`  채팅(HTTP): Gemini (gemini-2.5-flash) + RAG`);
    console.log(`  채팅(WS):   Gemini 스트리밍 + RAG`);
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
