package com.capstone.fitainess;

import android.app.AlertDialog;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.navigation.fragment.NavHostFragment;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;

public class HomeFragment extends Fragment
{

    public HomeFragment() { super(R.layout.fragment_home); }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState)
    {
        super.onViewCreated(view, savedInstanceState);
        checkUserProfile();

        Button btnLogout = view.findViewById(R.id.btnLogout);
        btnLogout.setOnClickListener(v ->
        {
            // 파이어베이스 인증 세션 종료
            FirebaseAuth.getInstance().signOut();

            // 로그인 화면으로 강제 이동 (백 스택 모두 제거)
            NavHostFragment.findNavController(HomeFragment.this)
                    .navigate(R.id.action_home_to_login);
        });
    }

    private void checkUserProfile()
    {
        String uid = FirebaseAuth.getInstance().getUid();
        if (uid == null) return;

        FirebaseFirestore.getInstance().collection("users").document(uid)
                .get().addOnCompleteListener(task ->
                {
                    if (task.isSuccessful())
                    {
                        DocumentSnapshot doc = task.getResult();
                        // is_profile_set이 false이면 경고창 노출
                        if (doc.exists() && !doc.getBoolean("is_profile_set"))
                        {
                            showInitialSettingDialog();
                        }
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
}