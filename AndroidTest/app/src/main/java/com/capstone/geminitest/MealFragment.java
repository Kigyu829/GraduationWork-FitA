package com.capstone.geminitest;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class MealFragment extends Fragment {
    private static final String PREFS_NAME = "meal_sp";
    private static final String KEY_PLAN_JSON      = "meal_plan_json";
    private static final String KEY_HEIGHT         = "user_height";
    private static final String KEY_WEIGHT         = "user_weight";
    private static final String KEY_TARGET_WEIGHT  = "user_target_weight";
    private static final String KEY_TARGET_WEEKS   = "user_target_weeks";
    private static final String KEY_GENDER         = "user_gender";
    private static final String KEY_ADJUST_REASONS = "adjust_reasons";

    private LinearLayout inputSection;
    private LinearLayout adjustSection;
    private RadioGroup rgGender;
    private EditText etHeight, etWeight, etTargetWeight;
    private EditText etAdjustReason;
    private Spinner spTargetWeeks, spAdjustWeeks;
    private Button btnGenerate, btnReset, btnAdjustConfirm, btnAdjustCancel;
    private ProgressBar progressBar;
    private ScrollView scrollResult;
    private LinearLayout resultContainer;
    private TextView tvError;

    private GeminiHelper geminiHelper;
    private SharedPreferences sp;
    private List<String> weekOptions;

    public MealFragment() {
        super(R.layout.fragment_meal);
    }

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_meal, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        // UI 컴포넌트 연결
        inputSection     = view.findViewById(R.id.inputSection);
        adjustSection    = view.findViewById(R.id.adjustSection);
        rgGender         = view.findViewById(R.id.rgGender);
        spTargetWeeks    = view.findViewById(R.id.spTargetWeeks);
        etHeight         = view.findViewById(R.id.etHeight);
        etWeight         = view.findViewById(R.id.etWeight);
        etTargetWeight   = view.findViewById(R.id.etTargetWeight);
        etAdjustReason   = view.findViewById(R.id.etAdjustReason);
        spAdjustWeeks    = view.findViewById(R.id.spAdjustWeeks);
        btnGenerate      = view.findViewById(R.id.btnGenerate);
        btnReset         = view.findViewById(R.id.btnReset);
        btnAdjustConfirm = view.findViewById(R.id.btnAdjustConfirm);
        btnAdjustCancel  = view.findViewById(R.id.btnAdjustCancel);
        progressBar      = view.findViewById(R.id.progressBar);
        scrollResult     = view.findViewById(R.id.scrollResult);
        resultContainer  = view.findViewById(R.id.resultContainer);
        tvError          = view.findViewById(R.id.tvError);

        geminiHelper = new GeminiHelper();
        sp = requireContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        setupWeeksSpinner();
        setupAdjustWeeksSpinner();

        btnGenerate.setOnClickListener(v -> generateMeal());
        btnReset.setOnClickListener(v -> showAdjustSection());
        btnAdjustConfirm.setOnClickListener(v -> requestAdjust());
        btnAdjustCancel.setOnClickListener(v -> hideAdjustSection());

        String savedPlan = sp.getString(KEY_PLAN_JSON, null);
        if (savedPlan != null) {
            showSavedPlan(savedPlan);
        } else {
            loadUserInfo();
        }
    }

    private void setupWeeksSpinner() {
        weekOptions = new ArrayList<>();
        for (int i = 1; i <= 12; i++) {
            weekOptions.add(i + "주");
        }
        ArrayAdapter<String> adapter = new ArrayAdapter<>(requireContext(),
                R.layout.spinner_item, weekOptions);
        adapter.setDropDownViewResource(R.layout.spinner_item);
        spTargetWeeks.setAdapter(adapter);
    }

    private void setupAdjustWeeksSpinner() {
        ArrayAdapter<String> adapter = new ArrayAdapter<>(requireContext(),
                R.layout.spinner_item, weekOptions);
        adapter.setDropDownViewResource(R.layout.spinner_item);
        spAdjustWeeks.setAdapter(adapter);
    }

    private void loadUserInfo() {
        int height       = sp.getInt(KEY_HEIGHT, 0);
        int weight       = sp.getInt(KEY_WEIGHT, 0);
        int targetWeight = sp.getInt(KEY_TARGET_WEIGHT, 0);
        int targetWeeks  = sp.getInt(KEY_TARGET_WEEKS, 4); // 기본값 4주

        if (height > 0)       etHeight.setText(String.valueOf(height));
        if (weight > 0)       etWeight.setText(String.valueOf(weight));
        if (targetWeight > 0) etTargetWeight.setText(String.valueOf(targetWeight));

        // 성별 설정
        if ("여성".equals(sp.getString(KEY_GENDER, "남성"))) {
            rgGender.check(R.id.rbFemale);
        } else {
            rgGender.check(R.id.rbMale);
        }

        if (targetWeeks >= 1 && targetWeeks <= 12) {
            spTargetWeeks.setSelection(targetWeeks - 1);
        }
    }

    private void showSavedPlan(String planJson) {
        try {
            JSONObject data = new JSONObject(planJson);
            buildMealCards(data);
            inputSection.setVisibility(View.GONE);
            btnReset.setVisibility(View.VISIBLE);
        } catch (Exception e) {
            sp.edit().remove(KEY_PLAN_JSON).apply();
        }
    }

    /** 재조정 이유 입력창 표시 */
    private void showAdjustSection() {
        btnReset.setVisibility(View.GONE);
        etAdjustReason.setText("");
        // 현재 저장된 기간으로 스피너 초기화
        int currentWeeks = sp.getInt(KEY_TARGET_WEEKS, 4);
        if (currentWeeks >= 1 && currentWeeks <= 12)
            spAdjustWeeks.setSelection(currentWeeks - 1);
        adjustSection.setVisibility(View.VISIBLE);
    }

    /** 재조정 이유 입력창 숨김 (취소) */
    private void hideAdjustSection() {
        adjustSection.setVisibility(View.GONE);
        btnReset.setVisibility(View.VISIBLE);
    }

    /** 재조정 이유를 AI에게 전달해서 플랜 수정 요청 */
    private void requestAdjust() {
        String reason = etAdjustReason.getText().toString().trim();
        if (reason.isEmpty()) {
            etAdjustReason.setError("재조정 이유를 입력해주세요.");
            return;
        }

        String currentPlan = sp.getString(KEY_PLAN_JSON, null);
        if (currentPlan == null) return;

        // 기간 Spinner에서 새 targetWeeks 읽기
        int newTargetWeeks = Integer.parseInt(
                spAdjustWeeks.getSelectedItem().toString().replace("주", ""));

        // 이유 누적: 기존 목록에 이번 이유 추가
        List<String> reasons = loadAdjustReasons();
        reasons.add(reason);

        // 누적 이유 + 새 기간 저장
        saveAdjustReasons(reasons);
        sp.edit().putInt(KEY_TARGET_WEEKS, newTargetWeeks).apply();

        // 새 기간 기준으로 목표 칼로리 재계산
        int weight         = sp.getInt(KEY_WEIGHT, 70);
        int targetWeight   = sp.getInt(KEY_TARGET_WEIGHT, 65);
        int tdee           = weight * 28;
        int dailyDeficit   = (int) ((weight - targetWeight) * 7700.0 / (newTargetWeeks * 7));
        int targetCalories = Math.max(1200, tdee - dailyDeficit);

        adjustSection.setVisibility(View.GONE);
        progressBar.setVisibility(View.VISIBLE);
        resultContainer.removeAllViews();
        tvError.setVisibility(View.GONE);

        geminiHelper.adjustMealPlan(currentPlan, reasons, targetCalories,
                new GeminiHelper.GeminiCallback() {
                    @Override
                    public void onSuccess(String response) {
                        if (!isAdded()) return;
                        requireActivity().runOnUiThread(() -> {
                            try {
                                String json = response.replace("```json", "").replace("```", "").trim();
                                JSONObject data = new JSONObject(json);
                                sp.edit().putString(KEY_PLAN_JSON, json).apply();
                                buildMealCards(data);
                                btnReset.setVisibility(View.VISIBLE);
                            } catch (Exception e) {
                                tvError.setText("⚠️ 응답 파싱 실패. 다시 시도해주세요.\n\n원본:\n" + response);
                                tvError.setVisibility(View.VISIBLE);
                                btnReset.setVisibility(View.VISIBLE);
                            }
                            progressBar.setVisibility(View.GONE);
                        });
                    }

                    @Override
                    public void onError(String error) {
                        if (!isAdded()) return;
                        requireActivity().runOnUiThread(() -> {
                            tvError.setText("❌ " + error);
                            tvError.setVisibility(View.VISIBLE);
                            btnReset.setVisibility(View.VISIBLE);
                            progressBar.setVisibility(View.GONE);
                        });
                    }
                });
    }

    /** SharedPreferences에서 누적 이유 목록 불러오기 */
    private List<String> loadAdjustReasons() {
        List<String> reasons = new ArrayList<>();
        String json = sp.getString(KEY_ADJUST_REASONS, null);
        if (json != null) {
            try {
                JSONArray arr = new JSONArray(json);
                for (int i = 0; i < arr.length(); i++)
                    reasons.add(arr.getString(i));
            } catch (Exception ignored) {}
        }
        return reasons;
    }

    /** 누적 이유 목록 SharedPreferences에 저장 */
    private void saveAdjustReasons(List<String> reasons) {
        JSONArray arr = new JSONArray(reasons);
        sp.edit().putString(KEY_ADJUST_REASONS, arr.toString()).apply();
    }

    private void generateMeal() {
        String hStr  = etHeight.getText().toString().trim();
        String wStr  = etWeight.getText().toString().trim();
        String tStr  = etTargetWeight.getText().toString().trim();

        String selectedWeek = spTargetWeeks.getSelectedItem().toString();
        int targetWeeks = Integer.parseInt(selectedWeek.replace("주", ""));

        if (hStr.isEmpty() || wStr.isEmpty() || tStr.isEmpty()) {
            tvError.setText("키, 현재 체중, 목표 체중을 입력해주세요.");
            tvError.setVisibility(View.VISIBLE);
            return;
        }

        int height       = Integer.parseInt(hStr);
        int weight       = Integer.parseInt(wStr);
        int targetWeight = Integer.parseInt(tStr);
        double bmi       = Math.round((weight / Math.pow(height / 100.0, 2)) * 10) / 10.0;
        String gender    = (rgGender.getCheckedRadioButtonId() == R.id.rbFemale) ? "여성" : "남성";

        // 정보 저장
        sp.edit()
                .putInt(KEY_HEIGHT, height)
                .putInt(KEY_WEIGHT, weight)
                .putInt(KEY_TARGET_WEIGHT, targetWeight)
                .putInt(KEY_TARGET_WEEKS, targetWeeks)
                .putString(KEY_GENDER, gender)
                .apply();

        btnGenerate.setEnabled(false);
        btnGenerate.setText("AI가 식단을 준비 중...");
        progressBar.setVisibility(View.VISIBLE);
        resultContainer.removeAllViews();
        tvError.setVisibility(View.GONE);

        geminiHelper.generateMealPlan(height, weight, bmi, gender, targetWeight, targetWeeks,
                new GeminiHelper.GeminiCallback() {
                    @Override
                    public void onSuccess(String response) {
                        if (!isAdded()) return;
                        requireActivity().runOnUiThread(() -> {
                            try {
                                String json = response.replace("```json", "").replace("```", "").trim();
                                JSONObject data = new JSONObject(json);
                                // 새 플랜 저장 + 이전 재조정 이유 초기화
                                sp.edit()
                                        .putString(KEY_PLAN_JSON, json)
                                        .remove(KEY_ADJUST_REASONS)
                                        .apply();
                                buildMealCards(data);
                                inputSection.setVisibility(View.GONE);
                                btnReset.setVisibility(View.VISIBLE);
                            } catch (Exception e) {
                                tvError.setText("⚠️ 응답 파싱 실패.");
                                tvError.setVisibility(View.VISIBLE);
                            }
                            btnGenerate.setEnabled(true);
                            btnGenerate.setText("🍽️ AI 식단 추천받기");
                            progressBar.setVisibility(View.GONE);
                        });
                    }

                    @Override
                    public void onError(String error) {
                        if (!isAdded()) return;
                        requireActivity().runOnUiThread(() -> {
                            tvError.setText("❌ " + error);
                            tvError.setVisibility(View.VISIBLE);
                            btnGenerate.setEnabled(true);
                            btnGenerate.setText("🍽️ AI 식단 추천받기");
                            progressBar.setVisibility(View.GONE);
                        });
                    }
                });
    }

    private void buildMealCards(JSONObject data) throws Exception {
        resultContainer.removeAllViews();
        LayoutInflater inflater = LayoutInflater.from(requireContext());
        addMealCard(inflater, "🌅 아침", data.getJSONObject("breakfast"));
        addMealCard(inflater, "🌞 점심", data.getJSONObject("lunch"));
        addMealCard(inflater, "🌙 저녁", data.getJSONObject("dinner"));

        View totalCard = inflater.inflate(R.layout.item_meal_total, resultContainer, false);
        ((TextView)totalCard.findViewById(R.id.tvTotalCalories)).setText(data.getInt("total_calories") + " kcal");
        ((TextView)totalCard.findViewById(R.id.tvTip)).setText("💡 " + data.getString("tip"));
        resultContainer.addView(totalCard);
        scrollResult.smoothScrollTo(0, 0);
    }

    private void addMealCard(LayoutInflater inflater, String title, JSONObject meal) throws Exception {
        View card = inflater.inflate(R.layout.item_meal_card, resultContainer, false);
        ((TextView)card.findViewById(R.id.tvMealTitle)).setText(title);
        ((TextView)card.findViewById(R.id.tvMealCalories)).setText(meal.getInt("calories") + " kcal");
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
        ((TextView)card.findViewById(R.id.tvMealDesc)).setText(meal.getString("desc"));
        resultContainer.addView(card);
    }
}