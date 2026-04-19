package com.capstone.fitainess;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.ImageButton;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.camera.core.Camera;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageProxy;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.Fragment;
import androidx.navigation.fragment.NavHostFragment;

import com.google.common.util.concurrent.ListenableFuture;
import com.google.mediapipe.framework.image.BitmapImageBuilder;
import com.google.mediapipe.framework.image.MPImage;
import com.google.mediapipe.tasks.core.BaseOptions;
import com.google.mediapipe.tasks.vision.core.RunningMode;
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker;
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * MediaPipe PoseLandmarker를 이용한 실시간 자세 분석 화면
 *
 * 사전 준비:
 *   app/src/main/assets/ 폴더에 MediaPipe 모델 파일 배치:
 *   pose_landmarker_lite.task  (경량, 권장)
 *   다운로드: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task
 *
 * Navigation 전달 인자:
 *   "exercise_name" (String, 선택) — 운동 이름 (화면 상단에 표시)
 */
public class ExercisePoseFragment extends Fragment
{
    private static final String TAG        = "ExercisePoseFragment";
    private static final String MODEL_NAME = "pose_landmarker_lite.task";

    private PreviewView   previewView;
    private PoseOverlayView overlayView;
    private TextView      tvExerciseName;
    private TextView      tvPoseStatus;
    private ImageButton   btnBack;

    private PoseLandmarker      poseLandmarker;
    private ExecutorService     cameraExecutor;
    private ProcessCameraProvider cameraProvider;

    private final ActivityResultLauncher<String> cameraPermLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
                if (granted) startCamera();
                else Toast.makeText(requireContext(), "카메라 권한이 필요합니다.", Toast.LENGTH_SHORT).show();
            });

    public ExercisePoseFragment() { super(R.layout.fragment_exercise_pose); }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState)
    {
        super.onViewCreated(view, savedInstanceState);

        previewView    = view.findViewById(R.id.previewView);
        overlayView    = view.findViewById(R.id.poseOverlayView);
        tvExerciseName = view.findViewById(R.id.tvExerciseName);
        tvPoseStatus   = view.findViewById(R.id.tvPoseStatus);
        btnBack        = view.findViewById(R.id.btnBack);

        // Navigation 인자에서 운동 이름 읽기
        if (getArguments() != null) {
            String name = getArguments().getString("exercise_name", "자세 분석");
            tvExerciseName.setText(name);
        }

        btnBack.setOnClickListener(v ->
                NavHostFragment.findNavController(this).popBackStack());

        cameraExecutor = Executors.newSingleThreadExecutor();
        initPoseLandmarker();

        // 카메라 권한 확인 후 시작
        if (ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED) {
            startCamera();
        } else {
            cameraPermLauncher.launch(Manifest.permission.CAMERA);
        }
    }

    // ── MediaPipe PoseLandmarker 초기화 ──────────────────────────
    private boolean poseSupported = false;

    private void initPoseLandmarker()
    {
        try {
            BaseOptions baseOptions = BaseOptions.builder()
                    .setModelAssetPath(MODEL_NAME)
                    .build();

            PoseLandmarker.PoseLandmarkerOptions options =
                    PoseLandmarker.PoseLandmarkerOptions.builder()
                            .setBaseOptions(baseOptions)
                            .setRunningMode(RunningMode.LIVE_STREAM)
                            .setNumPoses(1)
                            .setMinPoseDetectionConfidence(0.5f)
                            .setMinPosePresenceConfidence(0.5f)
                            .setMinTrackingConfidence(0.5f)
                            .setResultListener(this::handlePoseResult)
                            .setErrorListener(err ->
                                    Log.e(TAG, "MediaPipe 오류: " + err.getMessage()))
                            .build();

            poseLandmarker  = PoseLandmarker.createFromOptions(requireContext(), options);
            poseSupported   = true;
            tvPoseStatus.setText("자세를 카메라 앞에 보여주세요.");
            Log.i(TAG, "PoseLandmarker 초기화 완료");

        } catch (Exception e) {
            Log.e(TAG, "PoseLandmarker 초기화 실패", e);
            showUnsupportedMessage(e.getMessage());
        } catch (Error e) {
            // x86_64 에뮬레이터 등 JNI 미지원 환경
            Log.e(TAG, "MediaPipe JNI 로드 실패 (에뮬레이터 미지원)", e);
            showUnsupportedMessage("실기기 또는 arm64 에뮬레이터에서 실행해주세요.");
        }
    }

    private void showUnsupportedMessage(String detail) {
        poseSupported = false;
        tvPoseStatus.setText("⚠️ 이 환경에서는 자세 분석이 지원되지 않습니다.\n"
                + "실기기 또는 arm64 에뮬레이터에서 테스트해주세요.\n\n" + detail);
    }

    // ── CameraX 시작 ────────────────────────────────────────────
    private void startCamera()
    {
        ListenableFuture<ProcessCameraProvider> future =
                ProcessCameraProvider.getInstance(requireContext());

        future.addListener(() -> {
            try {
                cameraProvider = future.get();
                bindCamera();
            } catch (Exception e) {
                Log.e(TAG, "CameraProvider 오류", e);
            }
        }, ContextCompat.getMainExecutor(requireContext()));
    }

    private void bindCamera()
    {
        if (cameraProvider == null) return;
        cameraProvider.unbindAll();

        Preview preview = new Preview.Builder().build();
        preview.setSurfaceProvider(previewView.getSurfaceProvider());

        ImageAnalysis imageAnalysis = new ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
                .build();

        imageAnalysis.setAnalyzer(cameraExecutor, this::analyzeImage);

        CameraSelector cameraSelector = new CameraSelector.Builder()
                .requireLensFacing(CameraSelector.LENS_FACING_FRONT)
                .build();

        try {
            Camera camera = cameraProvider.bindToLifecycle(
                    getViewLifecycleOwner(), cameraSelector, preview, imageAnalysis);
        } catch (Exception e) {
            Log.e(TAG, "카메라 바인딩 실패", e);
        }
    }

    // ── 프레임 분석 → MediaPipe 전달 ─────────────────────────────
    private void analyzeImage(ImageProxy imageProxy)
    {
        if (poseLandmarker == null) { imageProxy.close(); return; }

        try {
            android.graphics.Bitmap bitmap = imageProxy.toBitmap();
            MPImage mpImage = new BitmapImageBuilder(bitmap).build();
            long timestamp  = imageProxy.getImageInfo().getTimestamp();
            poseLandmarker.detectAsync(mpImage, timestamp);
        } catch (Exception e) {
            Log.e(TAG, "이미지 분석 오류", e);
        } finally {
            imageProxy.close();
        }
    }

    // ── PoseLandmarker 결과 처리 ─────────────────────────────────
    private void handlePoseResult(PoseLandmarkerResult result, MPImage input)
    {
        boolean poseDetected = result != null && !result.landmarks().isEmpty();
        requireActivity().runOnUiThread(() -> {
            if (poseDetected) {
                overlayView.setResults(result, input.getWidth(), input.getHeight());
                tvPoseStatus.setText("자세 감지 중...");
            } else {
                overlayView.clearResults();
                tvPoseStatus.setText("사람이 감지되지 않았습니다. 카메라 앞에 서주세요.");
            }
        });
    }

    // ── 생명주기 정리 ─────────────────────────────────────────────
    @Override
    public void onDestroyView()
    {
        super.onDestroyView();
        cameraExecutor.shutdown();
        if (poseLandmarker != null) {
            poseLandmarker.close();
            poseLandmarker = null;
        }
    }
}
