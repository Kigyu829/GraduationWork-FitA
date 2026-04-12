require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const mealRouter       = require('./src/routes/meal');
const exerciseRouter   = require('./src/routes/exercise');
const chatRouter       = require('./src/routes/chat');
const goalRouter       = require('./src/routes/goal');
const motivationRouter = require('./src/routes/motivation');
const planRouter       = require('./src/routes/plan');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── 미들웨어 ──
app.use(cors());
app.use(express.json());

// 모든 요청 로깅
app.use((req, res, next) => {
    const time = new Date().toLocaleTimeString('ko-KR');
    console.log(`\n[${time}] ${req.method} ${req.path}`);
    if (req.body && Object.keys(req.body).length > 0) {
        const preview = { ...req.body };
        if (preview.currentPlan) preview.currentPlan = '{...}'; // 너무 길어서 축약
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
        status: 'ok',
        server: 'ai_server',
        port: PORT,
        chat_model: 'ollama/qwen2.5:14b',
        algorithm: 'rule-based (meal/exercise)',
        endpoints: [
            'POST /api/meal/recommend',
            'POST /api/meal/adjust',
            'POST /api/exercise/recommend',
            'POST /api/exercise/adjust',
            'POST /api/chat',
            'POST /api/goal/calories',
            'POST /api/motivation',
            'POST /api/plan/replan',
        ],
        timestamp: new Date().toISOString(),
    });
});

// ── 전역 에러 핸들러 ──
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
});

// ── 서버 시작 ──
app.listen(PORT, () => {
    console.log('==============================');
    console.log('  FitAiNess AI Server');
    console.log(`  http://localhost:${PORT}`);
    console.log('==============================');
    console.log(`  식단/운동:  규칙 기반 알고리즘`);
    console.log(`  채팅:       Ollama (qwen2.5:14b) @ localhost:11434`);
    console.log('');
    console.log('  POST /api/meal/recommend     - 식단 추천');
    console.log('  POST /api/meal/adjust        - 식단 재조정');
    console.log('  POST /api/exercise/recommend - 운동 추천');
    console.log('  POST /api/exercise/adjust    - 운동 재조정');
    console.log('  POST /api/chat               - AI 채팅 상담');
    console.log('  POST /api/goal/calories      - 일일 목표 칼로리 계산');
    console.log('  POST /api/motivation         - 동기부여 메시지');
    console.log('  POST /api/plan/replan        - AI 플랜 재스케줄링');
    console.log('  GET  /api/health             - 서버 상태');
    console.log('==============================');
});
