const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const DailyLog = sequelize.define(
  "DailyLog",
  {
    log_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      comment: "활동 기록 고유 번호",
    },
    plan_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "해당 일자 플랜 참조",
    },
    user_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "사용자 ID (빠른 조회용)",
    },
    log_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: "기록 날짜",
    },
    meal_type: {
      type: DataTypes.ENUM("breakfast", "lunch", "dinner", "snack"),
      allowNull: false,
      comment: "아침/점심/저녁/간식 구분",
    },
    img_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "업로드된 음식 사진 저장 경로",
    },
    scouter_result: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: "Food Scouter CNN이 판독한 음식명",
    },
    scouter_confidence: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: "CNN 판독 confidence score",
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "AI 식단 일치 여부 (성공/실패)",
    },
    is_cheating: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "사용자 직접 치팅 입력 여부",
    },
  },
  {
    tableName: "DailyLogs",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = DailyLog;
