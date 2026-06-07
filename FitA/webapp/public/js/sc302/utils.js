'use strict';

function hasTodayPlan() {
  const data = Storage.getUser();
  return data.planDate === todayStr() && !!(data.aiMealPlan && data.aiWorkoutPlan);
}
