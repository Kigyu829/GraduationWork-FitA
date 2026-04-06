package com.capstone.fitainess;

import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.cardview.widget.CardView;
import androidx.fragment.app.Fragment;
import androidx.navigation.fragment.NavHostFragment;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;

import java.util.Calendar;

public class HomeFragment extends Fragment
{

    private CardView cvGoalStatus;
    private TextView tvGoalTitle, tvGoalMessage;
    private Button btnSetGoal;

    private Button btnGoDiner;

    public HomeFragment() { super(R.layout.fragment_home); }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState)
    {
        cvGoalStatus = view.findViewById(R.id.cvGoalStatus);
        tvGoalTitle = view.findViewById(R.id.tvGoalTitle);
        tvGoalMessage = view.findViewById(R.id.tvGoalMessage);
        btnSetGoal = view.findViewById(R.id.btnSetGoal);
        btnGoDiner = view.findViewById(R.id.btnGoDiner);

        btnSetGoal.setOnClickListener(v -> NavHostFragment.findNavController(this).navigate(R.id.action_home_to_target));
        btnGoDiner.setOnClickListener(V -> NavHostFragment.findNavController(this).navigate(R.id.action_home_to_diner));

        super.onViewCreated(view, savedInstanceState);
        checkUserProfile();
    }

    private void checkUserProfile()
    {
        String uid = FirebaseAuth.getInstance().getUid();
        if (uid == null) return;

        FirebaseFirestore.getInstance().collection("users").document(uid)
                .get().addOnSuccessListener(doc -> {
                    if (doc.exists() && doc.getBoolean("is_profile_set") != null && doc.getBoolean("is_profile_set"))
                    {
                        Long currentWeight = doc.getLong("weight");
                        updateGoalUI(currentWeight != null ? currentWeight.intValue() : 0);
                    }
                    else
                    {
                        // (기존의) 초기 설정 필요 다이얼로그 호출
                        showInitialSettingDialog();
                    }
                });
    }

    private void showInitialSettingDialog()
    {
        new AlertDialog.Builder(requireContext())
                .setTitle("초기 설정 필요")
                .setMessage("신체 정보를 입력해주세요.")
                .setCancelable(false) // 강제성 부여
                .setPositiveButton("설정하러 가기", (dialog, which) ->
                {
                    NavHostFragment.findNavController(this).navigate(R.id.action_home_to_bodyInfo);
                }).show();
    }

    private void updateGoalUI(int currentWeight)
    {
        SharedPreferences prefs = requireActivity().getSharedPreferences("GoalPrefs", Context.MODE_PRIVATE);
        boolean isGoalSet = prefs.getBoolean("is_goal_set", false);

        if (!isGoalSet)
        {
            // 목표가 없을 때
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

            int targetWeight = prefs.getInt("target_weight", 0);
            int durationMonths = prefs.getInt("duration_months", 0);
            long startDateMillis = prefs.getLong("start_date", 0);

            // D-Day 계산 로직
            Calendar targetDate = Calendar.getInstance();
            targetDate.setTimeInMillis(startDateMillis);
            targetDate.add(Calendar.MONTH, durationMonths); // 시작일 + N개월

            long diffMillis = targetDate.getTimeInMillis() - System.currentTimeMillis();
            int dDay = (int) (diffMillis / (1000 * 60 * 60 * 24)); // 밀리초를 일(day)로 변환

            String dDayText;
            if (dDay > 0) dDayText = "D-" + dDay;
            else if (dDay == 0) dDayText = "D-Day";
            else dDayText = "D+" + Math.abs(dDay) + " (기한 초과)";

            // 결과 텍스트 조합
            String message = String.format("목표 일자: %d개월 뒤 (%s)\n\n현재 체중: %d kg\n목표 체중: %d kg",
                    durationMonths, dDayText, currentWeight, targetWeight);

            tvGoalMessage.setText(message);
        }
    }
}