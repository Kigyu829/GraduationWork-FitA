const express = require("express");
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");
const sharp = require("sharp");
const path = require("path");
const { DailyLog, Plan, Goal } = require("../models");
const foodScouter = require("../services/foodScouter");
const aiService = require("../services/aiService");

const router = express.Router();

// ── [기능 10,11,12,13] 식단 인증 (사진 업로드 → CNN 추론 → 일치 검증) ──
// POST /api/verify/meal
router.post("/meal", upload.single("image"), async (req, res, next) => {
  // 테스트용: 인증 없으면 기본 유저 설정
  if (!req.user) {
    req.user = { user_id: "test@test.com", name: "테스트" };
  }
  try {
    const { meal_type, plan_id } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "음식 사진을 업로드해주세요.",
      });
    }

    if (!meal_type || !plan_id) {
      return res.status(400).json({
        success: false,
        message: "식사 종류(meal_type)와 플랜 ID(plan_id)가 필요합니다.",
      });
    }

    // [기능 10] 이미지 전처리 - 모델 입력 규격으로 리사이징
    const processedPath = req.file.path.replace(
      path.extname(req.file.path),
      "_processed.jpg"
    );

    await sharp(req.file.path)
      .resize(224, 224) // CNN 입력 크기
      .jpeg({ quality: 90 })
      .toFile(processedPath);

    // [기능 11] CNN 모델로 음식 판별
    const prediction = await foodScouter.predict(processedPath);

    // [기능 12] 권장 식단과 비교
    const plan = await Plan.findByPk(plan_id);

    // 테스트 모드: Plan이 없으면 CNN 결과만 반환
    if (!plan) {
      const dailyLog = await DailyLog.create({
        plan_id: 0,
        user_id: req.user.user_id,
        log_date: new Date().toISOString().split("T")[0],
        meal_type,
        img_url: req.file.path,
        scouter_result: prediction.class_name,
        scouter_confidence: prediction.confidence,
        is_verified: false,
        is_cheating: false,
      }).catch(() => null);

      return res.json({
        success: true,
        data: {
          detected_food: prediction.class_name,
          detected_food_kr: prediction.class_name_kr || prediction.class_name,
          confidence: prediction.confidence,
          top_5: prediction.top_5 || [],
          is_verified: false,
          match_detail: "테스트 모드 - 플랜 없이 CNN 결과만 반환",
        },
      });
    }

    const verification = foodScouter.verifyMeal(
      prediction.class_name,
      plan.recmd_meal,
      prediction.confidence
    );

    // [기능 13] 결과 저장
    const dailyLog = await DailyLog.create({
      plan_id: parseInt(plan_id),
      user_id: req.user.user_id,
      log_date: new Date().toISOString().split("T")[0],
      meal_type,
      img_url: req.file.path,
      scouter_result: prediction.class_name,
      scouter_confidence: prediction.confidence,
      is_verified: verification.is_verified,
      is_cheating: false,
    });

    // [기능 14] 불일치 시 알림 데이터 포함
    const response = {
      success: true,
      data: {
        log_id: dailyLog.log_id,
        detected_food: prediction.class_name,
        confidence: prediction.confidence,
        top_5: prediction.top_5 || [],
        is_verified: verification.is_verified,
        match_detail: verification.match_detail,
      },
    };

    // 불일치 시 재계획 유도 메시지 추가
    if (!verification.is_verified) {
      response.data.replan_suggestion =
        "권장 식단과 다른 음식이 감지되었습니다. 남은 식단을 재조정할까요?";
      response.data.action = "replan";
    }

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// ── 치팅 직접 입력 ──
// POST /api/verify/cheating
router.post("/cheating", auth, async (req, res, next) => {
  try {
    const { meal_type, plan_id, food_name } = req.body;

    const dailyLog = await DailyLog.create({
      plan_id: parseInt(plan_id),
      user_id: req.user.user_id,
      log_date: new Date().toISOString().split("T")[0],
      meal_type,
      scouter_result: food_name || "치팅 (직접 입력)",
      is_verified: false,
      is_cheating: true,
    });

    res.json({
      success: true,
      data: {
        log_id: dailyLog.log_id,
        message: "치팅이 기록되었습니다. 괜찮아요, 내일 다시 시작하면 됩니다!",
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── 인증 기록 조회 (특정 날짜) ──
// GET /api/verify/history?date=2025-01-01
router.get("/history", auth, async (req, res, next) => {
  try {
    const { date } = req.query;

    const where = { user_id: req.user.user_id };
    if (date) {
      where.log_date = date;
    }

    const logs = await DailyLog.findAll({
      where,
      order: [["log_date", "DESC"], ["created_at", "DESC"]],
      include: [{ model: Plan, as: "Plan", attributes: ["day_number", "recmd_meal"] }],
    });

    res.json({
      success: true,
      data: logs.map((log) => ({
        log_id: log.log_id,
        log_date: log.log_date,
        meal_type: log.meal_type,
        detected_food: log.scouter_result,
        confidence: log.scouter_confidence,
        is_verified: log.is_verified,
        is_cheating: log.is_cheating,
        img_url: log.img_url,
        day_number: log.Plan ? log.Plan.day_number : null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
