const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const { sequelize } = require("./config/database");

// 라우터
const authRouter = require("./routes/auth");
const profileRouter = require("./routes/profile");
const goalRouter = require("./routes/goal");
const planRouter = require("./routes/plan");
const verifyRouter = require("./routes/verify");
const chatRouter = require("./routes/chat");
const dashboardRouter = require("./routes/dashboard");

const app = express();

// ── 미들웨어 ──
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// ── API 라우트 ──
app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/goal", goalRouter);
app.use("/api/plan", planRouter);
app.use("/api/verify", verifyRouter);
app.use("/api/chat", chatRouter);
app.use("/api/dashboard", dashboardRouter);

// ── 헬스체크 ──
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── 에러 핸들러 ──
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "서버 내부 오류가 발생했습니다.",
  });
});

// ── 서버 시작 ──
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log("✅ DB 연결 성공");

    await sequelize.sync({ alter: true });
    console.log("✅ 테이블 동기화 완료");

    app.listen(PORT, () => {
      console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ 서버 시작 실패:", error);
    process.exit(1);
  }
}

startServer();
