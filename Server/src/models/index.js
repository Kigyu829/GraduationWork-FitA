const User = require("./User");
const Profile = require("./Profile");
const Goal = require("./Goal");
const Plan = require("./Plan");
const DailyLog = require("./DailyLog");

// ── 관계 설정 (ERD 기반) ──

// User 1:1 Profile
User.hasOne(Profile, { foreignKey: "user_id", as: "profile" });
Profile.belongsTo(User, { foreignKey: "user_id" });

// User 1:N Goal
User.hasMany(Goal, { foreignKey: "user_id", as: "goals" });
Goal.belongsTo(User, { foreignKey: "user_id" });

// Goal 1:N Plan
Goal.hasMany(Plan, { foreignKey: "goal_id", as: "plans" });
Plan.belongsTo(Goal, { foreignKey: "goal_id" });

// Plan 1:N DailyLog
Plan.hasMany(DailyLog, { foreignKey: "plan_id", as: "logs" });
DailyLog.belongsTo(Plan, { foreignKey: "plan_id" });

// User 1:N DailyLog (빠른 조회용)
User.hasMany(DailyLog, { foreignKey: "user_id", as: "logs" });
DailyLog.belongsTo(User, { foreignKey: "user_id" });

module.exports = { User, Profile, Goal, Plan, DailyLog };
