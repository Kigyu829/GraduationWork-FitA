package com.capstone.geminitest;

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

public class WorkoutFragment extends Fragment
{
    private static final String PREFS_NAME       = "workout_sp";
    private static final String KEY_PLAN_JSON    = "workout_plan_json";
    private static final String KEY_HEIGHT       = "user_height";
    private static final String KEY_WEIGHT       = "user_weight";
    private static final String KEY_TARGET_WEIGHT  = "user_target_weight";
    private static final String KEY_TARGET_WEEKS   = "user_target_weeks";
    private static final String KEY_GENDER         = "user_gender";
    private static final String KEY_ADJUST_REASONS = "adjust_reasons";

    private LinearLayout inputSection, adjustSection;
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

    public WorkoutFragment() { super(R.layout.fragment_workout); }

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState)
    {
        return inflater.inflate(R.layout.fragment_workout, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState)
    {
        super.onViewCreated(view, savedInstanceState);

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

        setupSpinners();

        btnGenerate.setOnClickListener(v -> generateWorkout());
        btnReset.setOnClickListener(v -> showAdjustSection());
        btnAdjustConfirm.setOnClickListener(v -> requestAdjust());
        btnAdjustCancel.setOnClickListener(v -> hideAdjustSection());

        String savedPlan = sp.getString(KEY_PLAN_JSON, null);
        if (savedPlan != null)
            showSavedPlan(savedPlan);
        else
            loadUserInfo();
    }

    private void setupSpinners()
    {
        weekOptions = new ArrayList<>();
        for (int i = 1; i <= 12; i++) weekOptions.add(i + "주");

        ArrayAdapter<String> adapter = new ArrayAdapter<>(requireContext(),
                R.layout.spinner_item, weekOptions);
        adapter.setDropDownViewResource(R.layout.spinner_item);

        spTargetWeeks.setAdapter(adapter);
        spAdjustWeeks.setAdapter(new ArrayAdapter<>(requireContext(),
                R.layout.spinner_item, weekOptions));
        ((ArrayAdapter) spAdjustWeeks.getAdapter())
                .setDropDownViewResource(R.layout.spinner_item);
    }

    private void loadUserInfo()
    {
        int height       = sp.getInt(KEY_HEIGHT, 0);
        int weight       = sp.getInt(KEY_WEIGHT, 0);
        int targetWeight = sp.getInt(KEY_TARGET_WEIGHT, 0);
        int targetWeeks  = sp.getInt(KEY_TARGET_WEEKS, 4);

        if (height > 0)       etHeight.setText(String.valueOf(height));
        if (weight > 0)       etWeight.setText(String.valueOf(weight));
        if (targetWeight > 0) etTargetWeight.setText(String.valueOf(targetWeight));

        if ("여성".equals(sp.getString(KEY_GENDER, "남성")))
            rgGender.check(R.id.rbFemale);
        else
            rgGender.check(R.id.rbMale);

        if (targetWeeks >= 1 && targetWeeks <= 12)
            spTargetWeeks.setSelection(targetWeeks - 1);
    }

    private void showSavedPlan(String planJson)
    {
        try {
            buildWorkoutCards(new JSONObject(planJson));
            inputSection.setVisibility(View.GONE);
            btnReset.setVisibility(View.VISIBLE);
        } catch (Exception e) {
            sp.edit().remove(KEY_PLAN_JSON).apply();
        }
    }

    private void showAdjustSection()
    {
        btnReset.setVisibility(View.GONE);
        etAdjustReason.setText("");
        int currentWeeks = sp.getInt(KEY_TARGET_WEEKS, 4);
        if (currentWeeks >= 1 && currentWeeks <= 12)
            spAdjustWeeks.setSelection(currentWeeks - 1);
        adjustSection.setVisibility(View.VISIBLE);
    }

    private void hideAdjustSection()
    {
        adjustSection.setVisibility(View.GONE);
        btnReset.setVisibility(View.VISIBLE);
    }

    private void generateWorkout()
    {
        String hStr = etHeight.getText().toString().trim();
        String wStr = etWeight.getText().toString().trim();
        String tStr = etTargetWeight.getText().toString().trim();

        if (hStr.isEmpty() || wStr.isEmpty() || tStr.isEmpty())
        {
            tvError.setText("키, 현재 체중, 목표 체중을 입력해주세요.");
            tvError.setVisibility(View.VISIBLE);
            return;
        }

        int height       = Integer.parseInt(hStr);
        int weight       = Integer.parseInt(wStr);
        int targetWeight = Integer.parseInt(tStr);
        double bmi       = Math.round((weight / Math.pow(height / 100.0, 2)) * 10) / 10.0;
        int targetWeeks  = Integer.parseInt(
                spTargetWeeks.getSelectedItem().toString().replace("주", ""));
        String gender    = (rgGender.getCheckedRadioButtonId() == R.id.rbFemale) ? "여성" : "남성";

        sp.edit()
                .putInt(KEY_HEIGHT, height)
                .putInt(KEY_WEIGHT, weight)
                .putInt(KEY_TARGET_WEIGHT, targetWeight)
                .putInt(KEY_TARGET_WEEKS, targetWeeks)
                .putString(KEY_GENDER, gender)
                .apply();

        btnGenerate.setEnabled(false);
        btnGenerate.setText("AI가 운동을 준비 중...");
        progressBar.setVisibility(View.VISIBLE);
        resultContainer.removeAllViews();
        tvError.setVisibility(View.GONE);

        geminiHelper.generateWorkoutPlan(height, weight, bmi, gender, targetWeight, targetWeeks,
                new GeminiHelper.GeminiCallback()
                {
                    @Override
                    public void onSuccess(String response)
                    {
                        if (!isAdded()) return;
                        requireActivity().runOnUiThread(() ->
                        {
                            try {
                                String json = response.replace("```json", "").replace("```", "").trim();
                                JSONObject data = new JSONObject(json);
                                // 새 플랜 저장 + 이전 재조정 이유 초기화
                                sp.edit()
                                        .putString(KEY_PLAN_JSON, json)
                                        .remove(KEY_ADJUST_REASONS)
                                        .apply();
                                buildWorkoutCards(data);
                                inputSection.setVisibility(View.GONE);
                                btnReset.setVisibility(View.VISIBLE);
                            } catch (Exception e) {
                                tvError.setText("⚠️ 응답 파싱 실패. 다시 시도해주세요.\n\n원본:\n" + response);
                                tvError.setVisibility(View.VISIBLE);
                            }
                            btnGenerate.setEnabled(true);
                            btnGenerate.setText("💪 AI 운동 추천받기");
                            progressBar.setVisibility(View.GONE);
                        });
                    }

                    @Override
                    public void onError(String error)
                    {
                        if (!isAdded()) return;
                        requireActivity().runOnUiThread(() ->
                        {
                            tvError.setText("❌ " + error);
                            tvError.setVisibility(View.VISIBLE);
                            btnGenerate.setEnabled(true);
                            btnGenerate.setText("💪 AI 운동 추천받기");
                            progressBar.setVisibility(View.GONE);
                        });
                    }
                });
    }

    private void requestAdjust()
    {
        String reason = etAdjustReason.getText().toString().trim();
        if (reason.isEmpty()) {
            etAdjustReason.setError("재조정 이유를 입력해주세요.");
            return;
        }

        String currentPlan = sp.getString(KEY_PLAN_JSON, null);
        if (currentPlan == null) return;

        int newTargetWeeks = Integer.parseInt(
                spAdjustWeeks.getSelectedItem().toString().replace("주", ""));

        List<String> reasons = loadAdjustReasons();
        reasons.add(reason);
        saveAdjustReasons(reasons);
        sp.edit().putInt(KEY_TARGET_WEEKS, newTargetWeeks).apply();

        adjustSection.setVisibility(View.GONE);
        progressBar.setVisibility(View.VISIBLE);
        resultContainer.removeAllViews();
        tvError.setVisibility(View.GONE);

        geminiHelper.adjustWorkoutPlan(currentPlan, reasons, newTargetWeeks,
                new GeminiHelper.GeminiCallback()
                {
                    @Override
                    public void onSuccess(String response)
                    {
                        if (!isAdded()) return;
                        requireActivity().runOnUiThread(() ->
                        {
                            try {
                                String json = response.replace("```json", "").replace("```", "").trim();
                                JSONObject data = new JSONObject(json);
                                sp.edit().putString(KEY_PLAN_JSON, json).apply();
                                buildWorkoutCards(data);
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
                    public void onError(String error)
                    {
                        if (!isAdded()) return;
                        requireActivity().runOnUiThread(() ->
                        {
                            tvError.setText("❌ " + error);
                            tvError.setVisibility(View.VISIBLE);
                            btnReset.setVisibility(View.VISIBLE);
                            progressBar.setVisibility(View.GONE);
                        });
                    }
                });
    }

    private void buildWorkoutCards(JSONObject data) throws Exception
    {
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

    private void addWorkoutSection(LayoutInflater inflater, String title,
                                    JSONArray exercises, boolean isDuration) throws Exception
    {
        View card = inflater.inflate(R.layout.item_meal_card, resultContainer, false);

        ((TextView) card.findViewById(R.id.tvMealTitle)).setText(title);
        card.findViewById(R.id.tvMealDesc).setVisibility(View.GONE);

        int totalCal = 0;
        LinearLayout menuContainer = card.findViewById(R.id.menuContainer);

        for (int i = 0; i < exercises.length(); i++)
        {
            JSONObject ex = exercises.getJSONObject(i);
            String exerciseName = ex.getString("name");
            totalCal += ex.optInt("calories", 0);

            // 세부 정보 텍스트
            String detail = isDuration
                    ? ex.optString("duration", "")
                    : ex.optInt("sets", 0) + "세트 x " + ex.optInt("reps", 0) + "회";

            // 운동 이름에 밑줄+색상 (클릭 가능 표시)
            String fullText = "  •  " + exerciseName + "  |  " + detail;
            SpannableString spannable = new SpannableString(fullText);
            int nameStart = fullText.indexOf(exerciseName); // "  •  " 길이
            int nameEnd   = nameStart + exerciseName.length();
            spannable.setSpan(new UnderlineSpan(), nameStart, nameEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            spannable.setSpan(new ForegroundColorSpan(0xFF66D0BC), nameStart, nameEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);

            TextView tvItem = new TextView(requireContext());
            tvItem.setText(spannable);
            tvItem.setTextSize(14);
            tvItem.setTextColor(0xFFFFFFFF);
            tvItem.setPadding(0, 8, 0, 8);
            tvItem.setClickable(true);

            // 운동 이름 클릭 → YouTube 검색
            final String name = exerciseName;
            tvItem.setOnClickListener(v -> openYouTubeSearch(name));

            menuContainer.addView(tvItem);
        }

        ((TextView) card.findViewById(R.id.tvMealCalories)).setText(totalCal + " kcal");
        resultContainer.addView(card);
    }

    /** 운동 이름 클릭 시 YouTube에서 운동 방법 검색 */
    private void openYouTubeSearch(String exerciseName)
    {
        String query = exerciseName + " 운동 방법";
        Intent intent = new Intent(Intent.ACTION_VIEW,
                Uri.parse("https://www.youtube.com/results?search_query=" + Uri.encode(query)));
        startActivity(intent);
    }

    private List<String> loadAdjustReasons()
    {
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

    private void saveAdjustReasons(List<String> reasons)
    {
        sp.edit().putString(KEY_ADJUST_REASONS, new JSONArray(reasons).toString()).apply();
    }
}
