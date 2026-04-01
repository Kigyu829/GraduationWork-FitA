// sc203.js — 목표 설정

const bodyInfoForm2    = document.getElementById("bodyInfoForm2");
const bmiValueEl       = document.getElementById("bmiValue");
const bmiStatusEl      = document.getElementById("bmiStatus");
const targetLossInput  = document.getElementById("targetLoss");
const goalPeriodInput  = document.getElementById("goalPeriod");
const goalInfoEl       = document.getElementById("goalInfo");
const activityLevelInput = document.getElementById("activityLevel");

function getBMIStatus(bmi) {
  const v = Number(bmi);
  if (v < 18.5) return { label: "저체중",  color: "#66D0BC" };
  if (v < 23)   return { label: "정상",    color: "#66D0BC" };
  if (v < 25)   return { label: "과체중",  color: "#FF0B55" };
  return              { label: "비만",    color: "#FF0B55" };
}

function renderBMI() {
  const savedData = JSON.parse(localStorage.getItem("healthUserData")) || {};
  const bmi = savedData.bmi;
  if (!bmiValueEl || !bmiStatusEl) return;

  if (!bmi) {
    bmiValueEl.textContent  = "-";
    bmiStatusEl.textContent = "이전 단계 정보를 불러올 수 없습니다.";
    return;
  }

  const status = getBMIStatus(bmi);
  bmiValueEl.textContent  = bmi;
  bmiValueEl.style.color  = status.color;
  bmiStatusEl.textContent = `현재 BMI ${bmi}는 ${status.label} 범위입니다.`;
}

function updateGoalInfo() {
  const savedData     = JSON.parse(localStorage.getItem("healthUserData")) || {};
  const currentWeight = Number(savedData.weight);
  const targetLoss    = Number(targetLossInput.value);
  const goalPeriod    = goalPeriodInput.value;

  if (!goalInfoEl) return;

  if (!currentWeight || !targetLoss || !goalPeriod || !activityLevelInput.value) {
    goalInfoEl.textContent = "목표 감량과 기간을 입력하면 목표가 표시됩니다.";
    goalInfoEl.classList.add("muted");
    return;
  }

  const targetWeight = currentWeight - targetLoss;

  if (targetWeight <= 0) {
    goalInfoEl.textContent = "목표 감량 무게를 다시 확인해주세요.";
    goalInfoEl.classList.add("muted");
    return;
  }

  goalInfoEl.textContent =
    `${currentWeight}kg → ${targetWeight}kg, ${goalPeriod} 안에 ${targetLoss}kg 감량 목표`;
  goalInfoEl.classList.remove("muted");
}

if (targetLossInput)   targetLossInput.addEventListener("input",  updateGoalInfo);
if (goalPeriodInput)   goalPeriodInput.addEventListener("change", updateGoalInfo);
if (activityLevelInput) activityLevelInput.addEventListener("change", updateGoalInfo);

if (bodyInfoForm2) {
  bodyInfoForm2.addEventListener("submit", function (e) {
    e.preventDefault();

    const savedData     = JSON.parse(localStorage.getItem("healthUserData")) || {};
    const currentWeight = Number(savedData.weight);
    const targetLoss    = Number(targetLossInput.value);
    const goalPeriod    = goalPeriodInput.value;
    // 버그 수정: activityLevel 변수 → activityLevelInput.value
    const activityLevel = activityLevelInput.value;

    if (!currentWeight || !targetLoss || !goalPeriod || !activityLevel) {
      alert("모든 항목을 입력해주세요.");
      return;
    }

    const targetWeight = currentWeight - targetLoss;

    if (targetWeight <= 0) {
      alert("목표 감량 무게를 다시 확인해주세요.");
      return;
    }

    const updatedData = {
      ...savedData,
      initialWeight: currentWeight,   // 진행률 계산용 초기 체중 저장
      targetLoss:    targetLoss,
      goalPeriod:    goalPeriod,
      targetWeight:  targetWeight,
      activityLevel: activityLevel
    };

    localStorage.setItem("healthUserData", JSON.stringify(updatedData));
    location.href = "../pages/sc301.html";
  });
}

renderBMI();
