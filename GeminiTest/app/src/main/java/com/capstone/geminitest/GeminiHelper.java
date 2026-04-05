package com.capstone.geminitest;

import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class GeminiHelper
{
    private static final String TAG = "GeminiHelper";

    private static final String API_KEY = "AIzaSyDCOo8yJY2b2Up17ZUvVOiJeBxq82sMX8A";

    private static final String API_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + API_KEY;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    // CNN 학습된 150종 음식 라벨
    private static final String FOOD_LABELS =
            "가지볶음, 간장게장, 갈비구이, 갈비찜, 갈비탕, 갈치구이, 갈치조림, 감자전, 감자조림, "
            + "감자채볶음, 감자탕, 갓김치, 건새우볶음, 경단, 계란국, 계란말이, 계란찜, 계란후라이, "
            + "고등어구이, 고등어조림, 고사리나물, 고추장진미채볶음, 고추튀김, 곰탕/설렁탕, 곱창구이, "
            + "곱창전골, 과메기, 김밥, 김치볶음밥, 김치전, 김치찌개, 김치찜, 깍두기, 깻잎장아찌, "
            + "꼬막찜, 꽁치조림, 꽈리고추무침, 꿀떡, 나박김치, 누룽지, 닭갈비, 닭계장, 닭볶음탕, "
            + "더덕구이, 도라지무침, 도토리묵, 동그랑땡, 동태찌개, 된장찌개, 두부김치, 두부조림, "
            + "땅콩조림, 떡갈비, 떡국/만두국, 떡꼬치, 떡볶이, 라면, 라볶이, 막국수, 만두, 매운탕, "
            + "멍게, 메추리알장조림, 멸치볶음, 무국, 무생채, 물냉면, 물회, 미역국, 미역줄기볶음, "
            + "배추김치, 백김치, 보쌈, 부추김치, 북엇국, 불고기, 비빔냉면, 비빔밥, 산낙지, 삼겹살, "
            + "삼계탕, 새우볶음밥, 새우튀김, 생선전, 소세지볶음, 송편, 수육, 수정과, 수제비, 숙주나물, "
            + "순대, 순두부찌개, 시금치나물, 시래기국, 식혜, 알밥, 애호박볶음, 약과, 약식, 양념게장, "
            + "양념치킨, 어묵볶음, 연근조림, 열무국수, 열무김치, 오이소박이, 오징어채볶음, 오징어튀김, "
            + "우엉조림, 유부초밥, 육개장, 육회, 잔치국수, 잡곡밥, 잡채, 장어구이, 장조림, 전복죽, "
            + "젓갈, 제육볶음, 조개구이, 조기구이, 족발, 주꾸미볶음, 주먹밥, 짜장면, 짬뽕, 쫄면, "
            + "찜닭, 총각김치, 추어탕, 칼국수, 코다리조림, 콩국수, 콩나물국, 콩나물무침, 콩자반, "
            + "파김치, 파전, 편육, 피자, 한과, 해물찜, 호박전, 호박죽, 홍어무침, 황태구이, 회무침, "
            + "후라이드치킨, 훈제오리";

    public interface GeminiCallback
    {
        void onSuccess(String response);
        void onError(String error);
    }

    public void generate(String prompt, GeminiCallback callback)
    {
        executor.execute(() ->
        {
            try
            {
                JSONObject requestBody = new JSONObject();
                JSONArray contents = new JSONArray();
                JSONObject content = new JSONObject();
                JSONArray parts = new JSONArray();
                JSONObject part = new JSONObject();

                part.put("text", prompt);
                parts.put(part);
                content.put("parts", parts);
                contents.put(content);
                requestBody.put("contents", contents);

                URL url = new URL(API_URL);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(30000);
                conn.setReadTimeout(60000);

                OutputStream os = conn.getOutputStream();
                os.write(requestBody.toString().getBytes("UTF-8"));
                os.flush();
                os.close();

                int responseCode = conn.getResponseCode();
                BufferedReader reader;

                if (responseCode == 200)
                    reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
                else
                    reader = new BufferedReader(new InputStreamReader(conn.getErrorStream(), "UTF-8"));

                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null)
                    response.append(line);
                reader.close();
                conn.disconnect();

                if (responseCode == 200)
                {
                    JSONObject jsonResponse = new JSONObject(response.toString());
                    JSONArray candidates = jsonResponse.getJSONArray("candidates");
                    JSONObject firstCandidate = candidates.getJSONObject(0);
                    JSONObject contentObj = firstCandidate.getJSONObject("content");
                    JSONArray partsArr = contentObj.getJSONArray("parts");
                    String text = partsArr.getJSONObject(0).getString("text");
                    callback.onSuccess(text);
                }
                else
                {
                    Log.e(TAG, "Gemini API 오류: " + responseCode + " - " + response.toString());
                    callback.onError("API 오류 (코드: " + responseCode + ")");
                }
            }
            catch (Exception e)
            {
                Log.e(TAG, "Gemini 호출 실패", e);
                callback.onError("네트워크 오류: " + e.getMessage());
            }
        });
    }

    /** 기능 7: AI 식단 추천 (150종 제한 + JSON 응답) */
    public void generateMealPlan(int height, int weight, double bmi,
                                  String gender, int targetWeight, int targetWeeks,
                                  GeminiCallback callback)
    {
        // 목표 칼로리를 Java에서 직접 계산해서 AI에게 명시
        int totalDays    = targetWeeks * 7;
        int weightToLose = weight - targetWeight;

        // 체중 × 28 = 좌식 기준 유지 칼로리 간단 추정
        int tdee = weight * 28;

        // 1kg 감량 = 약 7,700kcal 적자 필요
        int dailyDeficit = (int) ((weightToLose * 7700.0) / totalDays);

        // 하루 목표 섭취량 (최소 1,200kcal 보장)
        int targetCalories = Math.max(1200, tdee - dailyDeficit);

        String prompt = "당신은 전문 영양사입니다. 다음 사용자 정보를 바탕으로 오늘의 식단을 추천해주세요.\n\n"
                + "사용자 정보:\n"
                + "- 성별: " + gender + "\n"
                + "- 키: " + height + "cm\n"
                + "- 현재 체중: " + weight + "kg\n"
                + "- BMI: " + bmi + "\n"
                + "- 목표 체중: " + targetWeight + "kg\n"
                + "- 목표 기간: " + targetWeeks + "주\n"
                + "- 하루 목표 섭취 칼로리: " + targetCalories + "kcal\n\n"
                + "★ 하루 총 칼로리 합계가 반드시 " + targetCalories + "kcal 근처(±30kcal 이내)가 되도록 식단을 구성하세요.\n"
                + "★ 중요: 반드시 아래 음식 목록 안에서만 메인 메뉴를 추천하세요. 목록에 없는 음식은 절대 추천하지 마세요.\n"
                + "【허용 음식 목록】\n" + FOOD_LABELS + "\n\n"
                + "★ 반드시 아래 JSON 형식으로만 답변하세요. 백틱(```)이나 다른 텍스트 없이 순수 JSON만 출력하세요.\n\n"
                + "{\n"
                + "  \"breakfast\": {\"menu\": [\"음식명1\", \"음식명2\"], \"calories\": 350, \"desc\": \"한 줄 설명\"},\n"
                + "  \"lunch\": {\"menu\": [\"음식명1\", \"음식명2\"], \"calories\": 500, \"desc\": \"한 줄 설명\"},\n"
                + "  \"dinner\": {\"menu\": [\"음식명1\", \"음식명2\"], \"calories\": 400, \"desc\": \"한 줄 설명\"},\n"
                + "  \"total_calories\": " + targetCalories + ",\n"
                + "  \"tip\": \"오늘의 식단 팁\"\n"
                + "}";

        generate(prompt, callback);
    }

    /** 기능 7-1: 식단 재조정 (기존 플랜 + 누적 이유 + 이번 이유 반영) */
    public void adjustMealPlan(String currentPlanJson, List<String> reasons,
                                int targetCalories, GeminiCallback callback)
    {
        // 이전 이유들과 이번 이유를 구분해서 프롬프트에 명시
        StringBuilder reasonsText = new StringBuilder();
        if (reasons.size() > 1) {
            reasonsText.append("【지금까지의 재조정 이유 - 아래 조건들을 모두 유지하면서 수정하세요】\n");
            for (int i = 0; i < reasons.size() - 1; i++) {
                reasonsText.append((i + 1)).append(". ").append(reasons.get(i)).append("\n");
            }
            reasonsText.append("\n");
        }
        reasonsText.append("【이번 재조정 이유】\n").append(reasons.get(reasons.size() - 1));

        String prompt = "당신은 전문 영양사입니다. 아래는 현재 사용자의 식단 플랜입니다.\n\n"
                + "【현재 식단 플랜】\n" + currentPlanJson + "\n\n"
                + reasonsText + "\n\n"
                + "★ 위의 모든 재조정 이유를 반영하여 식단을 수정해주세요.\n"
                + "★ 하루 총 칼로리 합계는 반드시 " + targetCalories + "kcal 근처(±30kcal 이내)를 유지하세요.\n"
                + "★ 반드시 아래 음식 목록 안에서만 메뉴를 추천하세요. 목록에 없는 음식은 절대 추천하지 마세요.\n"
                + "【허용 음식 목록】\n" + FOOD_LABELS + "\n\n"
                + "★ 반드시 아래 JSON 형식으로만 답변하세요. 백틱(```)이나 다른 텍스트 없이 순수 JSON만 출력하세요.\n\n"
                + "{\n"
                + "  \"breakfast\": {\"menu\": [\"음식명1\", \"음식명2\"], \"calories\": 350, \"desc\": \"한 줄 설명\"},\n"
                + "  \"lunch\": {\"menu\": [\"음식명1\", \"음식명2\"], \"calories\": 500, \"desc\": \"한 줄 설명\"},\n"
                + "  \"dinner\": {\"menu\": [\"음식명1\", \"음식명2\"], \"calories\": 400, \"desc\": \"한 줄 설명\"},\n"
                + "  \"total_calories\": " + targetCalories + ",\n"
                + "  \"tip\": \"재조정 관련 팁\"\n"
                + "}";

        generate(prompt, callback);
    }

    /** 기능 8: 운동 프로그램 추천 (JSON 응답) */
    public void generateWorkoutPlan(int height, int weight, double bmi,
                                     String gender, int targetWeight, int targetWeeks,
                                     GeminiCallback callback)
    {
        String prompt = "당신은 전문 운동 트레이너입니다. 다음 사용자 정보를 바탕으로 오늘의 운동 플랜을 추천해주세요.\n\n"
                + "사용자 정보:\n"
                + "- 성별: " + gender + "\n"
                + "- 키: " + height + "cm\n"
                + "- 현재 체중: " + weight + "kg\n"
                + "- BMI: " + bmi + "\n"
                + "- 목표 체중: " + targetWeight + "kg\n"
                + "- 목표 기간: " + targetWeeks + "주\n\n"
                + "★ 목표 기간에 맞는 운동 강도로 조절하세요. 기간이 짧을수록 강도를 높이세요.\n"
                + "★ 집에서 할 수 있는 맨몸 운동 위주로 추천하세요.\n"
                + "★ 반드시 아래 JSON 형식으로만 답변하세요. 백틱(```)이나 다른 텍스트 없이 순수 JSON만 출력하세요.\n\n"
                + "{\n"
                + "  \"warmup\": [{\"name\": \"운동명\", \"duration\": \"5분\", \"calories\": 30}],\n"
                + "  \"main\": [{\"name\": \"운동명\", \"sets\": 3, \"reps\": 15, \"calories\": 80}],\n"
                + "  \"cooldown\": [{\"name\": \"운동명\", \"duration\": \"5분\", \"calories\": 20}],\n"
                + "  \"total_duration\": 45,\n"
                + "  \"total_calories\": 300,\n"
                + "  \"tip\": \"오늘의 운동 팁\"\n"
                + "}";

        generate(prompt, callback);
    }

    /** 기능 8-1: 운동 재조정 (기존 플랜 + 누적 이유 반영) */
    public void adjustWorkoutPlan(String currentPlanJson, List<String> reasons,
                                   int targetWeeks, GeminiCallback callback)
    {
        StringBuilder reasonsText = new StringBuilder();
        if (reasons.size() > 1) {
            reasonsText.append("【지금까지의 재조정 이유 - 아래 조건들을 모두 유지하면서 수정하세요】\n");
            for (int i = 0; i < reasons.size() - 1; i++) {
                reasonsText.append((i + 1)).append(". ").append(reasons.get(i)).append("\n");
            }
            reasonsText.append("\n");
        }
        reasonsText.append("【이번 재조정 이유】\n").append(reasons.get(reasons.size() - 1));

        String prompt = "당신은 전문 운동 트레이너입니다. 아래는 현재 사용자의 운동 플랜입니다.\n\n"
                + "【현재 운동 플랜】\n" + currentPlanJson + "\n\n"
                + "- 목표 기간: " + targetWeeks + "주\n\n"
                + reasonsText + "\n\n"
                + "★ 위의 모든 재조정 이유를 반영하여 운동 플랜을 수정해주세요.\n"
                + "★ 집에서 할 수 있는 맨몸 운동 위주로 추천하세요.\n"
                + "★ 반드시 아래 JSON 형식으로만 답변하세요. 백틱(```)이나 다른 텍스트 없이 순수 JSON만 출력하세요.\n\n"
                + "{\n"
                + "  \"warmup\": [{\"name\": \"운동명\", \"duration\": \"5분\", \"calories\": 30}],\n"
                + "  \"main\": [{\"name\": \"운동명\", \"sets\": 3, \"reps\": 15, \"calories\": 80}],\n"
                + "  \"cooldown\": [{\"name\": \"운동명\", \"duration\": \"5분\", \"calories\": 20}],\n"
                + "  \"total_duration\": 45,\n"
                + "  \"total_calories\": 300,\n"
                + "  \"tip\": \"재조정 관련 팁\"\n"
                + "}";

        generate(prompt, callback);
    }

    /** 기능 9: AI 채팅 상담 (사용자 정보 + 플랜 + 대화 기록 포함) */
    public void chat(String currentMessage, String userInfo,
                      String mealPlanJson, String workoutPlanJson,
                      String recentHistory, GeminiCallback callback)
    {
        StringBuilder prompt = new StringBuilder();
        prompt.append("당신은 친절한 다이어트 코칭 AI입니다.\n");
        prompt.append("사용자 정보: ").append(userInfo).append("\n\n");

        if (mealPlanJson != null)
            prompt.append("【현재 식단 플랜】\n").append(mealPlanJson).append("\n\n");

        if (workoutPlanJson != null)
            prompt.append("【현재 운동 플랜】\n").append(workoutPlanJson).append("\n\n");

        if (!recentHistory.isEmpty())
            prompt.append("【최근 대화 기록】\n").append(recentHistory).append("\n");

        prompt.append("사용자: ").append(currentMessage).append("\n\n");
        prompt.append("위의 사용자 정보와 현재 플랜을 참고하여 친절하고 전문적으로 답변해주세요.\n");
        prompt.append("의학적 진단은 하지 않고, 심각한 건강 문제는 병원 방문을 권유하세요.\n");
        prompt.append("답변은 3~5문장으로 간결하게 해주세요.");

        generate(prompt.toString(), callback);
    }
}
