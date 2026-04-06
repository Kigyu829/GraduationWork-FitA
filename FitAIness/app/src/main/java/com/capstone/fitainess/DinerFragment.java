package com.capstone.fitainess;

import android.app.AlertDialog;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.FileProvider;
import androidx.fragment.app.Fragment;
import androidx.navigation.fragment.NavHostFragment;

import java.io.File;
import java.io.IOException;

public class DinerFragment extends Fragment
{

    private ImageView ivMealPreview;
    private Button btnUpload;

    // 고화질 원본 이미지가 저장될 경로 (Uri)
    private Uri currentPhotoUri;

    // 카메라 촬영 원본 (TakePicture) 처리
    private final ActivityResultLauncher<Uri> cameraLauncher = registerForActivityResult(
            new ActivityResultContracts.TakePicture(),
            isSuccess ->
            {
                if (isSuccess && currentPhotoUri != null)
                {
                    ivMealPreview.setImageURI(currentPhotoUri); // 원본 고화질 이미지 렌더링
                    btnUpload.setEnabled(true);
                }
            }
    );

    // 갤러리 선택 결과 처리
    private final ActivityResultLauncher<String> galleryLauncher = registerForActivityResult(
            new ActivityResultContracts.GetContent(),
            uri ->
            {
                if (uri != null)
                {
                    currentPhotoUri = uri; // 갤러리에서 선택한 이미지의 원본 Uri 저장
                    ivMealPreview.setImageURI(currentPhotoUri); //이미지 프리뷰(iv)에 삽입
                    btnUpload.setEnabled(true);
                }
            }
    );

    public DinerFragment()
    {
        super(R.layout.fragment_diner);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState)
    {
        super.onViewCreated(view, savedInstanceState);

        ivMealPreview = view.findViewById(R.id.ivMealPreview);
        btnUpload = view.findViewById(R.id.btnUpload);
        Button btnCamera = view.findViewById(R.id.btnCamera);
        Button btnGallery = view.findViewById(R.id.btnGallery);
        ImageButton btnBack = view.findViewById(R.id.btnBack);

        btnBack.setOnClickListener(v -> NavHostFragment.findNavController(this).popBackStack());

        // 카메라 실행 전 임시 파일(Uri)부터 생성
        btnCamera.setOnClickListener(v -> launchCameraWithHighRes());

        btnGallery.setOnClickListener(v -> galleryLauncher.launch("image/*"));

        // 분석 시작 버튼 클릭 시 식사 종류 다이얼로그 호출
        btnUpload.setOnClickListener(v -> showMealSelectionDialog());
    }

    // 빈 임시 파일을 만들고 카메라 앱에 넘겨주는 핵심 로직
    private void launchCameraWithHighRes()
    {
        try
        {
            // 내부 캐시 디렉토리에 빈 이미지 파일 생성 (앱 종료 시 자동 정리됨)
            File photoFile = File.createTempFile("meal_image_", ".jpg", requireContext().getCacheDir());

            // FileProvider를 통해 카메라 앱이 접근할 수 있는 안전한 Uri 발급
            currentPhotoUri = FileProvider.getUriForFile(requireContext(),
                    requireContext().getPackageName() + ".fileprovider",
                    photoFile);

            // 카메라 앱 실행 (저장될 위치 Uri를 함께 전달)
            cameraLauncher.launch(currentPhotoUri);

        }
        catch (IOException e)
        {
            Toast.makeText(getContext(), "카메라 실행 중 오류가 발생했습니다.", Toast.LENGTH_SHORT).show();
            e.printStackTrace();
        }
    }

    // 아침/점심/저녁 선택 다이얼로그
    private void showMealSelectionDialog()
    {
        String[] mealTypes = {"아침", "점심", "저녁", "간식"};

        new AlertDialog.Builder(requireContext())
                .setTitle("어느 식단에 추가할까요?")
                .setItems(mealTypes, (dialog, which) ->
                {
                    String selectedMeal = mealTypes[which];
                    startAiAnalysis(selectedMeal);
                })
                .setNegativeButton("취소", null)
                .show();
    }

    // 최종 분석 로직
    private void startAiAnalysis(String mealType)
    {
        Toast.makeText(getContext(), mealType + " 사진으로 AI 분석을 시작합니다!", Toast.LENGTH_SHORT).show();

        // TODO: currentPhotoUri, mealType 엮어서 백엔드로 전송
    }
}