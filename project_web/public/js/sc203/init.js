'use strict';

/* ============================================================
   sc203/init.js — 폼 제출 처리 및 초기 렌더
   의존: sc203/utils.js, sc203/goal.js, common.js
   ============================================================ */

/* ── 폼 제출 ── */
if (bodyInfoForm2) {
  bodyInfoForm2.addEventListener('submit', function (e) {
    e.preventDefault();

    const { weight: savedWeight } = Storage.getUser();
    const currentWeight = Number(savedWeight);
    const targetLoss    = Number(targetLossInput.value);
    const weeks         = getSelectedWeeks();
    const activityLevel = activityLevelInput.value;
    const periodLabel   = goalPeriodInput.value === '기타'
      ? `${weeks}주`
      : goalPeriodInput.value;

    if (!currentWeight || !targetLoss || !weeks || !activityLevel) {
      showCustomConfirm({
        icon: '✏️', title: '입력을 확인해주세요',
        desc: '모든 항목을 입력해주세요.',
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
          Storage.mergeUser({ initialWeight: currentWeight, targetLoss, goalPeriod: periodLabel, goalWeeks: weeks, targetWeight, activityLevel });
          location.href = 'sc302.html';
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
          Storage.mergeUser({ initialWeight: currentWeight, targetLoss, goalPeriod: periodLabel, goalWeeks: weeks, targetWeight, activityLevel });
          location.href = 'sc302.html';
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
      activityLevel,
    });

    location.href = 'sc302.html';
  });
}

/* ── 초기 렌더 ── */
renderBMI();
