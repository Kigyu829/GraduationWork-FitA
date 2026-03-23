const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Goal = sequelize.define(
  "Goal",
  {
    goal_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      comment: "목표 설정 고유 번호",
    },
    user_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "해당 사용자 ID",
    },
    target_weight: {
      type: DataTypes.FLOAT,
      allowNull: false,
      comment: "목표 체중 (kg)",
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: "시작일",
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: "종료일 (목표 기간)",
    },
    activity_level: {
      type: DataTypes.ENUM("low", "moderate", "high"),
      defaultValue: "moderate",
      comment: "활동량 (적음/보통/많음)",
    },
  },
  {
    tableName: "Goals",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = Goal;
