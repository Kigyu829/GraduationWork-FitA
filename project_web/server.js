const express = require('express');
const fs = require('fs');
const app = express();

app.use(express.static('public'));
app.use(express.json());

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

app.listen(3000, () => console.log("http://localhost:3000"));