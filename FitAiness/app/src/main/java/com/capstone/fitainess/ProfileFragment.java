package com.capstone.fitainess;

import android.app.AlertDialog;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.navigation.fragment.NavHostFragment;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;

public class ProfileFragment extends Fragment
{

    private TextView tvProfileHeight, tvProfileWeight, tvProfileBmi;
    private FirebaseFirestore db;
    private String uid;

    public ProfileFragment() { super(R.layout.fragment_profile); }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState)
    {
        super.onViewCreated(view, savedInstanceState);

        tvProfileHeight = view.findViewById(R.id.tvProfileHeight);
        tvProfileWeight = view.findViewById(R.id.tvProfileWeight);
        tvProfileBmi = view.findViewById(R.id.tvProfileBmi);
        Button btnGoToEdit = view.findViewById(R.id.btnGoToEdit);

        db = FirebaseFirestore.getInstance();
        uid = FirebaseAuth.getInstance().getUid();

        // 화면 진입 시 기존 정보 불러오기
        loadUserProfile();

        // 정보 수정 버튼 클릭 이벤트
        btnGoToEdit.setOnClickListener(v -> showEditConfirmDialog());
    }

    private void loadUserProfile()
    {
        if (uid == null) return;

        db.collection("users").document(uid).get().addOnCompleteListener(task ->
        {
            if (task.isSuccessful() && task.getResult() != null) {
                DocumentSnapshot doc = task.getResult();
                if (doc.exists()) {
                    Long height = doc.getLong("height");
                    Long weight = doc.getLong("weight");

                    if (height != null && weight != null) {
                        tvProfileHeight.setText("키: " + height + " cm");
                        tvProfileWeight.setText("몸무게: " + weight + " kg");

                        // BMI 계산 로직
                        double heightInMeter = height / 100.0;
                        double bmi = weight / (heightInMeter * heightInMeter);
                        String bmiText = String.format("BMI: %.1f", bmi);

                        if (bmi >= 25.0) bmiText += " (비만)";
                        else if (bmi >= 23.0) bmiText += " (과체중)";
                        else if (bmi >= 18.5) bmiText += " (정상)";
                        else bmiText += " (저체중)";

                        tvProfileBmi.setText(bmiText);
                    }
                }
            }
        });
    }

    private void showEditConfirmDialog()
    {
        new AlertDialog.Builder(requireContext())
                .setTitle("정보 수정")
                .setMessage("신체 정보 수정 화면으로 이동하시겠습니까?")
                .setPositiveButton("예", (dialog, which) ->
                {
                    if (uid == null) return;

                    // is_profile_set을 false로 변경
                    db.collection("users").document(uid).update("is_profile_set", false)
                            .addOnSuccessListener(aVoid ->
                            {
                                NavHostFragment.findNavController(ProfileFragment.this)
                                        .navigate(R.id.action_profile_to_bodyInfo);
                            })
                            .addOnFailureListener(e ->
                            {
                                Toast.makeText(getContext(), "오류가 발생했습니다. 다시 시도해주세요.", Toast.LENGTH_SHORT).show();
                            });
                })
                .setNegativeButton("아니오", null)
                .show();
    }
}