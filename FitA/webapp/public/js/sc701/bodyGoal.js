'use strict';

/* ════════════════════════════════
   sc701/bodyGoal.js
   신체 정보 수정, 활동량 설정, 목표 재설정
   의존: utils.js  (setVal, setTextSafe, buildLocalData, calcMinSafeWeight, showToast)
        profile.js (renderSidebar, renderBanner)
        common.js  (Storage, calculateBMI, getBMIStatus, showCustomConfirm)
   ════════════════════════════════ */

/* ════════════════════════════════
   섹션2: 신체 정보 수정
   ════════════════════════════════ */
function loadBodyForm(data) {
  setVal('inputGender',     data.gender);
  setVal('inputBirth',      data.birth);
  setVal('inputHeight',     data.height);
  setVal('inputWeight',     data.weight);
  setVal('mpHeight',        data.height);
  setVal('mpWeight',        data.weight);
  setVal('mpTargetWeight',  data.targetWeight);
  updateBmiMini();

  ['inputHeight', 'inputWeight', 'mpHeight', 'mpWeight'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateBmiMini);
  });
  ['inputWeight', 'mpWeight'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => updateGoalPreview(Storage.getUser()));
  });
}

function updateBmiMini() {
  const height = (document.getElementById('mpHeight') || document.getElementById('inputHeight'))?.value;
  const weight = (document.getElementById('mpWeight') || document.getElementById('inputWeight'))?.value;

  /* FitA: mpBmiDisplay 단일 div */
  const bmiDisplay = document.getElementById('mpBmiDisplay');
  if (bmiDisplay) {
    if (!height || !weight) { bmiDisplay.textContent = ''; return; }
    const bmi    = calculateBMI(height, weight);
    const status = getBMIStatus(bmi);
    bmiDisplay.textContent = `BMI ${bmi} · ${status.label}`;
    bmiDisplay.style.color = status.color;
    return;
  }

  /* project_web: bmiMiniRow 구조 */
  const row   = document.getElementById('bmiMiniRow');
  const valEl = document.getElementById('bmiMiniValue');
  const stEl  = document.getElementById('bmiMiniStatus');
  if (!row) return;
  if (!height || !weight) { row.style.display = 'none'; return; }
  const bmi    = calculateBMI(height, weight);
  const status = getBMIStatus(bmi);
  row.style.display = 'grid';
  if (valEl) { valEl.textContent = bmi; valEl.style.color = status.color; }
  if (stEl)  stEl.textContent = status.label;
}

function bindBodySave() {
  /* FitA: form submit 이벤트 (saveBodyBtn이 type=submit) */
  document.getElementById('bodyInfoForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const height       = document.getElementById('mpHeight')?.value;
    const weight       = document.getElementById('mpWeight')?.value;
    const targetWeight = document.getElementById('mpTargetWeight')?.value;
    const gender       = document.getElementById('inputGender')?.value;
    const birth        = document.getElementById('inputBirth')?.value;
    if (!height || !weight) { showToast('키와 체중은 필수 입력이에요.', 'error'); return; }
    const minSafeBody = calcMinSafeWeight(Number(height));
    if (Number(weight) < minSafeBody) {
      showCustomConfirm({
        icon: '⚖️', title: '권장 체중 이하예요',
        desc: `입력한 체중 <strong>${weight}kg</strong>은 최저 권장 체중 <strong>${minSafeBody}kg</strong>(BMI 18.5)보다 낮아요.`,
        okText: '그래도 저장', cancelText: '다시 입력', danger: true,
        onOk: () => _doSaveBody(height, weight, gender, birth, targetWeight)
      });
      return;
    }
    _doSaveBody(height, weight, gender, birth, targetWeight);
  });

  /* project_web: 버튼 클릭 이벤트 */
  document.getElementById('btnSaveBody')?.addEventListener('click', async () => {
    const height = document.getElementById('inputHeight')?.value;
    const weight = document.getElementById('inputWeight')?.value;
    const gender = document.getElementById('inputGender')?.value;
    const birth  = document.getElementById('inputBirth')?.value;

    if (!height || !weight) { showToast('키와 체중은 필수 입력이에요.', 'error'); return; }

    /* ── 체중 검증 1: 최저 권장 체중 ── */
    const minSafeBody = calcMinSafeWeight(Number(height));
    if (Number(weight) < minSafeBody) {
      showCustomConfirm({
        icon: '⚖️',
        title: '권장 체중 이하예요',
        desc: `입력한 체중 <strong>${weight}kg</strong>은 키 <strong>${height}cm</strong> 기준<br>최저 권장 체중 <strong style="color:var(--teal)">${minSafeBody}kg</strong>(BMI 18.5)보다 낮아요.<br><br>실수가 아닌지 확인해주세요.`,
        okText: '그래도 저장',
        cancelText: '다시 입력',
        danger: true,
        onOk: () => _doSaveBody(height, weight, gender, birth)
      });
      return;
    }

    /* ── 체중 검증 2: 이전 체중 대비 급격한 변화 ── */
    const prevWeight = Number(Storage.getUser().weight || 0);
    if (prevWeight > 0 && Math.abs(Number(weight) - prevWeight) >= 5) {
      const diff = (Number(weight) - prevWeight).toFixed(1);
      const sign = diff > 0 ? '+' : '';
      showCustomConfirm({
        icon: '📊',
        title: '체중 변화가 커요',
        desc: `기존 체중 <strong>${prevWeight}kg</strong> → 새 체중 <strong>${weight}kg</strong><br>차이가 <strong style="color:var(--red)">${sign}${diff}kg</strong>이에요.<br><br>정말 <strong>${weight}kg</strong>으로 저장할까요?`,
        okText: '그래도 저장',
        cancelText: '다시 입력',
        onOk: () => _doSaveBody(height, weight, gender, birth)
      });
      return;
    }

    _doSaveBody(height, weight, gender, birth);
  });

  async function _doSaveBody(height, weight, gender, birth, targetWeight) {
    const bmi = calculateBMI(height, weight);
    const update = { height, weight, gender, birth, bmi };
    if (targetWeight) update.targetWeight = targetWeight;
    Storage.mergeUser(update);

    const fresh = buildLocalData();
    renderSidebar(fresh);
    renderBanner(fresh);
    showToast('✅ 신체 정보가 저장됐어요.', 'success');
  }
}

/* ════════════════════════════════
   FitA 활동량 저장
   ════════════════════════════════ */
function bindActivitySave() {
  document.getElementById('activityForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const activityLevel = document.getElementById('mpActivityLevel')?.value;
    if (!activityLevel) return;
    Storage.mergeUser({ activityLevel });
    showToast('✅ 활동량이 저장됐어요.', 'success');
  });
}

/* ════════════════════════════════
   섹션3: 목표 재설정
   ════════════════════════════════ */
function loadGoalForm(data) {
  setTextSafe('statInitialWeight', data.initialWeight ? `${data.initialWeight}kg` : '—');
  setTextSafe('statTargetWeight',  data.targetWeight  ? `${data.targetWeight}kg`  : '—');
  setTextSafe('statTargetLoss',    data.targetLoss    ? `${data.targetLoss}kg`    : '—');
  setTextSafe('statGoalPeriod',    data.goalPeriod    || '—');
  setTextSafe('statActivityLevel', data.activityLevel || '—');

  setVal('inputActivityLevel',  data.activityLevel);
  setVal('mpActivityLevel',     data.activityLevel); /* FitA */
  setVal('inputTargetLoss',    data.targetLoss);

  const standardPeriods = ['4주', '8주', '12주', '16주'];
  if (data.goalPeriod && standardPeriods.includes(data.goalPeriod)) {
    setVal('inputGoalPeriod', data.goalPeriod);
  } else if (data.goalPeriod) {
    setVal('inputGoalPeriod', '기타');
    const cw = document.getElementById('customWeeksWrap');
    if (cw) cw.style.display = 'block';
    setVal('inputCustomWeeks', data.goalWeeks);
  }

  const periodSel  = document.getElementById('inputGoalPeriod');
  const customWrap = document.getElementById('customWeeksWrap');

  periodSel?.addEventListener('change', () => {
    if (customWrap) customWrap.style.display = periodSel.value === '기타' ? 'block' : 'none';
    if (periodSel.value !== '기타') {
      const el = document.getElementById('inputCustomWeeks');
      if (el) el.value = '';
    }
    updateGoalPreview(data);
  });

  document.getElementById('inputCustomWeeks')?.addEventListener('input', () => {
    const w    = parseInt(document.getElementById('inputCustomWeeks').value, 10);
    const hint = document.getElementById('customWeeksHint');
    if (hint) {
      hint.textContent = !w || w < 1 ? '1주 이상 입력해주세요.'
                       : w > 52      ? '최대 52주(1년)까지 입력 가능합니다.'
                       : '';
    }
    updateGoalPreview(data);
  });

  ['inputActivityLevel', 'inputTargetLoss'].forEach(id => {
    document.getElementById(id)?.addEventListener('input',  () => updateGoalPreview(data));
    document.getElementById(id)?.addEventListener('change', () => updateGoalPreview(data));
  });
}

function getGoalWeeks() {
  const val = document.getElementById('inputGoalPeriod')?.value;
  if (val === '기타') {
    const w = parseInt(document.getElementById('inputCustomWeeks')?.value, 10);
    return (!w || w < 1) ? null : w;
  }
  return { '4주': 4, '8주': 8, '12주': 12, '16주': 16 }[val] || null;
}

function getGoalPeriodLabel() {
  const val = document.getElementById('inputGoalPeriod')?.value;
  if (val === '기타') { const w = getGoalWeeks(); return w ? `${w}주` : '기타'; }
  return val || '';
}

function updateGoalPreview(data) {
  const currentW    = Number(data?.weight || Storage.getUser().weight || 0);
  const targetLoss  = Number(document.getElementById('inputTargetLoss')?.value || 0);
  const weeks       = getGoalWeeks();
  const activity    = document.getElementById('inputActivityLevel')?.value;
  const periodLabel = getGoalPeriodLabel();

  const previewEl  = document.getElementById('goalPreviewText');
  const warningBox = document.getElementById('goalWarningBox');

  if (warningBox) {
    if (targetLoss && weeks && targetLoss / weeks > 1.0) {
      warningBox.style.display = 'block';
      warningBox.textContent   = `⚠️ 주 ${(targetLoss / weeks).toFixed(1)}kg 감량은 권장 범위(주 1kg)를 초과합니다.`;
    } else {
      warningBox.style.display = 'none';
    }
  }

  if (!previewEl) return;
  if (!currentW || !targetLoss || !weeks || !activity) {
    previewEl.textContent = '목표 감량과 기간을 입력하면 표시됩니다.';
    previewEl.classList.add('muted');
    return;
  }

  const targetWeight = currentW - targetLoss;
  if (targetWeight <= 0) {
    previewEl.textContent = '목표 감량 무게를 다시 확인해주세요.';
    previewEl.classList.add('muted');
    return;
  }

  previewEl.textContent = `${currentW}kg → ${targetWeight}kg | ${periodLabel} 동안 ${targetLoss}kg 감량 (주 ${(targetLoss / weeks).toFixed(1)}kg)`;
  previewEl.classList.remove('muted');
}

function bindGoalSave(userData) {
  document.getElementById('btnSaveGoal')?.addEventListener('click', async () => {
    const currentW    = Number(Storage.getUser().weight || userData?.weight || 0);
    const targetLoss  = Number(document.getElementById('inputTargetLoss')?.value);
    const weeks       = getGoalWeeks();
    const activity    = document.getElementById('inputActivityLevel')?.value;
    const periodLabel = getGoalPeriodLabel();

    if (!targetLoss || !weeks || !activity) { showToast('모든 항목을 입력해주세요.', 'error'); return; }
    if (weeks < 1 || weeks > 52)            { showToast('달성 기간은 1~52주 사이로 입력해주세요.', 'error'); return; }

    const targetWeight = currentW - targetLoss;
    if (targetWeight <= 0) { showToast('목표 감량 무게를 다시 확인해주세요.', 'error'); return; }

    /* ── 최저 권장 체중 검증 (BMI 18.5) ── */
    const savedHeight = Storage.getUser().height;
    const minSafe     = calcMinSafeWeight(Number(savedHeight));
    if (targetWeight < minSafe) {
      showCustomConfirm({
        icon: '⚠️',
        title: '목표 체중이 너무 낮아요',
        desc: `목표 체중 <strong>${targetWeight}kg</strong>은 키 <strong>${savedHeight}cm</strong> 기준<br>최저 권장 체중 <span class="teal">${minSafe}kg</span>(BMI 18.5)보다 낮아요.<br><br>건강을 위해 <span class="teal">${minSafe}kg 이상</span>을 권장해요.`,
        okText: '그래도 저장',
        cancelText: '다시 설정',
        danger: true,
        onOk: () => _doSaveGoal(currentW, targetLoss, periodLabel, weeks, targetWeight, activity)
      });
      return;
    }

    if (targetLoss / weeks > 1.0) {
      showCustomConfirm({
        icon: '🏃',
        title: '감량 속도가 빠른 목표예요',
        desc: `권장 감량 속도는 <span class="teal">주 최대 1kg</span>이에요.<br>현재 설정은 <span class="warn">주 ${(targetLoss / weeks).toFixed(1)}kg</span>으로 건강에 무리가 올 수 있어요.`,
        okText: '이대로 저장',
        cancelText: '다시 조정',
        danger: true,
        onOk: () => _doSaveGoal(currentW, targetLoss, periodLabel, weeks, targetWeight, activity)
      });
      return;
    }

    _doSaveGoal(currentW, targetLoss, periodLabel, weeks, targetWeight, activity);
  });

  async function _doSaveGoal(currentW, targetLoss, periodLabel, weeks, targetWeight, activity) {
    const goalData = { initialWeight: currentW, targetLoss, goalPeriod: periodLabel, goalWeeks: weeks, targetWeight, activityLevel: activity };
    Storage.mergeUser(goalData);

    setTextSafe('statInitialWeight', `${currentW}kg`);
    setTextSafe('statTargetWeight',  `${targetWeight}kg`);
    setTextSafe('statTargetLoss',    `${targetLoss}kg`);
    setTextSafe('statGoalPeriod',    periodLabel);
    setTextSafe('statActivityLevel', activity);

    const fresh = buildLocalData();
    renderSidebar(fresh);
    renderBanner(fresh);
    showToast('✅ 목표가 재설정됐어요.', 'success');
  }
}
