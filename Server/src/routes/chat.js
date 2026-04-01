const express = require("express");
const auth = require("../middleware/auth");
const { Profile } = require("../models");
const aiService = require("../services/aiService");

const router = express.Router();

// ── [기능 9] AI 실시간 채팅 ──
// POST /api/chat
router.post("/", auth, async (req, res, next) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        message: "메시지를 입력해주세요.",
      });
    }

    // 사용자 프로필 조회 (맞춤 답변용)
    const profile = await Profile.findOne({
      where: { user_id: req.user.user_id },
    });

    // OpenAI 형식으로 변환
    const formattedMessages = messages.map((msg) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    }));

    const reply = await aiService.chat(formattedMessages, profile);

    res.json({
      success: true,
      data: {
        role: "assistant",
        content: reply,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── [기능 21] 동기부여 메시지 요청 ──
// GET /api/chat/motivation
router.get("/motivation", auth, async (req, res, next) => {
  try {
    const profile = await Profile.findOne({
      where: { user_id: req.user.user_id },
    });

    // 최근 미이행 횟수 조회
    const { DailyLog, Goal } = require("../models");
    const { Op } = require("sequelize");

    const goal = await Goal.findOne({
      where: { user_id: req.user.user_id },
      order: [["created_at", "DESC"]],
    });

    let missedCount = 0;
    let missedReasons = "";

    if (goal) {
      const failedLogs = await DailyLog.findAll({
        where: {
          user_id: req.user.user_id,
          is_verified: false,
          log_date: { [Op.gte]: goal.start_date },
        },
      });
      missedCount = failedLogs.length;

      const cheatingCount = failedLogs.filter((l) => l.is_cheating).length;
      const mismatchCount = failedLogs.filter((l) => !l.is_cheating).length;
      missedReasons = `치팅 ${cheatingCount}회, 식단 불일치 ${mismatchCount}회`;
    }

    const message = await aiService.generateMotivation(
      profile,
      missedCount,
      missedReasons
    );

    res.json({
      success: true,
      data: {
        message,
        missed_count: missedCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
