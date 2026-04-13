package com.capstone.fitainess;

import android.app.AlertDialog;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.ImageButton;
import android.widget.NumberPicker;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.navigation.fragment.NavHostFragment;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.SetOptions;
import java.util.HashMap;
import java.util.Map;

public class BodyInfoFragment extends Fragment
{

    private NumberPicker npHeight, npWeight;
    private TextView tvBmiResult;
    private RadioGroup rgGender;

    // 초기 상태 변수
    private int initialHeight = 170;
    private int initialWeight = 65;
    private String initialGender = "";

    public BodyInfoFragment()
    {
        super(R.layout.fragment_body_info);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState)
    {
        super.onViewCreated(view, savedInstanceState);

        npHeight = view.findViewById(R.id.npHeight);
        npWeight = view.findViewById(R.id.npWeight);
        tvBmiResult = view.findViewById(R.id.tvBmiResult);
        rgGender = view.findViewById(R.id.rgGender);
        Button btnSave = view.findViewById(R.id.btnSave);


        // NumberPicker 기본 범위 및 초기값
        npHeight.setMinValue(100);
        npHeight.setMaxValue(250);
        npHeight.setValue(initialHeight);

        npWeight.setMinValue(30);
        npWeight.setMaxValue(200);
        npWeight.setValue(initialWeight);

        // 기존 데이터 불러오기 (수정 모드)
        loadExistingData();

        // 화면 초기 진입 시 기본값 기준으로 BMI 계산
        calculateAndDisplayBMI();

        // BMI 실시간 업데이트 리스너
        NumberPicker.OnValueChangeListener listener = (picker, oldVal, newVal) -> calculateAndDisplayBMI();
        npHeight.setOnValueChangedListener(listener);
        npWeight.setOnValueChangedListener(listener);

        btnSave.setOnClickListener(v -> saveBodyInfo(getSelectedGender(), npHeight.getValue(), npWeight.getValue()));
        setupBackButtonLogic(view);
    }

    private void loadExistingData()
    {
        String uid = FirebaseAuth.getInstance().getUid();
        if (uid == null) return;

        FirebaseFirestore.getInstance().collection("users").document(uid).get()
                .addOnSuccessListener(documentSnapshot ->
                {
                    if (documentSnapshot.exists())
                    {
                        Long h = documentSnapshot.getLong("height");
                        Long w = documentSnapshot.getLong("weight");
                        String gender = documentSnapshot.getString("gender");



                        // 읽은 값 초기값으로 대입
                        if (h != null)
                        {
                            npHeight.setValue(h.intValue());
                            initialHeight = h.intValue();
                        }
                        if (w != null)
                        {
                            npWeight.setValue(w.intValue());
                            initialWeight = w.intValue();
                        }
                        if (gender != null)
                        {
                            initialGender = gender;

                            if (gender.equals("male"))
                                rgGender.check(R.id.rbMale);
                            else if (gender.equals("female"))
                                rgGender.check(R.id.rbFemale);

                        }
                        // DB에서 읽은 값에 맞춰 BMI 다시 계산
                        calculateAndDisplayBMI();
                    }
                });
    }

    private void calculateAndDisplayBMI()
    {
        double heightInMeter = npHeight.getValue() / 100.0;
        double weight = npWeight.getValue();
        double bmi = weight / (heightInMeter * heightInMeter);

        String bmiText = String.format("현재 BMI: %.1f", bmi);

        if (bmi >= 25.0)
            bmiText += " (비만)";
        else if (bmi >= 23.0)
            bmiText += " (과체중)";
        else if (bmi >= 18.5)
            bmiText += " (정상)";
        else
            bmiText += " (저체중)";

        tvBmiResult.setText(bmiText);
    }
    private String getSelectedGender()
    {
        int checkedId = rgGender.getCheckedRadioButtonId();
        if (checkedId == R.id.rbMale) return "male";
        if (checkedId == R.id.rbFemale) return "female";
        return "";
    }

    private void saveBodyInfo(String gender, int height, int weight )
    {
        String uid = FirebaseAuth.getInstance().getUid();
        if (uid == null) return;

        FirebaseFirestore db = FirebaseFirestore.getInstance();

        Map<String, Object> updateData = new HashMap<>();
        updateData.put("gender", gender);
        updateData.put("height", height);
        updateData.put("weight", weight);
        updateData.put("is_profile_set", true); // 신체 정보 입력 완료 플래그

        // SetOptions.merge()로 기존 이메일 등 다른 정보가 날아가지 않도록 보호
        db.collection("users").document(uid).set(updateData, SetOptions.merge())
                .addOnSuccessListener(aVoid ->
                {
                    NavHostFragment.findNavController(this)
                            .navigate(R.id.action_bodyInfo_to_target);
                })
                .addOnFailureListener(e ->
                {
                    Toast.makeText(getContext(), "저장 실패: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                });
    }

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
        // 현재 휠의 값이 진입 시점의 값(initial)과 달라졌는지 비교
        if (npHeight.getValue() != initialHeight ||
            npWeight.getValue() != initialWeight ||
            !getSelectedGender().equals(initialGender))
        {
            new AlertDialog.Builder(requireContext())
                    .setTitle("작성 취소")
                    .setMessage("변경된 정보가 저장되지 않았습니다.\n이전 화면으로 돌아가시겠습니까?")
                    .setPositiveButton("예", (dialog, which) ->
                    {
                        restoreProfileSetFlagAndGoBack();
                    })
                    .setNegativeButton("아니오", null)
                    .show();
        } 
        else 
        {
            // 그대로면 바로 뒤로
            restoreProfileSetFlagAndGoBack();
        }
    }

    private void restoreProfileSetFlagAndGoBack()
    {
        String uid = FirebaseAuth.getInstance().getUid();
        if (uid != null)
        {
            // ProfileFragment에서 수정 시 is_profile_set은 false로 바뀜
            // 취소 시 true로 복구
            FirebaseFirestore.getInstance().collection("users").document(uid)
                    .update("is_profile_set", true);
        }
        NavHostFragment.findNavController(this).popBackStack();
    }
}