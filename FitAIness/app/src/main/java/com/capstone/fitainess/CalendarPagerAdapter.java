package com.capstone.fitainess;

import android.content.Context;
import android.content.SharedPreferences;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.bottomsheet.BottomSheetDialog;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;

public class CalendarPagerAdapter extends RecyclerView.Adapter<CalendarPagerAdapter.MonthViewHolder>
{

    // 기준 월(오늘)의 달력 인덱스. 앞뒤로 5년씩(총 120개월) 스와이프 가능하도록 설정
    public final static int CENTER_POSITION = 60;

    @NonNull
    @Override
    public MonthViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType)
    {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_calendar_month, parent, false);
        return new MonthViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull MonthViewHolder holder, int position)
    {
        // 기준점(CENTER_POSITION)에서 얼만큼 떨어져 있는지 계산
        int monthOffset = position - CENTER_POSITION;

        Calendar calendar = Calendar.getInstance();
        calendar.add(Calendar.MONTH, monthOffset);

        int currentYear = calendar.get(Calendar.YEAR);
        int currentMonth = calendar.get(Calendar.MONTH) + 1; // 0부터 시작하므로 +1

        holder.tvMonthTitle.setText(currentYear + "년 " + currentMonth + "월");

        // 날짜 배열 계산 로직
        calendar.set(Calendar.DAY_OF_MONTH, 1);
        int startDayOfWeek = calendar.get(Calendar.DAY_OF_WEEK) - 1; // 1일의 요일 (일:0, 월:1 ...)
        int maxDays = calendar.getActualMaximum(Calendar.DAY_OF_MONTH); // 그 달의 총 일수

        SharedPreferences sp = holder.itemView.getContext().getSharedPreferences("ChallengePrefs", Context.MODE_PRIVATE);
        List<CalendarGridAdapter.DayInfo> daysList = new ArrayList<>();

        // 1일 앞의 빈 칸 채우기
        for (int i = 0; i < startDayOfWeek; i++)
        {
            daysList.add(new CalendarGridAdapter.DayInfo(0, false));
        }

        // 실제 날짜 채우기 and 성공 여부 체크
        for (int i = 1; i <= maxDays; i++)
        {
            // SP 키 포맷: "success_2026_04_12"
            String key = String.format("success_%d_%02d_%02d", currentYear, currentMonth, i);
            boolean isSuccess = sp.getBoolean(key, false);
            daysList.add(new CalendarGridAdapter.DayInfo(i, isSuccess));
        }

        // 그리드에 어댑터 연결
        holder.rvDaysGrid.setLayoutManager(new GridLayoutManager(holder.itemView.getContext(), 7));
        holder.rvDaysGrid.setAdapter(new CalendarGridAdapter(daysList, (int day) -> {

            String dateKey = String.format(Locale.getDefault(), "%04d-%02d-%02d", currentYear, currentMonth, day);

            // SharedPreferences에서 완료 여부 가져오기
            SharedPreferences activitySp = holder.itemView.getContext()
                    .getSharedPreferences("ActivityPrefs", Context.MODE_PRIVATE);

            boolean isMealDone = activitySp.getBoolean("meal_" + dateKey, false);
            boolean isWorkoutDone = activitySp.getBoolean("workout_" + dateKey, false);

            // BottomSheetDialog 출력
            Context context = holder.itemView.getContext();
            BottomSheetDialog bottomSheetDialog = new BottomSheetDialog(context);

            View bottomSheetView = LayoutInflater.from(context)
                    .inflate(R.layout.dialog_bottom_daily_record, null);
            bottomSheetDialog.setContentView(bottomSheetView);

            TextView tvTitle = bottomSheetView.findViewById(R.id.tvRecordDateTitle);
            TextView tvMeal = bottomSheetView.findViewById(R.id.tvMealStatus);
            TextView tvWorkout = bottomSheetView.findViewById(R.id.tvWorkoutStatus);
            Button btnClose = bottomSheetView.findViewById(R.id.btnCloseBottomSheet);

            tvTitle.setText(dateKey + " 활동 기록");
            tvMeal.setText("식단 인증 : " + (isMealDone ? "완료" : "미완료"));
            tvWorkout.setText("운동 완료 : " + (isWorkoutDone ? "완료" : "미완료"));

            btnClose.setOnClickListener(v -> bottomSheetDialog.dismiss());

            bottomSheetDialog.show();
        }));
    }

    @Override
    public int getItemCount()
    {
        return 120; // 스와이프 가능한 총 페이지 수 (10년치)
    }

    static class MonthViewHolder extends RecyclerView.ViewHolder
    {
        TextView tvMonthTitle;
        RecyclerView rvDaysGrid;
        public MonthViewHolder(@NonNull View itemView)
        {
            super(itemView);
            tvMonthTitle = itemView.findViewById(R.id.tvMonthTitle);
            rvDaysGrid = itemView.findViewById(R.id.rvDaysGrid);
        }
    }
}
