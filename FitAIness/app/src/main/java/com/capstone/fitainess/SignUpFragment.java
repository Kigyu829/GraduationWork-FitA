package com.capstone.fitainess;

import android.app.AlertDialog;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
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
    private EditText etNickname, etNewEmail, etNewPassword, etConfirmPassword;


    public SignUpFragment()
    {
        super(R.layout.fragment_sign_up);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState)
    {
        super.onViewCreated(view, savedInstanceState);

        mAuth = FirebaseAuth.getInstance();
        etNickname = view.findViewById(R.id.etNickname);
        etNewEmail = view.findViewById(R.id.etNewEmail);
        etNewPassword = view.findViewById(R.id.etNewPassword);
        etConfirmPassword = view.findViewById(R.id.etConfirmPassword);

        Button btnSignUpSubmit = view.findViewById(R.id.btnSignUpSubmit);
        Button btnSignUpBack = view.findViewById(R.id.btnSignUpBack);

        btnSignUpSubmit.setOnClickListener(v -> performSignUp());
        btnSignUpBack.setOnClickListener(v -> NavHostFragment.findNavController(this).navigate(R.id.action_signup_to_login));

        setupBackButtonLogic(view);
    }

    private void performSignUp()
    {
        String nickname = etNickname.getText().toString().trim();
        String email = etNewEmail.getText().toString().trim();
        String password = etNewPassword.getText().toString().trim();
        String confirmPassword = etConfirmPassword.getText().toString().trim();

        if (nickname.isEmpty())
        {
            etNickname.setError("닉네임을 입력하세요.");
            etNickname.requestFocus();
            return;
        }

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
        if (!InputValidator.isPasswordMatch(password, confirmPassword))
        {
            etConfirmPassword.setError("비밀번호가 일치하지 않습니다.");
            etConfirmPassword.requestFocus();
            return;
        }

        mAuth.createUserWithEmailAndPassword(email, password)
                .addOnCompleteListener(requireActivity(), task ->
                {
                    if (task.isSuccessful())
                    {
                        String uid = mAuth.getCurrentUser().getUid();
                        FirebaseFirestore db = FirebaseFirestore.getInstance();

                        Map<String, Object> user = new HashMap<>();
                        user.put("email", email);
                        user.put("nickname", nickname);
                        user.put("is_profile_set", false);

                        db.collection("users").document(uid).set(user).addOnSuccessListener(aVoid ->
                        {
                            Toast.makeText(getContext(), "계정이 생성되었습니다.", Toast.LENGTH_SHORT).show();
                            NavHostFragment.findNavController(this).navigate(R.id.action_signup_to_home);
                        });
                    }
                    else
                    {
                        Toast.makeText(getContext(), "가입 실패: " + task.getException().getMessage(), Toast.LENGTH_LONG).show();
                    }
                });
    }

    //백버튼 리스너
    private void setupBackButtonLogic(View view)
    {
        ImageButton btnBack = view.findViewById(R.id.btnBack);
        btnBack.setOnClickListener(v -> checkAndNavigateBack());

        requireActivity().getOnBackPressedDispatcher().addCallback(getViewLifecycleOwner(), new OnBackPressedCallback(true)
        {
            @Override
            public void handleOnBackPressed()
            {
                checkAndNavigateBack();
            }
        });
    }

    private void checkAndNavigateBack()
    {
        String email = etNewEmail.getText().toString();
        String password = etNewPassword.getText().toString();
        String confirm = etConfirmPassword.getText().toString();

        if (!email.isEmpty() || !password.isEmpty() || !confirm.isEmpty())
        {   //백버튼 다이얼로그
            new AlertDialog.Builder(requireContext())
                    .setTitle("작성 취소")
                    .setMessage("입력 중인 정보가 모두 사라집니다.\n이전 화면으로 돌아가시겠습니까?")
                    .setPositiveButton("예", (dialog, which) ->
                    {
                        NavHostFragment.findNavController(SignUpFragment.this).popBackStack();
                    })
                    .setNegativeButton("아니오", null)
                    .show();
        }
        else
        {
            NavHostFragment.findNavController(SignUpFragment.this).popBackStack();
        }
    }
}