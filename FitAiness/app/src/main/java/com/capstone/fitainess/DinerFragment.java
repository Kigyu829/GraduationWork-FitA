package com.capstone.fitainess;

import android.app.AlertDialog;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Button;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.Toast;
import android.text.InputType;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.FileProvider;
import androidx.fragment.app.Fragment;
import androidx.navigation.fragment.NavHostFragment;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class DinerFragment extends Fragment
{
    // CNN 서버 주소 (에뮬레이터: 10.0.2.2 / 실기기: PC 실제 IP)
    private static final String CNN_SERVER = "http://10.0.2.2:4000";

    private ImageView ivMealPreview;
    private Button btnUpload;
    private ProgressBar progressBar;

    private Uri currentPhotoUri;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    // 카메라 촬영 결과 처리
    private final ActivityResultLauncher<Uri> cameraLauncher = registerForActivityResult(
            new ActivityResultContracts.TakePicture(),
            isSuccess -> {
                if (isSuccess && currentPhotoUri != null) {
                    ivMealPreview.setImageURI(currentPhotoUri);
                    btnUpload.setEnabled(true);
                }
            }
    );

    // 갤러리 선택 결과 처리
    private final ActivityResultLauncher<String> galleryLauncher = registerForActivityResult(
            new ActivityResultContracts.GetContent(),
            uri -> {
                if (uri != null) {
                    currentPhotoUri = uri;
                    ivMealPreview.setImageURI(currentPhotoUri);
                    btnUpload.setEnabled(true);
                }
            }
    );

    public DinerFragment() { super(R.layout.fragment_diner); }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState)
    {
        super.onViewCreated(view, savedInstanceState);

        ivMealPreview = view.findViewById(R.id.ivMealPreview);
        btnUpload     = view.findViewById(R.id.btnUpload);
        progressBar   = view.findViewById(R.id.progressBar);
        Button btnCamera  = view.findViewById(R.id.btnCamera);
        Button btnGallery = view.findViewById(R.id.btnGallery);
        ImageButton btnBack = view.findViewById(R.id.btnBack);

        btnBack.setOnClickListener(v -> NavHostFragment.findNavController(this).popBackStack());
        btnCamera.setOnClickListener(v -> launchCameraWithHighRes());
        btnGallery.setOnClickListener(v -> galleryLauncher.launch("image/*"));
        btnUpload.setOnClickListener(v -> showMealSelectionDialog());
    }

    // ──────────────────────────────────────
    // 카메라 실행
    // ──────────────────────────────────────

    private void launchCameraWithHighRes()
    {
        try {
            File photoFile = File.createTempFile("meal_image_", ".jpg", requireContext().getCacheDir());
            currentPhotoUri = FileProvider.getUriForFile(requireContext(),
                    requireContext().getPackageName() + ".fileprovider", photoFile);
            cameraLauncher.launch(currentPhotoUri);
        } catch (IOException e) {
            Toast.makeText(getContext(), "카메라 실행 중 오류가 발생했습니다.", Toast.LENGTH_SHORT).show();
        }
    }

    // ──────────────────────────────────────
    // 식사 종류 선택 → CNN 분석
    // ──────────────────────────────────────

    private void showMealSelectionDialog()
    {
        String[] mealTypes = {"아침", "점심", "저녁", "간식"};
        new AlertDialog.Builder(requireContext())
                .setTitle("어느 식단에 추가할까요?")
                .setItems(mealTypes, (dialog, which) -> startAiAnalysis(mealTypes[which]))
                .setNegativeButton("취소", null)
                .show();
    }

    /** CNN 서버로 이미지 전송 및 결과 처리 */
    private void startAiAnalysis(String mealType)
    {
        if (currentPhotoUri == null) return;

        btnUpload.setEnabled(false);
        progressBar.setVisibility(View.VISIBLE);

        executor.execute(() -> {
            try {
                // 이미지 → JPEG 바이트 배열로 압축 (최대 1024px, 80% 품질)
                byte[] imageBytes = compressImage(currentPhotoUri);

                // CNN 서버에 multipart 전송
                String boundary = "----AndroidBoundary" + System.currentTimeMillis();
                URL url = new URL(CNN_SERVER + "/api/analyze");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setDoOutput(true);
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(60000);
                conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);

                OutputStream os = conn.getOutputStream();
                // multipart 헤더
                String partHeader = "--" + boundary + "\r\n"
                        + "Content-Disposition: form-data; name=\"image\"; filename=\"meal.jpg\"\r\n"
                        + "Content-Type: image/jpeg\r\n\r\n";
                os.write(partHeader.getBytes("UTF-8"));
                os.write(imageBytes);
                os.write(("\r\n--" + boundary + "--\r\n").getBytes("UTF-8"));
                os.flush();
                os.close();

                int code = conn.getResponseCode();
                InputStream is = (code == 200) ? conn.getInputStream() : conn.getErrorStream();
                String responseBody = readStream(is);
                conn.disconnect();

                if (code != 200) {
                    throw new Exception("서버 오류 " + code + ": " + responseBody);
                }

                JSONObject json = new JSONObject(responseBody);
                if (!json.optBoolean("success", false)) {
                    throw new Exception(json.optString("message", "분석 실패"));
                }

                JSONObject data = json.getJSONObject("data");
                mainHandler.post(() -> showAnalysisResult(data, mealType));

            } catch (Exception e) {
                mainHandler.post(() -> {
                    if (!isAdded()) return;
                    progressBar.setVisibility(View.GONE);
                    btnUpload.setEnabled(true);
                    new AlertDialog.Builder(requireContext())
                            .setTitle("❌ 분석 실패")
                            .setMessage(e.getMessage())
                            .setPositiveButton("확인", null)
                            .show();
                });
            }
        });
    }

    // ──────────────────────────────────────
    // 결과 처리
    // ──────────────────────────────────────

    /** AI 결과를 받아 탐지 음식 체크리스트 표시 */
    private void showAnalysisResult(JSONObject data, String mealType) {
        if (!isAdded()) return;
        progressBar.setVisibility(View.GONE);
        btnUpload.setEnabled(true);

        List<String> detectedFoods = new ArrayList<>();
        JSONArray detectionsArr = data.optJSONArray("detections");
        if (detectionsArr != null) {
            for (int i = 0; i < detectionsArr.length(); i++) {
                try {
                    detectedFoods.add(detectionsArr.getJSONObject(i).getString("class_name"));
                } catch (Exception ignored) {}
            }
        }

        showFoodChecklistDialog(new ArrayList<>(detectedFoods), new ArrayList<>(detectedFoods), mealType);
    }

    /** 탐지된 음식 체크리스트 다이얼로그 */
    private void showFoodChecklistDialog(List<String> allFoods, List<String> selected, String mealType) {
        if (!isAdded()) return;

        if (allFoods.isEmpty()) {
            new AlertDialog.Builder(requireContext())
                    .setTitle("🔍 인식된 음식 없음")
                    .setMessage("음식을 인식하지 못했어요.\n직접 추가할 수 있어요.")
                    .setPositiveButton("직접 추가", (d, w) -> showAddFoodDialog(allFoods, selected, mealType))
                    .setNegativeButton("취소", null)
                    .show();
            return;
        }

        String[] items = allFoods.toArray(new String[0]);
        boolean[] checked = new boolean[items.length];
        for (int i = 0; i < items.length; i++) {
            checked[i] = selected.contains(items[i]);
        }

        new AlertDialog.Builder(requireContext())
                .setTitle("인식된 음식을 선택하세요")
                .setMultiChoiceItems(items, checked, (dialog, which, isChecked) -> {
                    if (isChecked) {
                        if (!selected.contains(items[which])) selected.add(items[which]);
                    } else {
                        selected.remove(items[which]);
                    }
                })
                .setPositiveButton("등록", (d, w) -> registerFoods(selected, mealType))
                .setNeutralButton("+ 직접 추가", (d, w) -> showAddFoodDialog(allFoods, selected, mealType))
                .setNegativeButton("취소", null)
                .show();
    }

    /** 인식 안 된 음식 직접 입력 다이얼로그 */
    private void showAddFoodDialog(List<String> allFoods, List<String> selected, String mealType) {
        if (!isAdded()) return;

        EditText input = new EditText(requireContext());
        input.setHint("음식 이름을 입력하세요");
        input.setInputType(InputType.TYPE_CLASS_TEXT);
        int dp16 = (int) (16 * getResources().getDisplayMetrics().density);
        input.setPadding(dp16, dp16, dp16, dp16);

        new AlertDialog.Builder(requireContext())
                .setTitle("음식 직접 추가")
                .setView(input)
                .setPositiveButton("추가", (d, w) -> {
                    String foodName = input.getText().toString().trim();
                    if (!foodName.isEmpty() && !allFoods.contains(foodName)) {
                        allFoods.add(foodName);
                        selected.add(foodName);
                    }
                    showFoodChecklistDialog(allFoods, selected, mealType);
                })
                .setNegativeButton("취소", (d, w) -> showFoodChecklistDialog(allFoods, selected, mealType))
                .show();
    }

    /** 선택된 음식을 식단과 비교 후 등록 */
    private void registerFoods(List<String> selected, String mealType) {
        if (!isAdded()) return;

        if (selected.isEmpty()) {
            Toast.makeText(getContext(), "선택된 음식이 없습니다.", Toast.LENGTH_SHORT).show();
            return;
        }

        List<String> expectedFoods = getExpectedFoods(mealType);

        StringBuilder sb = new StringBuilder("기록된 음식:\n");
        for (String food : selected) sb.append("• ").append(food).append("\n");

        if (expectedFoods.isEmpty()) {
            new AlertDialog.Builder(requireContext())
                    .setTitle("✅ 식단 기록 완료")
                    .setMessage(sb.toString())
                    .setPositiveButton("확인", null)
                    .show();
            return;
        }

        // 식단 음식 중 몇 개가 선택 목록과 일치하는지 계산
        int matchCount = 0;
        for (String exp : expectedFoods) {
            for (String sel : selected) {
                if (isFoodMatch(exp, sel)) { matchCount++; break; }
            }
        }
        int total = expectedFoods.size();
        boolean majorityMatch = matchCount * 2 >= total; // 과반수 이상 일치

        sb.append("\n오늘 ").append(mealType).append(" 식단 (").append(matchCount).append("/").append(total).append(" 일치):\n");
        for (String exp : expectedFoods) sb.append("• ").append(exp).append("\n");

        if (majorityMatch) {
            new AlertDialog.Builder(requireContext())
                    .setTitle("✅ 식단 인증 성공!")
                    .setMessage(sb.toString())
                    .setPositiveButton("확인", null)
                    .show();
        } else {
            new AlertDialog.Builder(requireContext())
                    .setTitle("⚠️ 식단과 달라요")
                    .setMessage(sb.append("\n식단 과반수 이상 일치 시 인증 성공이에요.").toString())
                    .setPositiveButton("그래도 기록", (d, w) ->
                            Toast.makeText(getContext(), "다음엔 식단대로 지켜봐요! 꾸준하게 하다 보면 목표에 가까워질 거예요 💪", Toast.LENGTH_LONG).show())
                    .setNegativeButton("취소", null)
                    .show();
        }
    }

    // ──────────────────────────────────────
    // 헬퍼 메서드
    // ──────────────────────────────────────

    /** meal_sp에서 해당 식사의 menu 배열 가져오기 */
    private List<String> getExpectedFoods(String mealType) {
        List<String> foods = new ArrayList<>();
        try {
            String planJson = requireContext()
                    .getSharedPreferences("meal_sp", Context.MODE_PRIVATE)
                    .getString("meal_plan_json", null);
            if (planJson == null) return foods;

            JSONObject plan = new JSONObject(planJson);
            String key;
            switch (mealType) {
                case "아침": key = "breakfast"; break;
                case "점심": key = "lunch";     break;
                case "저녁": key = "dinner";    break;
                default:    return foods;
            }
            JSONArray menuArr = plan.getJSONObject(key).optJSONArray("menu");
            if (menuArr != null) {
                for (int i = 0; i < menuArr.length(); i++) foods.add(menuArr.getString(i));
            }
        } catch (Exception ignored) {}
        return foods;
    }

    /** 음식 이름 일치 여부 (공백·대소문자 무시, 포함 관계도 허용) */
    private boolean isFoodMatch(String expected, String detected) {
        if (expected == null || detected == null) return false;
        String e = expected.toLowerCase().replace(" ", "");
        String d = detected.toLowerCase().replace(" ", "");
        return e.equals(d) || d.contains(e) || e.contains(d);
    }

    /** URI → 압축된 JPEG 바이트 배열 (최대 1024px) */
    private byte[] compressImage(Uri uri) throws Exception {
        InputStream is = requireContext().getContentResolver().openInputStream(uri);
        Bitmap original = BitmapFactory.decodeStream(is);
        if (is != null) is.close();

        // 최대 1024px로 리사이즈 (서버 전송 크기 최소화)
        Bitmap scaled = scaleBitmap(original, 1024);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        scaled.compress(Bitmap.CompressFormat.JPEG, 80, baos);
        return baos.toByteArray();
    }

    /** 비율 유지하면서 maxSize 이하로 리사이즈 */
    private Bitmap scaleBitmap(Bitmap src, int maxSize) {
        int w = src.getWidth();
        int h = src.getHeight();
        if (w <= maxSize && h <= maxSize) return src;
        float scale = (float) maxSize / Math.max(w, h);
        return Bitmap.createScaledBitmap(src, (int)(w * scale), (int)(h * scale), true);
    }

    /** InputStream → String */
    private String readStream(InputStream is) throws Exception {
        StringBuilder sb = new StringBuilder();
        byte[] buf = new byte[4096];
        int len;
        while ((len = is.read(buf)) != -1)
            sb.append(new String(buf, 0, len, "UTF-8"));
        is.close();
        return sb.toString();
    }
}
