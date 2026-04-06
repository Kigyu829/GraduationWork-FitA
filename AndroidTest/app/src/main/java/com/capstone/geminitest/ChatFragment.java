package com.capstone.geminitest;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

public class ChatFragment extends Fragment
{
    private static final int MAX_HISTORY = 6;

    // 채팅 자체 저장용
    private static final String CHAT_PREFS   = "chat_sp";
    private static final String KEY_CHAT_LOG = "chat_log";
    private static final String KEY_HISTORY  = "recent_history";

    // MealFragment / WorkoutFragment와 동일한 SharedPreferences 이름
    private static final String MEAL_PREFS    = "meal_sp";
    private static final String WORKOUT_PREFS = "workout_sp";

    private EditText etMessage;
    private TextView tvChatLog;
    private Button btnSend;
    private ProgressBar progressBar;
    private ScrollView scrollChat;

    private GeminiHelper geminiHelper;
    private SharedPreferences chatSp;

    private StringBuilder chatLog = new StringBuilder();
    private Deque<String> recentHistory = new ArrayDeque<>();

    public ChatFragment() { super(R.layout.fragment_chat); }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState)
    {
        super.onViewCreated(view, savedInstanceState);

        etMessage   = view.findViewById(R.id.etMessage);
        tvChatLog   = view.findViewById(R.id.tvChatLog);
        btnSend     = view.findViewById(R.id.btnSend);
        progressBar = view.findViewById(R.id.progressBar);
        scrollChat  = view.findViewById(R.id.scrollChat);

        geminiHelper = new GeminiHelper();
        chatSp = requireContext().getSharedPreferences(CHAT_PREFS, Context.MODE_PRIVATE);

        // 저장된 채팅 기록 복원
        String savedLog = chatSp.getString(KEY_CHAT_LOG, null);
        if (savedLog != null) {
            chatLog.append(savedLog);
            tvChatLog.setText(chatLog.toString());
            scrollChat.post(() -> scrollChat.fullScroll(ScrollView.FOCUS_DOWN));
            String savedHistory = chatSp.getString(KEY_HISTORY, null);
            if (savedHistory != null) {
                try {
                    JSONArray arr = new JSONArray(savedHistory);
                    for (int i = 0; i < arr.length(); i++)
                        recentHistory.addLast(arr.getString(i));
                } catch (Exception ignored) {}
            }
        } else {
            appendChat("🤖 AI", buildWelcomeMessage());
        }

        btnSend.setOnClickListener(v -> sendMessage());
    }

    // ──────────────────────────────────────
    // SharedPreferences 헬퍼
    // ──────────────────────────────────────

    private SharedPreferences mealSp() {
        return requireContext().getSharedPreferences(MEAL_PREFS, Context.MODE_PRIVATE);
    }

    private SharedPreferences workoutSp() {
        return requireContext().getSharedPreferences(WORKOUT_PREFS, Context.MODE_PRIVATE);
    }

    private String buildUserInfo() {
        int height       = mealSp().getInt("user_height",        workoutSp().getInt("user_height", 0));
        int weight       = mealSp().getInt("user_weight",        workoutSp().getInt("user_weight", 0));
        int targetWeight = mealSp().getInt("user_target_weight", workoutSp().getInt("user_target_weight", 0));
        int targetWeeks  = mealSp().getInt("user_target_weeks",  workoutSp().getInt("user_target_weeks", 0));
        String gender    = mealSp().getString("user_gender",     workoutSp().getString("user_gender", "미등록"));

        if (height == 0) return "등록된 정보 없음";

        double bmi = Math.round((weight / Math.pow(height / 100.0, 2)) * 10) / 10.0;
        return "성별 " + gender + ", 키 " + height + "cm, 체중 " + weight + "kg"
                + ", BMI " + bmi + ", 목표 " + targetWeight + "kg (" + targetWeeks + "주)";
    }

    private String getMealPlan() {
        return mealSp().getString("meal_plan_json", null);
    }

    private String getWorkoutPlan() {
        return workoutSp().getString("workout_plan_json", null);
    }

    /** 식단 목표 칼로리 계산 (MealFragment와 동일한 로직) */
    private int calcTargetCalories() {
        int weight       = mealSp().getInt("user_weight", 70);
        int targetWeight = mealSp().getInt("user_target_weight", 65);
        int targetWeeks  = mealSp().getInt("user_target_weeks", 4);
        int tdee         = weight * 28;
        int dailyDeficit = (int) ((weight - targetWeight) * 7700.0 / (targetWeeks * 7));
        return Math.max(1200, tdee - dailyDeficit);
    }

    private int getTargetWeeks() {
        return mealSp().getInt("user_target_weeks", workoutSp().getInt("user_target_weeks", 4));
    }

    private List<String> loadReasons(SharedPreferences sp) {
        List<String> list = new ArrayList<>();
        String json = sp.getString("adjust_reasons", null);
        if (json != null) {
            try {
                JSONArray arr = new JSONArray(json);
                for (int i = 0; i < arr.length(); i++) list.add(arr.getString(i));
            } catch (Exception ignored) {}
        }
        return list;
    }

    private void saveReasons(SharedPreferences sp, List<String> reasons) {
        sp.edit().putString("adjust_reasons", new JSONArray(reasons).toString()).apply();
    }

    private String buildHistoryText() {
        return String.join("\n", recentHistory);
    }

    private String buildWelcomeMessage() {
        boolean hasMeal    = getMealPlan() != null;
        boolean hasWorkout = getWorkoutPlan() != null;
        if (hasMeal && hasWorkout)
            return "안녕하세요! 다이어트 코칭 AI입니다.\n식단 플랜과 운동 플랜이 등록되어 있어요.\n무엇이든 물어보세요!";
        else if (hasMeal)
            return "안녕하세요! 다이어트 코칭 AI입니다.\n식단 플랜이 등록되어 있어요.\n무엇이든 물어보세요!";
        else
            return "안녕하세요! 다이어트 코칭 AI입니다.\n식단·운동 탭에서 먼저 플랜을 생성하면 더 정확한 상담이 가능해요.\n무엇이든 물어보세요!";
    }

    // ──────────────────────────────────────
    // 메시지 전송
    // ──────────────────────────────────────

    private void sendMessage() {
        String message = etMessage.getText().toString().trim();
        if (message.isEmpty()) return;

        appendChat("👤 나", message);
        etMessage.setText("");
        btnSend.setEnabled(false);
        progressBar.setVisibility(View.VISIBLE);

        String userInfo    = buildUserInfo();
        String mealPlan    = getMealPlan();
        String workoutPlan = getWorkoutPlan();
        String historyText = buildHistoryText();

        geminiHelper.chat(message, userInfo, mealPlan, workoutPlan, historyText,
                new GeminiHelper.GeminiCallback() {
                    @Override
                    public void onSuccess(String response) {
                        if (!isAdded()) return;
                        requireActivity().runOnUiThread(() -> {
                            // response = "{ reply, action, reason }" JSON 문자열
                            String reply  = response;
                            String action = null;
                            String reason = null;
                            try {
                                JSONObject json = new JSONObject(response);
                                reply  = json.optString("reply", response);
                                action = json.optString("action", null);
                                reason = json.optString("reason", null);
                                if ("null".equals(action)) action = null;
                                if ("null".equals(reason)) reason = null;
                            } catch (Exception ignored) {}

                            appendChat("🤖 AI", reply);
                            addHistory("사용자: " + message, "AI: " + reply);
                            btnSend.setEnabled(true);
                            progressBar.setVisibility(View.GONE);

                            // 재조정 액션 처리
                            if ("meal_adjust".equals(action) && reason != null) {
                                handleMealAdjust(reason);
                            } else if ("exercise_adjust".equals(action) && reason != null) {
                                handleExerciseAdjust(reason, null);
                            }
                        });
                    }

                    @Override
                    public void onError(String error) {
                        if (!isAdded()) return;
                        requireActivity().runOnUiThread(() -> {
                            appendChat("❌ 오류", error);
                            btnSend.setEnabled(true);
                            progressBar.setVisibility(View.GONE);
                        });
                    }
                });
    }

    // ──────────────────────────────────────
    // 식단 재조정 → 칼로리 차이 계산 → 운동 보완
    // ──────────────────────────────────────

    private void handleMealAdjust(String reason) {
        String currentPlan = getMealPlan();
        if (currentPlan == null) {
            appendChat("🤖 AI", "등록된 식단 플랜이 없어요. 식단 탭에서 먼저 플랜을 생성해주세요.");
            return;
        }

        // 기존 칼로리 기록 (비교용)
        int oldCalories = 0;
        try { oldCalories = new JSONObject(currentPlan).optInt("total_calories", 0); }
        catch (Exception ignored) {}
        final int prevCalories = oldCalories;

        // 누적 이유 추가
        List<String> reasons = loadReasons(mealSp());
        reasons.add(reason);
        saveReasons(mealSp(), reasons);

        int targetCalories = calcTargetCalories();
        appendChat("🔄 시스템", "식단을 재조정하고 있어요...");

        geminiHelper.adjustMealPlan(currentPlan, reasons, targetCalories,
                new GeminiHelper.GeminiCallback() {
                    @Override
                    public void onSuccess(String response) {
                        if (!isAdded()) return;
                        requireActivity().runOnUiThread(() -> {
                            try {
                                JSONObject newPlan = new JSONObject(response);
                                int newCalories = newPlan.optInt("total_calories", targetCalories);

                                // 새 식단 저장
                                mealSp().edit().putString("meal_plan_json", response).apply();

                                int diff = newCalories - prevCalories;
                                String diffText = diff > 0 ? "+" + diff : String.valueOf(diff);
                                appendChat("✅ 식단 재조정 완료",
                                        "식단이 업데이트됐어요! (" + prevCalories + " → " + newCalories + "kcal, " + diffText + "kcal)\n"
                                        + "식단 탭에서 확인할 수 있어요.");

                                // 칼로리 차이가 50kcal 이상이면 운동도 보완
                                if (Math.abs(diff) >= 50) {
                                    String compensationReason = diff > 0
                                            ? "식단 칼로리가 " + diff + "kcal 증가했으므로 운동 소모 칼로리를 " + diff + "kcal 늘려주세요"
                                            : "식단 칼로리가 " + Math.abs(diff) + "kcal 감소했으므로 운동 소모 칼로리를 " + Math.abs(diff) + "kcal 줄여주세요";
                                    handleExerciseAdjust(compensationReason, diff);
                                }

                            } catch (Exception e) {
                                appendChat("❌ 오류", "식단 재조정 파싱 실패: " + e.getMessage());
                            }
                        });
                    }

                    @Override
                    public void onError(String error) {
                        if (!isAdded()) return;
                        requireActivity().runOnUiThread(() ->
                                appendChat("❌ 오류", "식단 재조정 실패: " + error));
                    }
                });
    }

    // ──────────────────────────────────────
    // 운동 재조정 (직접 요청 또는 칼로리 보완)
    // calorieDiff: null이면 직접 요청, 값이 있으면 칼로리 보완
    // ──────────────────────────────────────

    private void handleExerciseAdjust(String reason, Integer calorieDiff) {
        String currentPlan = getWorkoutPlan();
        if (currentPlan == null) {
            if (calorieDiff == null) // 직접 요청인 경우에만 메시지 표시
                appendChat("🤖 AI", "등록된 운동 플랜이 없어요. 운동 탭에서 먼저 플랜을 생성해주세요.");
            return;
        }

        List<String> reasons = loadReasons(workoutSp());
        reasons.add(reason);
        saveReasons(workoutSp(), reasons);

        String statusMsg = calorieDiff != null
                ? "칼로리 차이(" + (calorieDiff > 0 ? "+" : "") + calorieDiff + "kcal)를 운동으로 보완하고 있어요..."
                : "운동을 재조정하고 있어요...";
        appendChat("🔄 시스템", statusMsg);

        geminiHelper.adjustWorkoutPlan(currentPlan, reasons, getTargetWeeks(),
                new GeminiHelper.GeminiCallback() {
                    @Override
                    public void onSuccess(String response) {
                        if (!isAdded()) return;
                        requireActivity().runOnUiThread(() -> {
                            try {
                                JSONObject newPlan = new JSONObject(response);
                                workoutSp().edit().putString("workout_plan_json", response).apply();
                                int newTotalCal = newPlan.optInt("total_calories", 0);
                                String msg = calorieDiff != null
                                        ? "운동도 조정됐어요! 목표 소모 칼로리: " + newTotalCal + "kcal\n운동 탭에서 확인할 수 있어요."
                                        : "운동이 업데이트됐어요! 목표 소모 칼로리: " + newTotalCal + "kcal\n운동 탭에서 확인할 수 있어요.";
                                appendChat("✅ 운동 재조정 완료", msg);
                            } catch (Exception e) {
                                appendChat("❌ 오류", "운동 재조정 파싱 실패: " + e.getMessage());
                            }
                        });
                    }

                    @Override
                    public void onError(String error) {
                        if (!isAdded()) return;
                        requireActivity().runOnUiThread(() ->
                                appendChat("❌ 오류", "운동 재조정 실패: " + error));
                    }
                });
    }

    // ──────────────────────────────────────
    // 유틸
    // ──────────────────────────────────────

    private void addHistory(String userLine, String aiLine) {
        recentHistory.addLast(userLine);
        recentHistory.addLast(aiLine);
        while (recentHistory.size() > MAX_HISTORY) recentHistory.removeFirst();
        chatSp.edit().putString(KEY_HISTORY, new JSONArray(recentHistory).toString()).apply();
    }

    private void appendChat(String sender, String message) {
        chatLog.append(sender).append("\n");
        chatLog.append(message).append("\n\n");
        chatLog.append("─────────────────────\n\n");
        tvChatLog.setText(chatLog.toString());
        scrollChat.post(() -> scrollChat.fullScroll(ScrollView.FOCUS_DOWN));
        chatSp.edit().putString(KEY_CHAT_LOG, chatLog.toString()).apply();
    }
}
