package com.capstone.fitainess;

import android.graphics.Color;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.util.List;

public class CalendarGridAdapter extends RecyclerView.Adapter<CalendarGridAdapter.DayViewHolder>
{

    public interface OnDayClickListener
    {
        void onDayClick(int day);
    }

    private OnDayClickListener listener;

    // 각 칸에 들어갈 날짜 모델 (0이면 빈 칸)
    public static class DayInfo
    {
        int day;
        boolean isSuccess;
        public DayInfo(int day, boolean isSuccess)
        {
            this.day = day;
            this.isSuccess = isSuccess;
        }
    }

    private List<DayInfo> days;

    public CalendarGridAdapter(List<DayInfo> days, OnDayClickListener listener)
    {
        this.days = days;
        this.listener = listener;
    }

    @NonNull
    @Override
    public DayViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType)
    {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_calendar_day, parent, false);
        return new DayViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull DayViewHolder holder, int position)
    {
        DayInfo info = days.get(position);

        if (info.day == 0)
        {
            // 빈 칸 처리 (1일 시작 전 공간)
            holder.tvDayNumber.setText("");
            holder.ivStamp.setVisibility(View.GONE);
        }
        else
        {
            holder.tvDayNumber.setText(String.valueOf(info.day));


            if (position % 7 == 0) holder.tvDayNumber.setTextColor(Color.parseColor("#FF5252")); // sun
            else if (position % 7 == 6) holder.tvDayNumber.setTextColor(Color.parseColor("#448AFF")); // sat
            else holder.tvDayNumber.setTextColor(Color.WHITE);

            // 달성 시 ic_calendar_check 추가
            if (info.isSuccess)
                holder.ivStamp.setVisibility(View.VISIBLE);
            else
                holder.ivStamp.setVisibility(View.GONE);
        }

        holder.itemView.setOnClickListener(v -> {
            if (info.day != 0) listener.onDayClick(info.day);
        });
    }

    @Override
    public int getItemCount() { return days.size(); }

    static class DayViewHolder extends RecyclerView.ViewHolder
    {
        TextView tvDayNumber;
        ImageView ivStamp;
        public DayViewHolder(@NonNull View itemView)
        {
            super(itemView);
            tvDayNumber = itemView.findViewById(R.id.tvDayNumber);
            ivStamp = itemView.findViewById(R.id.ivStamp);
        }
    }
}
