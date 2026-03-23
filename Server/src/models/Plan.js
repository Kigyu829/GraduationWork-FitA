const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Plan = sequelize.define(
  "Plan",
  {
    plan_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      comment: "AI 생성 플랜 번호",
    },
    goal_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "해당 목표 정보 참조",
    },
    day_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "시작일로부터의 n일차",
    },
    recmd_meal: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "권장 식단 (JSON: Label 포함)",
    },
    recmd_workout: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "권장 운동 및 세트 수 (JSON)",
    },
    daily_calories: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "일일 권장 칼로리",
    },
  },
  {
    tableName: "Plans",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = Plan;
