const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const User = sequelize.define(
  "User",
  {
    user_id: {
      type: DataTypes.STRING(100),
      primaryKey: true,
      comment: "이메일 기반 고유 ID",
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "암호화된 비밀번호",
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: "사용자 닉네임",
    },
  },
  {
    tableName: "Users",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = User;
