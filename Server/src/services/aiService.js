const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class AIService {
  /**
   * [기능 7] AI 식단 가이드 생성
   * 신체정보 + 목표를 기반으로 일일 추천 식단 생성
   */
  async generateMealPlan(profile, goal, dayNumber) {
    const prompt = `당신은 전문 영양사입니다. 다음 사용자 정보를 바탕으로 ${dayNumber}일차 식단을 추천해주세요.

사용자 정보:
- 성별: ${profile.gender === "M" ? "남성" : "여성"}
- 키: ${profile.height}cm
- 현재 체중: ${profile.weight}kg
- 목표 체중: ${goal.target_weight}kg
- 활동량: ${goal.activity_level}

반드시 아래 JSON 형식으로만 응답해주세요:
{
  "items": [
    {"meal_type": "breakfast", "label": "음식명", "description": "간단한 설명", "calories": 숫자},
    {"meal_type": "lunch", "label": "음식명", "description": "간단한 설명", "calories": 숫자},
    {"meal_type": "dinner", "label": "음식명", "description": "간단한 설명", "calories": 숫자}
  ],
  "total_calories": 숫자,
  "tips": "오늘의 식단 팁"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    return JSON.parse(response.choices[0].message.content);
  }

  /**
   * [기능 8] 운동 프로그램 추천
   * METs 공식 기반 맞춤형 운동 추천
   */
  async generateWorkoutPlan(profile, goal, dayNumber) {
    const prompt = `당신은 전문 운동 트레이너입니다. 다음 사용자 정보를 바탕으로 ${dayNumber}일차 운동을 추천해주세요.

사용자 정보:
- 성별: ${profile.gender === "M" ? "남성" : "여성"}
- 체중: ${profile.weight}kg
- 목표 체중: ${goal.target_weight}kg
- 활동량: ${goal.activity_level}

반드시 아래 JSON 형식으로만 응답해주세요:
{
  "exercises": [
    {"name": "운동명", "sets": 세트수, "reps": 횟수, "duration_min": 시간, "mets": METs값, "calories_burned": 소모칼로리}
  ],
  "total_duration": 총시간(분),
  "total_calories_burned": 총소모칼로리,
  "difficulty": "easy|moderate|hard",
  "tips": "오늘의 운동 팁"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    return JSON.parse(response.choices[0].message.content);
  }

  /**
   * [기능 9] AI 실시간 채팅
   * 건강 관련 궁금증 상담
   */
  async chat(messages, profile) {
    const systemPrompt = `당신은 다이어트 코칭 AI입니다. 사용자의 건강 관련 질문에 친절하고 전문적으로 답변해주세요.
사용자 정보: ${profile ? `키 ${profile.height}cm, 체중 ${profile.weight}kg, ${profile.gender === "M" ? "남성" : "여성"}` : "정보 없음"}
주의: 의학적 진단은 하지 않습니다. 심각한 건강 문제는 병원 방문을 권유하세요.`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.8,
      max_tokens: 500,
    });

    return response.choices[0].message.content;
  }

  /**
   * [기능 21] 동기부여 메시지 생성
   * 미이행 데이터 분석 후 포기 방지 메시지
   */
  async generateMotivation(profile, missedCount, missedReasons) {
    const prompt = `사용자가 최근 ${missedCount}회 식단/운동을 미이행했습니다.
미이행 사유: ${missedReasons || "알 수 없음"}

사용자가 포기하지 않도록 따뜻하고 현실적인 격려 메시지를 작성해주세요.
- 3~4문장
- 자책하지 않도록 배려
- 구체적인 작은 실천 제안 포함`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9,
      max_tokens: 300,
    });

    return response.choices[0].message.content;
  }
}

module.exports = new AIService();
