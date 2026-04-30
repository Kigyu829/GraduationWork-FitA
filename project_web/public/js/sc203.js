/* ============================================================
   sc203.js — 목표 설정
   의존: common.js

   [과도한 목표 경고 기준]
   주 1kg 초과 감량은 건강에 무리가 올 수 있음.
   targetLoss / weeks > 1.0 이면 경고.

   [달성 기간]
   4/8/12/16주 선택 또는 기타(직접 입력) 지원.
   ============================================================ */

'use strict';

const bodyInfoForm2      = document.getElementById('bodyInfoForm2');
const bmiValueEl         = document.getElementById('bmiValue');
const bmiStatusEl        = document.getElementById('bmiStatus');
const targetLossInput    = document.getElementById('targetLoss');
const goalPeriodInput    = document.getElementById('goalPeriod');
const goalInfoEl         = document.getElementById('goalInfo');
const warningEl          = document.getElementById('goalWarning');
const customPeriodWrap   = document.getElementById('customPeriodWrap');
const customPeriodInput  = document.getElementById('customPeriodWeeks');

/* ── 현재 선택된 주 수 반환 (기타이면 직접입력값 사용) ── */
function getSelectedWeeks() {
  const val = goalPeriodInput.value;
  if (val === '기타') {
    const w = parseInt(customPeriodInput?.value, 10);
    return (!w || w < 1) ? null : w;
  }
  const map = { '4주': 4, '8주': 8, '12주': 12, '16주': 16 };
  return map[val] || null;
}

/* ── 기타 선택 시 직접입력 필드 토글 ── */
goalPeriodInput.addEventListener('change', () => {
  if (goalPeriodInput.value === '기타') {
    customPeriodWrap.style.display = 'block';
    customPeriodInput.focus();
  } else {
    customPeriodWrap.style.display = 'none';
    if (customPeriodInput) customPeriodInput.value = '';
  }
  updateGoalInfo();
});

if (customPeriodInput) {
  customPeriodInput.addEventListener('input', () => {
    const hint = document.getElementById('customPeriodHint');
    const w = parseInt(customPeriodInput.value, 10);
    if (hint) {
      if (!w || w < 1)   hint.textContent = '1주 이상 입력해주세요.';
      else if (w > 52)   hint.textContent = '최대 52주(1년)까지 입력 가능합니다.';
      else               hint.textContent = '';
    }
    updateGoalInfo();
  });
}

/* ── 과도한 목표 여부 ── */
function isExcessive(targetLoss, weeks) {
  if (!weeks || !targetLoss) return false;
  return (targetLoss / weeks) > 1.0;
}

/* ── BMI 표시 ── */
function renderBMI() {
  const { bmi } = Storage.getUser();
  if (!bmiValueEl || !bmiStatusEl) return;

  if (!bmi) {
    bmiValueEl.textContent  = '-';
    bmiStatusEl.textContent = '이전 단계 정보를 불러올 수 없습니다.';
    return;
  }

  const status = getBMIStatus(bmi);
  bmiValueEl.textContent  = bmi;
  bmiValueEl.style.color  = status.color;
  bmiStatusEl.textContent = `현재 BMI ${bmi}는 ${status.label} 범위입니다.`;
}

/* ── 목표 프리뷰 + 경고 갱신 ── */
function updateGoalInfo() {
  if (!goalInfoEl) return;

  const { weight: savedWeight } = Storage.getUser();
  const currentWeight = Number(savedWeight);
  const targetLoss    = Number(targetLossInput.value);
  const weeks         = getSelectedWeeks();
  const periodLabel   = goalPeriodInput.value === '기타'
    ? (weeks ? `${weeks}주` : '기타')
    : goalPeriodInput.value;

  /* ── 경고: targetLoss와 weeks 기준 ── */
  if (targetLoss && weeks) {
    if (isExcessive(targetLoss, weeks)) {
      const perWeek = (targetLoss / weeks).toFixed(1);
      showWarning(`주 ${perWeek}kg 감량은 권장 범위(주 1kg)를 초과합니다. 목표를 조정하거나 기간을 늘려주세요.`);
    } else {
      hideWarning();
    }
  } else {
    hideWarning();
  }

  /* ── 프리뷰는 모든 항목이 채워진 경우에만 표시 ── */
  if (!currentWeight || !targetLoss || !weeks) {
    goalInfoEl.textContent = '목표 감량과 기간을 입력하면 목표가 표시됩니다.';
    goalInfoEl.classList.add('muted');
    return;
  }

  const targetWeight = currentWeight - targetLoss;

  if (targetWeight <= 0) {
    goalInfoEl.textContent = '목표 감량 무게를 다시 확인해주세요.';
    goalInfoEl.classList.add('muted');
    return;
  }

  const perWeek = (targetLoss / weeks).toFixed(1);
  goalInfoEl.textContent = `${currentWeight}kg → ${targetWeight}kg | ${periodLabel} 동안 ${targetLoss}kg 감량 (주 ${perWeek}kg)`;
  goalInfoEl.classList.remove('muted');
}

function showWarning(msg) {
  if (!warningEl) return;
  warningEl.textContent = '⚠️ ' + msg;
  warningEl.classList.add('show');
}

function hideWarning() {
  if (!warningEl) return;
  warningEl.classList.remove('show');
}

/* ── 이벤트 바인딩 ── */
if (targetLossInput)    targetLossInput.addEventListener('input',  updateGoalInfo);

/* ── 폼 제출 ── */
if (bodyInfoForm2) {
  bodyInfoForm2.addEventListener('submit', function (e) {
    e.preventDefault();

    const { weight: savedWeight } = Storage.getUser();
    const currentWeight = Number(savedWeight);
    const targetLoss    = Number(targetLossInput.value);
    const weeks         = getSelectedWeeks();
    const periodLabel   = goalPeriodInput.value === '기타'
      ? `${weeks}주`
      : goalPeriodInput.value;

    if (!currentWeight || !targetLoss || !weeks) {
      showCustomConfirm({
        icon: '✏️', title: '입력을 확인해주세요',
        desc: '목표 감량과 달성 기간을 모두 입력해주세요.',
        okText: '확인', cancelText: null,
        onOk: () => {}
      });
      return;
    }
    if (weeks < 1 || weeks > 52) {
      showCustomConfirm({
        icon: '📅', title: '달성 기간을 확인해주세요',
        desc: '달성 기간은 <strong>1~52주</strong> 사이로 입력해주세요.',
        okText: '확인', cancelText: null,
        onOk: () => {}
      });
      return;
    }

    const targetWeight = currentWeight - targetLoss;
    if (targetWeight <= 0) {
      showCustomConfirm({
        icon: '⚠️', title: '목표 감량을 확인해주세요',
        desc: '목표 감량이 현재 체중보다 크거나 같아요.<br>다시 확인해주세요.',
        okText: '확인', cancelText: null,
        onOk: () => {}
      });
      return;
    }

    /* ── 최저 권장 체중 검증 (BMI 18.5 기준) ── */
    const { height: savedHeight } = Storage.getUser();
    const minSafe = calcMinSafeWeight(Number(savedHeight));
    if (targetWeight < minSafe) {
      showCustomConfirm({
        icon: '⚖️',
        title: '권장 체중 이하예요',
        desc: `목표 체중 <strong>${targetWeight}kg</strong>은 키 <strong>${savedHeight}cm</strong> 기준<br>최저 권장 체중 <strong style="color:var(--teal)">${minSafe}kg</strong>(BMI 18.5)보다 낮아요.<br><br>건강을 위해 <strong>${minSafe}kg 이상</strong>을 권장해요.`,
        okText: '그래도 저장',
        cancelText: '다시 설정',
        danger: true,
        onOk: () => {
          Storage.mergeUser({ initialWeight: currentWeight, targetLoss, goalPeriod: periodLabel, goalWeeks: weeks, targetWeight, activityLevel: '보통' });
          location.href = 'sc301.html';
        }
      });
      return;
    }

    if (isExcessive(targetLoss, weeks)) {
      showCustomConfirm({
        icon: '🏃',
        title: '감량 속도가 빠른 목표예요',
        desc: `권장 감량 속도는 <span class="teal">주 최대 1kg</span>이에요.<br>현재 설정은 <span class="warn">주 ${(targetLoss / weeks).toFixed(1)}kg</span>으로 건강에 무리가 올 수 있어요.<br><br>그래도 이 목표로 설정하시겠습니까?`,
        okText: '이대로 설정',
        cancelText: '다시 조정',
        danger: true,
        onOk: () => {
          Storage.mergeUser({ initialWeight: currentWeight, targetLoss, goalPeriod: periodLabel, goalWeeks: weeks, targetWeight, activityLevel: '보통' });
          location.href = 'sc301.html';
        }
      });
      return;
    }

    Storage.mergeUser({
      initialWeight: currentWeight,
      targetLoss,
      goalPeriod:    periodLabel,
      goalWeeks:     weeks,
      targetWeight,
      activityLevel: '보통',  /* 활동량 제거 — 기본값 고정 */
    });

    location.href = 'sc301.html';
  });
}

/* ── 초기 렌더 ── */
renderBMI();

/* ════════════════════════════════
   키 기반 최저 권장 체중 계산
   BMI 18.5 기준
   ════════════════════════════════ */
function calcMinSafeWeight(heightCm) {
  if (!heightCm || heightCm < 100) return 40; /* 키 없으면 기본 하한 */
  const h = heightCm / 100;
  return Math.round(18.5 * h * h * 10) / 10; /* 소수점 1자리 */
}
