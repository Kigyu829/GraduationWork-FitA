package com.capstone.fitainess;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.navigation.fragment.NavHostFragment;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

/**
 * AI 건강 상담 화면 (Socket.io 스트리밍)
 *
 * - socket.io 연결을 통해 Ollama 응답을 토큰 단위로 실시간 표시
 * - meal_sp / workout_sp SharedPreferences에서 플랜 정보를 읽어 AI에게 전달
 * - action이 "meal_adjust"이면 식단 플랜 재조정 자동 실행
 * - action이 "exercise_adjust"이면 운동 플랜 재조정 자동 실행
 * - 식단 칼로리 변동 ≥ 50kcal 시 운동 플랜도 자동 보완
 */
public class ChatFragment extends Fragment
{
    private static final int MAX_HISTORY = 6;

    private static final String CHAT_PREFS   = "chat_sp";
    private static final String KEY_CHAT_LOG = "chat_log";
    private static final String KEY_HISTORY  = "recent_history";

    private static final String MEAL_PREFS    = "meal_sp";
    private static final String WORKOUT_PREFS = "workout_sp";

    private EditText etMessage;
    private TextView tvChatLog;
    private Button btnSend;
    private ImageButton btnBack;
    private ProgressBar progressBar;
    private ScrollView scrollChat;

    private SocketChatHelper socketChatHelper;
    private GeminiHelper geminiHelper;          // meal/workout 재조정용 (HTTP)
    private SharedPreferences chatSp;

    private StringBuilder chatLog     = new StringBuilder();
    private Deque<String> recentHistory = new ArrayDeque<>();

    // 스트리밍 상태
    private String baseChatLog;     // 스트리밍 시작 전 채팅 로그 스냅샷
    private StringBuilder streamBuf; // 현재 스트리밍 중인 토큰 버퍼

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
        btnBack     = view.findViewById(R.id.btnBack);

        socketChatHelper = new SocketChatHelper();
        geminiHelper     = new GeminiHelper();
        chatSp = requireContext().getSharedPreferences(CHAT_PREFS, Context.MODE_PRIVATE);

        btnBack.setOnClickListener(v -> NavHostFragment.findNavController(this).popBackStack());

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

    @Override
    public void onDestroyView()
    {
        super.onDestroyView();
        if (socketChatHelper != null) socketChatHelper.disconnect();
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

    private String getMealPlan()    { return mealSp().getString("meal_plan_json",    null); }
    private String getWorkoutPlan() { return workoutSp().getString("workout_plan_json", null); }

    private int calcTargetCalories() {
        int weight       = mealSp().getInt("user_weight", 70);
        int targetWeight = mealSp().getInt("user_target_weight", 65);
        int targetWeeks  = mealSp().getInt("user_target_weeks", 4);
        int tdee         = weight * 28;
        int dailyDeficit = (int) ((weight - targetWeight) * 7700.0 / (targetWeeks * 7));
        return Math.max(1200, tdee - Math.min(dailyDeficit, 1000));
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

    private String buildHistoryText() { return String.join("\n", recentHistory); }

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
    // 메시지 전송 (Socket.io 스트리밍)
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

        // 스트리밍 버블 시작
        startStreaming();

        socketChatHelper.streamChat(message, userInfo, mealPlan, workoutPlan, historyText,
                new SocketChatHelper.StreamCallback() {
                    @Override
                    public void onToken(String token) {
                        if (!isAdded()) return;
                        requireActivity().runOnUiThread(() -> appendStreamToken(token));
                    }

                    @Override
                    public void onDone(String reply, String action, String reason) {
                        if (!isAdded()) return;
                        requireActivity().runOnUiThread(() -> {
                            finalizeStream(reply);
                            addHistory("사용자: " + message, "AI: " + reply);
                            btnSend.setEnabled(true);
                            progressBar.setVisibility(View.GONE);

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
                            finalizeStream("오류가 발생했어요: " + error);
                            btnSend.setEnabled(true);
                            progressBar.setVisibility(View.GONE);
                        });
                    }
                });
    }

    // ──────────────────────────────────────
    // 스트리밍 디스플레이 헬퍼
    // ──────────────────────────────────────

    /** 스트리밍 시작 — 빈 AI 버블을 미리 생성 */
    private void startStreaming() {
        baseChatLog = chatLog.toString();
        streamBuf   = new StringBuilder();
        updateStreamDisplay();
    }

    /** 토큰 추가 후 화면 업데이트 */
    private void appendStreamToken(String token) {
        streamBuf.append(token);
        updateStreamDisplay();
    }

    /** 화면 갱신 (baseChatLog + "🤖 AI\n" + streamBuf + separator) */
    private void updateStreamDisplay() {
        String display = baseChatLog
                + "🤖 AI\n"
                + streamBuf.toString()
                + "\n\n─────────────────────\n\n";
        tvChatLog.setText(display);
        scrollChat.post(() -> scrollChat.fullScroll(ScrollView.FOCUS_DOWN));
    }

    /** 스트리밍 완료 — chatLog에 확정 반영 후 저장 */
    private void finalizeStream(String fullReply) {
        chatLog = new StringBuilder(baseChatLog);
        chatLog.append("🤖 AI\n")
               .append(fullReply)
               .append("\n\n─────────────────────\n\n");
        tvChatLog.setText(chatLog.toString());
        scrollChat.post(() -> scrollChat.fullScroll(ScrollView.FOCUS_DOWN));
        chatSp.edit().putString(KEY_CHAT_LOG, chatLog.toString()).apply();
        baseChatLog = null;
        streamBuf   = null;
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

        int oldCalories = 0;
        try { oldCalories = new JSONObject(currentPlan).optInt("total_calories", 0); }
        catch (Exception ignored) {}
        final int prevCalories = oldCalories;

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
                                mealSp().edit().putString("meal_plan_json", response).apply();

                                int diff = newCalories - prevCalories;
                                String diffText = diff > 0 ? "+" + diff : String.valueOf(diff);
                                appendChat("✅ 식단 재조정 완료",
                                        "식단이 업데이트됐어요! (" + prevCalories + " → " + newCalories
                                        + "kcal, " + diffText + "kcal)\n식단 탭에서 확인할 수 있어요.");

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

    private void handleExerciseAdjust(String reason, Integer calorieDiff) {
        String currentPlan = getWorkoutPlan();
        if (currentPlan == null) {
            if (calorieDiff == null)
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
