package com.capstone.fitainess;

import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;

import androidx.activity.OnBackPressedCallback;
import androidx.fragment.app.Fragment;
import androidx.navigation.fragment.NavHostFragment;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.ImageButton;
import android.widget.NumberPicker;
import android.widget.Toast;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;

public class TargetFragment extends Fragment
{
    //초기값 설정
    private NumberPicker npTargetWeight, npDuration;
    private int initialTargetWeight = 60;
    private int initialDuration = 3;
    private int currentWeight = 0;

    public TargetFragment() { super(R.layout.fragment_target); }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState)
    {
        super.onViewCreated(view, savedInstanceState);

        npTargetWeight = view.findViewById(R.id.npTargetWeight);
        npDuration = view.findViewById(R.id.npDuration);
        Button btnSaveTarget = view.findViewById(R.id.btnSaveTarget);

        npTargetWeight.setMinValue(30); npTargetWeight.setMaxValue(150);
        npDuration.setMinValue(1); npDuration.setMaxValue(12);

        fetchCurrentWeight();

        loadExistingTarget();

        btnSaveTarget.setOnClickListener(v -> saveTarget());
        setupBackButtonLogic(view);
    }
    //현재 체중 Firestore에서 가져옴
    private void fetchCurrentWeight()
    {
        String uid = FirebaseAuth.getInstance().getUid();
        if (uid != null) {
            FirebaseFirestore.getInstance().collection("users").document(uid).get()
                    .addOnSuccessListener(doc -> {
                        if (doc.exists() && doc.getLong("weight") != null)
                        {
                            currentWeight = doc.getLong("weight").intValue();
                        }
                    });
        }
    }

    private void loadExistingTarget()
    {
        SharedPreferences prefs = requireActivity().getSharedPreferences("GoalPrefs", Context.MODE_PRIVATE);
        if (prefs.getBoolean("is_goal_set", false))
        {
            initialTargetWeight = prefs.getInt("target_weight", 60);
            initialDuration = prefs.getInt("duration_months", 3);
        }
        npTargetWeight.setValue(initialTargetWeight);
        npDuration.setValue(initialDuration);
    }

    private void setupBackButtonLogic(View view)
    {
        ImageButton btnBack = view.findViewById(R.id.btnBack);
        btnBack.setOnClickListener(v -> checkAndNavigateBack());

        requireActivity().getOnBackPressedDispatcher().addCallback(getViewLifecycleOwner(), new OnBackPressedCallback(true)
        {
            @Override
            public void handleOnBackPressed() { checkAndNavigateBack(); }
        });
    }

    private void checkAndNavigateBack()
    {
        if (npTargetWeight.getValue() != initialTargetWeight || npDuration.getValue() != initialDuration)
        {
            new AlertDialog.Builder(requireContext())
                    .setTitle("작성 취소")
                    .setMessage("변경된 목표가 저장되지 않았습니다.\n돌아가시겠습니까?")
                    .setPositiveButton("예", (dialog, which) -> NavHostFragment.findNavController(this).popBackStack())
                    .setNegativeButton("아니오", null).show();
        }
        else
        {
            NavHostFragment.findNavController(this).popBackStack();
        }
    }
    private void saveTarget()
    {
        if (currentWeight == 0)
        {
            Toast.makeText(getContext(), "현재 체중 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.", Toast.LENGTH_SHORT).show();
            return;
        }
        int targetValue = npTargetWeight.getValue();
        if (targetValue >= currentWeight)
        {
            new AlertDialog.Builder(requireContext())
                    .setTitle("목표 설정 오류")
                    .setMessage("감량 목표 체중(" + targetValue + "kg)은 현재 체중(" + currentWeight + "kg)보다 낮아야 합니다.")
                    .setPositiveButton("확인", null)
                    .show();
            return;
        }

        SharedPreferences prefs = requireActivity().getSharedPreferences("GoalPrefs", Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();

        editor.putInt("target_weight", targetValue);
        editor.putInt("duration_months", npDuration.getValue());
        editor.putLong("start_date", System.currentTimeMillis());
        editor.putBoolean("is_goal_set", true);
        editor.apply();

        String uid = FirebaseAuth.getInstance().getUid();

        FirebaseFirestore.getInstance().collection("users").document(uid)
                .update("is_profile_set", true)
                .addOnSuccessListener(aVoid -> {
                    Toast.makeText(getContext(), "목표가 설정되었습니다!", Toast.LENGTH_SHORT).show();

                    // 홈 화면으로 이동
                    NavHostFragment.findNavController(this)
                            .navigate(R.id.action_target_to_home);
                })
                .addOnFailureListener(e -> {
                    Toast.makeText(getContext(), "설정 저장에 실패했습니다: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
    }
}