// sc202
const bodyInfoForm1 = document.getElementById("bodyInfoForm1");

function calculateBMI(height, weight) {
  const h = Number(height) / 100;
  const w = Number(weight);

  if (!h || !w) return null;
  return (w / (h * h)).toFixed(1);
}

if (bodyInfoForm1) {
  bodyInfoForm1.addEventListener("submit", function (e) {
    e.preventDefault();
    const year = document.getElementById("birthYear").value;
    const month = document.getElementById("birthMonth").value;
    const day = document.getElementById("birthDay").value;

    if (month < 1 || month > 12 || day < 1 || day > 31) {
        alert("생년월일을 올바르게 입력해주세요.");
        return;
    }
    
    const birth = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

    const userData = {
        birth: birth,
        gender: document.getElementById("gender").value,
        height: document.getElementById("height").value,
        weight: document.getElementById("weight").value,
        bmi: calculateBMI(
            document.getElementById("height").value,
            document.getElementById("weight").value
        )
    };

    localStorage.setItem("healthUserData", JSON.stringify(userData));
    location.href = "../pages/sc203.html";
  });
}