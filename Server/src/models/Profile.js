const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Profile = sequelize.define(
  "Profile",
  {
    profile_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      comment: "프로필 일련번호",
    },
    user_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "Users 테이블 참조",
    },
    gender: {
      type: DataTypes.CHAR(1),
      allowNull: false,
      comment: "성별 (M/F)",
    },
    birth: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: "생년월일",
    },
    height: {
      type: DataTypes.FLOAT,
      allowNull: false,
      comment: "키 (cm)",
    },
    weight: {
      type: DataTypes.FLOAT,
      allowNull: false,
      comment: "현재 체중 (kg)",
    },
  },
  {
    tableName: "Profiles",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = Profile;
