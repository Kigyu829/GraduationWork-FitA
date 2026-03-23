const express = require("express");
const auth = require("../middleware/auth");
const { Op, fn, col, literal } = require("sequelize");
const { DailyLog, Plan, Goal, Profile } = require("../models");

const router = express.Router();

// ── [기능 15] 대시보드 - 체중 변화 그래프 + 목표 달성률 ──
// GET /api/dashboard
router.get("/", auth, async (req, res, next) => {
  try {
    const profile = await Profile.findOne({
      where: { user_id: req.user.user_id },
    });

    const goal = await Goal.findOne({
      where: { user_id: req.user.user_id },
      order: [["created_at", "DESC"]],
    });

    if (!goal || !profile) {
      return res.status(404).json({
        success: false,
        message: "프로필과 목표를 먼저 설정해주세요.",
      });
    }

    // 진행률 계산
    const today = new Date();
    const start = new Date(goal.start_date);
    const end = new Date(goal.end_date);
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.min(
      totalDays,
      Math.ceil((today - start) / (1000 * 60 * 60 * 24))
    );

    // 식단 인증 통계
    const totalLogs = await DailyLog.count({
      where: { user_id: req.user.user_id, log_date: { [Op.gte]: goal.start_date } },
    });

    const verifiedLogs = await DailyLog.count({
      where: {
        user_id: req.user.user_id,
        is_verified: true,
        log_date: { [Op.gte]: goal.start_date },
      },
    });

    const cheatingLogs = await DailyLog.count({
      where: {
        user_id: req.user.user_id,
        is_cheating: true,
        log_date: { [Op.gte]: goal.start_date },
      },
    });

    // 오늘 인증 현황
    const todayStr = today.toISOString().split("T")[0];
    const todayLogs = await DailyLog.findAll({
      where: { user_id: req.user.user_id, log_date: todayStr },
      attributes: ["meal_type", "is_verified", "scouter_result"],
    });

    const todayMeals = {
      breakfast: todayLogs.find((l) => l.meal_type === "breakfast") || null,
      lunch: todayLogs.find((l) => l.meal_type === "lunch") || null,
      dinner: todayLogs.find((l) => l.meal_type === "dinner") || null,
    };

    res.json({
      success: true,
      data: {
        // 목표 정보
        goal: {
          target_weight: goal.target_weight,
          current_weight: profile.weight,
          remaining_kg: (profile.weight - goal.target_weight).toFixed(1),
          start_date: goal.start_date,
          end_date: goal.end_date,
          total_days: totalDays,
          elapsed_days: elapsedDays,
          remaining_days: Math.max(0, totalDays - elapsedDays),
          progress_percent: Math.round((elapsedDays / totalDays) * 100),
        },
        // 식단 통계
        stats: {
          total_logs: totalLogs,
          verified: verifiedLogs,
          cheating: cheatingLogs,
          compliance_rate:
            totalLogs > 0 ? Math.round((verifiedLogs / totalLogs) * 100) : 0,
        },
        // 오늘 현황
        today: todayMeals,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── [기능 16] 캘린더 조회 - 일자별 인증 내역 ──
// GET /api/dashboard/calendar?month=2025-03
router.get("/calendar", auth, async (req, res, next) => {
  try {
    const { month } = req.query; // 형식: 2025-03

    if (!month) {
      return res.status(400).json({
        success: false,
        message: "조회할 월을 입력해주세요. (예: 2025-03)",
      });
    }

    const [year, mon] = month.split("-");
    const startDate = `${year}-${mon}-01`;
    const endDate = new Date(parseInt(year), parseInt(mon), 0)
      .toISOString()
      .split("T")[0];

    const logs = await DailyLog.findAll({
      where: {
        user_id: req.user.user_id,
        log_date: { [Op.between]: [startDate, endDate] },
      },
      attributes: ["log_date", "meal_type", "is_verified", "is_cheating", "img_url"],
      order: [["log_date", "ASC"]],
    });

    // 날짜별로 그룹핑
    const calendar = {};
    logs.forEach((log) => {
      const date = log.log_date;
      if (!calendar[date]) {
        calendar[date] = { meals: [], verified_count: 0, cheating_count: 0 };
      }
      calendar[date].meals.push({
        meal_type: log.meal_type,
        is_verified: log.is_verified,
        is_cheating: log.is_cheating,
        has_photo: !!log.img_url,
      });
      if (log.is_verified) calendar[date].verified_count++;
      if (log.is_cheating) calendar[date].cheating_count++;
    });

    res.json({
      success: true,
      data: {
        month,
        days: calendar,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
