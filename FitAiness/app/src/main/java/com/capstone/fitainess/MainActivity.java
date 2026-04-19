package com.capstone.fitainess;

import android.os.Bundle;
import android.view.View;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.navigation.NavController;
import androidx.navigation.fragment.NavHostFragment;
import androidx.navigation.ui.NavigationUI;
import com.google.android.material.bottomnavigation.BottomNavigationView;

public class MainActivity extends AppCompatActivity
{

    private BottomNavigationView bottomNavigationView;

    @Override
    protected void onCreate(Bundle savedInstanceState)
    {
        // Android 12 스플래시 스크린 적용
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        bottomNavigationView = findViewById(R.id.bottom_nav_view);

        // NavController 설정
        NavHostFragment navHostFragment = (NavHostFragment) getSupportFragmentManager().findFragmentById(R.id.nav_host_fragment);
        NavController navController = navHostFragment.getNavController();

        // BottomNavigationView <-> NavController 연결 (id 매칭으로 자동 탭 전환)
        NavigationUI.setupWithNavController(bottomNavigationView, navController);

        // 특정 프래그먼트에서 하단바 숨기기/보이기 제어
        navController.addOnDestinationChangedListener((controller, destination, arguments) ->
        {
            int id = destination.getId();
            if (id == R.id.splashFragment ||
                    id == R.id.loginFragment ||
                    id == R.id.signUpFragment ||
                    id == R.id.bodyInfoFragment ||
                    id == R.id.chatFragment)
            {
                // 온보딩 및 로그인 과정에서는 하단바 숨김
                bottomNavigationView.setVisibility(View.GONE);
            }
            else
            {
                // Home(sc301) 등 메인 탭 화면에서는 노출
                bottomNavigationView.setVisibility(View.VISIBLE);
            }
        });
    }
}