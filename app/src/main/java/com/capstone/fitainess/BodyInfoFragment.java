package com.capstone.fitainess;

import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.NumberPicker;
import android.widget.TextView;

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

    public BodyInfoFragment() { super(R.layout.fragment_body_info); }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState)
    {
        super.onViewCreated(view, savedInstanceState);

        npHeight = view.findViewById(R.id.npHeight);
        npWeight = view.findViewById(R.id.npWeight);
        tvBmiResult = view.findViewById(R.id.tvBmiResult);
        Button btnSave = view.findViewById(R.id.btnSave);


        // NumberPicker 초기값 부여
        npHeight.setMinValue(100); npHeight.setMaxValue(250); npHeight.setValue(170);
        npWeight.setMinValue(30); npWeight.setMaxValue(200); npWeight.setValue(65);

        loadExistingData();
        calculateAndDisplayBMI();

        NumberPicker.OnValueChangeListener listener = (picker, oldVal, newVal) ->
        {
            calculateAndDisplayBMI();
        };

        npHeight.setOnValueChangedListener(listener);
        npWeight.setOnValueChangedListener(listener);

        btnSave.setOnClickListener(v -> saveBodyInfo(npHeight.getValue(), npWeight.getValue()));
    }

    private void calculateAndDisplayBMI()
    {
        double heightInMeter = npHeight.getValue() / 100.0; // cm -> m 치환
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

    private void saveBodyInfo(int height, int weight)
    {
        String uid = FirebaseAuth.getInstance().getUid();
        FirebaseFirestore db = FirebaseFirestore.getInstance();

        Map<String, Object> updateData = new HashMap<>();
        updateData.put("height", height);
        updateData.put("weight", weight);
        updateData.put("is_profile_set", true); // 완료 플래그 변경

        // SetOptions.merge()를 사용하여 기존 이메일 등 데이터 보존
        db.collection("users").document(uid).set(updateData, SetOptions.merge())
                .addOnSuccessListener(aVoid ->
                {
                    NavHostFragment.findNavController(this).navigate(R.id.action_bodyInfo_to_home);
                });
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

                        // 데이터가 존재한다면(null이 아니라면) 그 값으로 휠 위치 조정
                        if (h != null) npHeight.setValue(h.intValue());
                        if (w != null) npWeight.setValue(w.intValue());
                    }
                });
    }
}