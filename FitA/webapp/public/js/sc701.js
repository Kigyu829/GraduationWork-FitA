/* ============================================================
   sc701.js — 마이페이지
   의존: common.js

   [인증 체크]
   Storage.getRegistered().email 유무로 판단 (기존 프로젝트 방식 동일)

   [네비게이션]
   탭 대신 좌측 nav-item 클릭으로 섹션 전환

   [저장 방식]
   Firebase Auth (이메일/비밀번호 변경) + Firestore (유저 데이터) + localStorage 동기화
   ============================================================ */

'use strict';

/* ════════════════════════════════
   DOMContentLoaded
   ════════════════════════════════ */
window.addEventListener('DOMContentLoaded', async () => {
  const reg = Storage.getRegistered();  /* common.js */
  if (!reg.email) {
    location.href = 'sc201_1.html';
    return;
  }

  const userData = await fetchUser();
  if (!userData) return;

  renderSidebar(userData);
  renderBanner(userData);

  /* Firebase auth가 비동기라 currentUser가 아직 null일 수 있음 → auth 확정 후 그래프 렌더 */
  if (typeof auth !== 'undefined') {
    const unsub = auth.onAuthStateChanged(user => {
      unsub();
      if (user) sessionStorage.setItem('_fitUid', user.uid);
      renderWeightGraph();
    });
  } else {
    renderWeightGraph();
  }

  loadProfileForm(userData);
  loadBodyForm(userData);
  loadGoalForm(userData);
  loadAccountForm(userData);

  bindNavItems();
  bindAvatarUpload();
  bindProfileSave();
  bindBodySave();
  bindGoalSave(userData);
  bindAccountSave();
  bindDangerZone();
  bindCancelBtns();
  bindActivitySave();    /* FitA 활동량 저장 */
  initCommonOverlays();  /* AI상담 오버레이 + 히스토리 sc602 이동 */
  bindMenuBtns();   /* common.js */
  bindLogout();
  bindLogoClick();
});

/* ════════════════════════════════
   유저 데이터 로드 (Firestore → localStorage 폴백)
   ════════════════════════════════ */
async function fetchUser() {
  const uid = getCurrentUid();
  const reg = Storage.getRegistered();
  if (uid && typeof db !== 'undefined') {
    try {
      const doc = await db.collection('users').doc(uid).get();
      if (doc.exists) {
        const data = doc.data().userData || {};
        return { email: reg.email, nickname: reg.nickname, ...data };
      }
    } catch (err) {
      console.warn('Firestore 로드 실패, localStorage 사용:', err.message);
    }
  }
  return buildLocalData();
}

function buildLocalData() {
  const reg  = Storage.getRegistered();
  const data = Storage.getUser();
  return { email: reg.email, nickname: reg.nickname, ...data };
}

/* ════════════════════════════════
   앱 사이드바 렌더
   ════════════════════════════════ */
function renderSidebar(data) {
  const nameEl   = document.getElementById('userName');
  const infoEl   = document.getElementById('userBasicInfo');
  const cwEl     = document.getElementById('currentWeightText');
  const twEl     = document.getElementById('targetWeightText');
  const avatarEl = document.getElementById('profileAvatar') || document.getElementById('sidebarAvatar');

  if (nameEl) nameEl.textContent = data.nickname ? `${data.nickname}님` : '사용자';
  if (infoEl) {
    const parts = [];
    if (data.gender) parts.push(data.gender);
    if (data.height) parts.push(`키 ${data.height}cm`);
    infoEl.textContent = parts.join(' · ') || '기본 정보 없음';
  }
  if (cwEl) cwEl.textContent = data.weight       ? `${data.weight}kg`       : '-';
  if (twEl) twEl.textContent = data.targetWeight  ? `${data.targetWeight}kg` : '-';

  const _uid0 = getCurrentUid();
  const saved = localStorage.getItem(_uid0 ? `profileAvatar_${_uid0}` : 'profileAvatar') || Storage.getUser().avatarUrl || null;
  if (saved && avatarEl) avatarEl.innerHTML = `<img src="${saved}" alt="프로필" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />`;
}

/* ════════════════════════════════
   웰컴 배너 렌더
   ════════════════════════════════ */
function renderBanner(data) {
  setTextSafe('heroName',        data.nickname || '사용자');
  setTextSafe('heroEmail',       data.email    || '이메일 미설정');
  setTextSafe('heroBadgeGender', data.gender   || '—');

  const ageBadge = document.getElementById('heroBadgeAge');
  if (ageBadge && data.birth) {
    const age = new Date().getFullYear() - Number(data.birth.slice(0, 4));
    ageBadge.textContent = `${age}세`;
  }

  const bmiBadge = document.getElementById('heroBadgeBMI');
  if (bmiBadge) {
    const bmi = data.bmi || calculateBMI(data.height, data.weight);
    bmiBadge.textContent = bmi ? `BMI ${bmi}` : 'BMI —';
  }

  setTextSafe('bannerCurrentWeight', data.weight       ? `${data.weight}kg`       : '—');
  setTextSafe('bannerTargetWeight',  data.targetWeight  ? `${data.targetWeight}kg` : '—');
  setTextSafe('bannerTargetLoss',    data.targetLoss    ? `${data.targetLoss}kg`   : '—');

  const _uid1 = getCurrentUid();
  const saved      = localStorage.getItem(_uid1 ? `profileAvatar_${_uid1}` : 'profileAvatar') || Storage.getUser().avatarUrl || null;
  const heroAvatar = document.getElementById('heroAvatar');
  if (saved && heroAvatar) heroAvatar.innerHTML = `<img src="${saved}" alt="프로필" />`;
}

/* ════════════════════════════════
   프로필 사진 업로드
   ════════════════════════════════ */
function bindAvatarUpload() {
  const fileInput = document.getElementById('avatarInput') || document.getElementById('avatarFileInput');
  if (!fileInput) return;

  fileInput.addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function (e) {
      const dataUrl = e.target.result;
      const _uid2 = getCurrentUid();
      localStorage.setItem(_uid2 ? `profileAvatar_${_uid2}` : 'profileAvatar', dataUrl);

      const imgTag = `<img src="${dataUrl}" alt="프로필" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />`;
      const el1 = document.getElementById('heroAvatar') || document.getElementById('profileAvatar');
      const el2 = document.getElementById('sidebarAvatar');
      if (el1) el1.innerHTML = imgTag;
      if (el2) el2.innerHTML = imgTag;

      showToast('✅ 프로필 사진이 변경됐어요.', 'success');

      /* Firebase Storage 업로드 → Firestore에 URL 저장 */
      const uid = getCurrentUid();
      if (uid && typeof storage !== 'undefined') {
        try {
          const ref = storage.ref(`avatarImages/${uid}/profile.jpg`);
          await ref.putString(dataUrl, 'data_url');
          const downloadUrl = await ref.getDownloadURL();
          Storage.mergeUser({ avatarUrl: downloadUrl });
        } catch (err) {
          console.error('아바타 Storage 업로드 실패:', err);
        }
      }
    };
    reader.readAsDataURL(file);
  });
}

/* ════════════════════════════════
   좌측 네비 전환
   ════════════════════════════════ */
function bindNavItems() {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.form-section');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n  => n.classList.remove('active'));
      sections.forEach(s  => s.classList.remove('active'));

      item.classList.add('active');
      const target = document.getElementById(item.dataset.section);
      if (target) target.classList.add('active');
    });
  });
}

/* ── 취소 버튼: 폼 값 복원 ── */
function bindCancelBtns() {
  document.querySelectorAll('.btn-cancel').forEach(btn => {
    btn.addEventListener('click', async () => {
      const fresh = await fetchUser();
      if (!fresh) return;
      loadProfileForm(fresh);
      loadBodyForm(fresh);
      loadGoalForm(fresh);
      loadAccountForm(fresh);
    });
  });
}

/* ════════════════════════════════
   섹션1: 프로필(닉네임) 수정
   ════════════════════════════════ */
function loadProfileForm(data) {
  setVal('inputNickname', data.nickname);
}

function bindProfileSave() {
  document.getElementById('btnSaveNickname')?.addEventListener('click', async () => {
    const nickname = document.getElementById('inputNickname')?.value.trim();
    if (!nickname) { showToast('닉네임을 입력해주세요.', 'error'); return; }

    const reg = Storage.getRegistered();
    Storage.setRegistered(reg.email, '', nickname);

    /* Firestore users/{uid}.nickname 갱신 */
    const uid = getCurrentUid();
    if (uid && typeof db !== 'undefined') {
      db.collection('users').doc(uid).update({ nickname }).catch(console.error);
    }

    setTextSafe('userName',  `${nickname}님`);
    setTextSafe('heroName',  nickname);
    showToast('✅ 닉네임이 변경됐어요.', 'success');
  });
}

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

/* ════════════════════════════════
   섹션4·5: 이메일 + 비밀번호 변경
   ════════════════════════════════ */
function loadAccountForm(data) {
  setVal('inputEmail', data.email);
}

function bindAccountSave() {
  /* 이메일 변경 */
  document.getElementById('btnSaveEmail')?.addEventListener('click', async () => {
    const newEmail  = document.getElementById('inputEmail')?.value.trim();
    const pwConfirm = document.getElementById('inputEmailPwConfirm')?.value;

    if (!newEmail)  { showToast('이메일을 입력해주세요.', 'error'); return; }
    if (!pwConfirm) { showToast('현재 비밀번호를 입력해주세요.', 'error'); return; }

    const user = typeof auth !== 'undefined' ? auth.currentUser : null;
    if (!user) { showToast('로그인 상태를 확인해주세요.', 'error'); return; }

    try {
      const cred = firebase.auth.EmailAuthProvider.credential(user.email, pwConfirm);
      await user.reauthenticateWithCredential(cred);
      await user.updateEmail(newEmail);
    } catch (e) {
      const msg = e.code === 'auth/wrong-password' ? '현재 비밀번호가 올바르지 않아요.' : '변경에 실패했어요.';
      showToast(msg, 'error'); return;
    }

    const reg = Storage.getRegistered();
    Storage.setRegistered(newEmail, '', reg.nickname);
    setTextSafe('heroEmail', newEmail);
    document.getElementById('inputEmailPwConfirm').value = '';
    showToast('✅ 이메일이 변경됐어요.', 'success');
  });

  /* 비밀번호 강도 표시 */
  document.getElementById('inputNewPw')?.addEventListener('input', function () {
    const pw    = this.value;
    const wrap  = document.getElementById('pwStrengthWrap');
    const fill  = document.getElementById('pwStrengthFill');
    const label = document.getElementById('pwStrengthLabel');

    if (!pw) { if (wrap) wrap.style.display = 'none'; return; }
    if (wrap) wrap.style.display = 'flex';

    const levels = [
      { pct: '25%',  color: 'var(--red,#FF0B55)',   text: '매우 약함' },
      { pct: '50%',  color: '#F5A623',               text: '약함'     },
      { pct: '75%',  color: '#5BA4E6',               text: '보통'     },
      { pct: '100%', color: 'var(--teal,#66D0BC)',   text: '강함'     },
    ];
    const level = levels[Math.min(getPwStrength(pw), 3)];
    if (fill)  { fill.style.width = level.pct; fill.style.background = level.color; }
    if (label) { label.textContent = level.text; label.style.color = level.color; }
  });

  /* 비밀번호 변경 */
  document.getElementById('btnSavePw')?.addEventListener('click', async () => {
    const currentPw = document.getElementById('inputCurrentPw')?.value;
    const newPw     = document.getElementById('inputNewPw')?.value;
    const newPwConf = document.getElementById('inputNewPwConfirm')?.value;

    if (!currentPw)                { showToast('현재 비밀번호를 입력해주세요.', 'error'); return; }
    if (!newPw || newPw.length < 8){ showToast('새 비밀번호는 8자 이상이어야 해요.', 'error'); return; }
    if (newPw !== newPwConf)       { showToast('새 비밀번호가 일치하지 않아요.', 'error'); return; }

    const user = typeof auth !== 'undefined' ? auth.currentUser : null;
    if (!user) { showToast('로그인 상태를 확인해주세요.', 'error'); return; }

    try {
      const cred = firebase.auth.EmailAuthProvider.credential(user.email, currentPw);
      await user.reauthenticateWithCredential(cred);
      await user.updatePassword(newPw);
    } catch (e) {
      const msg = e.code === 'auth/wrong-password' ? '현재 비밀번호가 올바르지 않아요.' : '변경에 실패했어요.';
      showToast(msg, 'error'); return;
    }

    ['inputCurrentPw', 'inputNewPw', 'inputNewPwConfirm'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const wrap = document.getElementById('pwStrengthWrap');
    if (wrap) wrap.style.display = 'none';
    showToast('✅ 비밀번호가 변경됐어요.', 'success');
  });
}

function getPwStrength(pw) {
  let score = 0;
  if (pw.length >= 8)                        score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw))                         score++;
  if (/[^A-Za-z0-9]/.test(pw))              score++;
  return Math.max(0, score - 1);
}

/* ════════════════════════════════
   섹션6: 위험 구역
   ════════════════════════════════ */
function bindDangerZone() {
  document.getElementById('btnResetData')?.addEventListener('click', () => {
    showCustomConfirm({
      icon: '⚠️',
      title: '건강 데이터 초기화',
      desc: '모든 건강 데이터(신체정보, 목표, 기록)가 삭제됩니다.<br>계속하시겠습니까?',
      okText: '초기화',
      cancelText: '취소',
      danger: true,
      onOk: () => {
        Storage.setUser({});
        showToast('✅ 건강 데이터가 초기화됐어요.', 'success');
        setTimeout(() => { location.href = 'sc202.html'; }, 1200);
      }
    });
  });

  (document.getElementById('btnDeleteAccount') || document.getElementById('withdrawBtn'))?.addEventListener('click', () => {
    showCustomConfirm({
      icon: '⚠️',
      title: '정말 탈퇴하시겠어요?',
      desc: `계정을 탈퇴하면 모든 정보가 삭제되며 복구할 수 없습니다.<br><br>
             <input id="_deletePwInput" type="password" placeholder="현재 비밀번호 입력"
               style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);
                      background:rgba(255,255,255,0.07);color:#fff;font-size:14px;box-sizing:border-box;">`,
      okText: '탈퇴하기',
      cancelText: '취소',
      danger: true,
      onOk: async () => {
        const currentPw = document.getElementById('_deletePwInput')?.value;
        if (!currentPw) { showToast('비밀번호를 입력해주세요.', 'error'); return; }

        const user = typeof auth !== 'undefined' ? auth.currentUser : null;
        if (user) {
          try {
            const cred = firebase.auth.EmailAuthProvider.credential(user.email, currentPw);
            await user.reauthenticateWithCredential(cred);
            try { await db.collection('users').doc(user.uid).delete(); } catch { /* 폴백 */ }
            await user.delete();
          } catch (e) {
            showToast('비밀번호가 올바르지 않아요.', 'error'); return;
          }
        }

        Storage.clearAll();
        location.href = 'sc101.html';
      }
    });
  });
}

/* ════════════════════════════════
   토스트
   ════════════════════════════════ */
let toastTimer = null;
function showToast(msg, type = '') {
  const toast = document.getElementById('toastMsg') || document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className   = `toast show${type ? ' ' + type : ''}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

/* ════════════════════════════════
   유틸
   ════════════════════════════════ */
function setVal(id, value) {
  const el = document.getElementById(id);
  if (el && value !== undefined && value !== null) el.value = value;
}
function setTextSafe(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/* ════════════════════════════════
   키 기반 최저 권장 체중 계산 (BMI 18.5)
   ════════════════════════════════ */
function calcMinSafeWeight(heightCm) {
  if (!heightCm || heightCm < 100) return 40;
  const h = heightCm / 100;
  return Math.round(18.5 * h * h * 10) / 10;
}

/* ════════════════════════════════
   체중 변화 그래프
   ════════════════════════════════ */
async function renderWeightGraph() {
  const svg       = document.getElementById('weightGraphSvg');
  const labelsEl  = document.getElementById('weightGraphLabels');
  const emptyEl   = document.getElementById('weightGraphEmpty');
  if (!svg) return;

  const uid = getCurrentUid();
  if (!uid) return;   /* auth 미확정 — onAuthStateChanged 후 재호출됨 */
  const points = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const key     = `todayWeight_check_${uid}_${dateStr}`;
    const val     = parseFloat(localStorage.getItem(key));
    points.push({ dateStr, weight: isNaN(val) ? null : val, dayLabel: `${d.getMonth()+1}/${d.getDate()}` });
  }

  /* localStorage에 없는 날짜를 Firestore에서 보완 */
  if (points.some(p => p.weight === null) && typeof db !== 'undefined') {
    try {
      const snap = await db.collection('users').doc(uid).collection('daily')
        .where(firebase.firestore.FieldPath.documentId(), '>=', points[0].dateStr)
        .where(firebase.firestore.FieldPath.documentId(), '<=', points[points.length - 1].dateStr)
        .get();
      snap.forEach(doc => {
        const data = doc.data();
        if (typeof data.weight !== 'number') return;
        const pt = points.find(p => p.dateStr === doc.id);
        if (pt && pt.weight === null) {
          pt.weight = data.weight;
          localStorage.setItem(`todayWeight_check_${uid}_${doc.id}`, String(data.weight));
        }
      });
    } catch { /* 네트워크 오류 — localStorage 데이터만 사용 */ }
  }

  const valid = points.filter(p => p.weight !== null);
  if (valid.length < 2) {
    if (svg)     svg.style.display    = 'none';
    if (labelsEl) labelsEl.style.display = 'none';
    if (emptyEl)  emptyEl.style.display  = 'block';
    return;
  }

  const weights = valid.map(p => p.weight);
  const minW    = Math.floor(Math.min(...weights) - 1);
  const maxW    = Math.ceil(Math.max(...weights)  + 1);
  const rangeW  = maxW - minW || 1;

  const W = 300, H = 160, padL = 30, padR = 8, padT = 10, padB = 10;
  const gW = W - padL - padR;
  const gH = H - padT - padB;

  function xOf(idx)    { return padL + (idx / (points.length - 1)) * gW; }
  function yOf(weight) { return padT + (1 - (weight - minW) / rangeW) * gH; }

  /* Y축 라벨 (최대, 중간, 최소) */
  const midW   = ((maxW + minW) / 2).toFixed(1);
  const yLines = [
    { val: maxW, y: yOf(maxW) },
    { val: midW, y: yOf(parseFloat(midW)) },
    { val: minW, y: yOf(minW) },
  ];

  let svgHtml = '';

  /* 격자선 */
  yLines.forEach(({ y, val }) => {
    svgHtml += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>`;
    svgHtml += `<text x="${padL - 4}" y="${y + 3.5}" text-anchor="end" font-size="8" fill="rgba(255,255,255,0.35)">${val}</text>`;
  });

  /* 면적 채우기 */
  const firstValid = valid[0];
  const lastValid  = valid[valid.length - 1];
  const pathD = valid.map((p, i) => {
    const allIdx = points.findIndex(q => q.dateStr === p.dateStr);
    return `${i === 0 ? 'M' : 'L'}${xOf(allIdx)},${yOf(p.weight)}`;
  }).join(' ');
  const fillD = `${pathD} L${xOf(points.findIndex(q => q.dateStr === lastValid.dateStr))},${H - padB} L${xOf(points.findIndex(q => q.dateStr === firstValid.dateStr))},${H - padB} Z`;

  svgHtml += `<defs>
    <linearGradient id="wgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(102,208,188,0.35)"/>
      <stop offset="100%" stop-color="rgba(102,208,188,0)"/>
    </linearGradient>
  </defs>`;
  svgHtml += `<path d="${fillD}" fill="url(#wgGrad)" stroke="none"/>`;
  svgHtml += `<path d="${pathD}" fill="none" stroke="var(--teal,#66D0BC)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;

  /* 점 + 툴팁 */
  valid.forEach(p => {
    const allIdx = points.findIndex(q => q.dateStr === p.dateStr);
    const cx = xOf(allIdx), cy = yOf(p.weight);
    svgHtml += `<circle cx="${cx}" cy="${cy}" r="3.5" fill="var(--teal,#66D0BC)" stroke="var(--card,#1a2632)" stroke-width="1.5"/>`;
    svgHtml += `<title>${p.dayLabel}: ${p.weight}kg</title>`;
  });

  svg.innerHTML = svgHtml;

  /* X축 라벨 — 7일 간격 */
  if (labelsEl) {
    const labelPoints = points.filter((_, i) => i % 7 === 0 || i === points.length - 1);
    labelsEl.innerHTML = '';
    const totalW = svg.getBoundingClientRect().width || 300;
    labelPoints.forEach(p => {
      const allIdx = points.findIndex(q => q.dateStr === p.dateStr);
      const span   = document.createElement('span');
      span.textContent  = p.dayLabel;
      span.style.cssText = `position:absolute;left:${(padL + (allIdx / (points.length-1)) * gW) / W * 100}%;transform:translateX(-50%);font-size:9px;color:rgba(255,255,255,0.4);`;
      labelsEl.appendChild(span);
    });
    labelsEl.style.position = 'relative';
    labelsEl.style.height   = '14px';
  }
}