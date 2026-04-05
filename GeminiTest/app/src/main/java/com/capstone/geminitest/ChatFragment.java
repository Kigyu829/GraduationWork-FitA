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

import java.util.ArrayDeque;
import java.util.Deque;

public class ChatFragment extends Fragment
{
    // 최근 대화 기록 최대 보관 개수 (사용자+AI 각 1쌍 = 2개씩)
    private static final int MAX_HISTORY = 6;

    private EditText etMessage;
    private TextView tvChatLog;
    private Button btnSend;
    private ProgressBar progressBar;
    private ScrollView scrollChat;

    private GeminiHelper geminiHelper;

    // 화면 표시용 전체 로그
    private StringBuilder chatLog = new StringBuilder();
    // AI 프롬프트 전달용 최근 대화 기록 (최대 MAX_HISTORY개)
    private Deque<String> recentHistory = new ArrayDeque<>();

    public ChatFragment() { super(R.layout.fragment_chat); }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState)
    {
        super.onViewCreated(view, savedInstanceState);

        etMessage  = view.findViewById(R.id.etMessage);
        tvChatLog  = view.findViewById(R.id.tvChatLog);
        btnSend    = view.findViewById(R.id.btnSend);
        progressBar = view.findViewById(R.id.progressBar);
        scrollChat = view.findViewById(R.id.scrollChat);

        geminiHelper = new GeminiHelper();

        appendChat("🤖 AI", buildWelcomeMessage());
        btnSend.setOnClickListener(v -> sendMessage());
    }

    /** SharedPreferences에서 사용자 정보 문자열 조합 */
    private String buildUserInfo()
    {
        SharedPreferences mealSp = requireContext()
                .getSharedPreferences("meal_prefs", Context.MODE_PRIVATE);
        SharedPreferences workoutSp = requireContext()
                .getSharedPreferences("workout_prefs", Context.MODE_PRIVATE);

        // meal_prefs 우선, 없으면 workout_prefs 참조
        int height       = mealSp.getInt("user_height", workoutSp.getInt("user_height", 0));
        int weight       = mealSp.getInt("user_weight", workoutSp.getInt("user_weight", 0));
        int targetWeight = mealSp.getInt("user_target_weight", workoutSp.getInt("user_target_weight", 0));
        int targetWeeks  = mealSp.getInt("user_target_weeks", workoutSp.getInt("user_target_weeks", 0));
        String gender    = mealSp.getString("user_gender", workoutSp.getString("user_gender", "미등록"));

        if (height == 0) return "등록된 정보 없음";

        double bmi = Math.round((weight / Math.pow(height / 100.0, 2)) * 10) / 10.0;
        return "성별 " + gender + ", 키 " + height + "cm, 체중 " + weight + "kg"
                + ", BMI " + bmi + ", 목표 " + targetWeight + "kg (" + targetWeeks + "주)";
    }

    /** SharedPreferences에서 현재 식단 플랜 JSON */
    private String getMealPlan()
    {
        return requireContext()
                .getSharedPreferences("meal_prefs", Context.MODE_PRIVATE)
                .getString("meal_plan_json", null);
    }

    /** SharedPreferences에서 현재 운동 플랜 JSON */
    private String getWorkoutPlan()
    {
        return requireContext()
                .getSharedPreferences("workout_prefs", Context.MODE_PRIVATE)
                .getString("workout_plan_json", null);
    }

    /** 최근 대화 기록을 AI 프롬프트용 문자열로 변환 */
    private String buildHistoryText()
    {
        return String.join("\n", recentHistory);
    }

    /** 플랜 등록 여부에 따라 첫 인사 메시지 생성 */
    private String buildWelcomeMessage()
    {
        boolean hasMeal    = getMealPlan() != null;
        boolean hasWorkout = getWorkoutPlan() != null;

        if (hasMeal && hasWorkout)
            return "안녕하세요! 다이어트 코칭 AI입니다.\n"
                    + "현재 식단 플랜과 운동 플랜이 등록되어 있어요.\n"
                    + "식단, 운동, 건강에 대해 무엇이든 물어보세요!";
        else if (hasMeal)
            return "안녕하세요! 다이어트 코칭 AI입니다.\n"
                    + "현재 식단 플랜이 등록되어 있어요.\n"
                    + "식단, 건강에 대해 무엇이든 물어보세요!";
        else
            return "안녕하세요! 다이어트 코칭 AI입니다.\n"
                    + "식단·운동 탭에서 먼저 플랜을 생성하면 더 정확한 상담이 가능해요.\n"
                    + "건강에 대해 무엇이든 물어보세요!";
    }

    private void sendMessage()
    {
        String message = etMessage.getText().toString().trim();
        if (message.isEmpty()) return;

        appendChat("👤 나", message);
        etMessage.setText("");
        btnSend.setEnabled(false);
        progressBar.setVisibility(View.VISIBLE);

        // AI에게 전달할 컨텍스트 수집
        String userInfo     = buildUserInfo();
        String mealPlan     = getMealPlan();
        String workoutPlan  = getWorkoutPlan();
        String historyText  = buildHistoryText();

        geminiHelper.chat(message, userInfo, mealPlan, workoutPlan, historyText,
                new GeminiHelper.GeminiCallback()
                {
                    @Override
                    public void onSuccess(String response)
                    {
                        if (!isAdded()) return;
                        requireActivity().runOnUiThread(() ->
                        {
                            appendChat("🤖 AI", response);

                            // 대화 기록 누적 (MAX_HISTORY 초과 시 오래된 것 제거)
                            recentHistory.addLast("사용자: " + message);
                            recentHistory.addLast("AI: " + response);
                            while (recentHistory.size() > MAX_HISTORY)
                                recentHistory.removeFirst();

                            btnSend.setEnabled(true);
                            progressBar.setVisibility(View.GONE);
                        });
                    }

                    @Override
                    public void onError(String error)
                    {
                        if (!isAdded()) return;
                        requireActivity().runOnUiThread(() ->
                        {
                            appendChat("❌ 오류", error);
                            btnSend.setEnabled(true);
                            progressBar.setVisibility(View.GONE);
                        });
                    }
                });
    }

    private void appendChat(String sender, String message)
    {
        chatLog.append(sender).append("\n");
        chatLog.append(message).append("\n\n");
        chatLog.append("─────────────────────\n\n");
        tvChatLog.setText(chatLog.toString());
        scrollChat.post(() -> scrollChat.fullScroll(ScrollView.FOCUS_DOWN));
    }
}
