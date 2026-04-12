package com.capstone.fitainess;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.navigation.fragment.NavHostFragment;

import com.capstone.fitainess.InputValidator; // 이전에 만든 유틸리티 클래스
import com.google.firebase.auth.FirebaseAuth;

public class LoginFragment extends Fragment
{
    private FirebaseAuth mAuth;
    private EditText etEmail, etPassword;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState)
    {
        View view = inflater.inflate(R.layout.fragment_login, container, false);

        // Firebase Auth 초기화
        mAuth = FirebaseAuth.getInstance();

        // 뷰 초기화
        etEmail = view.findViewById(R.id.etEmail);
        etPassword = view.findViewById(R.id.etPassword);
        Button btnLogin = view.findViewById(R.id.btnLogin);
        Button btnGoToSignUp = view.findViewById(R.id.btnSignUp);

        btnLogin.setOnClickListener(v -> performLogin());

        btnGoToSignUp.setOnClickListener(v ->
        {
            // nav_graph.xml에 정의한 action ID를 사용하여 SignUpFragment로 이동
            NavHostFragment.findNavController(LoginFragment.this)
                    .navigate(R.id.action_login_to_signup);
        });

        return view;
    }

    private void performLogin()
    {
        String email = etEmail.getText().toString().trim();
        String password = etPassword.getText().toString().trim();

        if (!InputValidator.isValidEmail(email))
        {
            etEmail.setError("유효한 이메일을 입력하세요.");
            etEmail.requestFocus();
            return;
        }
        if (!InputValidator.isValidPassword(password))
        {
            etPassword.setError("비밀번호는 6자리 이상이어야 합니다.");
            etPassword.requestFocus();
            return;
        }

        //Firebase 로그인 API 호출
        mAuth.signInWithEmailAndPassword(email, password)
                .addOnCompleteListener(requireActivity(), task ->
                {
                    if (task.isSuccessful())
                    {
                        Toast.makeText(getContext(), "로그인 성공", Toast.LENGTH_SHORT).show();
                        NavHostFragment.findNavController(LoginFragment.this)
                                .navigate(R.id.action_login_to_home);
                    }
                    else
                    {
                        Toast.makeText(getContext(), "로그인 실패: " + task.getException().getMessage(), Toast.LENGTH_LONG).show();
                    }
                });
    }
}