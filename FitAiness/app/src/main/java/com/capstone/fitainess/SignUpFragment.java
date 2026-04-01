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

import com.capstone.fitainess.InputValidator;
import com.google.firebase.Firebase;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;

import java.util.HashMap;
import java.util.Map;


public class SignUpFragment extends Fragment
{

    private FirebaseAuth mAuth;
    private EditText etNewEmail, etNewPassword, etConfirmPassword;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState)
    {
        View view = inflater.inflate(R.layout.fragment_sign_up, container, false);

        mAuth = FirebaseAuth.getInstance();
        etNewEmail = view.findViewById(R.id.etNewEmail);
        etNewPassword = view.findViewById(R.id.etNewPassword);
        etConfirmPassword = view.findViewById(R.id.etConfirmPassword);
        Button btnSignUpSubmit = view.findViewById(R.id.btnSignUpSubmit);
        Button btnSignUpBack = view.findViewById(R.id.btnSignUpBack);


        btnSignUpSubmit.setOnClickListener(v -> performSignUp());
        btnSignUpBack.setOnClickListener(v -> NavHostFragment.findNavController(this).navigate(R.id.action_signup_to_login));

        return view;
    }

    private void performSignUp()
    {
        String email = etNewEmail.getText().toString().trim();
        String password = etNewPassword.getText().toString().trim();
        String confirmPassword = etConfirmPassword.getText().toString().trim();

        if (!InputValidator.isValidEmail(email))
        {
            etNewEmail.setError("유효한 이메일을 입력하세요.");
            etNewEmail.requestFocus();
            return;
        }
        if (!InputValidator.isValidPassword(password))
        {
            etNewPassword.setError("비밀번호는 6자리 이상이어야 합니다.");
            etNewPassword.requestFocus();
            return;
        }

        // 2. 가입 전용 추가 검증: 비밀번호 일치 여부 확인
        if (!InputValidator.isPasswordMatch(password, confirmPassword))
        {
            etConfirmPassword.setError("비밀번호가 일치하지 않습니다.");
            etConfirmPassword.requestFocus();
            return;
        }

        // 3. Firebase 계정 생성 API 호출
        mAuth.createUserWithEmailAndPassword(email, password)
                .addOnCompleteListener(requireActivity(), task ->
                {
                    if (task.isSuccessful())
                    {
                        String uid = mAuth.getCurrentUser().getUid();
                        FirebaseFirestore db = FirebaseFirestore.getInstance();

                        Map<String, Object> user = new HashMap<>();
                        user.put("email", email);
                        user.put("is_profile_set", false);

                        db.collection("users").document(uid).set(user).addOnSuccessListener(aVoid ->
                        {
                            Toast.makeText(getContext(), "계정이 생성되었습니다.", Toast.LENGTH_SHORT).show();
                            NavHostFragment.findNavController(this).navigate(R.id.action_signup_to_login);
                        });
                    }
                    else
                    {
                        // 가입 실패 처리 (예: 이미 존재하는 이메일 등)
                        Toast.makeText(getContext(), "가입 실패: " + task.getException().getMessage(), Toast.LENGTH_LONG).show();
                    }
                });
    }
}