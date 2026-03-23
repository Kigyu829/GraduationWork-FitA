const express = require("express");
const auth = require("../middleware/auth");
const { Goal, Profile } = require("../models");

const router = express.Router();

// ── [기능 4,5,6] 목표 설정 (체중, 기간, 강도) ──
// POST /api/goal
router.post("/", auth, async (req, res, next) => {
  try {
    const { target_weight, duration_weeks, activity_level } = req.body;

    if (!target_weight || !duration_weeks) {
      return res.status(400).json({
        success: false,
        message: "목표 체중과 기간을 입력해주세요.",
      });
    }

    // 프로필에서 현재 체중 확인
    const profile = await Profile.findOne({
      where: { user_id: req.user.user_id },
    });

    if (!profile) {
      return res.status(400).json({
        success: false,
        message: "먼저 프로필을 등록해주세요.",
      });
    }

    // 목표 유효성 검증 (1주 1kg 이상 감량은 위험)
    const weightDiff = profile.weight - target_weight;
    const weeklyLoss = weightDiff / duration_weeks;

    if (weeklyLoss > 1.0) {
      return res.status(400).json({
        success: false,
        message: `주당 ${weeklyLoss.toFixed(1)}kg 감량은 무리합니다. 기간을 늘려주세요.`,
      });
    }

    // 시작일/종료일 계산
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + duration_weeks * 7);

    // 활동량 기반 일일 권장 칼로리 계산
    const dailyCalories = calculateDailyCalories(
      profile,
      target_weight,
      duration_weeks,
      activity_level || "moderate"
    );

    const goal = await Goal.create({
      user_id: req.user.user_id,
      target_weight,
      start_date: startDate,
      end_date: endDate,
      activity_level: activity_level || "moderate",
    });

    res.status(201).json({
      success: true,
      data: {
        ...goal.toJSON(),
        current_weight: profile.weight,
        weekly_loss: weeklyLoss.toFixed(2),
        daily_calories: dailyCalories,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── 현재 목표 조회 ──
// GET /api/goal/current
router.get("/current", auth, async (req, res, next) => {
  try {
    const goal = await Goal.findOne({
      where: { user_id: req.user.user_id },
      order: [["created_at", "DESC"]],
    });

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "설정된 목표가 없습니다.",
      });
    }

    // 진행률 계산
    const today = new Date();
    const start = new Date(goal.start_date);
    const end = new Date(goal.end_date);
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.ceil((today - start) / (1000 * 60 * 60 * 24));
    const progress = Math.min(100, Math.round((elapsedDays / totalDays) * 100));

    res.json({
      success: true,
      data: {
        ...goal.toJSON(),
        total_days: totalDays,
        elapsed_days: elapsedDays,
        remaining_days: Math.max(0, totalDays - elapsedDays),
        progress_percent: progress,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── 일일 권장 칼로리 계산 (Harris-Benedict + 활동계수) ──
function calculateDailyCalories(profile, targetWeight, weeks, activityLevel) {
  const age = Math.floor(
    (new Date() - new Date(profile.birth)) / (365.25 * 24 * 60 * 60 * 1000)
  );

  // 기초대사량 (BMR) - Mifflin-St Jeor
  let bmr;
  if (profile.gender === "M") {
    bmr = 10 * profile.weight + 6.25 * profile.height - 5 * age + 5;
  } else {
    bmr = 10 * profile.weight + 6.25 * profile.height - 5 * age - 161;
  }

  // 활동계수
  const activityMultiplier = {
    low: 1.2,
    moderate: 1.55,
    high: 1.725,
  };

  const tdee = bmr * (activityMultiplier[activityLevel] || 1.55);

  // 목표 감량을 위한 칼로리 적자 계산
  // 1kg 지방 ≈ 7700kcal
  const totalDeficit = (profile.weight - targetWeight) * 7700;
  const dailyDeficit = totalDeficit / (weeks * 7);

  // 최소 1200kcal 보장
  return Math.max(1200, Math.round(tdee - dailyDeficit));
}

module.exports = router;
