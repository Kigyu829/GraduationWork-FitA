package com.capstone.fitainess;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
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

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * AI 식단 추천 화면
 * - 최초 진입 시 Firebase(신체 정보) + GoalPrefs(목표 정보)에서 데이터를 읽어 AI 식단을 자동 생성
 * - 한 번 생성된 플랜은 "meal_sp" SharedPreferences에 저장되어 계속 표시됨
 * - 플랜 재조정은 AI 상담(ChatFragment)을 통해서만 가능
 */
public class MealFragment extends Fragment {

    // SharedPreferences 키 (ChatFragment와 동일한 이름 사용)
    private static final String PREFS_NAME       = "meal_sp";
    private static final String KEY_PLAN_JSON    = "meal_plan_json";
    private static final String KEY_HEIGHT       = "user_height";
    private static final String KEY_WEIGHT       = "user_weight";
    private static final String KEY_TARGET_WEIGHT = "user_target_weight";
    private static final String KEY_TARGET_WEEKS  = "user_target_weeks";
    private static final String KEY_GENDER        = "user_gender";

    private ProgressBar progressBar;
    private ScrollView scrollResult;
    private LinearLayout resultContainer;
    private TextView tvError;

    private GeminiHelper geminiHelper;
    private SharedPreferences sp;

    public MealFragment() {
        super(R.layout.fragment_meal);
    }

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_meal, container, false);
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

    /** Firebase + GoalPrefs에서 사용자 데이터를 읽어 AI 식단 자동 생성 */
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

                    // meal_sp에 사용자 정보 저장 (ChatFragment에서 읽을 수 있도록)
                    sp.edit()
                            .putInt(KEY_HEIGHT, height)
                            .putInt(KEY_WEIGHT, weight)
                            .putInt(KEY_TARGET_WEIGHT, targetWeight)
                            .putInt(KEY_TARGET_WEEKS, targetWeeks)
                            .putString(KEY_GENDER, gender)
                            .apply();

                    double bmi = Math.round((weight / Math.pow(height / 100.0, 2)) * 10) / 10.0;

                    // AI 식단 추천 요청
                    requireActivity().runOnUiThread(() ->
                            generateMealFromData(height, weight, bmi, gender, targetWeight, targetWeeks));
                })
                .addOnFailureListener(e -> {
                    if (!isAdded()) return;
                    requireActivity().runOnUiThread(() -> {
                        showError("데이터 로드 실패: " + e.getMessage());
                        progressBar.setVisibility(View.GONE);
                    });
                });
    }

    /** AI 서버에 식단 추천 요청 */
    private void generateMealFromData(int height, int weight, double bmi,
                                       String gender, int targetWeight, int targetWeeks) {
        geminiHelper.generateMealPlan(height, weight, bmi, gender, targetWeight, targetWeeks,
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
                                buildMealCards(data);
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
            JSONObject data = new JSONObject(planJson);
            buildMealCards(data);
        } catch (Exception e) {
            // 저장된 플랜이 손상된 경우 삭제 후 재생성
            sp.edit().remove(KEY_PLAN_JSON).apply();
            loadFirebaseDataAndGenerate();
        }
    }

    /** 식단 카드 UI 생성 */
    private void buildMealCards(JSONObject data) throws Exception {
        resultContainer.removeAllViews();
        LayoutInflater inflater = LayoutInflater.from(requireContext());
        addMealCard(inflater, "🌅 아침",  data.getJSONObject("breakfast"));
        addMealCard(inflater, "🌞 점심",  data.getJSONObject("lunch"));
        addMealCard(inflater, "🌙 저녁",  data.getJSONObject("dinner"));

        View totalCard = inflater.inflate(R.layout.item_meal_total, resultContainer, false);
        ((TextView) totalCard.findViewById(R.id.tvTotalCalories))
                .setText(data.getInt("total_calories") + " kcal");
        ((TextView) totalCard.findViewById(R.id.tvTip))
                .setText("💡 " + data.getString("tip"));
        resultContainer.addView(totalCard);

        scrollResult.smoothScrollTo(0, 0);
    }

    /** 개별 식사(아침/점심/저녁) 카드 추가 */
    private void addMealCard(LayoutInflater inflater, String title, JSONObject meal) throws Exception {
        View card = inflater.inflate(R.layout.item_meal_card, resultContainer, false);
        ((TextView) card.findViewById(R.id.tvMealTitle)).setText(title);
        ((TextView) card.findViewById(R.id.tvMealCalories)).setText(meal.getInt("calories") + " kcal");

        LinearLayout menuContainer = card.findViewById(R.id.menuContainer);
        JSONArray menuArr = meal.getJSONArray("menu");
        for (int i = 0; i < menuArr.length(); i++) {
            TextView tvMenu = new TextView(requireContext());
            tvMenu.setText("  •  " + menuArr.getString(i));
            tvMenu.setTextSize(15);
            tvMenu.setTextColor(0xFFFFFFFF);
            tvMenu.setPadding(0, 4, 0, 4);
            menuContainer.addView(tvMenu);
        }

        ((TextView) card.findViewById(R.id.tvMealDesc)).setText(meal.optString("desc", ""));
        resultContainer.addView(card);
    }

    private void showError(String msg) {
        tvError.setText(msg);
        tvError.setVisibility(View.VISIBLE);
    }
}
