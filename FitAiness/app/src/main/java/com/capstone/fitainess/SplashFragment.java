package com.capstone.fitainess;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.navigation.fragment.NavHostFragment;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;

public class SplashFragment extends Fragment
{
    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState)
    {
        return inflater.inflate(R.layout.fragment_splash, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState)
    {
        super.onViewCreated(view, savedInstanceState);

        
        // UI 및 라우팅 로직 로드를 위한 유예시간
        new Handler(Looper.getMainLooper()).postDelayed(() -> checkLoginStatus(), 1000);
    }

    private void checkLoginStatus()
    {
        // 이 시점에서 프래그먼트가 이미 종료되었거나 화면에서 사라졌다면 실행하지 않음
        if (!isAdded() || getActivity() == null) return;

        FirebaseAuth auth = FirebaseAuth.getInstance();
        FirebaseUser currentUser = auth.getCurrentUser();

        if (currentUser != null)
        {
            // 이미 로그인된 사용자 -> 메인 대시보드(HomeFragment)로 이동
            NavHostFragment.findNavController(this).navigate(R.id.action_splash_to_home);
        }
        else
        {
            // 로그인되지 않은 사용자 -> 온보딩/로그인 화면(LoginFragment)으로 이동
            NavHostFragment.findNavController(this).navigate(R.id.action_splash_to_login);
        }
    }
}