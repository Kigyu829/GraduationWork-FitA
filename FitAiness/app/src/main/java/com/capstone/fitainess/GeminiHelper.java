package com.capstone.fitainess;

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

    // 에뮬레이터: 10.0.2.2 / 실기기: 서버 PC의 실제 IP (예: 192.168.0.x)
    // 실기기 사용 시 아래 주석 해제하고 PC IP로 변경
    private static final String AI_SERVER = "http://10.0.2.2:5000";
    // private static final String AI_SERVER = "http://192.168.0.x:5000";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    public interface GeminiCallback
    {
        void onSuccess(String response);
        void onError(String error);
    }

    /** AI 서버로 POST 요청 → 응답 문자열 반환 */
    private String postJson(String endpoint, JSONObject body) throws Exception
    {
        URL url = new URL(AI_SERVER + endpoint);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(60000);

        OutputStream os = conn.getOutputStream();
        os.write(body.toString().getBytes("UTF-8"));
        os.flush();
        os.close();

        int code = conn.getResponseCode();
        BufferedReader reader = new BufferedReader(new InputStreamReader(
                code == 200 ? conn.getInputStream() : conn.getErrorStream(), "UTF-8"));

        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) sb.append(line);
        reader.close();
        conn.disconnect();

        if (code != 200) {
            JSONObject err = new JSONObject(sb.toString());
            throw new Exception(err.optString("message", "서버 오류 (코드: " + code + ")"));
        }

        return sb.toString();
    }

    /** 기능 7: AI 식단 추천 */
    public void generateMealPlan(int height, int weight, double bmi,
                                  String gender, int targetWeight, int targetWeeks,
                                  GeminiCallback callback)
    {
        executor.execute(() -> {
            try {
                JSONObject body = new JSONObject();
                body.put("height", height);
                body.put("weight", weight);
                body.put("bmi", bmi);
                body.put("gender", gender);
                body.put("targetWeight", targetWeight);
                body.put("targetWeeks", targetWeeks);

                String response = postJson("/api/meal/recommend", body);
                JSONObject json = new JSONObject(response);
                callback.onSuccess(json.getJSONObject("data").toString());

            } catch (Exception e) {
                Log.e(TAG, "식단 추천 실패", e);
                callback.onError("네트워크 오류: " + e.getMessage());
            }
        });
    }

    /** 기능 7-1: 식단 재조정 (누적 이유 반영) */
    public void adjustMealPlan(String currentPlanJson, List<String> reasons,
                                int targetCalories, GeminiCallback callback)
    {
        executor.execute(() -> {
            try {
                JSONObject body = new JSONObject();
                body.put("currentPlan", new JSONObject(currentPlanJson));
                body.put("reasons", new JSONArray(reasons));
                body.put("targetCalories", targetCalories);

                String response = postJson("/api/meal/adjust", body);
                JSONObject json = new JSONObject(response);
                callback.onSuccess(json.getJSONObject("data").toString());

            } catch (Exception e) {
                Log.e(TAG, "식단 재조정 실패", e);
                callback.onError("네트워크 오류: " + e.getMessage());
            }
        });
    }

    /** 기능 8: 운동 프로그램 추천 */
    public void generateWorkoutPlan(int height, int weight, double bmi,
                                     String gender, int targetWeight, int targetWeeks,
                                     GeminiCallback callback)
    {
        executor.execute(() -> {
            try {
                JSONObject body = new JSONObject();
                body.put("height", height);
                body.put("weight", weight);
                body.put("bmi", bmi);
                body.put("gender", gender);
                body.put("targetWeight", targetWeight);
                body.put("targetWeeks", targetWeeks);

                String response = postJson("/api/exercise/recommend", body);
                JSONObject json = new JSONObject(response);
                callback.onSuccess(json.getJSONObject("data").toString());

            } catch (Exception e) {
                Log.e(TAG, "운동 추천 실패", e);
                callback.onError("네트워크 오류: " + e.getMessage());
            }
        });
    }

    /** 기능 8-1: 운동 재조정 (누적 이유 반영) */
    public void adjustWorkoutPlan(String currentPlanJson, List<String> reasons,
                                   int targetWeeks, GeminiCallback callback)
    {
        executor.execute(() -> {
            try {
                JSONObject body = new JSONObject();
                body.put("currentPlan", new JSONObject(currentPlanJson));
                body.put("reasons", new JSONArray(reasons));
                body.put("targetWeeks", targetWeeks);

                String response = postJson("/api/exercise/adjust", body);
                JSONObject json = new JSONObject(response);
                callback.onSuccess(json.getJSONObject("data").toString());

            } catch (Exception e) {
                Log.e(TAG, "운동 재조정 실패", e);
                callback.onError("네트워크 오류: " + e.getMessage());
            }
        });
    }

    /** 기능 9: AI 채팅 상담 */
    public void chat(String currentMessage, String userInfo,
                      String mealPlanJson, String workoutPlanJson,
                      String recentHistory, GeminiCallback callback)
    {
        executor.execute(() -> {
            try {
                JSONObject body = new JSONObject();
                body.put("message", currentMessage);
                body.put("userInfo", userInfo != null ? userInfo : "");
                if (mealPlanJson != null)    body.put("mealPlan", new JSONObject(mealPlanJson));
                if (workoutPlanJson != null) body.put("workoutPlan", new JSONObject(workoutPlanJson));
                body.put("recentHistory", recentHistory != null ? recentHistory : "");

                String response = postJson("/api/chat", body);
                // ChatFragment에서 action/reason도 파싱할 수 있도록 전체 JSON 전달
                callback.onSuccess(response);

            } catch (Exception e) {
                Log.e(TAG, "채팅 실패", e);
                callback.onError("네트워크 오류: " + e.getMessage());
            }
        });
    }
}
