package com.capstone.fitainess;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.ImageButton;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.navigation.fragment.NavHostFragment;
import androidx.viewpager2.widget.ViewPager2;
import java.util.Calendar;

public class CalendarFragment extends Fragment
{

    private ViewPager2 viewPagerCalendar;
    private TextView tvMonthlyAchievement, tvCalendarStreak;
    private SharedPreferences sp;

    public CalendarFragment() { super(R.layout.fragment_calendar); }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState)
    {
        super.onViewCreated(view, savedInstanceState);

        sp = requireContext().getSharedPreferences("ChallengePrefs", Context.MODE_PRIVATE);

        viewPagerCalendar = view.findViewById(R.id.viewPagerCalendar);
        tvMonthlyAchievement = view.findViewById(R.id.tvMonthlyAchievement);
        tvCalendarStreak = view.findViewById(R.id.tvCalendarStreak);
        ImageButton btnBack = view.findViewById(R.id.btnBack);

        btnBack.setOnClickListener(v -> NavHostFragment.findNavController(this).popBackStack());

        // 전체 연속 성공 텍스트 띄우기
        int currentStreak = sp.getInt("current_streak", 0);
        tvCalendarStreak.setText("연속 " + currentStreak + "일 달성 중");

        // ViewPager2 세팅
        CalendarPagerAdapter adapter = new CalendarPagerAdapter();
        viewPagerCalendar.setAdapter(adapter);

        // 현재 월(60번 인덱스)에서 시작하게끔 이동
        viewPagerCalendar.setCurrentItem(CalendarPagerAdapter.CENTER_POSITION, false);

        // 스와이프하여 달(Month)이 바뀔 때마다 달성률 텍스트 갱신
        viewPagerCalendar.registerOnPageChangeCallback(new ViewPager2.OnPageChangeCallback()
        {
            @Override
            public void onPageSelected(int position)
            {
                updateMonthlyAchievementStats(position);
            }
        });
    }

    // 현재 보고 있는 달의 도장 개수를 세서 상단에 표시
    private void updateMonthlyAchievementStats(int position)
    {
        int monthOffset = position - CalendarPagerAdapter.CENTER_POSITION;
        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.MONTH, monthOffset);

        int targetYear = cal.get(Calendar.YEAR);
        int targetMonth = cal.get(Calendar.MONTH) + 1;
        int maxDays = cal.getActualMaximum(Calendar.DAY_OF_MONTH);

        int successCount = 0;
        // 1일부터 말일까지 SharedPreference를 돌아 도장 개수 count
        for (int i = 1; i <= maxDays; i++)
        {
            String key = String.format("success_%d_%02d_%02d", targetYear, targetMonth, i);
            if (sp.getBoolean(key, false))
            {
                successCount++;
            }
        }

        tvMonthlyAchievement.setText(String.format("이달의 달성: %d of %d", successCount, maxDays));
    }
}