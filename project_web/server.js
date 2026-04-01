const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const WEB_PORT = 3000;
const CNN_SERVER = process.env.CNN_SERVER_URL || 'http://localhost:4000';

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads', { recursive: true });

const FILE = './data/users.json';

const read = () => JSON.parse(fs.readFileSync(FILE));
const write = (data) => fs.writeFileSync(FILE, JSON.stringify(data, null, 2));

/* 회원가입 */
app.post('/register', (req, res) => {
    const users = read();

    const user = {
        id: Date.now(),
        email: req.body.email,
        password: req.body.password,
        nickname: req.body.nickname,
        phone: req.body.phone
    };

    users.push(user);
    write(users);

    res.json({ userId: user.id, nickname: user.nickname });
});

/* 로그인 */
app.post('/login', (req, res) => {
    const users = read();

    const user = users.find(
        u => u.email === req.body.email && u.password === req.body.password
    );

    if (!user) return res.json({ success: false });

    res.json({ success: true, userId: user.id });
});

/* 정보1 */
app.post('/info1', (req, res) => {
    const users = read();
    const user = users.find(u => u.id == req.body.userId);

    user.birth = req.body.birth;
    user.gender = req.body.gender;
    user.height = Number(req.body.height);
    user.weight = Number(req.body.weight);

    const h = user.height / 100;
    user.bmi = (user.weight / (h * h)).toFixed(1);

    write(users);

    res.json({ bmi: user.bmi });
});

/* 목표 */
app.post('/goal', (req, res) => {
    const users = read();
    const user = users.find(u => u.id == req.body.userId);

    user.targetWeight = req.body.targetWeight;
    user.startDate = req.body.startDate;
    user.endDate = req.body.endDate;

    write(users);

    res.json({ success: true });
});

/* 유저 조회 */
app.get('/user/:id', (req, res) => {
    const users = read();
    const user = users.find(u => u.id == req.params.id);
    res.json(user);
});

const multer = require('multer');
const multerStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dateFolder = new Date().toISOString().split('T')[0];
        const dest = path.join('./uploads', dateFolder);
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const suffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `food_${suffix}${path.extname(file.originalname)}`);
    }
});
const upload = multer({
    storage: multerStorage,
    fileFilter: (req, file, cb) => {
        cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
    },
    limits: { fileSize: 10 * 1024 * 1024 }
});

// 사진 업로드 → CNN 서버로 전달 → 결과 반환
app.post('/api/verify/meal', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: '이미지를 업로드해주세요.' });
        }

        console.log(`이미지 수신: ${req.file.filename}`);
        console.log(`CNN 서버(${CNN_SERVER})로 전달 중...`);

        // 이미지를 CNN 서버로 전송
        const { File } = require('buffer');
        const imageBuffer = fs.readFileSync(req.file.path);
        const file = new File([imageBuffer], req.file.filename, { type: req.file.mimetype });
        const formData = new FormData();
        formData.append('image', file);
        formData.append('meal_type', req.body.meal_type || 'unknown');

        const response = await fetch(`${CNN_SERVER}/api/analyze`, {
            method: 'POST',
            body: formData,
        });

        const result = await response.json();

        console.log(`CNN 서버 응답: ${result.data?.detected_food_kr || 'unknown'} (${(result.data?.confidence * 100).toFixed(1)}%)`);

        // 인증 기록 웹 서버에 저장
        const logFile = './data/meal_logs.json';
        const logs = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile)) : [];
        logs.push({
            id: Date.now(),
            date: new Date().toISOString(),
            meal_type: req.body.meal_type || 'unknown',
            detected_food: result.data?.detected_food,
            detected_food_kr: result.data?.detected_food_kr,
            confidence: result.data?.confidence,
            top_5: result.data?.top_5,
            img_url: req.file.path,
            source: 'cnn_server'
        });
        fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));

        // CNN 서버 결과를 그대로 클라이언트에 반환
        res.json(result);

    } catch (error) {
        console.error('CNN 서버 통신 실패:', error.message);
        res.status(502).json({
            success: false,
            message: `CNN 서버(${CNN_SERVER})에 연결할 수 없습니다. CNN 서버가 실행 중인지 확인해주세요.`,
        });
    }
});

// 인증 기록 조회
app.get('/api/verify/history', (req, res) => {
    const logFile = './data/meal_logs.json';
    const logs = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile)) : [];
    res.json({ success: true, data: logs });
});

// CNN 서버 상태 확인 (프록시)
app.get('/api/cnn/health', async (req, res) => {
    try {
        const response = await fetch(`${CNN_SERVER}/api/health`);
        const data = await response.json();
        res.json({ web_server: 'ok', cnn_server: data });
    } catch {
        res.json({ web_server: 'ok', cnn_server: 'offline' });
    }
});

// 웹 서버 헬스체크
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        server: 'web',
        port: WEB_PORT,
        cnn_server_url: CNN_SERVER,
        timestamp: new Date().toISOString()
    });
});

// 에러 핸들러
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
});

// 서버 시작
app.listen(WEB_PORT, () => {
    console.log(`http://localhost:${WEB_PORT}`);
    console.log(`CNN 서버: ${CNN_SERVER}`);
    console.log('메인 페이지: http://localhost:3000/pages/sc101.html');
});
