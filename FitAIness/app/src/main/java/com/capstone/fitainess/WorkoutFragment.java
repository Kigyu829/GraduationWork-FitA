package com.capstone.fitainess;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.UnderlineSpan;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * AI 운동 추천 화면
 * - 최초 진입 시 Firebase(신체 정보) + GoalPrefs(목표 정보)에서 데이터를 읽어 AI 운동을 자동 생성
 * - 한 번 생성된 플랜은 "workout_sp" SharedPreferences에 저장되어 계속 표시됨
 * - 플랜 재조정은 AI 상담(ChatFragment)을 통해서만 가능
 * - 운동 이름 클릭 시 YouTube에서 운동 방법 검색
 */
public class WorkoutFragment extends Fragment
{

    // SharedPreferences 키 (ChatFragment와 동일한 이름 사용)
    private static final String PREFS_NAME        = "workout_sp";
    private static final String KEY_PLAN_JSON     = "workout_plan_json";
    private static final String KEY_HEIGHT        = "user_height";
    private static final String KEY_WEIGHT        = "user_weight";
    private static final String KEY_TARGET_WEIGHT = "user_target_weight";
    private static final String KEY_TARGET_WEEKS  = "user_target_weeks";
    private static final String KEY_GENDER        = "user_gender";

    private ProgressBar progressBar;
    private ScrollView scrollResult;
    private LinearLayout resultContainer;
    private TextView tvError;

    private GeminiHelper geminiHelper;
    private SharedPreferences sp;

    public WorkoutFragment() {
        super(R.layout.fragment_workout);
    }

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_workout, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        progressBar     = view.findViewById(R.id.progressBar);
        scrollResult    = view.findViewById(R.id.scrollResult);
        resultContainer = view.findViewById(R.id.resultContainer);
        tvError         = view.findViewById(R.id.tvError);

        geminiHelper = new GeminiHelper();
        sp = requireContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        // 저장된 플랜이 있으면 표시, 없으면 Firebase에서 데이터 로드 후 자동 생성
        String savedPlan = sp.getString(KEY_PLAN_JSON, null);
        if (savedPlan != null) {
            showSavedPlan(savedPlan);
        } else {
            loadFirebaseDataAndGenerate();
        }
    }

    /** Firebase + GoalPrefs에서 사용자 데이터를 읽어 AI 운동 자동 생성 */
    private void loadFirebaseDataAndGenerate() {
        String uid = FirebaseAuth.getInstance().getUid();
        if (uid == null) {
            showError("로그인이 필요합니다.");
            return;
        }

        progressBar.setVisibility(View.VISIBLE);
        tvError.setVisibility(View.GONE);

        FirebaseFirestore.getInstance().collection("users").document(uid)
                .get()
                .addOnSuccessListener(doc -> {
                    if (!isAdded()) return;

                    if (!doc.exists()) {
                        requireActivity().runOnUiThread(() -> {
                            showError("사용자 정보를 찾을 수 없어요.\n홈 화면에서 신체 정보를 먼저 입력해주세요.");
                            progressBar.setVisibility(View.GONE);
                        });
                        return;
                    }

                    // Firebase에서 신체 정보 읽기
                    Long heightL = doc.getLong("height");
                    Long weightL = doc.getLong("weight");
                    String genderRaw = doc.getString("gender"); // "male" 또는 "female"

                    int height = (heightL != null) ? heightL.intValue() : 0;
                    int weight = (weightL != null) ? weightL.intValue() : 0;
                    // Firebase는 "male"/"female"로 저장 → AI 서버는 "남성"/"여성"으로 전달
                    String gender = "male".equals(genderRaw) ? "남성" : "여성";

                    // GoalPrefs에서 목표 정보 읽기
                    SharedPreferences goalPrefs = requireActivity()
                            .getSharedPreferences("GoalPrefs", Context.MODE_PRIVATE);
                    int targetWeight   = goalPrefs.getInt("target_weight", 0);
                    int durationMonths = goalPrefs.getInt("duration_months", 3);
                    int targetWeeks    = durationMonths * 4; // 개월 → 주 변환

                    if (height == 0 || weight == 0 || targetWeight == 0) {
                        requireActivity().runOnUiThread(() -> {
                            showError("신체 정보 또는 목표 체중이 설정되지 않았어요.\n홈 화면에서 먼저 설정해주세요.");
                            progressBar.setVisibility(View.GONE);
                        });
                        return;
                    }

                    // workout_sp에 사용자 정보 저장 (ChatFragment에서 읽을 수 있도록)
                    sp.edit()
                            .putInt(KEY_HEIGHT, height)
                            .putInt(KEY_WEIGHT, weight)
                            .putInt(KEY_TARGET_WEIGHT, targetWeight)
                            .putInt(KEY_TARGET_WEEKS, targetWeeks)
                            .putString(KEY_GENDER, gender)
                            .apply();

                    double bmi = Math.round((weight / Math.pow(height / 100.0, 2)) * 10) / 10.0;

                    // AI 운동 추천 요청
                    requireActivity().runOnUiThread(() ->
                            generateWorkoutFromData(height, weight, bmi, gender, targetWeight, targetWeeks));
                })
                .addOnFailureListener(e -> {
                    if (!isAdded()) return;
                    requireActivity().runOnUiThread(() -> {
                        showError("데이터 로드 실패: " + e.getMessage());
                        progressBar.setVisibility(View.GONE);
                    });
                });
    }

    /** AI 서버에 운동 추천 요청 */
    private void generateWorkoutFromData(int height, int weight, double bmi,
                                          String gender, int targetWeight, int targetWeeks) {
        geminiHelper.generateWorkoutPlan(height, weight, bmi, gender, targetWeight, targetWeeks,
                new GeminiHelper.GeminiCallback() {
                    @Override
                    public void onSuccess(String response) {
                        if (!isAdded()) return;
                        requireActivity().runOnUiThread(() -> {
                            try {
                                String json = response.replace("```json", "").replace("```", "").trim();
                                JSONObject data = new JSONObject(json);
                                // 플랜 저장 (이전 재조정 이유 초기화)
                                sp.edit()
                                        .putString(KEY_PLAN_JSON, json)
                                        .remove("adjust_reasons")
                                        .apply();
                                buildWorkoutCards(data);
                            } catch (Exception e) {
                                showError("⚠️ 응답 파싱 실패. 다시 시도해주세요.");
                            }
                            progressBar.setVisibility(View.GONE);
                        });
                    }

                    @Override
                    public void onError(String error) {
                        if (!isAdded()) return;
                        requireActivity().runOnUiThread(() -> {
                            showError("❌ " + error);
                            progressBar.setVisibility(View.GONE);
                        });
                    }
                });
    }

    /** 저장된 플랜 JSON을 파싱해서 카드로 표시 */
    private void showSavedPlan(String planJson) {
        try {
            buildWorkoutCards(new JSONObject(planJson));
        } catch (Exception e) {
            // 저장된 플랜이 손상된 경우 삭제 후 재생성
            sp.edit().remove(KEY_PLAN_JSON).apply();
            loadFirebaseDataAndGenerate();
        }
    }

    /** 운동 카드 UI 생성 */
    private void buildWorkoutCards(JSONObject data) throws Exception {
        resultContainer.removeAllViews();
        LayoutInflater inflater = LayoutInflater.from(requireContext());

        addWorkoutSection(inflater, "🔥 워밍업",   data.getJSONArray("warmup"),   true);
        addWorkoutSection(inflater, "💪 메인 운동", data.getJSONArray("main"),     false);
        addWorkoutSection(inflater, "🧘 쿨다운",   data.getJSONArray("cooldown"), true);

        // 총 요약 카드
        View totalCard = inflater.inflate(R.layout.item_meal_total, resultContainer, false);
        ((TextView) totalCard.findViewById(R.id.tvTotalCalories)).setText(
                "⏱ " + data.getInt("total_duration") + "분  |  🔥 " + data.getInt("total_calories") + " kcal");
        ((TextView) totalCard.findViewById(R.id.tvTip)).setText("💡 " + data.getString("tip"));
        resultContainer.addView(totalCard);

        scrollResult.smoothScrollTo(0, 0);
    }

    /** 운동 섹션(워밍업/메인/쿨다운) 카드 추가 */
    private void addWorkoutSection(LayoutInflater inflater, String title,
                                    JSONArray exercises, boolean isDuration) throws Exception {
        View card = inflater.inflate(R.layout.item_meal_card, resultContainer, false);

        ((TextView) card.findViewById(R.id.tvMealTitle)).setText(title);
        card.findViewById(R.id.tvMealDesc).setVisibility(View.GONE);

        int totalCal = 0;
        LinearLayout menuContainer = card.findViewById(R.id.menuContainer);

        for (int i = 0; i < exercises.length(); i++) {
            JSONObject ex = exercises.getJSONObject(i);
            String exerciseName = ex.getString("name");
            totalCal += ex.optInt("calories", 0);

            // 세부 정보 텍스트
            String detail = isDuration
                    ? ex.optString("duration", "")
                    : ex.optInt("sets", 0) + "세트 x " + ex.optInt("reps", 0) + "회";

            // 운동 이름에 밑줄+색상 적용 (클릭 가능 표시)
            String fullText = "  •  " + exerciseName + "  |  " + detail;
            SpannableString spannable = new SpannableString(fullText);
            int nameStart = fullText.indexOf(exerciseName);
            int nameEnd   = nameStart + exerciseName.length();
            spannable.setSpan(new UnderlineSpan(), nameStart, nameEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            spannable.setSpan(new ForegroundColorSpan(0xFF66D0BC), nameStart, nameEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);

            TextView tvItem = new TextView(requireContext());
            tvItem.setText(spannable);
            tvItem.setTextSize(14);
            tvItem.setTextColor(0xFFFFFFFF);
            tvItem.setPadding(0, 8, 0, 8);
            tvItem.setClickable(true);

            // 운동 이름 클릭 → YouTube에서 운동 방법 검색
            final String name = exerciseName;
            tvItem.setOnClickListener(v -> openYouTubeSearch(name));

            menuContainer.addView(tvItem);
        }

        ((TextView) card.findViewById(R.id.tvMealCalories)).setText(totalCal + " kcal");
        resultContainer.addView(card);
    }

    /** 운동 이름 클릭 시 YouTube에서 검색 */
    private void openYouTubeSearch(String exerciseName) {
        String query = exerciseName + " 운동 방법";
        Intent intent = new Intent(Intent.ACTION_VIEW,
                Uri.parse("https://www.youtube.com/results?search_query=" + Uri.encode(query)));
        startActivity(intent);
    }

    private void showError(String msg) {
        tvError.setText(msg);
        tvError.setVisibility(View.VISIBLE);
    }
}
