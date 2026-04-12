package com.capstone.fitainess;

import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
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
    private CardView cvGoalStatus;
    private TextView tvGoalTitle, tvGoalMessage;
    private Button btnSetGoal;

    private Button btnGoDiner;
    private Button btnGoMeal, btnGoWorkout, btnGoChat;

    // 오늘의 식단 카드 뷰
    private LinearLayout mealContainer;
    private TextView tvMealNoPlan, tvMealTotal;

    public HomeFragment() { super(R.layout.fragment_home); }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState)
    {
        cvGoalStatus  = view.findViewById(R.id.cvGoalStatus);
        tvGoalTitle   = view.findViewById(R.id.tvGoalTitle);
        tvGoalMessage = view.findViewById(R.id.tvGoalMessage);
        btnSetGoal    = view.findViewById(R.id.btnSetGoal);
        btnGoDiner    = view.findViewById(R.id.btnGoDiner);
        btnGoMeal     = view.findViewById(R.id.btnGoMeal);
        btnGoWorkout  = view.findViewById(R.id.btnGoWorkout);
        btnGoChat     = view.findViewById(R.id.btnGoChat);
        mealContainer = view.findViewById(R.id.mealContainer);
        tvMealNoPlan  = view.findViewById(R.id.tvMealNoPlan);
        tvMealTotal   = view.findViewById(R.id.tvMealTotal);

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

        super.onViewCreated(view, savedInstanceState);
        checkUserProfile();
        loadMealPlanToCard(); // 식단 카드 초기 로딩
    }

    /** MealFragment에서 돌아왔을 때 식단 카드 갱신 */
    @Override
    public void onResume() {
        super.onResume();
        loadMealPlanToCard();
    }

    // ──────────────────────────────────────
    // 오늘의 식단 카드
    // ──────────────────────────────────────

    /** meal_sp에 저장된 AI 식단 플랜을 읽어 카드에 표시 */
    private void loadMealPlanToCard() {
        SharedPreferences mealSp = requireContext()
                .getSharedPreferences("meal_sp", Context.MODE_PRIVATE);
        String planJson = mealSp.getString("meal_plan_json", null);

        mealContainer.removeAllViews();

        if (planJson == null) {
            // 플랜 없음
            tvMealNoPlan.setVisibility(View.VISIBLE);
            tvMealTotal.setVisibility(View.GONE);
            return;
        }

        try {
            JSONObject plan = new JSONObject(planJson);
            tvMealNoPlan.setVisibility(View.GONE);

            addMealRow("🌅 아침", plan.getJSONObject("breakfast"));
            addMealRow("🌞 점심", plan.getJSONObject("lunch"));
            addMealRow("🌙 저녁", plan.getJSONObject("dinner"));

            int total = plan.optInt("total_calories", 0);
            if (total > 0) {
                tvMealTotal.setText("합계 " + total + " kcal");
                tvMealTotal.setVisibility(View.VISIBLE);
            }
        } catch (Exception e) {
            tvMealNoPlan.setText("식단 데이터를 불러오지 못했어요.");
            tvMealNoPlan.setVisibility(View.VISIBLE);
            tvMealTotal.setVisibility(View.GONE);
        }
    }

    /** 식사 1행 (이모지 타이틀 | 메뉴 첫 항목... | 칼로리) */
    private void addMealRow(String label, JSONObject meal) throws Exception {
        LinearLayout row = new LinearLayout(requireContext());
        row.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams rowParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        rowParams.setMargins(0, 0, 0, 8);
        row.setLayoutParams(rowParams);

        // 라벨 (아침/점심/저녁)
        TextView tvLabel = new TextView(requireContext());
        tvLabel.setText(label);
        tvLabel.setTextColor(Color.parseColor("#66D0BC"));
        tvLabel.setTextSize(13f);
        LinearLayout.LayoutParams labelParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        labelParams.setMarginEnd(8);
        tvLabel.setLayoutParams(labelParams);

        // 메뉴 (첫 2개 항목만 표시, 나머지는 "...")
        JSONArray menu = meal.getJSONArray("menu");
        StringBuilder menuText = new StringBuilder();
        int showCount = Math.min(menu.length(), 2);
        for (int i = 0; i < showCount; i++) {
            if (i > 0) menuText.append(", ");
            menuText.append(menu.getString(i));
        }
        if (menu.length() > 2) menuText.append("...");

        TextView tvMenu = new TextView(requireContext());
        tvMenu.setText(menuText.toString());
        tvMenu.setTextColor(Color.WHITE);
        tvMenu.setTextSize(13f);
        LinearLayout.LayoutParams menuParams = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        tvMenu.setLayoutParams(menuParams);

        // 칼로리
        TextView tvKcal = new TextView(requireContext());
        tvKcal.setText(meal.getInt("calories") + "kcal");
        tvKcal.setTextColor(Color.parseColor("#AAAAAA"));
        tvKcal.setTextSize(12f);

        row.addView(tvLabel);
        row.addView(tvMenu);
        row.addView(tvKcal);
        mealContainer.addView(row);
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
