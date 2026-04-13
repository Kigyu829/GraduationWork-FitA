package com.capstone.fitainess;

import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.ColorInt;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.cardview.widget.CardView;
import androidx.fragment.app.Fragment;
import androidx.navigation.fragment.NavHostFragment;

import com.google.android.material.bottomsheet.BottomSheetDialog;
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
    private TextView tvWelcomeMessage;
    private TextView tvGoalTitle, tvGoalMessage;
    private TextView tvMealTimeTitle;
    private TextView tvTodayMealContent;
    private TextView tvStreakCount;

    private CheckBox cbWorkout;

    private LinearLayout layoutWeightUpdate;
    private TextView tvCurrentWeightDisplay;
    private Button btnQuickUpdateWeight;
    private double currentSavedWeight = 0.0;
    private double pickerWeight = 0.0;

    public HomeFragment() { super(R.layout.fragment_home); }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState)
    {
        super.onViewCreated(view, savedInstanceState);

        cvChallenge = view.findViewById(R.id.cvChallenge);
        tvStreakCount = view.findViewById(R.id.tvStreakCount);

        cvGoalStatus  = view.findViewById(R.id.cvGoalStatus);
        tvGoalTitle   = view.findViewById(R.id.tvGoalTitle);
        tvGoalTitle.setTextColor(Color.WHITE);
        tvGoalMessage = view.findViewById(R.id.tvGoalMessage);
        btnSetGoal    = view.findViewById(R.id.btnSetGoal);

        btnGoDiner    = view.findViewById(R.id.btnGoDiner);
        btnGoMeal     = view.findViewById(R.id.btnGoMeal);
        btnGoWorkout  = view.findViewById(R.id.btnGoWorkout);
        btnGoChat     = view.findViewById(R.id.btnGoChat);

        tvWelcomeMessage = view.findViewById(R.id.tvWelcomeMessage);
        tvMealTimeTitle    = view.findViewById(R.id.tvMealTimeTitle);
        tvTodayMealContent = view.findViewById(R.id.tvTodayMealContent);
        cbWorkout          = view.findViewById(R.id.cbWorkout);
        cbWorkout.setTextColor(Color.WHITE);


        layoutWeightUpdate = view.findViewById(R.id.layoutWeightUpdate);
        tvCurrentWeightDisplay = view.findViewById(R.id.tvCurrentWeightDisplay);
        btnQuickUpdateWeight = view.findViewById(R.id.btnQuickUpdateWeight);

        btnQuickUpdateWeight.setOnClickListener(v -> showWeightBottomSheet());

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
        loadWorkoutPlanToCard();
    }

    @Override
    public void onResume()
    {
        super.onResume();
        loadMealPlanToCard();
        loadWorkoutPlanToCard();
    }

    // ──────────────────────────────────────
    // 체중 기록 BottomSheet 관련 메서드
    // ──────────────────────────────────────
    private void showWeightBottomSheet() {
        BottomSheetDialog bottomSheetDialog = new BottomSheetDialog(requireContext());
        View bottomSheetView = getLayoutInflater().inflate(R.layout.dialog_bottom_weight, null);
        bottomSheetDialog.setContentView(bottomSheetView);

        Button btnMinusWeight = bottomSheetView.findViewById(R.id.btnMinusWeight);
        Button btnPlusWeight = bottomSheetView.findViewById(R.id.btnPlusWeight);
        TextView tvWeightPickerValue = bottomSheetView.findViewById(R.id.tvWeightPickerValue);
        Button btnSaveWeight = bottomSheetView.findViewById(R.id.btnSaveWeight);

        // 1. 시작 체중 설정 (기존 DB 저장 체중 기준)
        pickerWeight = currentSavedWeight > 0 ? currentSavedWeight : 60.0; // 기본값 방어 코드
        tvWeightPickerValue.setText(String.format("%.1f", pickerWeight));

        // 2. 마이너스 버튼 로직 (-0.1kg)
        btnMinusWeight.setOnClickListener(v -> {
            if (pickerWeight > 20.0) {
                pickerWeight -= 0.1;
                tvWeightPickerValue.setText(String.format("%.1f", pickerWeight));
            }
        });

        // 3. 플러스 버튼 로직 (+0.1kg)
        btnPlusWeight.setOnClickListener(v -> {
            if (pickerWeight < 200.0) {
                pickerWeight += 0.1;
                tvWeightPickerValue.setText(String.format("%.1f", pickerWeight));
            }
        });

        // 4. 저장 버튼 로직
        btnSaveWeight.setOnClickListener(v -> {
            updateWeightToFirebase(pickerWeight, bottomSheetDialog);
        });

        bottomSheetDialog.show();
    }

    private void updateWeightToFirebase(double newWeight, BottomSheetDialog dialog) {
        String uid = FirebaseAuth.getInstance().getUid();
        if (uid == null) return;

        FirebaseFirestore.getInstance().collection("users").document(uid)
                .update("weight", newWeight)
                .addOnSuccessListener(aVoid -> {
                    dialog.dismiss();
                    Toast.makeText(getContext(), "체중이 기록되었습니다!", Toast.LENGTH_SHORT).show();

                    // 즉각적인 UI 반영을 위해 프로필 다시 로드
                    checkUserProfile();
                })
                .addOnFailureListener(e ->
                        Toast.makeText(getContext(), "기록 실패: " + e.getMessage(), Toast.LENGTH_SHORT).show()
                );
    }

    // ──────────────────────────────────────
    // 오늘의 목표: 시간대별 식단 카드 로직
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

        // 시간대에 맞는 식단 키(Key)와 타이틀 설정
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
            btnGoDiner.setVisibility(View.GONE);
            return;
        }

        // JSON에서 현재 시간에 맞는 식단만 추출
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

            // ex) "닭가슴살 샐러드, 현미밥 (450kcal)"
            tvTodayMealContent.setText(menuText.toString() + " (" + calories + "kcal)");

        }
        catch (Exception e)
        {
            tvTodayMealContent.setText("식단 데이터를 불러오지 못했어요.");
        }
    }

    private void loadWorkoutPlanToCard() {
        SharedPreferences workoutSp = requireContext()
                .getSharedPreferences("workout_sp", Context.MODE_PRIVATE);

        String planJson = workoutSp.getString("workout_plan_json", null);

        if (planJson == null)
        {
            cbWorkout.setText("아직 AI 운동 플랜이 생성되지 않았어요.");
            return;
        }

        try {
            JSONObject plan = new JSONObject(planJson);
            int totalDuration = plan.getInt("total_duration");
            int totalCalories = plan.getInt("total_calories");

            // 메인 운동 배열 가져오기
            JSONArray mainExercises = plan.getJSONArray("main");
            String previewName = "";

            // 메인 운동이 있다면 첫 번째 운동 이름으로 요약
            if (mainExercises.length() > 0) {
                previewName = mainExercises.getJSONObject(0).getString("name");
                if (mainExercises.length() > 1) {
                    previewName += " 외 " + (mainExercises.length() - 1) + "개 동작";
                }
            }

            // 체크박스 옆 텍스트에 요약 정보 출력 (ex 스쿼트 외 3개 동작 (45분 | 300kcal))
            String workoutSummary = String.format("%s (⏱ %d분 | %dkcal)",
                    previewName, totalDuration, totalCalories);
            cbWorkout.setText(workoutSummary);

        }
        catch (Exception e)
        {
            cbWorkout.setText("운동 데이터를 불러오지 못했어요.");
            e.printStackTrace();
        }
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
                        String nickname = doc.getString("nickname");
                        if (nickname != null && !nickname.isEmpty())
                            tvWelcomeMessage.setText("환영합니다 " + nickname + " 님!");
                        else
                            tvWelcomeMessage.setText("환영합니다!");

                        // Number를 사용하여 int와 double 모두 안전하게 처리
                        Number currentWeightNum = doc.getDouble("weight");
                        double currentWeight = currentWeightNum != null ? currentWeightNum.doubleValue() : 0.0;
                        updateGoalUI(currentWeight);
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

    // 🔥 UI 업데이트 (파라미터를 double로 변경)
    private void updateGoalUI(double currentWeight)
    {
        // 바텀시트를 위해 현재 체중 값 저장
        this.currentSavedWeight = currentWeight;

        SharedPreferences prefs = requireActivity()
                .getSharedPreferences("GoalPrefs", Context.MODE_PRIVATE);
        boolean isGoalSet = prefs.getBoolean("is_goal_set", false);

        if (!isGoalSet)
        {
            cvGoalStatus.setCardBackgroundColor(Color.parseColor("#FFFF0B55"));
            tvGoalTitle.setText("목표 미설정");
            tvGoalTitle.setTextColor(Color.parseColor("#FFFFFF"));
            tvGoalMessage.setText("목표가 설정되지 않았습니다.\n목표를 설정하고 플랜을 시작해보세요!");
            btnSetGoal.setTextColor(Color.parseColor("#FFFFFF"));
            btnSetGoal.setVisibility(View.VISIBLE);

            // 목표가 없으면 기록창 숨김
            if (layoutWeightUpdate != null) layoutWeightUpdate.setVisibility(View.GONE);
        }
        else
        {
            cvGoalStatus.setCardBackgroundColor(Color.parseColor("#FF243840"));
            tvGoalTitle.setText("나의 감량 목표");
            btnSetGoal.setVisibility(View.GONE);

            // 목표가 있으면 기록창 표시
            if (layoutWeightUpdate != null) {
                layoutWeightUpdate.setVisibility(View.VISIBLE);
                // 소수점 1자리까지 표시
                tvCurrentWeightDisplay.setText("현재 " + String.format("%.1f", currentWeight) + " kg");
            }

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
                    "목표 일자: %d개월 뒤 (%s)\n\n목표 체중: %d kg",
                    durationMonths, dDayText, targetWeight); // 현재 체중은 별도로 표시되므로 메시지에서 뺌
            tvGoalMessage.setText(message);
        }
    }
}