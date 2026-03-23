const express = require("express");
const auth = require("../middleware/auth");
const { Profile } = require("../models");

const router = express.Router();

// ── [기능 3] 초기 신체정보 등록 ──
// POST /api/profile
router.post("/", auth, async (req, res, next) => {
  try {
    const { gender, birth, height, weight } = req.body;

    if (!gender || !birth || !height || !weight) {
      return res.status(400).json({
        success: false,
        message: "성별, 생년월일, 키, 체중을 모두 입력해주세요.",
      });
    }

    // BMI 자동 계산
    const heightM = height / 100;
    const bmi = (weight / (heightM * heightM)).toFixed(1);

    const profile = await Profile.create({
      user_id: req.user.user_id,
      gender,
      birth,
      height,
      weight,
    });

    res.status(201).json({
      success: true,
      data: { ...profile.toJSON(), bmi: parseFloat(bmi) },
    });
  } catch (error) {
    next(error);
  }
});

// ── 프로필 조회 ──
// GET /api/profile
router.get("/", auth, async (req, res, next) => {
  try {
    const profile = await Profile.findOne({
      where: { user_id: req.user.user_id },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "프로필이 등록되지 않았습니다.",
      });
    }

    const heightM = profile.height / 100;
    const bmi = (profile.weight / (heightM * heightM)).toFixed(1);

    res.json({
      success: true,
      data: { ...profile.toJSON(), bmi: parseFloat(bmi) },
    });
  } catch (error) {
    next(error);
  }
});

// ── [기능 18] 신체정보 갱신 (체중 변화 시) ──
// PUT /api/profile
router.put("/", auth, async (req, res, next) => {
  try {
    const { weight, height } = req.body;

    const profile = await Profile.findOne({
      where: { user_id: req.user.user_id },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "프로필이 등록되지 않았습니다.",
      });
    }

    if (weight) profile.weight = weight;
    if (height) profile.height = height;
    await profile.save();

    const heightM = profile.height / 100;
    const bmi = (profile.weight / (heightM * heightM)).toFixed(1);

    res.json({
      success: true,
      data: { ...profile.toJSON(), bmi: parseFloat(bmi) },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
