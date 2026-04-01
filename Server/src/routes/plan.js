const express = require("express");
const auth = require("../middleware/auth");
const { Plan, Goal, Profile } = require("../models");
const aiService = require("../services/aiService");
const replanService = require("../services/replanService");

const router = express.Router();

// ── [기능 7,8] AI 식단/운동 플랜 생성 ──
// POST /api/plan/generate
router.post("/generate", auth, async (req, res, next) => {
  try {
    const profile = await Profile.findOne({
      where: { user_id: req.user.user_id },
    });

    if (!profile) {
      return res.status(400).json({
        success: false,
        message: "먼저 프로필을 등록해주세요.",
      });
    }

    const goal = await Goal.findOne({
      where: { user_id: req.user.user_id },
      order: [["created_at", "DESC"]],
    });

    if (!goal) {
      return res.status(400).json({
        success: false,
        message: "먼저 목표를 설정해주세요.",
      });
    }

    // 현재 일차 계산
    const today = new Date();
    const startDate = new Date(goal.start_date);
    const dayNumber = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24)) + 1;

    // 이미 오늘 플랜이 있는지 확인
    const existingPlan = await Plan.findOne({
      where: { goal_id: goal.goal_id, day_number: dayNumber },
    });

    if (existingPlan) {
      return res.json({
        success: true,
        data: {
          plan_id: existingPlan.plan_id,
          day_number: existingPlan.day_number,
          meal: JSON.parse(existingPlan.recmd_meal || "{}"),
          workout: JSON.parse(existingPlan.recmd_workout || "{}"),
          daily_calories: existingPlan.daily_calories,
          is_existing: true,
        },
      });
    }

    // AI로 새 플랜 생성
    const [mealPlan, workoutPlan] = await Promise.all([
      aiService.generateMealPlan(profile, goal, dayNumber),
      aiService.generateWorkoutPlan(profile, goal, dayNumber),
    ]);

    const plan = await Plan.create({
      goal_id: goal.goal_id,
      day_number: dayNumber,
      recmd_meal: JSON.stringify(mealPlan),
      recmd_workout: JSON.stringify(workoutPlan),
      daily_calories: mealPlan.total_calories || 0,
    });

    res.status(201).json({
      success: true,
      data: {
        plan_id: plan.plan_id,
        day_number: dayNumber,
        meal: mealPlan,
        workout: workoutPlan,
        daily_calories: plan.daily_calories,
        is_existing: false,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── 오늘의 플랜 조회 ──
// GET /api/plan/today
router.get("/today", auth, async (req, res, next) => {
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

    const today = new Date();
    const startDate = new Date(goal.start_date);
    const dayNumber = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24)) + 1;

    const plan = await Plan.findOne({
      where: { goal_id: goal.goal_id, day_number: dayNumber },
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "오늘의 플랜이 아직 생성되지 않았습니다.",
      });
    }

    res.json({
      success: true,
      data: {
        plan_id: plan.plan_id,
        day_number: plan.day_number,
        meal: JSON.parse(plan.recmd_meal || "{}"),
        workout: JSON.parse(plan.recmd_workout || "{}"),
        daily_calories: plan.daily_calories,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── 특정 일차 플랜 조회 ──
// GET /api/plan/:dayNumber
router.get("/:dayNumber", auth, async (req, res, next) => {
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

    const plan = await Plan.findOne({
      where: {
        goal_id: goal.goal_id,
        day_number: parseInt(req.params.dayNumber),
      },
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: `${req.params.dayNumber}일차 플랜이 없습니다.`,
      });
    }

    res.json({
      success: true,
      data: {
        plan_id: plan.plan_id,
        day_number: plan.day_number,
        meal: JSON.parse(plan.recmd_meal || "{}"),
        workout: JSON.parse(plan.recmd_workout || "{}"),
        daily_calories: plan.daily_calories,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── [기능 19] 미이행 체크 ──
// GET /api/plan/check/missed
router.get("/check/missed", auth, async (req, res, next) => {
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

    const today = new Date();
    const startDate = new Date(goal.start_date);
    const currentDay = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24));

    // 지난 플랜 중 DailyLog가 없는 것 = 미이행
    const plans = await Plan.findAll({
      where: { goal_id: goal.goal_id, day_number: { [require("sequelize").Op.lt]: currentDay } },
      include: [{ model: require("../models").DailyLog, as: "logs" }],
    });

    const missedPlans = plans.filter((p) => p.logs.length === 0);

    res.json({
      success: true,
      data: {
        total_plans: plans.length,
        completed: plans.length - missedPlans.length,
        missed: missedPlans.length,
        missed_days: missedPlans.map((p) => p.day_number),
        compliance_rate:
          plans.length > 0
            ? Math.round(((plans.length - missedPlans.length) / plans.length) * 100)
            : 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── [기능 20] 재스케줄링 ──
// POST /api/plan/replan
router.post("/replan", auth, async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await replanService.replan(req.user.user_id);

    res.json({
      success: true,
      message: "플랜이 재조정되었습니다.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
