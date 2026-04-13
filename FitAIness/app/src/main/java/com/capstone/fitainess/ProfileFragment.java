package com.capstone.fitainess;

import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.cardview.widget.CardView;
import androidx.fragment.app.Fragment;
import androidx.navigation.fragment.NavHostFragment;

import com.google.firebase.Firebase;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;

public class ProfileFragment extends Fragment {

    private TextView tvProfileHeight, tvProfileWeight, tvProfileBmi;
    private CardView cvGoalStatus;
    private TextView tvGoalTitle, tvGoalMessage;
    private String uid;

    public ProfileFragment() { super(R.layout.fragment_profile); }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        // 뷰 연결
        tvProfileHeight = view.findViewById(R.id.tvProfileHeight);
        tvProfileWeight = view.findViewById(R.id.tvProfileWeight);
        tvProfileBmi = view.findViewById(R.id.tvProfileBmi);
        cvGoalStatus = view.findViewById(R.id.cvProfileGoalStatus);
        tvGoalTitle = view.findViewById(R.id.tvProfileGoalTitle);
        tvGoalMessage = view.findViewById(R.id.tvProfileGoalMessage);

        // 버튼
        Button btnGoToBodyEdit = view.findViewById(R.id.btnGoToBodyEdit);
        Button btnGoToTargetEdit = view.findViewById(R.id.btnGoToTargetEdit);
        Button btnClearData = view.findViewById(R.id.btnClearData);
        Button btnDeleteAccount = view.findViewById(R.id.btnDeleteAccount);

        uid = FirebaseAuth.getInstance().getUid();

        // 데이터 로드
        loadUserProfile(); // Firestore
        loadGoalProfile(); // SharedPreferences

        // 이동 버튼 이벤트 (다이얼로그 포함)
        btnGoToBodyEdit.setOnClickListener(v -> showConfirmDialog("신체 정보 수정", "신체 정보 수정 화면으로 이동하시겠습니까?", true));
        btnGoToTargetEdit.setOnClickListener(v -> showConfirmDialog("목표 설정 수정", "목표 설정 화면으로 이동하시겠습니까?", false));
        btnClearData.setOnClickListener(v -> showClearDataDialog());
        btnDeleteAccount.setOnClickListener(v -> showDeleteAccountDialog());
        Button btnLogout = view.findViewById(R.id.btnLogout);
        view.findViewById(R.id.btnViewRecentLog).setOnClickListener(v ->
                NavHostFragment.findNavController(this).navigate(R.id.action_profile_to_recentLog)
        );
        btnLogout.setOnClickListener(v ->
        {
            // 파이어베이스 인증 세션 종료
            FirebaseAuth.getInstance().signOut();

            // 로그인 화면으로 강제 이동 (백 스택 모두 제거)
            NavHostFragment.findNavController(ProfileFragment.this)
                    .navigate(R.id.action_profile_to_login);
        });
    }

    private void loadUserProfile() {
        if (uid == null) return;
        FirebaseFirestore.getInstance().collection("users").document(uid).get()
                .addOnSuccessListener(doc -> {
                    if (doc.exists()) {
                        Long h = doc.getLong("height");
                        Long w = doc.getLong("weight");
                        if (h != null && w != null) {
                            tvProfileHeight.setText("키: " + h + " cm");
                            tvProfileWeight.setText("몸무게: " + w + " kg");
                            double bmi = w / (Math.pow(h / 100.0, 2));
                            tvProfileBmi.setText(String.format("BMI: %.1f", bmi));
                        }
                    }
                });
    }

    private void loadGoalProfile() {
        SharedPreferences prefs = requireActivity().getSharedPreferences("GoalPrefs", Context.MODE_PRIVATE);
        boolean isGoalSet = prefs.getBoolean("is_goal_set", false);

        if (!isGoalSet) {
            cvGoalStatus.setCardBackgroundColor(Color.parseColor("#FFEBEE")); // 미설정 시 붉은색 배경
            tvGoalMessage.setText("목표가 설정되지 않았습니다.");
        } else {
            cvGoalStatus.setCardBackgroundColor(Color.WHITE);
            int targetWeight = prefs.getInt("target_weight", 0);
            int duration = prefs.getInt("duration_months", 0);
            tvGoalMessage.setText(String.format("목표 체중: %d kg\n목표 기간: %d 개월", targetWeight, duration));
        }
    }

    private void showConfirmDialog(String title, String message, boolean isBodyInfo)
    {
        new AlertDialog.Builder(requireContext())
                .setTitle(title)
                .setMessage(message)
                .setPositiveButton("예", (dialog, which) ->
                {
                    if (isBodyInfo)
                    {
                        // 신체 정보 수정 시에는 is_profile_set 플래그 변경 후 이동
                        FirebaseFirestore.getInstance().collection("users").document(uid)
                                .update("is_profile_set", false)
                                .addOnSuccessListener(aVoid -> NavHostFragment.findNavController(this).navigate(R.id.action_profile_to_bodyInfo));
                    }
                    else
                    {
                        // 목표 수정 시에는 바로 이동 (SharedPreferences 기반이므로)
                        NavHostFragment.findNavController(this).navigate(R.id.action_profile_to_target);
                    }
                })
                .setNegativeButton("아니오", null)
                .show();
    }
    // ──────────────────────────────────────
    // 1. SharedPreferences 데이터 초기화 로직
    // ──────────────────────────────────────
    private void showClearDataDialog()
    {
        new AlertDialog.Builder(requireContext())
                .setTitle("데이터 초기화")
                .setMessage("저장된 식단, 목표, 챌린지 기록이 기기에서 모두 삭제됩니다.\n정말 초기화하시겠습니까?")
                .setPositiveButton("초기화", (dialog, which) -> resetUserData())
                .setNegativeButton("취소", null)
                .show();
    }

    private void resetUserData()
    {
        String uid = FirebaseAuth.getInstance().getUid();
        if (uid == null) return;

        FirebaseFirestore db = FirebaseFirestore.getInstance();

        // 프로필 설정 플래그를 false로 변경
        db.collection("users").document(uid)
                .update("is_profile_set", false, "weight", null, "height", null)
                .addOnSuccessListener(aVoid -> {

                    // 로컬 SharedPreferences 일괄 삭제
                    String[] spNames = {"meal_sp", "workout_sp", "GoalPrefs", "ChallengePrefs"};
                    for (String spName : spNames) {
                        requireContext().getSharedPreferences(spName, Context.MODE_PRIVATE)
                                .edit().clear().apply();
                    }

                    Toast.makeText(getContext(), "데이터가 초기화되었습니다.", Toast.LENGTH_SHORT).show();

                    // 홈 화면으로 이동
                    NavHostFragment.findNavController(this)
                            .navigate(R.id.action_profile_to_home);
                })
                .addOnFailureListener(e -> {
                    Toast.makeText(getContext(), "초기화 실패: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
    }
    // ──────────────────────────────────────
    // 2. Firebase 회원 탈퇴 로직
    // ──────────────────────────────────────
    private void showDeleteAccountDialog()
    {
        new AlertDialog.Builder(requireContext())
                .setTitle("회원 탈퇴")
                .setMessage("계정 및 클라우드에 저장된 모든 정보가 영구적으로 삭제되며 복구할 수 없습니다.\n정말 탈퇴하시겠습니까?")
                .setPositiveButton("탈퇴", (dialog, which) -> deleteFirebaseAccount())
                .setNegativeButton("취소", null)
                .show();
    }

    private void deleteFirebaseAccount()
    {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user != null) {
            String uid = user.getUid();
            FirebaseFirestore db = FirebaseFirestore.getInstance();

            // Firestore에 저장된 유저 프로필 문서(Document) 삭제
            db.collection("users").document(uid).delete().addOnCompleteListener(task ->
            {
                // Firebase Auth 계정 삭제
                user.delete().addOnCompleteListener(authTask -> {
                    if (authTask.isSuccessful())
                    {
                        // SP 데이터 삭제
                        resetUserData();

                        Toast.makeText(getContext(), "탈퇴가 완료되었습니다. 이용해 주셔서 감사합니다.", Toast.LENGTH_LONG).show();

                        // 로그인 화면으로 eject
                        NavHostFragment.findNavController(this).navigate(R.id.action_profile_to_login);
                    }
                    else
                        Toast.makeText(getContext(), "탈퇴 실패: " + authTask.getException().getMessage(), Toast.LENGTH_SHORT).show();
                });
            });
        }
    }
}
