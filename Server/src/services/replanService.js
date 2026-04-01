const { Plan, Goal, DailyLog, Profile } = require("../models");
const aiService = require("./aiService");
const { Op } = require("sequelize");

class ReplanService {
  /**
   * [기능 20] AI 재스케줄링
   * 누적된 미이행 데이터를 바탕으로 남은 기간의 플랜을 재조정
   *
   * 트리거 조건:
   * - 식단 불일치 3회 이상 누적
   * - 사용자가 직접 재계획 요청
   */
  async replan(userId) {
    // 1. 현재 목표 조회
    const goal = await Goal.findOne({
      where: { user_id: userId },
      order: [["created_at", "DESC"]],
    });

    if (!goal) {
      throw new Error("설정된 목표가 없습니다.");
    }

    const profile = await Profile.findOne({
      where: { user_id: userId },
    });

    // 2. 미이행 데이터 분석
    const failedLogs = await DailyLog.findAll({
      where: {
        user_id: userId,
        is_verified: false,
        log_date: { [Op.gte]: goal.start_date },
      },
    });

    const cheatingLogs = await DailyLog.findAll({
      where: {
        user_id: userId,
        is_cheating: true,
        log_date: { [Op.gte]: goal.start_date },
      },
    });

    // 3. 남은 일수 계산
    const today = new Date();
    const endDate = new Date(goal.end_date);
    const remainingDays = Math.ceil(
      (endDate - today) / (1000 * 60 * 60 * 24)
    );

    if (remainingDays <= 0) {
      throw new Error("목표 기간이 이미 종료되었습니다.");
    }

    // 4. 기존 미래 플랜 삭제
    const todayStr = today.toISOString().split("T")[0];
    await Plan.destroy({
      where: {
        goal_id: goal.goal_id,
        day_number: {
          [Op.gt]: Math.ceil(
            (today - new Date(goal.start_date)) / (1000 * 60 * 60 * 24)
          ),
        },
      },
    });

    // 5. 새 플랜 생성 (남은 기간에 대해)
    const currentDay = Math.ceil(
      (today - new Date(goal.start_date)) / (1000 * 60 * 60 * 24)
    );

    const newPlans = [];

    for (let i = 1; i <= Math.min(remainingDays, 7); i++) {
      const dayNum = currentDay + i;

      const mealPlan = await aiService.generateMealPlan(
        profile,
        goal,
        dayNum
      );

      const workoutPlan = await aiService.generateWorkoutPlan(
        profile,
        goal,
        dayNum
      );

      const plan = await Plan.create({
        goal_id: goal.goal_id,
        day_number: dayNum,
        recmd_meal: JSON.stringify(mealPlan),
        recmd_workout: JSON.stringify(workoutPlan),
        daily_calories: mealPlan.total_calories,
      });

      newPlans.push(plan);
    }

    return {
      replan_reason: `미이행 ${failedLogs.length}회, 치팅 ${cheatingLogs.length}회`,
      remaining_days: remainingDays,
      new_plans_count: newPlans.length,
      plans: newPlans,
    };
  }
}

module.exports = new ReplanService();
