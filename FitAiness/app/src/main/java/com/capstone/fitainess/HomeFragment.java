package com.capstone.fitainess;

import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.cardview.widget.CardView;
import androidx.fragment.app.Fragment;
import androidx.navigation.fragment.NavHostFragment;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;

public class HomeFragment extends Fragment
{
    private CardView cvChallenge;
    private CardView cvGoalStatus;

    private Button btnSetGoal;
    private Button btnGoDiner, btnGoMeal, btnGoWorkout, btnGoChat;

    private TextView tvGoalTitle, tvGoalMessage;
    private TextView tvMealTimeTitle;
    private TextView tvTodayMealContent;
    private TextView tvStreakCount;

    private CheckBox cbWorkout;

    public HomeFragment() { super(R.layout.fragment_home); }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState)
    {
        super.onViewCreated(view, savedInstanceState);

        cvChallenge = view.findViewById(R.id.cvChallenge);
        tvStreakCount = view.findViewById(R.id.tvStreakCount);

        cvGoalStatus  = view.findViewById(R.id.cvGoalStatus);
        tvGoalTitle   = view.findViewById(R.id.tvGoalTitle);
        tvGoalMessage = view.findViewById(R.id.tvGoalMessage);
        btnSetGoal    = view.findViewById(R.id.btnSetGoal);

        btnGoDiner    = view.findViewById(R.id.btnGoDiner);
        btnGoMeal     = view.findViewById(R.id.btnGoMeal);
        btnGoWorkout  = view.findViewById(R.id.btnGoWorkout);
        btnGoChat     = view.findViewById(R.id.btnGoChat);

        tvMealTimeTitle    = view.findViewById(R.id.tvMealTimeTitle);
        tvTodayMealContent = view.findViewById(R.id.tvTodayMealContent);
        cbWorkout          = view.findViewById(R.id.cbWorkout);

        cvChallenge.setOnClickListener(v ->
                NavHostFragment.findNavController(this).navigate(R.id.action_home_to_calendar));
        btnSetGoal.setOnClickListener(v ->
                NavHostFragment.findNavController(this).navigate(R.id.action_home_to_target));
        btnGoDiner.setOnClickListener(v ->
                NavHostFragment.findNavController(this).navigate(R.id.action_home_to_diner));
        btnGoMeal.setOnClickListener(v ->
                NavHostFragment.findNavController(this).navigate(R.id.action_home_to_meal));
        btnGoWorkout.setOnClickListener(v ->
                NavHostFragment.findNavController(this).navigate(R.id.action_home_to_workout));
        btnGoChat.setOnClickListener(v ->
                NavHostFragment.findNavController(this).navigate(R.id.action_home_to_chat));

        updateChallengeUI();
        checkUserProfile();
        loadMealPlanToCard();
        // 구현 필요 loadWorkoutPlanToCard();
    }

    @Override
    public void onResume() {
        super.onResume();
        loadMealPlanToCard();
    }

    // ──────────────────────────────────────
    // 오늘의 목표: 시간대별 식단 카드 로직 (수정됨)
    // ──────────────────────────────────────
    private void loadMealPlanToCard()
    {
        SharedPreferences mealSp = requireContext()
                .getSharedPreferences("meal_sp", Context.MODE_PRIVATE);
        String planJson = mealSp.getString("meal_plan_json", null);

        // 1. 현재 시간 확인
        Calendar calendar = Calendar.getInstance();
        int hour = calendar.get(Calendar.HOUR_OF_DAY);

        String mealKey;
        String mealTitle;
        int mealIconResId; //아이콘 리소스 담을 변수


        // 2. 시간대에 맞는 식단 키(Key)와 타이틀 설정
        if (hour >= 5 && hour < 11) {
            mealTitle = "아침 식단";
            mealKey = "breakfast";
            mealIconResId = R.drawable.ic_meal_breakfast;
        } else if (hour >= 11 && hour < 17) {
            mealTitle = "점심 식단";
            mealKey = "lunch";
            mealIconResId = R.drawable.ic_meal_lunch;
        } else {
            mealTitle = "저녁 식단";
            mealKey = "dinner";
            mealIconResId = R.drawable.ic_meal_dinner;
        }

        // 타이틀 반영
        tvMealTimeTitle.setText(mealTitle);
        tvMealTimeTitle.setCompoundDrawablesWithIntrinsicBounds(mealIconResId, 0, 0, 0);

        if (planJson == null)
        {
            tvTodayMealContent.setText("아직 AI 식단 플랜이 생성되지 않았어요.");
            return;
        }

        // 3. JSON에서 현재 시간에 맞는 식단만 추출
        try {
            JSONObject plan = new JSONObject(planJson);
            JSONObject targetMeal = plan.getJSONObject(mealKey);
            JSONArray menu = targetMeal.getJSONArray("menu");

            StringBuilder menuText = new StringBuilder();
            for (int i = 0; i < menu.length(); i++)
            {
                if (i > 0) menuText.append(", ");
                menuText.append(menu.getString(i));
            }

            int calories = targetMeal.getInt("calories");

            // "닭가슴살 샐러드, 현미밥 (450kcal)" 형태로 출력
            tvTodayMealContent.setText(menuText.toString() + " (" + calories + "kcal)");

        }
        catch (Exception e)
        {
            tvTodayMealContent.setText("식단 데이터를 불러오지 못했어요.");
        }
    }

    private void loadWorkoutPlanToCard()
    {
        SharedPreferences mealSp = requireContext()
                .getSharedPreferences("workout_sp", Context.MODE_PRIVATE);
        String planJson = mealSp.getString("wrokout_plan_json", null);

        //TODO 루틴 출력
    }

    // ──────────────────────────────────────
    // Firebase 프로필 / 목표 UI
    // ──────────────────────────────────────
    private void checkUserProfile()
    {
        String uid = FirebaseAuth.getInstance().getUid();
        if (uid == null) return;

        FirebaseFirestore.getInstance().collection("users").document(uid)
                .get().addOnSuccessListener(doc -> {
                    if (doc.exists()
                            && doc.getBoolean("is_profile_set") != null
                            && doc.getBoolean("is_profile_set"))
                    {
                        Long currentWeight = doc.getLong("weight");
                        updateGoalUI(currentWeight != null ? currentWeight.intValue() : 0);
                    }
                    else
                    {
                        showInitialSettingDialog();
                    }
                });
    }

    private void showInitialSettingDialog()
    {
        new AlertDialog.Builder(requireContext())
                .setTitle("초기 설정 필요")
                .setMessage("신체 정보를 입력해주세요.")
                .setCancelable(false)
                .setPositiveButton("설정하러 가기", (dialog, which) ->
                        NavHostFragment.findNavController(this).navigate(R.id.action_home_to_bodyInfo))
                .show();
    }

    // cvChallenge UI 갱신 로직
    private void updateChallengeUI()
    {
        SharedPreferences sp = requireContext().getSharedPreferences("ChallengePrefs", Context.MODE_PRIVATE);
        int streak = sp.getInt("current_streak", 0);
        tvStreakCount.setText(streak + "일째 연속 성공 중!");
    }

    private void updateGoalUI(int currentWeight)
    {
        SharedPreferences prefs = requireActivity()
                .getSharedPreferences("GoalPrefs", Context.MODE_PRIVATE);
        boolean isGoalSet = prefs.getBoolean("is_goal_set", false);

        if (!isGoalSet)
        {
            cvGoalStatus.setCardBackgroundColor(Color.parseColor("#FFFF0B55"));
            tvGoalTitle.setText("목표 미설정");
            tvGoalTitle.setTextColor(Color.parseColor("#FFFFFF"));
            tvGoalMessage.setText("목표가 설정되지 않았습니다.\n목표를 설정하고 플랜을 시작해보세요!");
            btnSetGoal.setVisibility(View.VISIBLE);
        }
        else
        {
            cvGoalStatus.setCardBackgroundColor(Color.parseColor("#FF243840"));
            tvGoalTitle.setText("나의 감량 목표");
            tvGoalTitle.setTextColor(Color.WHITE);
            btnSetGoal.setVisibility(View.GONE);

            int targetWeight    = prefs.getInt("target_weight", 0);
            int durationMonths  = prefs.getInt("duration_months", 0);
            long startDateMillis = prefs.getLong("start_date", 0);

            Calendar targetDate = Calendar.getInstance();
            targetDate.setTimeInMillis(startDateMillis);
            targetDate.add(Calendar.MONTH, durationMonths);

            long diffMillis = targetDate.getTimeInMillis() - System.currentTimeMillis();
            int dDay = (int) (diffMillis / (1000 * 60 * 60 * 24));

            String dDayText;
            if (dDay > 0)      dDayText = "D-" + dDay;
            else if (dDay == 0) dDayText = "D-Day";
            else               dDayText = "D+" + Math.abs(dDay) + " (기한 초과)";

            String message = String.format(
                    "목표 일자: %d개월 뒤 (%s)\n\n현재 체중: %d kg\n목표 체중: %d kg",
                    durationMonths, dDayText, currentWeight, targetWeight);
            tvGoalMessage.setText(message);
        }
    }
}