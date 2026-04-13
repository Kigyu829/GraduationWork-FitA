package com.capstone.fitainess;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.ImageButton;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.navigation.fragment.NavHostFragment;

public class RecentLogFragment extends Fragment
{
    private ImageButton btnBack;
    public RecentLogFragment() { super(R.layout.fragment_recent_log); }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState)
    {
        super.onViewCreated(view, savedInstanceState);

        ImageButton btnBack = view.findViewById(R.id.btnBack);
        TextView tvMeal = view.findViewById(R.id.tvRecentMealInfo);
        TextView tvWorkout = view.findViewById(R.id.tvRecentWorkoutInfo);
        Button btnCalendar = view.findViewById(R.id.btnViewAllCalendar);

        SharedPreferences mSp = requireContext().getSharedPreferences("meal_sp", Context.MODE_PRIVATE);
        String mealJson = mSp.getString("meal_plan_json", "최근 저장된 식단 정보가 없습니다.");
        tvMeal.setText(mealJson);

        btnCalendar.setOnClickListener(v ->
                NavHostFragment.findNavController(this).navigate(R.id.action_recentLog_to_calendar)
        );
        btnBack.setOnClickListener(v -> NavHostFragment.findNavController(this).popBackStack());
    }
}